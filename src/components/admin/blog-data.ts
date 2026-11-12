/**
 * Server-side data for the blog admin pages: the post list and the editor's option lists. Posts on the site come from
 * this deployment's content collection; drafts, schedules and just-made changes come from the store.
 */
import { getCollection } from 'astro:content';
import { coverFor } from '../blocks/PostIndex/covers';
import { mediaUrl, statusOf, type BlogStatus } from '../../lib/admin/blog';
import { getStore } from '../../lib/admin/store';
import { POST_TOPICS, POST_TOPIC_LABELS, type PostTopic } from '../../schemas/constants';
import type { BlogCategory, BlogDraft, BlogMedia, BlogRecent } from '../../lib/admin/types';
import { authorOptions, ownerOptions } from './data';

export interface BlogRow {
  slug: string;
  title: string;
  status: BlogStatus;
  /** Live, with saved changes that are not published yet. */
  changes: boolean;
  scheduledAt: string | null;
  updated: string | null;
  author: string;
  topic: string;
  cover: string | null;
  liveUrl: string | null;
}

export interface Option {
  value: string;
  label: string;
}

const RECENT_MS = 86_400_000;

export async function blogRows(): Promise<{ rows: BlogRow[]; storeError: string | null }> {
  const [posts, authors] = await Promise.all([getCollection('posts'), authorOptions()]);
  const authorName = (id: unknown) => (typeof id === 'string' && id ? (authors.find((a) => a.id === id)?.name ?? id) : '');
  const topicLabel = (t: unknown) => POST_TOPIC_LABELS[t as PostTopic] ?? '';
  let drafts: BlogDraft[] = [];
  let media: BlogMedia[] = [];
  let recent: BlogRecent[] = [];
  let storeError: string | null = null;
  try {
    const store = getStore();
    [drafts, media, recent] = await Promise.all([store.listDocs<BlogDraft>('draft'), store.listDocs<BlogMedia>('media'), store.listDocs<BlogRecent>('recent')]);
  } catch (error) {
    console.error('[admin] draft store failed:', error);
    storeError = 'Drafts could not be loaded: the draft store is not reachable. Published posts are still listed. Check SUPABASE_URL and SUPABASE_SECRET_KEY, then reload.';
  }
  const now = Date.now();
  const recentBySlug = new Map(recent.filter((r) => now - new Date(r.updatedAt).getTime() < RECENT_MS).map((r) => [r.id, r]));
  const draftBySlug = new Map(drafts.map((d) => [d.slug, d]));
  const draftCover = new Set(media.filter((m) => m.name.startsWith('cover.')).map((m) => m.slug));
  const rows = new Map<string, BlogRow>();

  for (const entry of posts) {
    const slug = entry.id;
    const note = recentBySlug.get(slug);
    if (note?.state === 'deleted') continue;
    const live = note ? note.state === 'published' : entry.data.status === 'published';
    const draft = draftBySlug.get(slug) ?? null;
    const fm = draft?.content.frontmatter;
    const updated = draft?.updatedAt ?? note?.updatedAt ?? (entry.data.lastUpdated ? entry.data.lastUpdated.toISOString() : null);
    rows.set(slug, {
      slug,
      title: String(fm?.title ?? entry.data.title),
      status: statusOf(draft, live),
      changes: Boolean(draft) && live,
      scheduledAt: draft?.scheduledAt ?? null,
      updated,
      author: authorName(fm ? fm.author : entry.data.author?.id),
      topic: topicLabel(fm?.topic ?? (entry.data as { topic?: string }).topic),
      cover: draftCover.has(slug) ? mediaUrl(slug, 'cover') : coverFor({ path: `/${slug}/`, topic: (entry.data as unknown as { topic: PostTopic }).topic }).src.src,
      liveUrl: live ? `/${slug}/` : null,
    });
  }
  // Drafts never published, and posts published since this deployment was built.
  for (const draft of drafts) {
    if (rows.has(draft.slug)) continue;
    const note = recentBySlug.get(draft.slug);
    const live = note?.state === 'published';
    const fm = draft.content.frontmatter;
    rows.set(draft.slug, {
      slug: draft.slug, title: String(fm.title ?? draft.slug), status: statusOf(draft, live), changes: live, scheduledAt: draft.scheduledAt ?? null,
      updated: draft.updatedAt, author: authorName(fm.author), topic: topicLabel(fm.topic), cover: draftCover.has(draft.slug) ? mediaUrl(draft.slug, 'cover') : null, liveUrl: live ? `/${draft.slug}/` : null,
    });
  }
  for (const note of recentBySlug.values()) {
    if (rows.has(note.id) || note.state !== 'published') continue;
    rows.set(note.id, { slug: note.id, title: note.title, status: 'published', changes: false, scheduledAt: null, updated: note.updatedAt, author: '', topic: '', cover: mediaUrl(note.id, 'cover'), liveUrl: `/${note.id}/` });
  }
  const list = [...rows.values()].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
  return { rows: list, storeError };
}

export interface CategoryOption {
  name: string;
  /** Posts using it, for "Most used". */
  count: number;
}

/** Categories from every post on this deployment and every draft, plus ones added in the admin. */
export async function categoryOptions(): Promise<CategoryOption[]> {
  const counts = new Map<string, { name: string; count: number }>();
  const add = (name: unknown, used: boolean) => {
    if (typeof name !== 'string' || !name.trim()) return;
    const key = name.trim().toLowerCase();
    const seen = counts.get(key) ?? { name: name.trim(), count: 0 };
    if (used) seen.count += 1;
    counts.set(key, seen);
  };
  for (const entry of await getCollection('posts')) for (const c of (entry.data as { categories?: string[] }).categories ?? []) add(c, true);
  try {
    const store = getStore();
    const [drafts, added] = await Promise.all([store.listDocs<BlogDraft>('draft'), store.listDocs<BlogCategory>('category')]);
    for (const d of drafts) for (const c of (Array.isArray(d.content.frontmatter.categories) ? d.content.frontmatter.categories : [])) add(c, false);
    for (const c of added) add(c.name, false);
  } catch {
    // Without the store, the published posts' categories are still offered.
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function editorOptions(): Promise<{ authors: Option[]; topics: Option[]; owners: Option[]; categories: CategoryOption[] }> {
  const [authors, owners, categories] = await Promise.all([authorOptions(), ownerOptions(), categoryOptions()]);
  return {
    categories,
    authors: authors.map((a) => ({ value: a.id, label: a.name })),
    topics: POST_TOPICS.map((t) => ({ value: t as string, label: POST_TOPIC_LABELS[t] })),
    owners: owners.map((o) => ({ value: o.path, label: `${o.label} (${o.path})` })),
  };
}
