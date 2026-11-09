import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, Check, PostContent, Store, Submission } from '../../src/lib/admin/types.ts';
import { fakeRepo, storeExtras } from './admin-fakes.ts';

vi.mock('../../src/lib/admin/env.ts', () => ({ env: () => undefined }));
vi.mock('../../src/lib/admin/harness.ts', () => ({ checkPost: () => [] }));

const wf = await import('../../src/lib/admin/workflow.ts');
const { StaleWriteError } = await import('../../src/lib/admin/store.ts');
const { RepoRateLimitError } = await import('../../src/lib/admin/repo.ts');
const { parsePost, serializePost } = await import('../../src/lib/admin/mdx-file.ts');

const editor: AdminUser = { email: 'ed@x.com', name: 'Ed', role: 'editor' };
const boss: AdminUser = { email: 'boss@x.com', name: 'Boss', role: 'approver' };
const boss2: AdminUser = { email: 'two@x.com', name: 'Two', role: 'approver' };
const ANSWERS = { onlyUsCouldWrite: 'Our own clinic numbers.', readsMachineWritten: 'No.' };

/** In memory, with the same atomic check the real stores make. */
function memoryStore() {
  const docs = new Map<string, string>();
  const store: Store & { failNext: number } = {
    failNext: 0,
    getSubmission: async (id) => (docs.has(id) ? JSON.parse(docs.get(id)!) : null),
    listSubmissions: async () => [...docs.values()].map((d) => JSON.parse(d)),
    async putSubmission(value, expected) {
      if (store.failNext > 0) {
        store.failNext--;
        throw new Error('database down');
      }
      if (expected !== undefined && (docs.has(value.id) ? JSON.parse(docs.get(value.id)!).updatedAt : undefined) !== expected) throw new StaleWriteError();
      docs.set(value.id, JSON.stringify(value));
    },
    getJob: async () => null,
    listJobs: async () => [],
    putJob: async () => {},
    ...storeExtras(async () => [...docs.values()].map((d) => JSON.parse(d)), (id) => docs.delete(id)),
  };
  return store;
}

let store: ReturnType<typeof memoryStore>;
let repo: ReturnType<typeof fakeRepo>['repo'];
let files: ReturnType<typeof fakeRepo>['files'];
let checks: Check[];
let routes: Awaited<ReturnType<import('../../src/lib/admin/workflow.ts').Deps['routes']>>;
let deps: import('../../src/lib/admin/workflow.ts').Deps;
let clock: Date;

beforeEach(() => {
  store = memoryStore();
  ({ repo, files } = fakeRepo());
  checks = [];
  routes = { pages: [], redirects: [], gone: [] };
  clock = new Date('2026-11-06T10:00:00Z');
  deps = { store, repo, check: () => checks, routes: async () => routes, now: () => clock };
});

const newPost = (slug = 'my-post') => wf.createSubmission({ slug, title: 'T', topic: 'x', owner: '/features/emr/' }, editor, deps);
async function pendingPost(slug = 'my-post'): Promise<Submission> {
  await newPost(slug);
  const [sub] = (await store.listSubmissions()).filter((s) => s.slug === slug);
  return wf.submitForApproval(sub.id, editor, deps);
}
const approveAs = (sub: Submission, user: AdminUser) => wf.approve(sub.id, user, { viewedHash: sub.contentHash, ...ANSWERS }, deps);
const later = (ms: number) => (clock = new Date(clock.getTime() + ms));

describe('fields the form does not ask for', () => {
  it('fills lastUpdated and the blog breadcrumb, and keeps existing values', () => {
    expect(wf.withPostDefaults({}, '2026-11-06')).toEqual({ lastUpdated: '2026-11-06', links: { hub: '/blog/' } });
    expect(wf.withPostDefaults({ lastUpdated: '2025-01-01', links: { hub: '/x/' } }, '2026-11-06')).toEqual({ lastUpdated: '2025-01-01', links: { hub: '/x/' } });
  });
});

describe('roles', () => {
  it('an editor cannot approve, send back or reject, even calling the function directly', async () => {
    const sub = await pendingPost();
    await expect(approveAs(sub, editor)).rejects.toMatchObject({ status: 403 });
    await expect(wf.requestChanges(sub.id, editor, 'n', deps)).rejects.toMatchObject({ status: 403 });
    await expect(wf.reject(sub.id, editor, 'n', deps)).rejects.toMatchObject({ status: 403 });
    expect(repo.commit).not.toHaveBeenCalled();
  });
});

