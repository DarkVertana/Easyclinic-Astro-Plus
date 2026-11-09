/**
 * The status model and the one table of who may do what (docs/research/admin-build-spec.md). Pure and browser-safe.
 *
 * A post has two facts, never merged: `site` (what Git says about the live site) and `work` (what the store says about
 * a working copy). A live post with a working copy is "Published · Edits in review", never "Draft".
 */
import type { Role, Submission } from './types.ts';

export type SiteState = 'never' | 'draft' | 'live' | 'unpublished';
export type WorkState = 'none' | 'editing' | 'in_review' | 'changes_requested' | 'scheduled' | 'publishing' | 'failed';
export type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export type PostAction =
  | 'view' | 'view-live' | 'compare' | 'edit' | 'save' | 'submit' | 'withdraw' | 'discard' | 'duplicate' | 'rename'
  | 'approve' | 'schedule' | 'unschedule' | 'publish-now' | 'request-changes' | 'reject' | 'reopen' | 'restore-revision'
  | 'unpublish' | 'trash' | 'restore' | 'delete';

export interface ActionContext {
  trashed?: boolean;
  /** The latest working copy was rejected and nothing newer is open: it can be reopened. */
  rejected?: boolean;
  /** For a scheduled post: false hides "publish now" until the time has passed. Omitted means due. */
  due?: boolean;
}

export const TRASH_DAYS = 30;
export const REVISION_CAP = 50;
export const BULK_CAP = 50;

/** Submission states that hold the per-slug lock. The one list: store, workflow and data.ts all read this. */
export const ACTIVE_STATES: ReadonlyArray<Submission['state']> = ['draft', 'pending', 'changes_requested', 'scheduled'];

const EDITOR_WORKING: PostAction[] = ['edit', 'save', 'submit', 'discard', 'restore-revision', 'rename'];
const COMPARE_IF_LIVE = (site: SiteState): PostAction[] => (site === 'live' ? ['compare', 'view-live'] : site === 'unpublished' ? ['compare'] : []);

/** What this role may do to a post in this state. The server enforces it, and the list and editor render from it. */
export function actionsFor(site: SiteState, work: WorkState, role: Role, context: ActionContext = {}): PostAction[] {
  const approver = role === 'approver';
  if (context.trashed) {
    if (approver) return ['view', 'restore', 'delete'];
    return site === 'never' || site === 'draft' ? ['view', 'restore'] : ['view'];
  }
  switch (work) {
    case 'publishing':
      return ['view'];
    case 'in_review':
    case 'failed':
      return ['view', 'withdraw', 'duplicate', ...COMPARE_IF_LIVE(site), ...(approver ? (['approve', 'schedule', 'request-changes', 'reject'] as PostAction[]) : [])];
    case 'scheduled':
      return ['view', 'duplicate', ...COMPARE_IF_LIVE(site), ...(approver ? (['unschedule', ...(context.due === false ? [] : ['publish-now'])] as PostAction[]) : [])];
    case 'changes_requested':
      return [...EDITOR_WORKING, ...COMPARE_IF_LIVE(site)];
    case 'editing':
      if (site === 'never' || site === 'draft') return [...EDITOR_WORKING, 'duplicate', 'trash'];
      return [...EDITOR_WORKING, ...COMPARE_IF_LIVE(site)];
    case 'none': {
      const reopen: PostAction[] = context.rejected ? ['reopen'] : [];
      if (site === 'live') return ['view', 'edit', 'save', 'duplicate', 'view-live', 'rename', ...reopen, ...(approver ? (['unpublish'] as PostAction[]) : [])];
      if (site === 'draft') return ['view', 'edit', 'save', 'submit', 'duplicate', 'rename', 'trash', ...reopen];
      if (site === 'unpublished') return ['view', 'edit', 'save', 'submit', 'duplicate', ...reopen, ...(approver ? (['trash'] as PostAction[]) : [])];
      return ['view', ...reopen];
    }
  }
}

export function isActive(state: Submission['state']): boolean {
  return ACTIVE_STATES.includes(state);
}

/** The work state of an open submission; undefined or closed means none. */
export function workFor(sub: Submission | null | undefined, now: Date = new Date()): WorkState {
  if (!sub) return 'none';
  const locked = Boolean(sub.publishLockUntil && new Date(sub.publishLockUntil) > now);
  if (locked && (sub.state === 'pending' || sub.state === 'scheduled')) return 'publishing';
  switch (sub.state) {
    case 'draft':
      return 'editing';
    case 'changes_requested':
      return 'changes_requested';
    case 'scheduled':
      return 'scheduled';
    case 'pending': {
      const last = sub.history[sub.history.length - 1]?.action;
      return last === 'publish_failed' || last === 'schedule_failed' ? 'failed' : 'in_review';
    }
    default:
      return 'none';
  }
}

