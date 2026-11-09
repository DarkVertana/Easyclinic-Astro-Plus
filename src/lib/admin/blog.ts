/**
 * The blog editor's whole model: Draft, Scheduled, Published. No approvals.
 *
 * Published content lives in the repository (src/content/posts/<slug>/index.mdx, images beside it, the featured image
 * at src/assets/images/blog/<slug>.<ext>). Work that is not live yet lives in the store as one BlogDraft per slug, with
 * its uploaded images as BlogMedia. Publishing writes everything in one commit. Everything that touches the repository
 * goes through `publishTarget` below, so a later move to a database changes one place.
 */
import { createHash } from 'node:crypto';
import { checkForBuild } from './harness.ts';
import { parsePost, serializePost } from './mdx-file.ts';
import { assertSlug, postPath } from './repo.ts';
import { PublicError } from './http.ts';
import { defaultDeps, keywordConflict, slugConflict, withPostDefaults, type RouteRules } from './workflow.ts';
import type { AdminUser, BlogDraft, BlogMedia, BlogRecent, Check, CommitPlan, ContentRepo, PostContent, Store } from './types.ts';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_RAW_BYTES = 900_000;

export type BlogStatus = 'draft' | 'scheduled' | 'published';

export interface BlogDeps {
  store: Store;
  repo: ContentRepo;
  routes: () => Promise<RouteRules>;
  now: () => Date;
}

export function blogDeps(): BlogDeps {
  const base = defaultDeps();
  return { store: base.store, repo: base.repo, routes: base.routes, now: base.now };
}

const today = (now: Date) => now.toISOString().slice(0, 10);
const coverPath = (slug: string, ext: string) => `src/assets/images/blog/${slug}.${ext}`;
const mediaId = (slug: string, name: string) => `m${createHash('sha256').update(`${slug}|${name}`).digest('hex').slice(0, 40)}`;

function checkedSlug(slug: unknown): string {
  try {
    assertSlug(slug);
  } catch (error) {
    throw new PublicError((error as Error).message, 400);
  }
  if ((slug as string).length > 100) throw new PublicError('Keep the web address under 100 characters.', 400);
  return slug as string;
}

/* ---------- Reading ---------- */

export interface OpenPost {
  slug: string;
  content: PostContent;
  status: BlogStatus;
  /** Live on the site (it may also have unpublished changes). */
  live: boolean;
  /** A draft exists that differs from what is live. */
  changes: boolean;
  isNew: boolean;
  scheduledAt: string | null;
  updatedAt: string | null;
  /** The featured image URL for the editor, or null. */
  coverUrl: string | null;
}

export function statusOf(draft: Pick<BlogDraft, 'scheduledAt'> | null, live: boolean): BlogStatus {
  if (draft?.scheduledAt) return 'scheduled';
  return live ? 'published' : 'draft';
}

export const mediaUrl = (slug: string, name: string) => `/admin/api/media/?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(name)}`;

async function draftCover(store: Store, slug: string): Promise<BlogMedia | null> {
  const all = await store.listDocs<BlogMedia>('media');
  return all.find((m) => m.slug === slug && m.name.startsWith('cover.')) ?? null;
}

/** Opens a post for the editor: the draft if there is one, otherwise the file on main. */
export async function openPost(slugInput: string, deps: BlogDeps = blogDeps()): Promise<OpenPost | null> {
  const slug = checkedSlug(slugInput);
  const [draft, file] = await Promise.all([deps.store.getDoc<BlogDraft>('draft', slug), deps.repo.readPost(slug)]);
  if (!draft && !file) return null;
  const fileContent = file ? parsePost(file.raw) : null;
  const live = fileContent?.frontmatter.status === 'published';
  const content = draft?.content ?? fileContent!;
  return {
    slug,
    content,
    status: statusOf(draft, live),
    live,
    changes: Boolean(draft && live),
    isNew: !file,
    scheduledAt: draft?.scheduledAt ?? null,
    updatedAt: draft?.updatedAt ?? null,
    coverUrl: mediaUrl(slug, 'cover'),
  };
}

