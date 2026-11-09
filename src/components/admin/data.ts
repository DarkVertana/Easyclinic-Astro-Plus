/**
 * Server-side data for the admin pages. Every read of the store goes through here, so a store or config failure
 * becomes a message on the page instead of a stack trace, and every page shows the same numbers.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { getRegistry } from '../../lib/content/registry';
import type { PostExtras } from '../../lib/content/posts';
import { POST_TOPIC_LABELS, type PostTopic } from '../../schemas/constants';
import { actionsFor, inTab, isActive, siteFor, statusLabel, statusTone, TRASH_DAYS, workFor, type ActivityItem, type PipelineCounts, type PostRow, type SiteState } from '../../lib/admin/lifecycle';
import { parsePost } from '../../lib/admin/mdx-file';
import { baseConflict, gateChecks, postStatus, type PostStatus } from '../../lib/admin/workflow';
import { requireUser } from '../../lib/admin/auth';
import { env } from '../../lib/admin/env';
import { getStore } from '../../lib/admin/store';
import type { AdminUser, Check, HistoryAction, Job, PostContent, PostFlag, Revision, Role, ScheduleRun, Store, Submission } from '../../lib/admin/types';

/** A published post not updated for this long counts as stale on the dashboard and in the list. */
export const STALE_DAYS = 365;

export const STORE_ERROR =
  'The workflow store could not be reached, so submissions and AI jobs are missing from this page. Posts from Git are still listed. Check DATABASE_URL, then reload.';

/** requireUser throws its redirect as a Response; Astro pages have to return it. */
export async function pageUser(context: Parameters<typeof requireUser>[0]): Promise<AdminUser | Response> {
  try {
    return await requireUser(context);
  } catch (refused) {
    if (refused instanceof Response) return refused;
    throw refused;
  }
}

export function storeOrNull(): { store: Store | null; storeError: string | null } {
  try {
    return { store: getStore(), storeError: null };
  } catch {
    return { store: null, storeError: STORE_ERROR };
  }
}

export async function loadWorkflow(): Promise<{ submissions: Submission[]; jobs: Job[]; storeError: string | null }> {
  const { store, storeError } = storeOrNull();
  if (!store) return { submissions: [], jobs: [], storeError };
  try {
    const [submissions, jobs] = await Promise.all([store.listSubmissions(), store.listJobs()]);
    return { submissions, jobs: jobs.filter((job) => job.kind !== 'topics'), storeError: null };
  } catch {
    return { submissions: [], jobs: [], storeError: STORE_ERROR };
  }
}

export type { PostRow } from '../../lib/admin/lifecycle';

function isStale(entry: CollectionEntry<'posts'>): boolean {
  const updated = entry.data.lastUpdated;
  if (entry.data.status !== 'published' || !updated) return false;
  return Date.now() - updated.getTime() > STALE_DAYS * 86_400_000;
}

function gitHint(entry: CollectionEntry<'posts'>): string | null {
  const { author, owner, lastUpdated } = entry.data as typeof entry.data & PostExtras;
  const gaps = [!author && 'No author', owner === '/blog/' && 'Owned by /blog/, needs a landing page', !lastUpdated && 'No update date'].filter(Boolean);
  if (gaps.length) return gaps.join('. ');
  return isStale(entry) ? `Not updated for over ${STALE_DAYS} days` : null;
}