/** Site status from the Git file's status. Only `unpublished` needs the store: Git cannot tell it from a draft. */
export function siteFor(gitStatus: string | null | undefined, unpublished = false): SiteState {
  if (!gitStatus) return 'never';
  if (gitStatus === 'published') return 'live';
  return unpublished ? 'unpublished' : 'draft';
}

const ON_SITE: Record<SiteState, string> = { never: 'Draft', draft: 'Draft', live: 'Published', unpublished: 'Unpublished' };

/** "12 Nov, 09:00 IST". Always India time in a label; the schedule dialog also shows the approver's zone and UTC. */
export function formatIst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'an unknown time';
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month')}, ${part('hour')}:${part('minute')} IST`;
}

export function statusLabel(site: SiteState, work: WorkState, context: { trashed?: boolean; rejected?: boolean; scheduledAt?: string | null } = {}): string {
  if (context.trashed) return 'In trash';
  const base = ON_SITE[site];
  if (work === 'none') return context.rejected && site === 'never' ? 'Rejected' : base;
  if (work === 'scheduled') {
    const when = `Scheduled for ${context.scheduledAt ? formatIst(context.scheduledAt) : 'a set time'}`;
    return site === 'live' ? `Published · ${when}` : when;
  }
  if (work === 'editing') return site === 'live' || site === 'unpublished' ? `${base} · Edits in progress` : base;
  const words: Record<Exclude<WorkState, 'none' | 'scheduled' | 'editing'>, string> = {
    in_review: site === 'live' ? 'Edits in review' : 'In review',
    changes_requested: 'Changes requested',
    publishing: 'Publishing',
    failed: 'Publishing failed',
  };
  return `${base} · ${words[work]}`;
}

export function statusTone(site: SiteState, work: WorkState, context: { trashed?: boolean; rejected?: boolean } = {}): Tone {
  if (context.trashed) return 'neutral';
  if (work === 'failed') return 'danger';
  if (work === 'changes_requested') return 'warning';
  if (work === 'in_review' || work === 'scheduled' || work === 'publishing') return 'info';
  if (context.rejected && site === 'never') return 'danger';
  if (site === 'live') return 'success';
  return site === 'unpublished' ? 'warning' : 'neutral';
}

export type PostTab = 'all' | 'published' | 'edits' | 'drafts' | 'review' | 'scheduled' | 'unpublished' | 'trash';

export const POST_TABS: Array<{ id: PostTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'edits', label: 'With edits' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'review', label: 'In review' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'unpublished', label: 'Unpublished' },
  { id: 'trash', label: 'Trash' },
];

/** Tabs can overlap ("Published" and "With edits" both hold an edited live post), so counts need not sum. "All" leaves out trash. */
export function inTab(tab: PostTab, row: Pick<PostRow, 'site' | 'work' | 'trashed'>): boolean {
  if (tab === 'trash') return row.trashed;
  if (row.trashed) return false;
  switch (tab) {
    case 'all': return true;
    case 'published': return row.site === 'live';
    case 'edits': return row.site === 'live' && row.work !== 'none';
    case 'drafts': return row.site === 'draft' || row.site === 'never';
    case 'review': return row.work === 'in_review' || row.work === 'failed' || row.work === 'publishing';
    case 'scheduled': return row.work === 'scheduled';
    case 'unpublished': return row.site === 'unpublished';
  }
}

/** One row of the post list. Returned by postRows() in src/components/admin/data.ts. */
export interface PostRow {
  slug: string;
  title: string;
  site: SiteState;
  work: WorkState;
  label: string;
  tone: Tone;
  trashed: boolean;
  submissionId: string | null;
  topic: string;
  topicLabel: string;
  owner: string;
  author: string;
  authorId: string;
  updated: Date | string | null;
  liveUrl: string | null;
  scheduledAt: string | null;
  actions: PostAction[];
  hint: string | null;
  /** Same as slug or submission id. Stable row key for the page. */
  key: string;
  /** @deprecated Merged field, kept only until posts/index.astro moves to site and work. */
  status: Submission['state'] | 'review';
}

export interface ActivityItem {
  at: string;
  by: string;
  action: string;
  /** Plain sentence, e.g. "Approved and published". */
  text: string;
  slug: string;
  title: string;
  submissionId: string;
  note?: string;
}

export interface PipelineCounts {
  drafts: number;
  inReview: number;
  scheduled: number;
  published: number;
}

/** Result of one row in a bulk request. */
export interface BulkRowResult {
  slug: string;
  ok: boolean;
  message: string;
}