/* ---------- Writing drafts ---------- */

/** Fields a new post needs before it can be saved at all; the rest is filled in the editor. */
export function blankPost(title: string, now: Date): PostContent {
  return {
    frontmatter: withPostDefaults(
      {
        status: 'draft',
        headKeyword: '',
        title,
        metaDescription: '',
        h1: title,
        linkLabel: title.slice(0, 48),
        openingAnswer: '',
        summary: '',
        author: null,
        topic: 'running-a-clinic',
        owner: '/features/',
        ctas: { primary: { label: 'Book a 20-minute demo', href: '/demo/' } },
      },
      today(now),
    ),
    body: '',
  };
}

export async function createPost(input: { title: string; slug: string }, user: AdminUser, deps: BlogDeps = blogDeps()): Promise<string> {
  const title = input.title.trim();
  if (title.length < 3) throw new PublicError('Give the post a title.', 400);
  const slug = checkedSlug(input.slug);
  const routes = await deps.routes();
  const conflict = slugConflict(slug, routes, false);
  if (conflict) throw new PublicError(conflict, 409);
  if ((await deps.store.getDoc('draft', slug)) || (await deps.repo.readPost(slug))) throw new PublicError(`A post already uses /${slug}/.`, 409);
  const now = deps.now();
  const draft: BlogDraft = { id: slug, slug, content: blankPost(title, now), isNew: true, scheduledAt: null, updatedAt: now.toISOString(), updatedBy: user.email };
  await deps.store.putDoc('draft', draft);
  return slug;
}

/** Saves the editor's content as the draft. A new post may change its web address here; a live one keeps it. */
export async function saveDraft(slugInput: string, content: PostContent, user: AdminUser, options: { newSlug?: string } = {}, deps: BlogDeps = blogDeps()): Promise<{ slug: string; updatedAt: string }> {
  let slug = checkedSlug(slugInput);
  if (Buffer.byteLength(serializePost(content)) > MAX_RAW_BYTES) throw new PublicError('This post is too long to save.', 413);
  const [existing, file] = await Promise.all([deps.store.getDoc<BlogDraft>('draft', slug), deps.repo.readPost(slug)]);
  const now = deps.now();
  const frontmatter = { ...content.frontmatter };
  if (frontmatter.author === '') frontmatter.author = null;
  const next: BlogDraft = {
    id: slug,
    slug,
    content: { frontmatter, body: content.body.replace(/\r\n/g, '\n') },
    isNew: !file,
    scheduledAt: existing?.scheduledAt ?? null,
    updatedAt: now.toISOString(),
    updatedBy: user.email,
  };
  const wanted = options.newSlug ? checkedSlug(options.newSlug) : slug;
  if (wanted !== slug) {
    if (file) throw new PublicError('A post that is already on the site keeps its web address.', 409);
    const conflict = slugConflict(wanted, await deps.routes(), false);
    if (conflict) throw new PublicError(conflict, 409);
    if ((await deps.store.getDoc('draft', wanted)) || (await deps.repo.readPost(wanted))) throw new PublicError(`A post already uses /${wanted}/.`, 409);
    for (const media of (await deps.store.listDocs<BlogMedia>('media')).filter((m) => m.slug === slug)) {
      await deps.store.putDoc('media', { ...media, id: mediaId(wanted, media.name), slug: wanted });
      await deps.store.deleteDoc('media', media.id);
    }
    await deps.store.deleteDoc('draft', slug);
    slug = wanted;
    next.id = slug;
    next.slug = slug;
  }
  await deps.store.putDoc('draft', next);
  return { slug, updatedAt: next.updatedAt };
}

/** Throws away the draft of a post that is on the site, so the editor shows the live version again. */
export async function discardChanges(slugInput: string, deps: BlogDeps = blogDeps()): Promise<void> {
  const slug = checkedSlug(slugInput);
  if (!(await deps.repo.readPost(slug))) throw new PublicError('This post has never been published. Delete it instead.', 409);
  await deps.store.deleteDoc('draft', slug);
  for (const media of (await deps.store.listDocs<BlogMedia>('media')).filter((m) => m.slug === slug)) await deps.store.deleteDoc('media', media.id);
}

