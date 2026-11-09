/**
 * The owner's complaint and the lifecycle built to fix it. GitHub and the store are in-memory fakes with the real
 * contract (expected shas, atomic plans, stale writes); routing rules, the loader and resolveRules are the real code.
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoaderContext } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, Check, Store, Submission } from '../../src/lib/admin/types.ts';
import { fakeRepo, storeExtras } from './admin-fakes.ts';

const secrets = vi.hoisted(() => ({ values: {} as Record<string, string> }));
const collections = vi.hoisted(() => ({ data: {} as Record<string, unknown[]> }));
vi.mock('../../src/lib/admin/env.ts', () => ({ env: (name: string) => secrets.values[name] }));
vi.mock('astro:content', async () => ({
  ...(await (await import('./keystatic-harness.ts')).astroContentMock()),
  getCollection: async (name: string) => collections.data[name] ?? [],
}));

const wf = await import('../../src/lib/admin/workflow.ts');
const lc = await import('../../src/lib/admin/lifecycle.ts');
const { postRows, pipelineCounts, activityFeed } = await import('../../src/components/admin/data.ts');
const { StaleWriteError, createFileStore } = await import('../../src/lib/admin/store.ts');
const { RepoRateLimitError, createLocalRepo, postPath } = await import('../../src/lib/admin/repo.ts');
const { parsePost, serializePost } = await import('../../src/lib/admin/mdx-file.ts');
const { routingLists } = await import('../../src/lib/content/routing-loader.ts');
const { bearerMatches } = await import('../../src/lib/admin/http.ts');

const editor: AdminUser = { email: 'ed@x.com', name: 'Ed', role: 'editor' };
const boss: AdminUser = { email: 'boss@x.com', name: 'Boss', role: 'approver' };
const ANSWERS = { onlyUsCouldWrite: 'Our own clinic numbers.', readsMachineWritten: 'No.' };
const R = 'src/data/redirects.yaml';
const RA = 'src/data/redirects-admin.yaml';
const GA = 'src/data/gone-admin.yaml';

function memoryStore() {
  const docs = new Map<string, string>();
  const list = async () => [...docs.values()].map((d) => JSON.parse(d) as Submission);
  const store: Store & { writes: number } & ReturnType<typeof storeExtras> = {
    writes: 0,
    getSubmission: async (id) => (docs.has(id) ? JSON.parse(docs.get(id)!) : null),
    listSubmissions: list,
    async putSubmission(value, expected) {
      if (expected !== undefined && (docs.has(value.id) ? JSON.parse(docs.get(value.id)!).updatedAt : undefined) !== expected) throw new StaleWriteError();
      store.writes++;
      docs.set(value.id, JSON.stringify(value));
    },
    getJob: async () => null,
    listJobs: async () => [],
    putJob: async () => {},
    ...storeExtras(list, (id) => docs.delete(id)),
  };
  return store;
}

const live = (over: Record<string, unknown> = {}, body = 'Live body\n') => serializePost({ frontmatter: { status: 'published', title: 'Live', h1: 'Live post', topic: 'billing-and-claims', owner: '/features/billing/', headKeyword: 'live keyword', ctas: { primary: { label: 'Go', href: '/x/' } }, ...over }, body });

let store: ReturnType<typeof memoryStore>;
let gh: ReturnType<typeof fakeRepo>;
let deps: import('../../src/lib/admin/workflow.ts').Deps;
let routes: import('../../src/lib/admin/workflow.ts').RouteRules;
let checks: Check[];
let clock: Date;
const PATH = postPath('my-post');

beforeEach(() => {
  store = memoryStore();
  gh = fakeRepo({ [R]: { raw: '[]\n', sha: 'r1' }, [PATH]: { raw: live(), sha: 'v1' } });
  routes = { pages: [{ path: '/my-post/', postSlug: 'my-post', status: 'published' }, { path: '/features/billing/' }], redirects: [], gone: [] };
  checks = [];
  clock = new Date('2026-11-06T10:00:00Z');
  deps = { store, repo: gh.repo, check: () => checks, routes: async () => routes, now: () => clock, stillApprover: (e) => e === boss.email };
  collections.data = {};
  secrets.values = {};
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const startCopy = async (slug = 'my-post', body = 'Changed\n') => (await wf.startEdit(slug, (c) => ({ ...c, body }), gh.tree[postPath(slug)].sha, editor, deps))!;
const inReview = async (slug = 'my-post') => wf.submitForApproval((await startCopy(slug)).id, editor, deps);
const entry = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, data: { status, h1: id, topic: 'billing-and-claims', owner: '/features/billing/', lastUpdated: new Date('2026-01-01'), author: null, ...over } });
const rowFor = async (slug: string, subs?: Submission[]) => (await postRows(subs ?? (await store.listSubmissions()), 'editor', await store.listFlags())).find((r) => r.slug === slug);
const newDraft = (slug: string) => wf.createSubmission({ slug, title: 'T', topic: 'x', owner: '/features/billing/' }, editor, deps);

describe('the owner complaint: opening a published post', () => {
  it('reading writes nothing, anywhere', async () => {
    const before = store.writes;
    const status = await wf.postStatus('my-post', 'editor', deps);
    expect(status).toMatchObject({ site: 'live', work: 'none', active: null });
    expect(store.writes).toBe(before);
    expect(store.flags.size + store.revisions.size).toBe(0);
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(await store.listSubmissions()).toEqual([]);
  });
  it('the list keeps calling it Published after opening', async () => {
    collections.data = { posts: [entry('my-post', 'published')] };
    await wf.postStatus('my-post', 'editor', deps);
    expect(await rowFor('my-post')).toMatchObject({ site: 'live', work: 'none', label: 'Published', tone: 'success', submissionId: null, liveUrl: '/my-post/' });
  });
  it('a save with no changes creates no copy, using the real form parser', async () => {
    const same = form({ title: 'Live', h1: 'Live post', topic: 'billing-and-claims', owner: '/features/billing/', headKeyword: 'live keyword', ctaPrimaryLabel: 'Go', ctaPrimaryHref: '/x/', body: 'Live body\n', faq: '' });
    expect(await wf.startEdit('my-post', (c) => wf.contentFromForm(same, c), 'v1', editor, deps)).toBeNull();
    expect(store.writes).toBe(0);
    collections.data = { posts: [entry('my-post', 'published')] };
    expect((await rowFor('my-post'))!.label).toBe('Published');
  });
  it('a real post with every field survives a form round trip as no change', () => {
    const dir = join(process.cwd(), 'src/content/posts');
    const slug = readdirSync(dir).find((name) => /^status: published/m.test(readFileSync(join(dir, name, 'index.mdx'), 'utf8')))!;
    const current = parsePost(readFileSync(join(dir, slug, 'index.mdx'), 'utf8'));
    const fm = current.frontmatter as Record<string, any>;
    const fields: Record<string, string> = { faq: JSON.stringify(fm.faq ?? []), body: current.body.replace(/^\r?\n/, '') };
    for (const name of ['title', 'metaDescription', 'h1', 'linkLabel', 'headKeyword', 'openingAnswer', 'summary', 'author', 'topic', 'owner']) fields[name] = String(fm[name] ?? '');
    for (const [slot, cap] of [['primary', 'Primary'], ['secondary', 'Secondary']]) {
      fields[`cta${cap}Label`] = fm.ctas?.[slot]?.label ?? '';
      fields[`cta${cap}Href`] = fm.ctas?.[slot]?.href ?? '';
    }
    expect(wf.sameEdit(wf.contentFromForm(form(fields), current), current)).toBe(true);
  });
  it('a no-op save on an existing copy writes nothing and keeps its history', async () => {
    const sub = await startCopy();
    const writes = store.writes;
    const saved = await wf.saveEdit(sub.id, sub.content, editor, sub.updatedAt, deps);
    expect(saved.updatedAt).toBe(sub.updatedAt);
    expect(saved.history).toHaveLength(1);
    expect(store.writes).toBe(writes);
  });
  it('a real edit shows both facts, and the live file is untouched', async () => {
    collections.data = { posts: [entry('my-post', 'published')] };
    await startCopy();
    expect(await rowFor('my-post')).toMatchObject({ site: 'live', work: 'editing', label: 'Published · Edits in progress', hint: 'Edits are not on the live page yet' });
    expect(gh.tree[PATH].raw).toBe(live());
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('an untouched live post cannot be submitted, so it cannot earn a false date', async () => {
    const sub = await startCopy();
    const back = await wf.saveEdit(sub.id, parsePost(live()), editor, sub.updatedAt, deps);
    await expect(wf.submitForApproval(back.id, editor, deps)).rejects.toThrow('Nothing has changed');
  });
  it('the old approval routes are gone', () => {
    for (const path of ['src/pages/admin/api/posts', 'src/pages/admin/approvals']) expect(existsSync(join(process.cwd(), path)), path).toBe(false);
  });
});

describe('status labels', () => {
  it.each([
    ['live', 'none', {}, 'Published'],
    ['live', 'in_review', {}, 'Published · Edits in review'],
    ['draft', 'none', {}, 'Draft'],
    ['draft', 'editing', {}, 'Draft'],
    ['draft', 'in_review', {}, 'Draft · In review'],
    ['never', 'scheduled', { scheduledAt: '2026-11-12T03:30:00Z' }, 'Scheduled for 12 Nov, 09:00 IST'],
    ['unpublished', 'none', {}, 'Unpublished'],
    ['live', 'none', { trashed: true }, 'In trash'],
  ] as const)('%s + %s %j reads %s', (site, work, context, label) => {
    expect(lc.statusLabel(site, work, context)).toBe(label);
  });
  it('a live post is never labelled Draft, in any work state', () => {
    for (const work of ['none', 'editing', 'in_review', 'changes_requested', 'scheduled', 'publishing', 'failed'] as const) {
      expect(lc.statusLabel('live', work, { scheduledAt: '2026-11-12T03:30:00Z' })).not.toMatch(/Draft/);
    }
  });
});

describe('actions table', () => {
  const both = (site: any, work: any, ctx = {}) => ({ ed: lc.actionsFor(site, work, 'editor', ctx), ap: lc.actionsFor(site, work, 'approver', ctx) });
  it('review, schedule, unpublish and delete powers are approver-only', () => {
    expect(both('never', 'in_review').ed).not.toEqual(expect.arrayContaining(['approve']));
    expect(both('never', 'in_review').ap).toEqual(expect.arrayContaining(['approve', 'schedule', 'request-changes', 'reject', 'withdraw']));
    expect(both('never', 'scheduled').ed).toEqual(['view', 'duplicate']);
    expect(both('never', 'scheduled').ap).toEqual(expect.arrayContaining(['unschedule', 'publish-now']));
    expect(both('never', 'scheduled', { due: false }).ap).not.toContain('publish-now');
    expect(both('live', 'none').ed).not.toContain('unpublish');
    expect(both('live', 'none').ap).toContain('unpublish');
    expect(both('live', 'none').ap).not.toContain('trash');
    expect(both('unpublished', 'none').ed).not.toContain('trash');
    expect(both('unpublished', 'none').ap).toContain('trash');
  });
  it('trash: editors restore only what was never live; only approvers delete', () => {
    expect(both('draft', 'none', { trashed: true }).ed).toEqual(['view', 'restore']);
    expect(both('unpublished', 'none', { trashed: true }).ed).toEqual(['view']);
    expect(both('unpublished', 'none', { trashed: true }).ap).toEqual(['view', 'restore', 'delete']);
  });
  it('a scheduled post cannot be edited by anyone', () => {
    for (const role of ['editor', 'approver'] as const) expect(lc.actionsFor('live', 'scheduled', role)).not.toContain('edit');
  });
});

describe('state transitions', () => {
  it('draft to review to changes to review to published', async () => {
    const pending = await inReview();
    expect(lc.workFor(pending)).toBe('in_review');
    const back = await wf.requestChanges(pending.id, boss, 'fix', deps);
    expect(lc.workFor(back)).toBe('changes_requested');
    const again = await wf.submitForApproval(back.id, editor, deps);
    const done = await wf.approve(again.id, boss, { viewedHash: again.contentHash, ...ANSWERS }, deps);
    expect(done.state).toBe('published');
    expect(lc.workFor(done)).toBe('none');
    expect(parsePost(gh.tree[PATH].raw).frontmatter.status).toBe('published');
  });
  it('withdraw returns review to editing and removes the preview', async () => {
    const pending = await inReview();
    expect((await wf.withdraw(pending.id, editor, deps)).state).toBe('draft');
    expect(gh.repo.deletePreview).toHaveBeenCalledWith('content/my-post');
  });
  it('discard closes the copy, frees the slug, and leaves Git alone', async () => {
    const sub = await startCopy();
    expect((await wf.discard(sub.id, editor, deps)).state).toBe('discarded');
    expect(gh.tree[PATH].raw).toBe(live());
    expect((await wf.postStatus('my-post', 'editor', deps)).work).toBe('none');
    await expect(startCopy()).resolves.toBeTruthy();
  });
  it('wrong moves are refused', async () => {
    const pending = await inReview();
    await expect(wf.discard(pending.id, editor, deps)).rejects.toMatchObject({ status: 409 });
    await expect(wf.saveEdit(pending.id, { ...pending.content, body: 'x' }, editor, pending.updatedAt, deps)).rejects.toMatchObject({ status: 409 });
    await expect(wf.unschedule(pending.id, boss, deps)).rejects.toMatchObject({ status: 409 });
    await expect(wf.publishNow(pending.id, boss, deps)).rejects.toMatchObject({ status: 409 });
  });
  it('a second copy of a post is refused with a link, and typed text is not overwritten', async () => {
    const first = await startCopy();
    const refusal = await startCopy('my-post', 'other tab').catch((e) => e);
    expect(refusal).toMatchObject({ status: 409, extra: { submissionId: first.id } });
    expect((await store.getSubmission(first.id))!.content.body).toBe('Changed\n');
  });
  it('main moving between view and first save refuses, keeping the page', async () => {
    gh.tree[PATH] = { raw: live({ title: 'Moved' }), sha: 'v2' };
    await expect(wf.startEdit('my-post', (c) => ({ ...c, body: 'x' }), 'v1', editor, deps)).rejects.toMatchObject({ status: 409, extra: { stale: true, currentSha: 'v2' } });
    expect(await store.listSubmissions()).toEqual([]);
  });
});

describe('role refusal, calling the functions directly', () => {
  it('an editor can do none of the approver-only acts', async () => {
    const pending = await inReview();
    const asEditor = [
      wf.approve(pending.id, editor, { viewedHash: pending.contentHash, ...ANSWERS }, deps),
      wf.schedule(pending.id, editor, { viewedHash: pending.contentHash, ...ANSWERS, at: '2026-12-01T00:00:00Z' }, deps),
      wf.unschedule(pending.id, editor, deps),
      wf.publishNow(pending.id, editor, deps),
      wf.requestChanges(pending.id, editor, 'n', deps),
      wf.reject(pending.id, editor, 'n', deps),
      wf.unpublish('my-post', editor, { mode: 'gone' }, deps),
      wf.deletePost('my-post', editor, { confirm: 'my-post' }, deps),
      wf.emptyTrash(editor, wf.EMPTY_TRASH_CONFIRM, deps),
    ];
    for (const attempt of asEditor) await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('an editor cannot trash an unpublished post, or restore one', async () => {
    await wf.unpublish('my-post', boss, { mode: 'gone' }, deps);
    await expect(wf.trash('my-post', editor, deps)).rejects.toThrow('cannot trash');
    await wf.trash('my-post', boss, deps);
    await expect(wf.restore('my-post', editor, deps)).rejects.toThrow('cannot restore');
  });
});

describe('the single gate to main', () => {
  const sources = () => {
    const out: Array<{ path: string; text: string }> = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|astro|js|mjs)$/.test(name)) out.push({ path: path.replaceAll('\\', '/'), text: readFileSync(path, 'utf8') });
      }
    };
    walk(join(process.cwd(), 'src'));
    walk(join(process.cwd(), 'scripts'));
    return out;
  };
  it('repo.commit has two callers: commitPlan in workflow.ts and publishTarget in blog.ts', () => {
    const hits = sources().flatMap((f) => (f.text.match(/\.commit\s*\(/g) ?? []).map(() => f.path));
    expect(hits).toHaveLength(2);
    expect(hits.some((h) => /src\/lib\/admin\/workflow\.ts$/.test(h))).toBe(true);
    const blogText = sources().find((f) => f.path.endsWith('lib/admin/blog.ts'))!.text;
    const beforeBlog = blogText.slice(0, blogText.indexOf('deps.repo.commit('));
    expect(beforeBlog.lastIndexOf('async function ')).toBe(beforeBlog.lastIndexOf('async function publishTarget'));
    const wfText = sources().find((f) => f.path.endsWith('lib/admin/workflow.ts'))!.text;
    expect(wfText.slice(wfText.indexOf('.commit('), wfText.indexOf('.commit(') + 10)).toContain('commit');
    const before = wfText.slice(0, wfText.indexOf('deps.repo.commit('));
    expect(before.lastIndexOf('async function ')).toBe(before.lastIndexOf('async function commitPlan'));
  });
  it('nothing can write to main another way', () => {
    for (const f of sources()) {
      expect(f.text, f.path).not.toMatch(/repo\.publish\s*\(/);
      if (!f.path.endsWith('lib/admin/repo.ts')) expect(f.text, f.path).not.toMatch(/\/git\/refs\/heads|\/git\/trees/);
    }
  });
  it('commitPlan is reached only from approval paths and approved lifecycle operations', () => {
    const wfText = sources().find((f) => f.path.endsWith('lib/admin/workflow.ts'))!.text;
    const callers = [...wfText.matchAll(/await commitPlan\(deps/g)].map((m) => /(?:async )?function (\w+)[^\n]*\n(?:(?!\n(?:export )?(?:async )?function )[\s\S])*$/.exec(wfText.slice(0, m.index))?.[1]);
    expect(callers.sort()).toEqual(['approve', 'commitOrExplain', 'fire']);
    const explained = [...wfText.matchAll(/await commitOrExplain\(deps/g)].map((m) => /(?:async )?function (\w+)[^\n]*\n(?:(?!\n(?:export )?(?:async )?function )[\s\S])*$/.exec(wfText.slice(0, m.index))?.[1]);
    expect(explained.sort()).toEqual(['deleteConfirmed', 'unpublish']);
  });
  it('the AI engine has no way in', () => {
    const engine = sources().find((f) => f.path.endsWith('lib/admin/engine.ts'))!.text;
    expect(engine).not.toMatch(/commitPlan|approve\(|publishNow|publishPost|blog\.ts/);
  });
});

describe('atomic commits', () => {
  const withRules = (redirects = '[]\n', gone = '[]\n') => {
    gh.tree[RA] = { raw: redirects, sha: 'ra1' };
    gh.tree[GA] = { raw: gone, sha: 'ga1' };
  };
  it('unpublish: status and the 410 row in one commit, each blob expected', async () => {
    withRules();
    await wf.unpublish('my-post', boss, { mode: 'gone' }, deps);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
    const plan = gh.repo.commit.mock.calls[0][0];
    expect(plan.writes.map((w) => w.path).sort()).toEqual([GA, PATH].sort());
    expect(plan.expect).toEqual(expect.arrayContaining([{ path: PATH, sha: 'v1' }, { path: GA, sha: 'ga1' }]));
    expect(parsePost(gh.tree[PATH].raw).frontmatter.status).toBe('draft');
    expect(parseYaml(gh.tree[GA].raw)).toEqual([expect.objectContaining({ path: '/my-post/' })]);
    expect((await wf.postStatus('my-post', 'approver', deps)).site).toBe('unpublished');
  });
  it('unpublish with a redirect; a bad target refused; no mode refused', async () => {
    withRules();
    await expect(wf.unpublish('my-post', boss, {}, deps)).rejects.toMatchObject({ status: 400 });
    await expect(wf.unpublish('my-post', boss, { mode: 'redirect', target: '//evil.test' }, deps)).rejects.toMatchObject({ status: 400 });
    await expect(wf.unpublish('my-post', boss, { mode: 'redirect', target: '/my-post/' }, deps)).rejects.toMatchObject({ status: 400 });
    await wf.unpublish('my-post', boss, { mode: 'redirect', target: '/features/billing/' }, deps);
    expect(parseYaml(gh.tree[RA].raw)).toEqual([expect.objectContaining({ from: '/my-post/', to: '/features/billing/' })]);
  });
  it('a moved file refuses the whole plan: neither the status nor the rule lands', async () => {
    withRules();
    const status = gh.tree[PATH];
    gh.repo.commit.mockImplementationOnce(async () => {
      const { RepoConflictError } = await import('../../src/lib/admin/repo.ts');
      throw new RepoConflictError();
    });
    await expect(wf.unpublish('my-post', boss, { mode: 'gone' }, deps)).rejects.toMatchObject({ status: 409 });
    expect(gh.tree[PATH]).toBe(status);
    expect(gh.tree[GA].raw).toBe('[]\n');
    expect(store.flags.size).toBe(0);
  });
  it('a rule that would fail the build is refused before any commit', async () => {
    withRules();
    routes.pages.push({ path: '/target/', postSlug: 'target', status: 'published' });
    // The hand-written row makes the admin's redirect target a loop.
    gh.tree[R] = { raw: '- { from: /features/billing/, to: /my-post/, fallback: /x/ }\n', sha: 'r2' };
    await expect(wf.unpublish('my-post', boss, { mode: 'redirect', target: '/features/billing/' }, deps)).rejects.toThrow(/build|loop/i);
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it("another file's redirect to this post stops the action and names the file", async () => {
    withRules();
    gh.tree[R] = { raw: '- { from: /older/, to: /my-post/ }\n', sha: 'r2' };
    await expect(wf.unpublish('my-post', boss, { mode: 'gone' }, deps)).rejects.toThrow('src/data/redirects.yaml');
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('the admin never writes a duplicate of an existing exact row', async () => {
    withRules();
    gh.tree[R] = { raw: '- { from: /my-post/, to: /features/billing/ }\n', sha: 'r2' };
    await wf.unpublish('my-post', boss, { mode: 'redirect', target: '/features/billing/' }, deps);
    expect(gh.repo.commit.mock.calls[0][0].writes.map((w) => w.path)).toEqual([PATH]);
  });
  it('republishing lifts the admin rule in the same commit', async () => {
    withRules();
    await wf.unpublish('my-post', boss, { mode: 'gone' }, deps);
    const pending = await inReview();
    const done = await wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps);
    expect(done.state).toBe('published');
    expect(parseYaml(gh.tree[GA].raw)).toEqual([]);
    expect(gh.repo.commit.mock.calls.at(-1)![0].writes.map((w) => w.path).sort()).toEqual([GA, PATH].sort());
    expect(await wf.postStatus('my-post', 'editor', deps)).toMatchObject({ site: 'live' });
    expect(store.flags.get('my-post')).toBeUndefined();
  });
  it('the local repo applies a plan and removes an emptied folder, in a temp root only', async () => {
    const root = mkdtempSync(join(tmpdir(), 'admin-local-'));
    try {
      const local = createLocalRepo(root);
      const file = join(root, PATH);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, 'x');
      expect(await local.listFolder('my-post')).toEqual([PATH]);
      await local.commit({ writes: [{ path: GA, content: '[]\n' }], deletes: [PATH], expect: [], message: 'm' });
      expect((await local.readFile(GA))!.raw).toBe('[]\n');
      expect(await local.readPost('my-post')).toBeNull();
      expect(readdirSync(join(root, 'src/content/posts'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('rule files and the real routing loader', () => {
  function loaderContext(root: string) {
    const entries = new Map<string, unknown>();
    const ctx = {
      config: { root: pathToFileURL(`${root}/`) },
      parseData: async ({ data }: { data: Record<string, unknown> }) => data,
      store: { clear: () => entries.clear(), set: (entry: { id: string }) => entries.set(entry.id, entry) },
    } as unknown as LoaderContext;
    return { ctx, entries };
  }
  const configured = readFileSync(join(process.cwd(), 'src/content.config.ts'), 'utf8');

  it('content.config.ts lists both files, and the checked-in files load as empty', async () => {
    expect(configured).toContain(`'${RA}'`);
    expect(configured).toContain(`'${GA}'`);
    const { ctx, entries } = loaderContext(process.cwd());
    await routingLists('from', [RA]).load(ctx);
    await routingLists('path', [GA]).load(ctx);
    expect(entries.size).toBe(0);
  });
  it('what the admin commits loads through the real loader beside the real hand-written data', async () => {
    gh.tree[RA] = { raw: '[]\n', sha: 'a' };
    gh.tree[GA] = { raw: '[]\n', sha: 'b' };
    await wf.unpublish('my-post', boss, { mode: 'redirect', target: '/features/billing/' }, deps);
    const root = mkdtempSync(join(tmpdir(), 'admin-rules-'));
    try {
      mkdirSync(join(root, 'src/data'), { recursive: true });
      for (const name of ['redirects.yaml', 'redirects-posts.yaml']) writeFileSync(join(root, 'src/data', name), readFileSync(join(process.cwd(), 'src/data', name)));
      writeFileSync(join(root, RA), gh.tree[RA].raw);
      const { ctx, entries } = loaderContext(root);
      await routingLists('from', ['src/data/redirects.yaml', 'src/data/redirects-posts.yaml', RA]).load(ctx);
      expect(entries.get('exact:/my-post/')).toMatchObject({ filePath: RA, data: { from: '/my-post/', to: '/features/billing/' } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('the loader really does fail on a duplicate, which is why planRules must not write one', async () => {
    const root = mkdtempSync(join(tmpdir(), 'admin-dup-'));
    try {
      mkdirSync(join(root, 'src/data'), { recursive: true });
      writeFileSync(join(root, R), '- { from: /a/, to: /b/ }\n');
      writeFileSync(join(root, RA), '- { from: /a/, to: /c/ }\n');
      const { ctx } = loaderContext(root);
      await expect(routingLists('from', [R, RA]).load(ctx)).rejects.toThrow('also listed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('reading real main through the local repo gives every rule file, with the admin ones empty', async () => {
    const { readMainRules } = await import('../../src/lib/admin/routing-edit.ts');
    const rules = (await readMainRules(createLocalRepo(process.cwd())))!;
    expect(rules.redirects.length).toBeGreaterThan(0);
    expect(rules.redirects.filter((r) => r.file === RA)).toEqual([]);
    expect(rules.gone.filter((g) => g.file === GA)).toEqual([]);
  });
});

describe('scheduling', () => {
  const at = '2026-11-12T03:30:00Z';
  const scheduled = async (slug = 'my-post') => {
    const pending = await inReview(slug);
    return wf.schedule(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS, at }, deps);
  };
  const toTime = () => (clock = new Date('2026-11-12T04:00:00Z'));

  it('freezes the exact file and hash, commits nothing, and locks the post', async () => {
    const sub = await scheduled();
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(sub.state).toBe('scheduled');
    expect(sub.scheduled).toMatchObject({ at: new Date(at).toISOString(), approvedBy: boss.email, reviewedHash: sub.contentHash });
    expect(sub.scheduled!.planHash).toBe(wf.hashPlan(sub.scheduled!.plan));
    await expect(wf.saveEdit(sub.id, { ...sub.content, body: 'x' }, editor, sub.updatedAt, deps)).rejects.toMatchObject({ status: 409 });
    await expect(startCopy()).rejects.toMatchObject({ status: 409 });
    expect(await rowFor('my-post')).toMatchObject({ work: 'scheduled', label: expect.stringContaining('Scheduled for 12 Nov, 09:00 IST') });
  });
  it('refuses a past time, a stale hash, missing answers', async () => {
    const pending = await inReview();
    await expect(wf.schedule(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS, at: '2020-01-01T00:00:00Z' }, deps)).rejects.toMatchObject({ status: 400 });
    await expect(wf.schedule(pending.id, boss, { viewedHash: 'old', ...ANSWERS, at }, deps)).rejects.toMatchObject({ status: 409 });
    await expect(wf.schedule(pending.id, boss, { viewedHash: pending.contentHash, onlyUsCouldWrite: '', readsMachineWritten: '', at }, deps)).rejects.toMatchObject({ status: 400 });
  });
  it('not due: the runner leaves it alone', async () => {
    await scheduled();
    expect((await wf.runDueSchedules(deps)).results).toEqual([]);
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('due: publishes exactly the frozen bytes', async () => {
    const sub = await scheduled();
    toTime();
    const run = await wf.runDueSchedules(deps);
    expect(run.results).toMatchObject([{ slug: 'my-post', outcome: 'published' }]);
    expect(gh.tree[PATH].raw).toBe(sub.scheduled!.plan.writes[0].content);
    expect(parsePost(gh.tree[PATH].raw).frontmatter).toMatchObject({ status: 'published', lastUpdated: '2026-11-12' });
    const done = (await store.getSubmission(sub.id))!;
    expect(done).toMatchObject({ state: 'published' });
    expect(done.scheduled).toBeUndefined();
    expect(store.runs[0].results).toHaveLength(1);
  });
  it('a re-run is idempotent', async () => {
    await scheduled();
    toTime();
    await wf.runDueSchedules(deps);
    expect((await wf.runDueSchedules(deps)).results).toEqual([]);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
  });
  it('double firing at the same moment commits once', async () => {
    await scheduled();
    toTime();
    const runs = await Promise.all([wf.runDueSchedules(deps), wf.runDueSchedules(deps)]);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
    expect(runs.flatMap((r) => r.results.map((x) => x.outcome)).sort()).toEqual(['published', 'skipped']);
  });
  it('a commit that landed with its record lost is recorded by the next run, not committed twice', async () => {
    const sub = await scheduled();
    toTime();
    const real = store.putSubmission;
    let n = 0;
    store.putSubmission = async (value, expected) => {
      if (n++ >= 1) throw new Error('database down');
      return real(value, expected);
    };
    const first = await wf.runDueSchedules(deps);
    expect(first.results[0].outcome).toBe('failed');
    store.putSubmission = real;
    clock = new Date(clock.getTime() + 5 * 60_000);
    const second = await wf.runDueSchedules(deps);
    expect(second.results[0].outcome).toBe('published');
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
    expect((await store.getSubmission(sub.id))!.state).toBe('published');
  });
  const voided = async (sub: Submission, reason: RegExp) => {
    toTime();
    const run = await wf.runDueSchedules(deps);
    expect(run.results[0]).toMatchObject({ outcome: 'failed', message: expect.stringMatching(reason) });
    const after = (await store.getSubmission(sub.id))!;
    expect(after.state).toBe('pending');
    expect(after.scheduled).toBeUndefined();
    expect(after.history.at(-1)).toMatchObject({ action: 'schedule_failed', note: expect.stringMatching(reason) });
    expect(lc.workFor(after, clock)).toBe('failed');
    expect(gh.tree[PATH].raw).toBe(live());
  };
  it('a changed frozen plan voids the approval', async () => {
    const sub = await scheduled();
    const tampered = structuredClone(sub);
    tampered.scheduled!.plan.writes[0].content += 'injected';
    await store.putSubmission(tampered, sub.updatedAt);
    await voided(sub, /no longer matches/);
  });
  it('gates re-run at fire time', async () => {
    const sub = await scheduled();
    checks = [{ rule: 'token', severity: 'error', path: 'title', message: 'gone' }];
    await voided(sub, /Fix 1 problem/);
  });
  it('an approver who lost rights voids it', async () => {
    const sub = await scheduled();
    deps.stillApprover = () => false;
    await voided(sub, /no longer has approval/);
  });
  it('more than 7 days overdue voids it', async () => {
    const sub = await scheduled();
    clock = new Date('2026-11-25T00:00:00Z');
    const run = await wf.runDueSchedules(deps);
    expect(run.results[0].message).toMatch(/7 days/);
    expect((await store.getSubmission(sub.id))!.state).toBe('pending');
  });
  it('a rule added after approval voids it', async () => {
    const sub = await scheduled();
    gh.tree[R] = { raw: '- { from: /my-post/, to: /features/billing/ }\n', sha: 'r2' };
    await voided(sub, /redirect/);
  });
  it('main moving voids it, never rebases', async () => {
    const sub = await scheduled();
    const moved = { raw: live({ title: 'Someone else' }), sha: 'v9' };
    gh.tree[PATH] = moved;
    toTime();
    const run = await wf.runDueSchedules(deps);
    expect(run.results[0].outcome).toBe('failed');
    expect(gh.tree[PATH]).toBe(moved);
    expect((await store.getSubmission(sub.id))!.state).toBe('pending');
  });
  it('a rate limit stops the run and leaves everything due', async () => {
    gh.tree[postPath('other')] = { raw: live({ headKeyword: 'other' }), sha: 'o1' };
    routes.pages.push({ path: '/other/', postSlug: 'other', status: 'published' });
    const a = await scheduled();
    const b = await scheduled('other');
    toTime();
    gh.repo.commit.mockRejectedValueOnce(new RepoRateLimitError(600));
    const run = await wf.runDueSchedules(deps);
    expect(run.results).toHaveLength(1);
    expect(run.results[0].outcome).toBe('postponed');
    for (const sub of [a, b]) expect((await store.getSubmission(sub.id))!).toMatchObject({ state: 'scheduled' });
    expect((await store.getSubmission(a.id))!.publishLockUntil).toBeUndefined();
    expect((await wf.runDueSchedules(deps)).results.map((r) => r.outcome)).toEqual(['published', 'published']);
  });
  it('at most 5 per run; the rest wait', async () => {
    const slugs = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    for (const slug of slugs) {
      gh.tree[postPath(slug)] = { raw: live({ headKeyword: slug }), sha: `${slug}-v1` };
      routes.pages.push({ path: `/${slug}/`, postSlug: slug, status: 'published' });
      await scheduled(slug);
    }
    toTime();
    const run = await wf.runDueSchedules(deps);
    expect(run.results.filter((r) => r.outcome === 'published')).toHaveLength(5);
    expect(run.results.filter((r) => r.outcome === 'postponed')).toHaveLength(2);
  });
  it('unschedule returns it to review; publish now works only when due', async () => {
    const sub = await scheduled();
    await expect(wf.publishNow(sub.id, boss, deps)).rejects.toThrow('not due');
    const back = await wf.unschedule(sub.id, boss, deps);
    expect(back.state).toBe('pending');
    expect(back.scheduled).toBeUndefined();
    const again = await wf.schedule(back.id, boss, { viewedHash: back.contentHash, ...ANSWERS, at }, deps);
    toTime();
    expect((await wf.publishNow(again.id, boss, deps)).state).toBe('published');
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
  });
});

describe('cron auth', () => {
  it('fails closed without a secret; refuses wrong or missing tokens', () => {
    expect(bearerMatches('Bearer x', undefined)).toBe(false);
    expect(bearerMatches(null, 's3cret')).toBe(false);
    expect(bearerMatches('Bearer wrong', 's3cret')).toBe(false);
    expect(bearerMatches('s3cret', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
  });
  it('the route refuses with 401 before touching anything', async () => {
    const { GET, POST } = await import('../../src/pages/admin/api/cron/run-schedules.ts');
    const call = (handler: typeof GET, headers: Record<string, string> = {}) => handler({ request: new Request('https://x.test/admin/api/cron/run-schedules/', { headers }) } as never) as Promise<Response>;
    expect((await call(GET)).status).toBe(401);
    expect((await call(GET, { authorization: 'Bearer anything' })).status).toBe(401);
    secrets.values.CRON_SECRET = 'real-secret';
    expect((await call(GET, { authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await call(POST, {})).status).toBe(401);
  });
  it('the configured path keeps its trailing slash, because cron follows no redirect', () => {
    expect(readFileSync(join(process.cwd(), 'integrations/vercel-routes.ts'), 'utf8')).toContain("path: '/admin/api/cron/run-schedules/'");
  });
});

describe('trash and restore', () => {
  beforeEach(() => {
    gh.tree[postPath('git-draft')] = { raw: serializePost({ frontmatter: { status: 'draft', title: 'D', topic: 't', owner: '/x/' }, body: 'b' }), sha: 'd1' };
    gh.tree[RA] = { raw: '[]\n', sha: 'ra' };
    gh.tree[GA] = { raw: '[]\n', sha: 'ga' };
  });
  it('a live post cannot go in the trash: unpublish first', async () => {
    await expect(wf.trash('my-post', boss, deps)).rejects.toThrow('unpublished before');
  });
  it('a draft: flag only, no commit, read-only until restored, and restored to Draft', async () => {
    collections.data = { posts: [entry('git-draft', 'draft')] };
    await wf.trash('git-draft', editor, deps);
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(await rowFor('git-draft')).toMatchObject({ label: 'In trash', trashed: true, actions: ['view', 'restore'] });
    await expect(wf.startEdit('git-draft', (c) => ({ ...c, body: 'x' }), 'd1', editor, deps)).rejects.toThrow('trash');
    await wf.restore('git-draft', editor, deps);
    expect(await rowFor('git-draft')).toMatchObject({ label: 'Draft', trashed: false });
    expect(parsePost(gh.tree[postPath('git-draft')].raw).frontmatter.status).toBe('draft');
  });
  it('an unpublished post restores to Unpublished, never live', async () => {
    await wf.unpublish('my-post', boss, { mode: 'gone' }, deps);
    await wf.trash('my-post', boss, deps);
    await wf.restore('my-post', boss, deps);
    expect(await wf.postStatus('my-post', 'approver', deps)).toMatchObject({ site: 'unpublished', trashed: false });
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
  });
  it('permanent delete: typed slug, trash first, one commit removing the folder', async () => {
    gh.tree['src/content/posts/git-draft/note.txt'] = { raw: 'x', sha: 'n' };
    await expect(wf.deletePost('git-draft', boss, { confirm: 'git-draft' }, deps)).rejects.toThrow('trash first');
    await wf.trash('git-draft', boss, deps);
    await expect(wf.deletePost('git-draft', boss, { confirm: 'wrong' }, deps)).rejects.toMatchObject({ status: 400 });
    await wf.deletePost('git-draft', boss, { confirm: 'git-draft' }, deps);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
    expect(gh.repo.commit.mock.calls[0][0].deletes.sort()).toEqual([postPath('git-draft'), 'src/content/posts/git-draft/note.txt'].sort());
    expect(gh.tree[postPath('git-draft')]).toBeUndefined();
    expect(store.flags.get('git-draft')?.removed).toBeTruthy();
  });
  it('a draft holding a public WordPress address must choose its rule', async () => {
    gh.tree['migration/posts-manifest.csv'] = { raw: 'path,x\n/git-draft/,keep\n', sha: 'm' };
    await wf.trash('git-draft', boss, deps);
    await expect(wf.deletePost('git-draft', boss, { confirm: 'git-draft' }, deps)).rejects.toThrow('was public');
    await wf.deletePost('git-draft', boss, { confirm: 'git-draft', mode: 'gone' }, deps);
    expect(parseYaml(gh.tree[GA].raw)).toEqual([expect.objectContaining({ path: '/git-draft/' })]);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
  });
  it('a copy that never reached Git goes with no commit', async () => {
    const sub = await newDraft('only-here');
    await wf.trash('only-here', editor, deps);
    await wf.deletePost('only-here', boss, { confirm: 'only-here' }, deps);
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(await store.getSubmission(sub.id)).toBeNull();
  });
  it('emptying needs its phrase, and reports each row', async () => {
    await newDraft('only-here');
    await wf.trash('only-here', editor, deps);
    gh.tree['migration/posts-manifest.csv'] = { raw: 'path,x\n/git-draft/,keep\n', sha: 'm' };
    await wf.trash('git-draft', boss, deps);
    await expect(wf.emptyTrash(boss, 'yes', deps)).rejects.toMatchObject({ status: 400 });
    const results = await wf.emptyTrash(boss, wf.EMPTY_TRASH_CONFIRM, deps);
    expect(results.map((r) => [r.slug, r.ok])).toEqual([['only-here', true], ['git-draft', false]]);
    expect(store.flags.get('git-draft')?.trashed).toBeTruthy();
  });
  it('after 30 days the runner purges store-only copies but never commits a Git deletion', async () => {
    const sub = await newDraft('only-here');
    await wf.trash('only-here', editor, deps);
    await wf.trash('git-draft', editor, deps);
    clock = new Date(clock.getTime() + 31 * 86_400_000);
    await wf.runDueSchedules(deps);
    expect(await store.getSubmission(sub.id)).toBeNull();
    expect(store.flags.get('git-draft')?.trashed).toBeTruthy();
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
});

describe('revisions', () => {
  it('each changing save snapshots; a no-op does not; restore goes to the copy, not live', async () => {
    const sub = await startCopy();
    expect((await store.listRevisions(sub.id))).toHaveLength(1);
    const two = await wf.saveEdit(sub.id, { ...sub.content, body: 'two' }, editor, sub.updatedAt, deps);
    await wf.saveEdit(sub.id, two.content, editor, two.updatedAt, deps);
    const revisions = await store.listRevisions(sub.id);
    expect(revisions).toHaveLength(2);
    const oldest = revisions.find((r) => r.content.body === 'Changed\n')!;
    const restored = await wf.restoreRevision(sub.id, oldest.id, editor, deps);
    expect(restored.content.body).toBe('Changed\n');
    expect(restored.state).toBe('draft');
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(gh.tree[PATH].raw).toBe(live());
    await expect(wf.restoreRevision(sub.id, 'nope', editor, deps)).rejects.toMatchObject({ status: 404 });
  });
  it('a new post keeps its starting text as the first version', async () => {
    const sub = await newDraft('fresh-one');
    await wf.saveEdit(sub.id, { ...sub.content, body: 'first words' }, editor, sub.updatedAt, deps);
    expect(await store.listRevisions(sub.id)).toHaveLength(2);
  });
  it('capped at 50', async () => {
    let sub = await startCopy();
    for (let i = 0; i < 53; i++) sub = await wf.saveEdit(sub.id, { ...sub.content, body: `v${i}` }, editor, sub.updatedAt, deps);
    expect(await store.listRevisions(sub.id)).toHaveLength(lc.REVISION_CAP);
  });
  it('a failing snapshot does not lose the save', async () => {
    const sub = await startCopy();
    store.putRevision = async () => {
      throw new Error('down');
    };
    expect((await wf.saveEdit(sub.id, { ...sub.content, body: 'kept' }, editor, sub.updatedAt, deps)).content.body).toBe('kept');
  });
  it('the file store keeps and removes revisions and flags, on disk in a temp folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'admin-store-'));
    try {
      const file = createFileStore(root);
      await file.putRevision({ id: 'a-1', submissionId: 'a', hash: 'h', updatedAt: 't', by: 'x', content: { frontmatter: {}, body: '' } });
      expect(await file.listRevisions('a')).toHaveLength(1);
      await file.deleteRevision('a-1');
      expect(await file.listRevisions('a')).toEqual([]);
      await file.putFlag({ id: 'p', updatedAt: 't', trashed: { at: 't', by: 'x' } });
      expect((await file.getFlag('p'))!.trashed).toBeTruthy();
      await file.deleteFlag('p');
      expect(await file.getFlag('p')).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('bulk', () => {
  beforeEach(() => {
    gh.tree[postPath('git-draft')] = { raw: serializePost({ frontmatter: { status: 'draft', title: 'D', topic: 't', owner: '/x/' }, body: 'b' }), sha: 'd1' };
  });
  it('per-row results: one refusal stops nothing', async () => {
    const results = await wf.bulk('trash', ['my-post', 'git-draft', '../evil', 'missing-one'], {}, editor, deps);
    expect(results.map((r) => [r.slug, r.ok])).toEqual([['my-post', false], ['git-draft', true], ['../evil', false], ['missing-one', false]]);
  });
  it.each(['approve', 'publish', 'publish-now', 'schedule', 'unpublish', 'delete'])('has no %s path', async (op) => {
    await expect(wf.bulk(op, ['my-post'], {}, boss, deps)).rejects.toMatchObject({ status: 400 });
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('caps at 50 and dedupes', async () => {
    await expect(wf.bulk('trash', Array.from({ length: 51 }, (_, i) => `s${i}`), {}, boss, deps)).rejects.toThrow('at most 50');
    expect(await wf.bulk('trash', ['git-draft', 'git-draft'], {}, boss, deps)).toHaveLength(1);
  });
  it('submit a Git draft as it stands, and never commits', async () => {
    const [row] = await wf.bulk('submit', ['git-draft'], {}, editor, deps);
    expect(row.ok).toBe(true);
    expect((await wf.postStatus('git-draft', 'editor', deps)).work).toBe('in_review');
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('assign author and set topic go to a working copy, with no change to live', async () => {
    await wf.bulk('assign-author', ['my-post'], { author: 'someone' }, editor, deps);
    expect((await wf.postStatus('my-post', 'editor', deps)).active!.content.frontmatter.author).toBe('someone');
    await wf.bulk('set-topic', ['my-post'], { topic: 'billing' }, editor, deps);
    expect((await wf.postStatus('my-post', 'editor', deps)).active!.content.frontmatter.topic).toBe('billing');
    expect(gh.tree[PATH].raw).toBe(live());
    await expect(wf.bulk('assign-author', ['my-post'], {}, editor, deps)).rejects.toMatchObject({ status: 400 });
  });
  it('duplicate per row', async () => {
    const [row] = await wf.bulk('duplicate', ['my-post'], {}, editor, deps);
    expect(row.message).toContain('/my-post-copy/');
  });
});

describe('duplicate', () => {
  it('a new draft with no keyword and no pass, and the next free address', async () => {
    gh.tree[PATH] = { raw: live({ editorialPass: { by: 'x' } }), sha: 'v1' };
    const a = await wf.duplicatePost('my-post', editor, deps);
    expect(a).toMatchObject({ slug: 'my-post-copy', kind: 'new', state: 'draft' });
    expect(a.content.frontmatter).toMatchObject({ status: 'draft' });
    expect(a.content.frontmatter.headKeyword).toBeUndefined();
    expect(a.content.frontmatter.editorialPass).toBeUndefined();
    expect((await wf.duplicatePost('my-post', editor, deps)).slug).toBe('my-post-copy-2');
  });
});

describe('rename', () => {
  beforeEach(() => {
    gh.tree[RA] = { raw: '[]\n', sha: 'ra' };
    gh.tree[GA] = { raw: '[]\n', sha: 'ga' };
  });
  const approveRename = async (from: string, to: string) => {
    await wf.renamePost(from, to, editor, deps);
    const status = await wf.postStatus(from, 'editor', deps);
    const pending = await wf.submitForApproval(status.active!.id, editor, deps);
    return wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps);
  };
  it('goes through review: nothing commits until approved, then one commit moves it with a 301', async () => {
    await wf.renamePost('my-post', 'better-name', editor, deps);
    expect(gh.repo.commit).not.toHaveBeenCalled();
    expect(gh.tree[PATH]).toBeTruthy();
    const status = await wf.postStatus('my-post', 'editor', deps);
    const pending = await wf.submitForApproval(status.active!.id, editor, deps);
    const done = await wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps);
    expect(gh.repo.commit).toHaveBeenCalledTimes(1);
    const plan = gh.repo.commit.mock.calls[0][0];
    expect(plan.deletes).toEqual([PATH]);
    expect(plan.writes.map((w) => w.path).sort()).toEqual([RA, postPath('better-name')].sort());
    expect(gh.tree[PATH]).toBeUndefined();
    expect(parseYaml(gh.tree[RA].raw)).toEqual([expect.objectContaining({ from: '/my-post/', to: '/better-name/' })]);
    expect(done.slug).toBe('better-name');
    expect(store.flags.get('my-post')?.removed?.renamedTo).toBe('better-name');
  });
  it('renaming back removes the old row, so there is neither a page on a rule nor a loop', async () => {
    await approveRename('my-post', 'better-name');
    routes.pages = [{ path: '/better-name/', postSlug: 'better-name', status: 'published' }, { path: '/features/billing/' }];
    await approveRename('better-name', 'my-post');
    expect(parseYaml(gh.tree[RA].raw)).toEqual([expect.objectContaining({ from: '/better-name/', to: '/my-post/' })]);
    expect(gh.tree[PATH]).toBeTruthy();
    expect(gh.tree[postPath('better-name')]).toBeUndefined();
  });
  it('refuses a taken, reserved or rule-held address, naming the file it cannot edit', async () => {
    gh.tree[postPath('taken')] = { raw: live(), sha: 't' };
    await expect(wf.renamePost('my-post', 'taken', editor, deps)).rejects.toThrow('already exists');
    await expect(wf.renamePost('my-post', 'admin', editor, deps)).rejects.toThrow('reserved');
    gh.tree[R] = { raw: '- { from: /held/, to: /features/billing/ }\n', sha: 'r2' };
    await expect(wf.renamePost('my-post', 'held', editor, deps)).rejects.toThrow(/redirect/);
  });
  it('refuses a post with other files beside it at approval', async () => {
    gh.tree['src/content/posts/my-post/photo.png'] = { raw: 'x', sha: 'p' };
    await wf.renamePost('my-post', 'better-name', editor, deps);
    const status = await wf.postStatus('my-post', 'editor', deps);
    const pending = await wf.submitForApproval(status.active!.id, editor, deps);
    await expect(wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps)).rejects.toThrow('other files');
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
  it('a post only in the store just changes address, with no rule', async () => {
    await newDraft('draft-one');
    expect((await wf.renamePost('draft-one', 'draft-two', editor, deps)).slug).toBe('draft-two');
    expect(gh.repo.commit).not.toHaveBeenCalled();
  });
});

describe('audit bugs', () => {
  const published = async (slug: string) => {
    await newDraft(slug);
    const [sub] = (await store.listSubmissions()).filter((s) => s.slug === slug);
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    return wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps);
  };
  it('a just-published new post stays in the list before the deployment has it, labelled Published', async () => {
    deps.now = () => new Date();
    await published('brand-new');
    expect(await rowFor('brand-new')).toMatchObject({ site: 'live', label: 'Published', hint: 'Building, live in a few minutes' });
  });
  it('a published Git draft reads Published before the deployment catches up', async () => {
    gh.tree[postPath('was-draft')] = { raw: serializePost({ frontmatter: { status: 'draft', title: 'D', topic: 't', owner: '/x/' }, body: 'b' }), sha: 'd1' };
    collections.data = { posts: [entry('was-draft', 'draft')] };
    const pending = await inReview('was-draft');
    await wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, { ...deps, now: () => new Date() });
    expect(await rowFor('was-draft')).toMatchObject({ site: 'live', label: 'Published' });
  });
  it('a rejected new post stays findable and offers reopen', async () => {
    const sub = await newDraft('rejected-one');
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    await wf.reject(pending.id, boss, 'Not this one', deps);
    expect(await rowFor('rejected-one')).toMatchObject({ label: 'Rejected', submissionId: sub.id, hint: 'Rejected: Not this one', actions: expect.arrayContaining(['reopen']) });
    expect((await wf.reopen(sub.id, editor, deps)).state).toBe('draft');
    expect(await rowFor('rejected-one')).toMatchObject({ label: 'Draft', work: 'editing' });
  });
  it('a rejected edit of a live post stays Published and offers reopen', async () => {
    collections.data = { posts: [entry('my-post', 'published')] };
    const pending = await inReview();
    await wf.reject(pending.id, boss, 'No', deps);
    expect(await rowFor('my-post')).toMatchObject({ site: 'live', label: 'Published', actions: expect.arrayContaining(['reopen']) });
  });
  it('a Git draft with a copy reads Draft, never as an edit of a live post', async () => {
    gh.tree[postPath('git-one')] = { raw: serializePost({ frontmatter: { status: 'draft', title: 'D', topic: 't', owner: '/x/' }, body: 'b' }), sha: 'd1' };
    collections.data = { posts: [entry('git-one', 'draft')] };
    expect((await rowFor('git-one'))!.label).toBe('Draft');
    const sub = await startCopy('git-one');
    expect(sub.sourceStatus).toBe('draft');
    const row = (await rowFor('git-one'))!;
    expect(row).toMatchObject({ site: 'draft', work: 'editing', label: 'Draft' });
    expect(row.hint ?? '').not.toMatch(/live/i);
  });
  it('a Git draft may submit unchanged; a live post may not', async () => {
    gh.tree[postPath('git-one')] = { raw: serializePost({ frontmatter: { status: 'draft', title: 'D', topic: 't', owner: '/x/' }, body: 'b' }), sha: 'd1' };
    const [row] = await wf.bulk('submit', ['git-one'], {}, editor, deps);
    expect(row.ok).toBe(true);
    const [bad] = await wf.bulk('submit', ['my-post'], {}, editor, deps);
    expect(bad.ok).toBe(false);
  });
  it('keywordConflict: unpublishing or deleting releases a keyword; publishing does not', async () => {
    const keyword = { frontmatter: { headKeyword: 'live keyword' }, body: '' };
    gh.tree[RA] = { raw: '[]\n', sha: 'ra' };
    gh.tree[GA] = { raw: '[]\n', sha: 'ga' };
    routes.headKeywords = [{ keyword: 'live keyword', path: '/my-post/', postSlug: 'my-post' }];
    const other = { slug: 'other-post' } as Submission;
    const gate = async () => (await wf.gateChecks(other, keyword, deps)).filter((c) => c.rule === 'cannibalisation');
    expect(await gate()).toHaveLength(1);
    await wf.unpublish('my-post', boss, { mode: 'gone' }, deps);
    expect(await gate()).toHaveLength(0);
  });
  it('keywordConflict: a store row saying published does not hold a keyword once main disagrees', async () => {
    const sub = await startCopy();
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    await wf.approve(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS }, deps);
    const keyword = { frontmatter: { headKeyword: 'live keyword' }, body: '' };
    const other = { slug: 'other-post' } as Submission;
    const gate = async () => (await wf.gateChecks(other, keyword, deps)).filter((c) => c.rule === 'cannibalisation');
    expect(await gate()).toHaveLength(1);
    delete gh.tree[PATH]; // A developer removed it directly.
    expect(await gate()).toHaveLength(0);
  });
  it('dashboard counts agree with the tabs, and the feed is newest first', async () => {
    collections.data = { posts: [entry('my-post', 'published'), entry('git-one', 'draft')] };
    await startCopy();
    const rows = await postRows(await store.listSubmissions(), 'editor', await store.listFlags());
    expect(await pipelineCounts(rows)).toEqual({ drafts: 1, inReview: 0, scheduled: 0, published: 1 });
    expect(rows.filter((r) => lc.inTab('edits', r)).map((r) => r.slug)).toEqual(['my-post']);
    const feed = await activityFeed(5, await store.listSubmissions());
    expect(feed[0]).toMatchObject({ action: 'created', slug: 'my-post', text: 'Started' });
  });
  it('postStatus reports a Git draft and a deleted post from main, not the deployment', async () => {
    expect((await wf.postStatus('nothing-here', 'approver', deps)).site).toBe('never');
    expect((await wf.postStatus('my-post', 'approver', deps)).site).toBe('live');
  });
});
