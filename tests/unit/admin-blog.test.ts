/** The blog editor's model: drafts in the store, one commit per publish, images with their post, schedules. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, BlogDraft, Check, Store } from '../../src/lib/admin/types.ts';
import { fakeRepo, storeExtras } from './admin-fakes.ts';

const gate: { checks: Check[] } = { checks: [] };
vi.mock('../../src/lib/admin/env.ts', () => ({ env: () => undefined }));
vi.mock('../../src/lib/admin/harness.ts', () => ({ checkPost: () => [], checkForBuild: () => gate.checks }));

const blog = await import('../../src/lib/admin/blog.ts');
const { parsePost, serializePost } = await import('../../src/lib/admin/mdx-file.ts');

const me: AdminUser = { email: 'admin@x.com', name: 'Admin', role: 'approver' };
const NOW = new Date('2026-11-09T10:00:00Z');

function setup(tree: Record<string, { raw: string; sha: string | null }> = {}) {
  const store = {
    getSubmission: async () => null, listSubmissions: async () => [], putSubmission: async () => {},
    getJob: async () => null, listJobs: async () => [], putJob: async () => {},
    ...storeExtras(async () => []),
  } as unknown as Store & { docs: Map<string, unknown> };
  const { repo } = fakeRepo(tree);
  const deps = { store, repo, routes: async () => ({ pages: [], redirects: [], gone: [{ path: '/gone-page/' }] }), now: () => NOW };
  return { store, repo, deps, tree };
}

const livePost = (title = 'Live post') => serializePost({ frontmatter: { status: 'published', title, h1: title, headKeyword: 'k', topic: 'cura-ai', owner: '/features/', originallyPublished: '2026-01-01' }, body: 'Hello\n' });

beforeEach(() => {
  gate.checks = [];
});

describe('drafts', () => {
  it('creates a draft in the store only, and refuses taken or reserved addresses', async () => {
    const { deps, repo, tree } = setup({ 'src/content/posts/taken/index.mdx': { raw: livePost(), sha: 'a' } });
    expect(await blog.createPost({ title: 'My first post', slug: 'my-first-post' }, me, deps)).toBe('my-first-post');
    expect(repo.commit).not.toHaveBeenCalled();
    expect(Object.keys(tree)).toHaveLength(1);
    await expect(blog.createPost({ title: 'Again', slug: 'my-first-post' }, me, deps)).rejects.toThrow(/already uses/);
    await expect(blog.createPost({ title: 'Taken', slug: 'taken' }, me, deps)).rejects.toThrow(/already uses/);
    await expect(blog.createPost({ title: 'Gone', slug: 'gone-page' }, me, deps)).rejects.toThrow(/gone/);
    await expect(blog.createPost({ title: 'Bad', slug: 'Bad Slug' }, me, deps)).rejects.toThrow(/lowercase/);
  });

  it('saving a live post keeps it live with changes; a new post can move to a new address with its images', async () => {
    const { deps } = setup({ 'src/content/posts/live/index.mdx': { raw: livePost(), sha: 'a' } });
    await blog.saveDraft('live', { frontmatter: { title: 'Edited' }, body: 'x' }, me, {}, deps);
    const open = await blog.openPost('live', deps);
    expect(open).toMatchObject({ status: 'published', live: true, changes: true, isNew: false });
    expect(open?.content.frontmatter.title).toBe('Edited');
    await expect(blog.saveDraft('live', { frontmatter: {}, body: '' }, me, { newSlug: 'other' }, deps)).rejects.toThrow(/keeps its web address/);

    await blog.createPost({ title: 'Fresh one', slug: 'fresh' }, me, deps);
    await blog.uploadImage('fresh', { name: 'Photo.PNG', type: 'image/png', bytes: new Uint8Array([1, 2, 3]) }, false, deps);
    const moved = await blog.saveDraft('fresh', { frontmatter: { title: 'Fresh one' }, body: '' }, me, { newSlug: 'fresh-two' }, deps);
    expect(moved.slug).toBe('fresh-two');
    expect(await blog.openPost('fresh', deps)).toBeNull();
    const media = await deps.store.listDocs<{ id: string; updatedAt: string; slug: string }>('media');
    expect(media.map((m) => m.slug)).toEqual(['fresh-two']);
  });
});

describe('images', () => {
  it('accepts common image types up to 4 MB and names them safely', async () => {
    const { deps } = setup();
    const up = await blog.uploadImage('p', { name: '../My Photo!.jpg', type: 'image/jpeg', bytes: new Uint8Array([9]) }, false, deps);
    expect(up.name).toMatch(/^my-photo-[0-9a-f]{6}\.jpg$/);
    expect((await blog.readImage('p', up.name, deps))?.type).toBe('image/jpeg');
    await expect(blog.uploadImage('p', { name: 'x.svg', type: 'image/svg+xml', bytes: new Uint8Array([1]) }, false, deps)).rejects.toThrow(/JPG/);
    await expect(blog.uploadImage('p', { name: 'x.gif', type: 'image/gif', bytes: new Uint8Array([1]) }, true, deps)).rejects.toThrow(/featured/);
    await expect(blog.uploadImage('p', { name: 'big.png', type: 'image/png', bytes: new Uint8Array(blog.MAX_IMAGE_BYTES + 1) }, false, deps)).rejects.toThrow(/4 MB/);
    expect(await blog.readImage('p', '../../etc/passwd', deps)).toBeNull();
  });

  it('a new featured image replaces the previous upload', async () => {
    const { deps } = setup();
    await blog.uploadImage('p', { name: 'a.png', type: 'image/png', bytes: new Uint8Array([1]) }, true, deps);
    await blog.uploadImage('p', { name: 'b.webp', type: 'image/webp', bytes: new Uint8Array([2]) }, true, deps);
    const covers = (await deps.store.listDocs<{ id: string; updatedAt: string; name: string }>('media')).map((m) => m.name);
    expect(covers).toEqual(['cover.webp']);
    expect((await blog.readImage('p', 'cover', deps))?.type).toBe('image/webp');
  });
});

describe('publishing', () => {
  it('publishes in one commit with the used images and the featured image, then clears the draft', async () => {
    const { deps, repo, tree } = setup({ 'src/assets/images/blog/post.jpg': { raw: 'old', sha: 'c' } });
    await blog.createPost({ title: 'A post', slug: 'post' }, me, deps);
    const used = await blog.uploadImage('post', { name: 'used.png', type: 'image/png', bytes: new Uint8Array([1, 2]) }, false, deps);
    await blog.uploadImage('post', { name: 'unused.png', type: 'image/png', bytes: new Uint8Array([3]) }, false, deps);
    await blog.uploadImage('post', { name: 'c.webp', type: 'image/webp', bytes: new Uint8Array([4]) }, true, deps);
    const draft = (await deps.store.getDoc<BlogDraft>('draft', 'post'))!;
    await blog.saveDraft('post', { ...draft.content, body: `Text\n\n![Alt](./${used.name})\n` }, me, {}, deps);

    await blog.publishPost('post', me, deps);
    expect(repo.commit).toHaveBeenCalledTimes(1);
    const plan = repo.commit.mock.calls[0][0];
    expect(plan.writes.map((w) => w.path).sort()).toEqual(['src/assets/images/blog/post.webp', `src/content/posts/post/${used.name}`, 'src/content/posts/post/index.mdx'].sort());
    expect(plan.writes.filter((w) => w.encoding === 'base64')).toHaveLength(2);
    expect(plan.deletes).toEqual(['src/assets/images/blog/post.jpg']);
    const fm = parsePost(tree['src/content/posts/post/index.mdx'].raw).frontmatter;
    expect(fm).toMatchObject({ status: 'published', lastUpdated: '2026-11-09', originallyPublished: '2026-11-09' });
    expect(await deps.store.getDoc('draft', 'post')).toBeNull();
    expect(await deps.store.listDocs('media')).toEqual([]);
    expect(await blog.openPost('post', deps)).toMatchObject({ status: 'published', live: true, changes: false });
  });

  it('refuses to publish while a check fails, and commits nothing', async () => {
    const { deps, repo } = setup();
    await blog.createPost({ title: 'A post', slug: 'post' }, me, deps);
    gate.checks = [{ rule: 'schema', severity: 'error', path: 'metaDescription', message: 'Add the meta description.' }, { rule: 'x', severity: 'warning', path: 'body', message: 'Just a hint' }];
    await expect(blog.publishPost('post', me, deps)).rejects.toThrow(/Fix one thing.*meta description/);
    expect(repo.commit).not.toHaveBeenCalled();
  });

  it('keeps the original publish date when updating a live post', async () => {
    const { deps, tree } = setup({ 'src/content/posts/live/index.mdx': { raw: livePost(), sha: 'a' } });
    await blog.saveDraft('live', { ...parsePost(livePost()), body: 'Updated\n' }, me, {}, deps);
    const reply = await blog.publishPost('live', me, deps);
    expect(reply.message).toMatch(/Changes published/);
    const fm = parsePost(tree['src/content/posts/live/index.mdx'].raw).frontmatter;
    expect(fm.originallyPublished).toBe('2026-01-01');
  });

  it('unpublish turns the file into a draft; delete refuses a live post and removes a draft completely', async () => {
    const { deps, tree } = setup({ 'src/content/posts/live/index.mdx': { raw: livePost(), sha: 'a' }, 'src/content/posts/live/pic.png': { raw: 'x', sha: 'b' } });
    await expect(blog.deletePost('live', me, deps)).rejects.toThrow(/Unpublish/);
    await blog.unpublishPost('live', me, deps);
    expect(parsePost(tree['src/content/posts/live/index.mdx'].raw).frontmatter.status).toBe('draft');
    await expect(blog.deletePost('live', me, deps)).rejects.toThrow(/trash first/);
    await blog.trashPost('live', me, deps);
    await blog.deletePost('live', me, deps);
    expect(Object.keys(tree)).toEqual([]);
    expect(await deps.store.getDoc('recent', 'live')).toMatchObject({ state: 'deleted' });
  });
});

describe('trash', () => {
  it('moves a draft to the trash, blocks editing it there, and restores it', async () => {
    const { deps } = setup();
    await blog.createPost({ title: 'A post', slug: 'post' }, me, deps);
    expect((await blog.trashPost('post', me, deps)).message).toMatch(/trash/);
    expect((await blog.openPost('post', deps))?.status).toBe('trash');
    await expect(blog.saveDraft('post', blankPostFor('post'), me, {}, deps)).rejects.toThrow(/Restore it first/);
    await expect(blog.publishPost('post', me, deps)).rejects.toThrow(/Restore it first/);
    await blog.restorePost('post', deps);
    expect((await blog.openPost('post', deps))?.status).toBe('draft');
    await expect(blog.restorePost('post', deps)).rejects.toThrow(/not in the trash/);
  });

  it('refuses to trash a live post', async () => {
    const { deps } = setup({ 'src/content/posts/live/index.mdx': { raw: livePost(), sha: 'a' } });
    await expect(blog.trashPost('live', me, deps)).rejects.toThrow(/Unpublish/);
  });
});

const blankPostFor = (title: string) => blog.blankPost(title, new Date('2026-11-11T00:00:00Z'));

describe('scheduling', () => {
  it('refuses past times and failing checks; publishes when due', async () => {
    const { deps, repo } = setup();
    await blog.createPost({ title: 'Later post', slug: 'later' }, me, deps);
    await expect(blog.schedulePost('later', '2026-11-09T09:00:00Z', me, deps)).rejects.toThrow(/future/);
    gate.checks = [{ rule: 'schema', severity: 'error', path: 'author', message: 'Add an author.' }];
    await expect(blog.schedulePost('later', '2026-11-10T09:00:00Z', me, deps)).rejects.toThrow(/before scheduling/);
    gate.checks = [];
    await blog.schedulePost('later', '2026-11-10T09:00:00Z', me, deps);
    expect((await blog.openPost('later', deps))?.status).toBe('scheduled');

    expect(await blog.runDueSchedules(deps)).toEqual([]);
    const later = { ...deps, now: () => new Date('2026-11-10T09:05:00Z') };
    const results = await blog.runDueSchedules(later);
    expect(results).toMatchObject([{ slug: 'later', ok: true }]);
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect((await blog.openPost('later', later))?.status).toBe('published');
  });

  it('cancelling a schedule makes it a draft again', async () => {
    const { deps } = setup();
    await blog.createPost({ title: 'Later post', slug: 'later' }, me, deps);
    await blog.schedulePost('later', '2026-11-10T09:00:00Z', me, deps);
    await blog.unschedulePost('later', deps);
    expect((await blog.openPost('later', deps))?.status).toBe('draft');
  });
});