/* ---------- Images ---------- */

function safeImageName(original: string, ext: string, bytes: Uint8Array): string {
  const base = original.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  const tag = createHash('sha256').update(bytes).digest('hex').slice(0, 6);
  return `${base}-${tag}.${ext}`;
}

/** Keeps an uploaded image with the draft. `cover` makes it the featured image. Returns the name to reference. */
export async function uploadImage(slugInput: string, file: { name: string; type: string; bytes: Uint8Array }, cover: boolean, deps: BlogDeps = blogDeps()): Promise<{ name: string; url: string }> {
  const slug = checkedSlug(slugInput);
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new PublicError('Use a JPG, PNG, WebP or GIF image.', 415);
  if (cover && ext === 'gif') throw new PublicError('The featured image must be a JPG, PNG or WebP.', 415);
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new PublicError('Images can be up to 4 MB. Make it smaller and try again.', 413);
  if (file.bytes.byteLength === 0) throw new PublicError('That file is empty.', 400);
  const name = cover ? `cover.${ext}` : safeImageName(file.name, ext, file.bytes);
  if (cover) {
    const old = await draftCover(deps.store, slug);
    if (old) await deps.store.deleteDoc('media', old.id);
  }
  const media: BlogMedia = { id: mediaId(slug, name), slug, name, type: file.type, data: Buffer.from(file.bytes).toString('base64'), updatedAt: deps.now().toISOString() };
  await deps.store.putDoc('media', media);
  return { name, url: mediaUrl(slug, cover ? 'cover' : name) };
}

