/**
 * What to work on next. Pure, and useful with no analytics connected: only the "losing clicks" reason needs Google.
 * Thresholds are editorial judgement, not Google's: docs/research/admin-insights-edge-cases.md.
 */

export const STALE_AFTER_DAYS = 365; // Same as STALE_DAYS on the dashboard (src/components/admin/data.ts), which cannot be imported into pure code.
export const LOSING_CLICKS_PERCENT = 30;
/** Below this, a drop is noise: 2 clicks to 1 is not a 50% alarm. */
export const LOSING_MIN_PREVIOUS_CLICKS = 10;
const MAX_REASON_LENGTH = 160;

export interface RefreshPost {
  slug: string;
  title: string;
  status: string; // 'draft' | 'review' | 'published'
  lastUpdated: Date | string | null | undefined;
  owner?: string | null;
  notes?: string[];
}
export interface RefreshInsights {
  rows: Array<{ slug: string; clicks: number | null; clicksPrevious: number | null }>;
}
export type RefreshKind = 'losing_clicks' | 'no_owner' | 'stale' | 'draft_held' | 'draft_not_rewritten' | 'draft_other' | 'in_review';
export interface RefreshFinding {
  kind: RefreshKind;
  reason: string;
}
export interface RefreshItem {
  slug: string;
  title: string;
  status: string;
  findings: RefreshFinding[];
}

const PRIORITY: RefreshKind[] = ['losing_clicks', 'no_owner', 'stale', 'in_review', 'draft_not_rewritten', 'draft_held', 'draft_other'];

function shorten(text: string): string {
  if (text.length <= MAX_REASON_LENGTH) return text;
  return `${text.slice(0, MAX_REASON_LENGTH).replace(/\s+\S*$/, '')}…`;
}

function ageInDays(value: RefreshPost['lastUpdated'], today: Date): number | null {
  if (!value) return null;
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(time) ? null : Math.floor((today.getTime() - time) / 86_400_000);
}

/** Why a post is unpublished, from its notes[]: "Triage <date>: hold, <reason>; merge into <path>" or "Needs the spec ...". */
function draftFinding(post: RefreshPost): RefreshFinding {
  const notes = post.notes ?? [];
  for (const note of [...notes].reverse()) {
    const held = note.match(/Triage [\d-]+: hold, (.+?)(?:; merge into .*)?$/s);
    if (held) return { kind: 'draft_held', reason: shorten(`Held back: ${held[1].trim()}`) };
  }
  if (notes.some((note) => /Needs the spec/i.test(note))) return { kind: 'draft_not_rewritten', reason: 'Imported from the old site and not yet rewritten to the post standard.' };
  return { kind: 'draft_other', reason: 'Draft with no recorded reason. Check the post notes.' };
}

/** One item per post, each with its plain reasons, most urgent first. */
export function refreshQueue(posts: RefreshPost[], insights: RefreshInsights | null, today: Date | string): RefreshItem[] {
  const day = today instanceof Date ? today : new Date(today);
  const bySlug = new Map((insights?.rows ?? []).map((row) => [row.slug, row]));
  const drop = new Map<string, number>();
  const items: RefreshItem[] = [];

  for (const post of posts) {
    const findings: RefreshFinding[] = [];
    if (post.status === 'published') {
      const row = bySlug.get(post.slug);
      if (row && row.clicks !== null && row.clicksPrevious !== null && row.clicksPrevious >= LOSING_MIN_PREVIOUS_CLICKS) {
        const percent = Math.round(((row.clicksPrevious - row.clicks) / row.clicksPrevious) * 100);
        if (percent >= LOSING_CLICKS_PERCENT) {
          drop.set(post.slug, percent);
          findings.push({ kind: 'losing_clicks', reason: `Search clicks fell ${percent}%, from ${row.clicksPrevious} to ${row.clicks}, against the previous 28 days.` });
        }
      }
      if (post.owner?.startsWith('/blog/')) findings.push({ kind: 'no_owner', reason: 'No landing page owns this post: its owner is still /blog/.' });
      const age = ageInDays(post.lastUpdated, day);
      if (age === null) findings.push({ kind: 'stale', reason: 'Has no valid last-updated date.' });
      else if (age > STALE_AFTER_DAYS) findings.push({ kind: 'stale', reason: `Last updated ${age} days ago; the limit is ${STALE_AFTER_DAYS}.` });
    } else if (post.status === 'review') {
      findings.push({ kind: 'in_review', reason: 'Written and waiting for review, so not published.' });
    } else {
      findings.push(draftFinding(post));
    }
    if (findings.length) items.push({ slug: post.slug, title: post.title, status: post.status, findings });
  }

  const rank = (item: RefreshItem) => Math.min(...item.findings.map((f) => PRIORITY.indexOf(f.kind)));
  return items.sort((a, b) => rank(a) - rank(b) || (drop.get(b.slug) ?? 0) - (drop.get(a.slug) ?? 0) || a.title.localeCompare(b.title));
}