describe('happy path', () => {
  it('sets the published fields, commit message and history, and removes the preview', async () => {
    const sub = await pendingPost();
    expect(sub.content.frontmatter.status).toBe('review');
    const done = await approveAs(sub, boss);
    expect(done.state).toBe('published');
    expect(done.content.frontmatter).toMatchObject({ status: 'published', lastUpdated: '2026-11-06', editorialPass: { by: 'Boss', on: '2026-11-06', ...ANSWERS } });
    expect(repo.commit.mock.calls[0][0].message).toBe('Publish my-post (approved by boss@x.com)');
    expect(done.history.map((e) => e.action)).toEqual(['created', 'submitted', 'approved', 'published']);
    expect(repo.deletePreview).toHaveBeenCalledWith('content/my-post');
    expect(done.publishAttempt).toBeUndefined();
    expect(done.publishLockUntil).toBeUndefined();
  });
  it('blocks on checks at submit and at approve; missing answers and notes are refused', async () => {
    await newPost();
    const [draft] = await store.listSubmissions();
    checks = [{ rule: 'r', severity: 'error', path: 'title', message: 'm' }];
    await expect(wf.submitForApproval(draft.id, editor, deps)).rejects.toMatchObject({ status: 422 });
    expect(repo.writePreview).not.toHaveBeenCalled();
    checks = [{ rule: 'r', severity: 'warning', path: 'title', message: 'm' }];
    const sub = await wf.submitForApproval(draft.id, editor, deps);
    checks = [{ rule: 'r', severity: 'error', path: 'title', message: 'm' }];
    await expect(approveAs(sub, boss)).rejects.toMatchObject({ status: 422 });
    checks = [];
    await expect(wf.approve(sub.id, boss, { viewedHash: sub.contentHash, onlyUsCouldWrite: '', readsMachineWritten: '' }, deps)).rejects.toMatchObject({ status: 400 });
    await expect(wf.requestChanges(sub.id, boss, '  ', deps)).rejects.toMatchObject({ status: 400 });
    await expect(wf.reject(sub.id, boss, '', deps)).rejects.toMatchObject({ status: 400 });
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it('a form cannot set status or editorialPass through saveEdit', async () => {
    const sub = await newPost();
    const hostile: PostContent = { frontmatter: { title: 'x', status: 'published', editorialPass: { by: 'fake' } }, body: 'b' };
    const saved = await wf.saveEdit(sub.id, hostile, editor, sub.updatedAt, deps);
    expect(saved.content.frontmatter.status).toBe('draft');
    expect(saved.content.frontmatter.editorialPass).toBeUndefined();
  });
});

describe('races', () => {
  it('two approvers at once: one publish, one refusal', async () => {
    const sub = await pendingPost();
    const results = await Promise.allSettled([approveAs(sub, boss), approveAs(sub, boss2)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(repo.commit).toHaveBeenCalledTimes(1);
  });
  it('a second approver during a publish is told to wait; an approval after it is refused', async () => {
    const sub = await pendingPost();
    let release = () => {};
    repo.commit.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return 'c';
    });
    const first = approveAs(sub, boss);
    await vi.waitFor(() => expect(repo.commit).toHaveBeenCalled());
    await expect(approveAs(sub, boss2)).rejects.toMatchObject({ status: 409 });
    await expect(wf.requestChanges(sub.id, boss2, 'no', deps)).rejects.toMatchObject({ status: 409 });
    await expect(wf.reject(sub.id, boss2, 'no', deps)).rejects.toMatchObject({ status: 409 });
    release();
    await first;
    await expect(approveAs(sub, boss2)).rejects.toMatchObject({ status: 409 });
    expect(repo.commit).toHaveBeenCalledTimes(1);
  });
  it('a pending post cannot be edited', async () => {
    const sub = await pendingPost();
    await expect(wf.saveEdit(sub.id, sub.content, editor, sub.updatedAt, deps)).rejects.toMatchObject({ status: 409 });
  });
  it('edit racing an approval: sent back, edited and resubmitted content cannot pass on the old hash', async () => {
    const seen = await pendingPost();
    const back = await wf.requestChanges(seen.id, boss2, 'fix', deps);
    const saved = await wf.saveEdit(seen.id, { ...back.content, body: 'changed' }, editor, back.updatedAt, deps);
    expect(saved.submittedHash).toBeNull();
    await wf.submitForApproval(seen.id, editor, deps);
    await expect(approveAs(seen, boss)).rejects.toMatchObject({ status: 409 });
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it('two editors saving from one version: the second gets a conflict, not an overwrite', async () => {
    const sub = await newPost();
    await wf.saveEdit(sub.id, { ...sub.content, body: 'a' }, editor, sub.updatedAt, deps);
    await expect(wf.saveEdit(sub.id, { ...sub.content, body: 'b' }, editor, sub.updatedAt, deps)).rejects.toMatchObject({ status: 409 });
    expect((await store.getSubmission(sub.id))!.content.body).toBe('a');
  });
  it('writes in one millisecond still get different stamps', async () => {
    const sub = await newPost();
    const one = await wf.saveEdit(sub.id, { ...sub.content, body: 'a' }, editor, sub.updatedAt, deps);
    const two = await wf.saveEdit(sub.id, { ...sub.content, body: 'b' }, editor, one.updatedAt, deps);
    expect(new Set([sub.updatedAt, one.updatedAt, two.updatedAt]).size).toBe(3);
  });
});

describe('main changing', () => {
  const existing = () => serializePost({ frontmatter: { status: 'published', title: 'Old' }, body: 'old' });
  const edited = async () => (await wf.startEdit('my-post', (c) => ({ ...c, body: 'mine' }), files['my-post'].sha, editor, deps))!;
  it('at submit: refused before any branch is written', async () => {
    files['my-post'] = { raw: existing(), sha: 'v1' };
    const sub = await edited();
    files['my-post'] = { raw: existing(), sha: 'v2' };
    await expect(wf.submitForApproval(sub.id, editor, deps)).rejects.toMatchObject({ status: 409 });
    expect(repo.writePreview).not.toHaveBeenCalled();
  });
  it('after submit: stays pending, publish_failed recorded, main not overwritten, unlocked', async () => {
    files['my-post'] = { raw: existing(), sha: 'v1' };
    const opened = await edited();
    const sub = await wf.submitForApproval(opened.id, editor, deps);
    files['my-post'] = { raw: 'someone else', sha: 'v2' };
    await expect(approveAs(sub, boss)).rejects.toMatchObject({ status: 409 });
    expect(files['my-post'].raw).toBe('someone else');
    const after = (await store.getSubmission(sub.id))!;
    expect(after.state).toBe('pending');
    expect(after.history.at(-1)!.action).toBe('publish_failed');
    expect(after.publishLockUntil).toBeUndefined();
  });
  it('the way out: compare, choose per field, and the copy moves to the new base', async () => {
    files['my-post'] = { raw: existing(), sha: 'v1' };
    const old = await edited();
    files['my-post'] = { raw: serializePost({ frontmatter: { status: 'published', title: 'Theirs' }, body: 'theirs' }), sha: 'v2' };
    const conflict = (await wf.baseConflict(old, deps))!;
    expect(conflict.fields.map((f) => f.field).sort()).toEqual(['body', 'title']);
    const next = await wf.rebase(old.id, ['title'], editor, deps);
    expect(next).toMatchObject({ baseSha: 'v2', content: { body: 'mine', frontmatter: { title: 'Theirs' } } });
    expect((await wf.submitForApproval(next.id, editor, deps)).state).toBe('pending');
  });
  it('a new post whose slug appeared on main is not overwritten', async () => {
    const sub = await pendingPost();
    files['my-post'] = { raw: 'landed elsewhere', sha: 'v1' };
    await expect(approveAs(sub, boss)).rejects.toMatchObject({ status: 409 });
    expect(files['my-post'].raw).toBe('landed elsewhere');
    expect(repo.commit).not.toHaveBeenCalled();
  });
});

describe('partial failures and retries', () => {
  it('commit lands, store write fails: the retry records it and does not commit again', async () => {
    const sub = await pendingPost();
    const original = store.putSubmission;
    let writes = 0;
    store.putSubmission = async (value, expected) => {
      if (writes++ >= 1) throw new Error('database down'); // The claim passes; every record try fails.
      return original(value, expected);
    };
    await expect(approveAs(sub, boss)).rejects.toThrow('live');
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect((await store.getSubmission(sub.id))!.state).toBe('pending');
    store.putSubmission = original;
    later(24 * 60 * 60 * 1000); // Next day: the rebuilt file would differ, so only the stored attempt can match.
    const done = await approveAs(sub, boss2);
    expect(done.state).toBe('published');
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(done.content.frontmatter.lastUpdated).toBe('2026-11-06');
    expect(done.history.at(-1)!.by).toBe('boss@x.com');
  });
  it('commit lands, store blips once: recorded by the built-in retry', async () => {
    const sub = await pendingPost();
    const original = store.putSubmission;
    let writes = 0;
    store.putSubmission = async (value, expected) => {
      if (writes++ === 1) throw new Error('blip');
      return original(value, expected);
    };
    expect((await approveAs(sub, boss)).state).toBe('published');
  });
  it('a commit that timed out but landed cannot be sent back or rejected', async () => {
    const sub = await pendingPost();
    repo.commit.mockImplementationOnce(async (plan) => {
      files['my-post'] = { raw: plan.writes[0].content, sha: 'landed' };
      throw new Error('timeout');
    });
    await expect(approveAs(sub, boss)).rejects.toMatchObject({ status: 502 });
    await expect(wf.requestChanges(sub.id, boss, 'no', deps)).rejects.toThrow('already live');
    await expect(wf.reject(sub.id, boss, 'no', deps)).rejects.toThrow('already live');
    expect((await approveAs(sub, boss)).state).toBe('published');
    expect(repo.commit).toHaveBeenCalledTimes(1);
  });
  it('rate limit: stays pending, says when, and a retry works', async () => {
    const sub = await pendingPost();
    repo.commit.mockRejectedValueOnce(new RepoRateLimitError(600));
    await expect(approveAs(sub, boss)).rejects.toThrow('rate limiting');
    expect((await store.getSubmission(sub.id))!.state).toBe('pending');
    expect((await approveAs(sub, boss)).state).toBe('published');
  });
  it('an unknown publish error shows nothing of its text', async () => {
    const sub = await pendingPost();
    repo.commit.mockRejectedValueOnce(new Error('token ghp_secret'));
    const error = await approveAs(sub, boss).catch((e) => e);
    expect(error.message).not.toContain('ghp_secret');
    expect(JSON.stringify(await store.getSubmission(sub.id))).not.toContain('ghp_secret');
  });
  it('crash after the claim: others wait, then the lease expires and approval works', async () => {
    const sub = await pendingPost();
    const original = store.putSubmission;
    repo.commit.mockRejectedValueOnce(new Error('x'));
    let writes = 0;
    store.putSubmission = async (value, expected) => {
      if (writes++ >= 1) throw new Error('database down'); // The claim is saved; the failure note is not.
      return original(value, expected);
    };
    await expect(approveAs(sub, boss)).rejects.toMatchObject({ status: 502 });
    store.putSubmission = original;
    await expect(approveAs(sub, boss2)).rejects.toThrow('publishing this post');
    later(3 * 60 * 1000);
    expect((await approveAs(sub, boss2)).state).toBe('published');
  });
  it('preview write fails at submit: stays a draft; a store failure after it can be retried', async () => {
    await newPost();
    const [draft] = await store.listSubmissions();
    (repo.writePreview as any).mockRejectedValueOnce(new Error('down'));
    await expect(wf.submitForApproval(draft.id, editor, deps)).rejects.toThrow();
    expect((await store.getSubmission(draft.id))!.state).toBe('draft');
    store.failNext = 1;
    await expect(wf.submitForApproval(draft.id, editor, deps)).rejects.toThrow();
    expect((await store.getSubmission(draft.id))!.state).toBe('draft');
    expect((await wf.submitForApproval(draft.id, editor, deps)).state).toBe('pending');
  });
  it('preview cleanup failing does not undo a publish or a reject', async () => {
    const sub = await pendingPost();
    (repo.deletePreview as any).mockRejectedValue(new Error('down'));
    expect((await approveAs(sub, boss)).state).toBe('published');
    const other = await pendingPost('other-post');
    expect((await wf.reject(other.id, boss, 'no', deps)).state).toBe('rejected');
  });
  it('the claim failing publishes nothing', async () => {
    const sub = await pendingPost();
    store.failNext = 1;
    await expect(approveAs(sub, boss)).rejects.toThrow();
    expect(repo.commit).not.toHaveBeenCalled();
  });
});

describe('slug collisions, redirects and gone rules', () => {
  const rules = () => ({
    pages: [{ path: '/pricing/' }, { path: '/old-post/', postSlug: 'old-post' }],
    redirects: [{ from: '/moved/' }, { from: '/tree/', match: 'prefix' as const }],
    gone: [{ path: '/dead/' }, { path: '/dead-tree/', match: 'children' as const }],
  });
  it.each([
    ['admin', 'reserved'], ['blog', 'reserved'], ['pricing', 'already a page'], ['old-post', 'already a page'],
    ['moved', 'redirect'], ['tree', 'redirect'], ['dead', 'gone'],
  ])('/%s/ cannot be a new post (%s)', async (slug, why) => {
    routes = rules();
    await expect(newPost(slug)).rejects.toThrow(why);
  });
  it('a free slug, and a path only below a children rule, are fine', () => {
    expect(wf.slugConflict('free', rules(), false)).toBeNull();
    expect(wf.slugConflict('dead-tree', rules(), false)).toBeNull();
  });
  it('a post may keep its own path when edited, unless a rule now covers it', () => {
    expect(wf.slugConflict('old-post', rules(), true)).toBeNull();
    expect(wf.slugConflict('pricing', rules(), true)).toContain('already a page');
    expect(wf.slugConflict('moved', { ...rules(), pages: [{ path: '/moved/', postSlug: 'moved' }] }, true)).toContain('redirect');
  });
  it('a rule added after submit blocks approval: publishing would fail the site build', async () => {
    const sub = await pendingPost();
    routes = { pages: [], redirects: [{ from: '/my-post/' }], gone: [] };
    await expect(approveAs(sub, boss)).rejects.toThrow('redirect');
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it('a slug on main but not in this deployment, one in use, and a bad slug are refused', async () => {
    files['on-main'] = { raw: 'x', sha: 's' };
    await expect(newPost('on-main')).rejects.toMatchObject({ status: 409 });
    await newPost('taken');
    await expect(newPost('taken')).rejects.toMatchObject({ status: 409 });
    await expect(newPost('../evil')).rejects.toMatchObject({ status: 400 });
    await expect(wf.startEdit('../evil', (c) => c, null, editor, deps)).rejects.toMatchObject({ status: 400 });
  });
  it('if the route data cannot be read, nothing is created or approved', async () => {
    const sub = await pendingPost();
    deps.routes = async () => {
      throw new Error('no data');
    };
    await expect(newPost('free')).rejects.toThrow();
    await expect(approveAs(sub, boss)).rejects.toThrow();
    expect(repo.commit).not.toHaveBeenCalled();
  });
});

describe('form and transitions', () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const current: PostContent = { frontmatter: { title: 'Old', notes: ['keep'], ctas: { whatsapp: 'hi' } }, body: 'old' };
  it('takes named fields only, and keeps what the form lacks', () => {
    const out = wf.contentFromForm(form({ title: 'New', status: 'published', notes: 'x', faq: '[{"question":"q","answer":"a"}]' }), current);
    expect(out.frontmatter).toMatchObject({ title: 'New', notes: ['keep'], faq: [{ question: 'q', answer: 'a' }], ctas: { whatsapp: 'hi' } });
    expect(out.frontmatter.status).toBeUndefined();
    expect(out.body).toBe('old');
  });
  it.each(['not json', '{}', '[1]', '[{"question":1,"answer":"a"}]'])('refuses the FAQ %s', (faq) => {
    expect(() => wf.contentFromForm(form({ faq }), current)).toThrow('FAQ');
  });
  it.each(['javascript:alert(1)', '//evil.test', 'http://x.test', '/\\evil.test'])('refuses the link %s', (href) => {
    expect(() => wf.contentFromForm(form({ ctaPrimaryLabel: 'x', ctaPrimaryHref: href }), current)).toThrow('Links');
  });
  it('refuses a post too large for the GitHub contents API', async () => {
    const sub = await newPost();
    await expect(wf.saveEdit(sub.id, { ...sub.content, body: 'x'.repeat(1_000_000) }, editor, sub.updatedAt, deps)).rejects.toMatchObject({ status: 413 });
  });
  it('published and rejected posts refuse the wrong moves; reopen brings a rejected post back', async () => {
    const sub = await pendingPost();
    const done = await approveAs(sub, boss);
    await expect(wf.reopen(done.id, editor, deps)).rejects.toMatchObject({ status: 409 });
    await expect(approveAs(done, boss)).rejects.toMatchObject({ status: 409 });
    const other = await pendingPost('other-post');
    await wf.reject(other.id, boss, 'no', deps);
    await expect(approveAs(other, boss)).rejects.toMatchObject({ status: 409 });
    expect((await wf.reopen(other.id, editor, deps)).state).toBe('draft');
  });
  it('reopening a rejected post is refused while another is active on that slug', async () => {
    const other = await pendingPost('other-post');
    await wf.reject(other.id, boss, 'no', deps);
    await newPost('other-post');
    await expect(wf.reopen(other.id, editor, deps)).rejects.toMatchObject({ status: 409 });
  });
  it('published content parses back from the committed file', async () => {
    const sub = await pendingPost();
    await approveAs(sub, boss);
    expect(parsePost(files['my-post'].raw).frontmatter.status).toBe('published');
  });
});