function submissionHint(submission: Submission, site: SiteState): string | null {
  if (submission.state === 'scheduled') return null;
  if (submission.state === 'pending') {
    const last = submission.history[submission.history.length - 1];
    if (last?.action === 'schedule_failed' || last?.action === 'publish_failed') return last.note ? `Not published: ${last.note}` : 'Not published';
    return 'Waiting for an approver';
  }
  if (submission.state === 'changes_requested') {
    const note = [...submission.history].reverse().find((event) => event.action === 'changes_requested')?.note;
    return note ? `Reviewer: ${note}` : 'Sent back by a reviewer';
  }
  if (site === 'live') return 'Edits are not on the live page yet';
  return site === 'never' ? 'Not submitted yet' : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function authorOptions(): Promise<Array<{ id: string; name: string }>> {
  const authors = await getCollection('authors');
  // An author with a placeholder role cannot appear on a live page (authorProblem in harness.ts).
  return authors.filter((a) => !/^\[/.test(a.data.role ?? '')).map((a) => ({ id: a.id, name: a.data.name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Pages that can own a post: real landing pages, never /blog/ and never another article. */
export async function ownerOptions(): Promise<Array<{ path: string; label: string }>> {
  const registry = await getRegistry();
  const excluded = new Set(['post', 'guide', 'legal', 'glossary', 'kitchenSink']);
  return registry.pages
    .filter((page) => !excluded.has(page.family) && page.path !== '/blog/')
    .map((page) => ({ path: page.path, label: page.label }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** A just-published post: this deployment may not have it yet, so the store speaks for it this long. */
const DEPLOY_WINDOW_MS = 86_400_000;

function latestBySlug(submissions: Submission[], state: Submission['state']): Map<string, Submission> {
  const out = new Map<string, Submission>();
  for (const s of submissions) {
    if (s.state !== state) continue;
    const seen = out.get(s.slug);
    if (!seen || s.updatedAt > seen.updatedAt) out.set(s.slug, s);
  }
  return out;
}

async function loadFlags(): Promise<PostFlag[]> {
  try {
    return await getStore().listFlags();
  } catch {
    return [];
  }
}

/**
 * Site status comes from Git, work state from the store, and neither replaces the other. A store row only speaks for
 * Git in the gap before a deployment catches up: just published, unpublished or deleted.
 */
export async function postRows(submissions: Submission[], user: AdminUser | Role = 'editor', flagList?: PostFlag[]): Promise<PostRow[]> {
  const role: Role = typeof user === 'string' ? user : user.role;
  const now = new Date();
  const [posts, authors, flagRows] = await Promise.all([getCollection('posts'), authorOptions(), flagList ?? loadFlags()]);
  const authorName = (id: string) => authors.find((a) => a.id === id)?.name ?? (id || 'No author');
  const flags = new Map(flagRows.map((f) => [f.id, f]));
  const open = new Map(submissions.filter((s) => isActive(s.state)).map((s) => [s.slug, s]));
  const published = latestBySlug(submissions, 'published');
  const rejected = latestBySlug(submissions, 'rejected');
  const newest = new Map<string, Submission>();
  for (const s of submissions) {
    const seen = newest.get(s.slug);
    if (!seen || s.updatedAt > seen.updatedAt) newest.set(s.slug, s);
  }
  const byId = new Map(posts.map((p) => [p.id, p]));
  const rows: PostRow[] = [];
  const slugs = new Set([...posts.map((p) => p.id), ...open.keys(), ...published.keys(), ...rejected.keys()]);
  for (const slug of slugs) {
    const entry = byId.get(slug);
    const flag = flags.get(slug);
    const working = open.get(slug) ?? null;
    const lastPublished = published.get(slug);
    const wasRejected = !working && newest.get(slug)?.state === 'rejected';
    const removedAt = flag?.removed?.at;
    const republished = lastPublished && (!removedAt || lastPublished.updatedAt > removedAt);
    if (removedAt && !republished && !working) continue;
    const justPublished = Boolean(lastPublished && !flag?.unpublished && !removedAt && now.getTime() - new Date(lastPublished.updatedAt).getTime() < DEPLOY_WINDOW_MS);
    const building = justPublished && entry?.data.status !== 'published';
    if (!entry && !working && !wasRejected && !building) continue;
    const gitStatus = building ? 'published' : entry?.data.status ?? null;
    const site = siteFor(gitStatus, Boolean(flag?.unpublished));
    const work = workFor(working, now);
    const trashed = Boolean(flag?.trashed);
    const scheduledAt = working?.scheduled?.at ?? null;
    const due = scheduledAt ? new Date(scheduledAt) <= now : undefined;

    const source = working ?? (entry ? null : (wasRejected ? rejected.get(slug) : lastPublished) ?? null);
    const fm = source?.content.frontmatter;
    const extras = entry?.data as (NonNullable<typeof entry>['data'] & PostExtras) | undefined;
    const topic = fm ? text(fm.topic) : extras?.topic ?? '';
    const authorId = fm ? text(fm.author) : entry?.data.author?.id ?? '';
    const rejectedRow = wasRejected ? rejected.get(slug)! : null;
    const note = rejectedRow ? [...rejectedRow.history].reverse().find((e) => e.action === 'rejected')?.note : undefined;
    const context = { trashed, rejected: wasRejected, scheduledAt };
    const hint = building ? 'Building, live in a few minutes'
      : trashed ? `Can be restored for ${TRASH_DAYS} days`
      : rejectedRow ? (note ? `Rejected: ${note}` : 'Rejected')
      : working ? submissionHint(working, site)
      : entry ? gitHint(entry) : null;
    rows.push({
      key: working?.id ?? slug,
      slug,
      title: (fm ? text(fm.h1) || text(fm.title) : entry?.data.h1) || slug,
      site,
      work,
      label: statusLabel(site, work, context),
      tone: statusTone(site, work, context),
      trashed,
      submissionId: working?.id ?? rejectedRow?.id ?? null,
      topic,
      topicLabel: POST_TOPIC_LABELS[topic as PostTopic] ?? 'No topic',
      owner: (fm ? text(fm.owner) : extras?.owner) || 'No owner',
      author: authorName(authorId),
      authorId,
      updated: working?.updatedAt ?? (building ? lastPublished!.updatedAt : entry?.data.lastUpdated ?? source?.updatedAt ?? null),
      liveUrl: site === 'live' ? `/${slug}/` : null,
      scheduledAt,
      actions: actionsFor(site, work, role, { trashed, rejected: wasRejected, due }),
      hint,
      status: site === 'live' ? 'published' : working?.state ?? (rejectedRow ? 'rejected' : entry?.data.status === 'review' ? 'review' : 'draft'),
    });
  }
  return rows;
}

const ACTIVITY_WORDS: Partial<Record<HistoryAction, string>> = {
  created: 'Started', edited: 'Saved changes', submitted: 'Submitted for approval', approved: 'Approved', published: 'Published',
  changes_requested: 'Sent back', rejected: 'Rejected', reopened: 'Reopened', publish_failed: 'Publishing failed', withdrawn: 'Withdrawn from review',
  discarded: 'Discarded changes', trashed: 'Moved to the trash', restored: 'Restored from the trash', scheduled: 'Scheduled',
  schedule_cancelled: 'Unscheduled', schedule_failed: 'Scheduled publishing failed', unpublished: 'Unpublished', deleted: 'Deleted', renamed: 'Changed the address',
  rebased: 'Updated to the current version', restored_revision: 'Restored an earlier version',
};

/** Newest first, from every submission's history. */
export async function activityFeed(limit = 20, loaded?: Submission[]): Promise<ActivityItem[]> {
  const submissions = loaded ?? (await loadWorkflow()).submissions;
  return submissions
    .flatMap((s) => s.history.map((event) => ({
      at: event.at, by: event.by, action: event.action, text: ACTIVITY_WORDS[event.action] ?? event.action, slug: s.slug,
      title: text(s.content.frontmatter.h1) || text(s.content.frontmatter.title) || s.slug, submissionId: s.id, ...(event.note ? { note: event.note } : {}),
    })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** The dashboard's pipeline bar. Drafts are posts not on the site; an edit of a live post counts under Published. */
export async function pipelineCounts(rows?: PostRow[]): Promise<PipelineCounts> {
  const list = rows ?? (await postRows((await loadWorkflow()).submissions));
  const count = (tab: Parameters<typeof inTab>[0]) => list.filter((r) => inTab(tab, r)).length;
  return { drafts: count('drafts'), inReview: count('review'), scheduled: count('scheduled'), published: count('published') };
}

/** Read-only state of one post for GET /admin/posts/view/. Writes nothing. */
export async function postForView(slug: string, user: AdminUser): Promise<(PostStatus & { content: PostContent | null }) | null> {
  const status = await postStatus(slug, user.role);
  if (!status.file && !status.active) return null;
  return { ...status, content: status.active?.content ?? (status.file ? parsePost(status.file.raw) : null) };
}

/** Main moved under this copy: both versions, for the compare-and-choose screen. null when nothing to reconcile, or GitHub is unreachable. */
export function conflictFor(submission: Submission): ReturnType<typeof baseConflict> {
  return baseConflict(submission).catch(() => null);
}

export async function revisionsFor(submissionId: string): Promise<Revision[]> {
  try {
    return await getStore().listRevisions(submissionId);
  } catch {
    return [];
  }
}

export async function scheduleRuns(limit = 10): Promise<ScheduleRun[]> {
  try {
    return await getStore().listScheduleRuns(limit);
  } catch {
    return [];
  }
}

/** The honest delay the schedule dialog states. */
export function schedulePrecision(): string {
  return env('ADMIN_SCHEDULE_PRECISION') ?? 'within a day on Hobby';
}

export async function backlogCounts(): Promise<{ drafts: number; stale: number }> {
  const posts = await getCollection('posts');
  return { drafts: posts.filter((p) => p.data.status === 'draft').length, stale: posts.filter(isStale).length };
}

/** The checks submit and approve run. null means the checker itself failed, which must never read as a pass. */
export async function runChecks(submission: Submission, content: PostContent = submission.content): Promise<Check[] | null> {
  try {
    return await gateChecks(submission, content);
  } catch {
    return null;
  }
}

/**
 * The checks as approve() will run them: published, dated today, with the editorial pass the approver is about to
 * give. Keep in step with publishedContent in workflow.ts. A plain check of a draft would report the missing
 * editorial pass, which only approving can supply, and hide the approve form for good.
 */
export function approvalChecks(submission: Submission): Promise<Check[] | null> {
  const { content } = submission;
  const today = new Date().toISOString().slice(0, 10);
  const pass = { by: 'Approver', on: today, onlyUsCouldWrite: 'Answered when approving.', readsMachineWritten: 'Answered when approving.' };
  return runChecks(submission, { frontmatter: { ...content.frontmatter, status: 'published', lastUpdated: today, editorialPass: pass }, body: content.body });
}

/** ADMIN_PREVIEW_URL_TEMPLATE with {branch} and {slug} filled in, or null when either is missing. */
export function previewUrl(branch: string | null, slug: string): string | null {
  const template = env('ADMIN_PREVIEW_URL_TEMPLATE');
  if (!template || !branch) return null;
  return template.replaceAll('{branch}', encodeURIComponent(branch.replace(/\//g, '-'))).replaceAll('{slug}', encodeURIComponent(slug));
}

export function aiConfigured(): boolean {
  return Boolean(env('ANTHROPIC_API_KEY'));
}

export function latestNote(submission: Submission): { note: string; by: string; at: string } | null {
  const event = [...submission.history].reverse().find((e) => (e.action === 'changes_requested' || e.action === 'rejected' || e.action === 'publish_failed' || e.action === 'schedule_failed') && e.note);
  return event ? { note: event.note!, by: event.by, at: event.at } : null;
}