export async function removeCover(slugInput: string, deps: BlogDeps = blogDeps()): Promise<void> {
  const slug = checkedSlug(slugInput);
  const old = await draftCover(deps.store, slug);
  if (old) await deps.store.deleteDoc('media', old.id);
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** An image for the editor and preview: the draft's upload first, then the published file. */
export async function readImage(slugInput: string, name: string, deps: BlogDeps = blogDeps()): Promise<{ type: string; bytes: Uint8Array } | null> {
  const slug = checkedSlug(slugInput);
  if (name === 'cover') {
    const draft = await draftCover(deps.store, slug);
    if (draft) return { type: draft.type, bytes: new Uint8Array(Buffer.from(draft.data, 'base64')) };
    for (const ext of COVER_EXTS) {
      const bytes = await deps.repo.readBytes(coverPath(slug, ext));
      if (bytes) return { type: MIME[ext], bytes };
    }
    return null;
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return null;
  const media = await deps.store.getDoc<BlogMedia>('media', mediaId(slug, name));
  if (media) return { type: media.type, bytes: new Uint8Array(Buffer.from(media.data, 'base64')) };
  const bytes = await deps.repo.readBytes(`src/content/posts/${slug}/${name}`);
  return bytes ? { type: MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream', bytes } : null;
}

/* ---------- Checks and publishing ---------- */

/** The content exactly as it would be published. */
export function asPublished(content: PostContent, now: Date, firstTime: boolean): PostContent {
  const fm = withPostDefaults({ ...content.frontmatter }, today(now));
  fm.status = 'published';
  fm.lastUpdated = today(now);
  if (firstTime && !fm.originallyPublished) fm.originallyPublished = today(now);
  return { frontmatter: fm, body: content.body };
}

/** What would stop this post from publishing (errors) or is worth a look (warnings). */
export async function publishChecks(slug: string, content: PostContent, isNew: boolean, deps: BlogDeps = blogDeps()): Promise<Check[]> {
  const routes = await deps.routes();
  const ready = asPublished(content, deps.now(), isNew);
  const checks = checkForBuild(ready, routes.tokenData ?? { prices: {}, facts: {}, figures: {}, publications: {}, contacts: {} });
  if (isNew) {
    const conflict = slugConflict(slug, routes, false);
    if (conflict) checks.push({ rule: 'slug', severity: 'error', path: 'slug', message: conflict });
  }
  const keyword = keywordConflict(ready, slug, routes, []);
  if (keyword) checks.push({ rule: 'cannibalisation', severity: 'error', path: 'headKeyword', message: keyword });
  return checks;
}

/** The one place that writes published content. Today: one commit to the repository. */
async function publishTarget(plan: CommitPlan, deps: BlogDeps): Promise<string> {
  return deps.repo.commit(plan);
}

async function noteRecent(deps: BlogDeps, slug: string, title: unknown, state: BlogRecent['state']): Promise<void> {
  const value: BlogRecent = { id: slug, title: typeof title === 'string' ? title : slug, state, updatedAt: deps.now().toISOString() };
  await deps.store.putDoc('recent', value);
}

function referencedNames(body: string): Set<string> {
  const names = new Set<string>();
  for (const match of body.matchAll(/\]\(\.\/([^)\s]+)\)|src=["']\.\/([^"']+)["']/g)) names.add(match[1] ?? match[2]);
  return names;
}

export async function publishPost(slugInput: string, user: AdminUser, deps: BlogDeps = blogDeps()): Promise<{ message: string }> {
  const slug = checkedSlug(slugInput);
  const [draft, file] = await Promise.all([deps.store.getDoc<BlogDraft>('draft', slug), deps.repo.readPost(slug)]);
  const media = (await deps.store.listDocs<BlogMedia>('media')).filter((m) => m.slug === slug);
  if (!draft && !file) throw new PublicError('That post does not exist.', 404);
  const source = draft?.content ?? parsePost(file!.raw);
  const onMain = file ? parsePost(file.raw).frontmatter : null;
  const isNew = !onMain || (onMain.status !== 'published' && !onMain.originallyPublished);
  const errors = (await publishChecks(slug, source, isNew, deps)).filter((c) => c.severity === 'error');
  if (errors.length) throw new PublicError(`Fix ${errors.length === 1 ? 'one thing' : `${errors.length} things`} before publishing: ${errors.map((e) => e.message).join(' · ')}`, 422);
  const now = deps.now();
  const ready = asPublished(source, now, isNew);
  const used = referencedNames(ready.body);
  const writes: CommitPlan['writes'] = [{ path: postPath(slug), content: serializePost(ready) }];
  const deletes: string[] = [];
  for (const item of media) {
    if (item.name.startsWith('cover.')) {
      const ext = item.name.split('.').pop()!;
      writes.push({ path: coverPath(slug, ext), content: item.data, encoding: 'base64' });
      for (const other of COVER_EXTS.filter((e) => e !== ext)) if (await deps.repo.readBytes(coverPath(slug, other))) deletes.push(coverPath(slug, other));
    } else if (used.has(item.name)) {
      writes.push({ path: `src/content/posts/${slug}/${item.name}`, content: item.data, encoding: 'base64' });
    }
  }
  await publishTarget({ writes, deletes, expect: [], message: `${isNew ? 'Publish' : 'Update'} post ${slug} (${user.email})` }, deps);
  await deps.store.deleteDoc('draft', slug);
  for (const item of media) await deps.store.deleteDoc('media', item.id);
  await noteRecent(deps, slug, ready.frontmatter.title, 'published');
  return { message: isNew ? 'Published. The site updates in a minute or two.' : 'Changes published. The site updates in a minute or two.' };
}

/** Publishes at `at`. The checks run now, so a scheduled post does not fail later for something visible today. */
export async function schedulePost(slugInput: string, at: string, user: AdminUser, deps: BlogDeps = blogDeps()): Promise<{ message: string }> {
  const slug = checkedSlug(slugInput);
  const when = new Date(at);
  const now = deps.now();
  if (Number.isNaN(when.getTime())) throw new PublicError('Choose a date and time.', 400);
  if (when.getTime() < now.getTime() + 60_000) throw new PublicError('Choose a time in the future.', 400);
  if (when.getTime() > now.getTime() + 366 * 86_400_000) throw new PublicError('Schedule within the next year.', 400);
  const [draft, file] = await Promise.all([deps.store.getDoc<BlogDraft>('draft', slug), deps.repo.readPost(slug)]);
  const content = draft?.content ?? (file ? parsePost(file.raw) : null);
  if (!content) throw new PublicError('That post does not exist.', 404);
  const isNew = !file;
  const errors = (await publishChecks(slug, content, isNew, deps)).filter((c) => c.severity === 'error');
  if (errors.length) throw new PublicError(`Fix ${errors.length === 1 ? 'one thing' : `${errors.length} things`} before scheduling: ${errors.map((e) => e.message).join(' · ')}`, 422);
  await deps.store.putDoc('draft', { id: slug, slug, content, isNew, scheduledAt: when.toISOString(), updatedAt: now.toISOString(), updatedBy: user.email } satisfies BlogDraft);
  return { message: 'Scheduled.' };
}

export async function unschedulePost(slugInput: string, deps: BlogDeps = blogDeps()): Promise<void> {
  const slug = checkedSlug(slugInput);
  const draft = await deps.store.getDoc<BlogDraft>('draft', slug);
  if (draft) await deps.store.putDoc('draft', { ...draft, scheduledAt: null, updatedAt: deps.now().toISOString() });
}

/** Takes a live post off the site. It stays in the admin as a draft. */
export async function unpublishPost(slugInput: string, user: AdminUser, deps: BlogDeps = blogDeps()): Promise<{ message: string }> {
  const slug = checkedSlug(slugInput);
  const file = await deps.repo.readPost(slug);
  if (!file) throw new PublicError('This post is not on the site.', 409);
  const content = parsePost(file.raw);
  if (content.frontmatter.status !== 'published') throw new PublicError('This post is not on the site.', 409);
  content.frontmatter.status = 'draft';
  await publishTarget({ writes: [{ path: postPath(slug), content: serializePost(content) }], deletes: [], expect: [], message: `Unpublish post ${slug} (${user.email})` }, deps);
  await noteRecent(deps, slug, content.frontmatter.title, 'draft');
  return { message: 'Unpublished. It stays here as a draft.' };
}

/** Deletes a post that is not live: its draft, its images, and its files if it ever reached the repository. */
export async function deletePost(slugInput: string, user: AdminUser, deps: BlogDeps = blogDeps()): Promise<{ message: string }> {
  const slug = checkedSlug(slugInput);
  const file = await deps.repo.readPost(slug);
  if (file && parsePost(file.raw).frontmatter.status === 'published') throw new PublicError('Unpublish this post before deleting it.', 409);
  if (file) {
    const deletes = await deps.repo.listFolder(slug);
    for (const ext of COVER_EXTS) if (await deps.repo.readBytes(coverPath(slug, ext))) deletes.push(coverPath(slug, ext));
    if (deletes.length) await publishTarget({ writes: [], deletes, expect: [], message: `Delete post ${slug} (${user.email})` }, deps);
  }
  await deps.store.deleteDoc('draft', slug);
  for (const media of (await deps.store.listDocs<BlogMedia>('media')).filter((m) => m.slug === slug)) await deps.store.deleteDoc('media', media.id);
  if (file) await noteRecent(deps, slug, parsePost(file.raw).frontmatter.title, 'deleted');
  return { message: 'Deleted.' };
}

/** Publishes every scheduled post whose time has come. Called by the cron route. */
export async function runDueSchedules(deps: BlogDeps = blogDeps()): Promise<Array<{ slug: string; ok: boolean; message: string }>> {
  const now = deps.now();
  const due = (await deps.store.listDocs<BlogDraft>('draft')).filter((d) => d.scheduledAt && new Date(d.scheduledAt) <= now).slice(0, 5);
  const results: Array<{ slug: string; ok: boolean; message: string }> = [];
  for (const draft of due) {
    try {
      const { message } = await publishPost(draft.slug, { email: draft.updatedBy, name: 'Scheduler', role: 'approver' }, deps);
      results.push({ slug: draft.slug, ok: true, message });
    } catch (error) {
      results.push({ slug: draft.slug, ok: false, message: (error as Error).message });
    }
  }
  return results;
}
