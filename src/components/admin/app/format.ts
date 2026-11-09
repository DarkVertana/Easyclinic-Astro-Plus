/** Pure helpers for the admin UI. No Astro imports: the React islands use this too. */
import type { JobStage } from '../../../lib/admin/types';

export const EMPTY_CELL = '—';

export const STAGE_LABELS: Array<{ stage: JobStage; label: string }> = [
  { stage: 'research', label: 'Find candidate sources' },
  { stage: 'read', label: 'Read the sources' },
  { stage: 'ledger', label: 'Extract claims and verify each quote' },
  { stage: 'outline', label: 'Propose an angle and outline' },
  { stage: 'awaiting_outline', label: 'Wait for a person to approve the outline' },
  { stage: 'draft', label: 'Write from verified claims only' },
  { stage: 'check', label: 'Run the automatic checks' },
  { stage: 'review', label: 'AI fact check and edit' },
  { stage: 'revise', label: 'Revise, if the checks or review need it' },
  { stage: 'done', label: 'Create the draft' },
];

/** Plain names for post fields. Nothing outside this file says headKeyword or ctas. */
export const FIELD_NAMES: Record<string, string> = {
  title: 'Search title',
  metaDescription: 'Search description',
  h1: 'Post title',
  linkLabel: 'Link text',
  headKeyword: 'Main keyword',
  openingAnswer: 'Short answer',
  summary: 'Summary',
  author: 'Author',
  topic: 'Topic',
  owner: 'Landing page',
  body: 'Text',
  faq: 'FAQs',
  ctas: 'Calls to action',
  slug: 'Web address',
  status: 'Status',
  lastUpdated: 'Last updated',
};

/** The editor field a check's path points at and the side panel holding it, or null when it has no field. */
export function fieldForPath(path: string): { id: string; line?: number; panel: string } | null {
  const body = path.match(/^body(?::(\d+))?$/);
  if (body) return { id: 'f-body', line: body[1] ? Number(body[1]) : undefined, panel: '' };
  if (path.startsWith('faq')) return { id: 'f-faq', panel: 'extra' };
  const cta = path.match(/^ctas\.(primary|secondary)\.(label|href)$/);
  if (cta) return { id: `f-cta${cap(cta[1]!)}${cap(cta[2]!)}`, panel: 'extra' };
  if (path.startsWith('ctas')) return { id: path.startsWith('ctas.whatsapp') ? 'f-whatsapp' : 'f-ctaPrimaryLabel', panel: 'extra' };
  const root = path.split(/[.[]/)[0]!;
  if (root === 'h1') return { id: 'f-h1', panel: '' };
  if (['title', 'metaDescription', 'headKeyword'].includes(root)) return { id: `f-${root}`, panel: 'seo' };
  if (['linkLabel', 'openingAnswer', 'summary', 'author', 'topic', 'owner'].includes(root)) return { id: `f-${root}`, panel: 'details' };
  return null;
}

/** A check message with internal names swapped for the words the editor uses. */
export function friendlyMessage(message: string, path = ''): string {
  // Schema wording lists internal option values; say what the person has to do instead.
  if (/^Invalid (option|input)/.test(message)) {
    const name = FIELD_NAMES[path.split(/[.[:]/)[0]!];
    return name ? `Choose a ${name.toLowerCase()}.` : 'This field has a value the site does not accept.';
  }
  return message
    .replace(/\bhead keyword\b/gi, 'main keyword')
    .replace(/\bmeta description\b/gi, 'search description')
    .replace(/\blink label\b/gi, 'link text')
    .replace(/\bopening answer\b/gi, 'short answer')
    .replace(/\bInlineCtas?\b/g, 'call to action')
    .replace(/\bheadKeyword\b/g, 'main keyword')
    .replace(/\bmetaDescription\b/g, 'search description')
    .replace(/\bopeningAnswer\b/g, 'short answer')
    .replace(/\blinkLabel\b/g, 'link text')
    .replace(/\bctas\b/g, 'calls to action')
    .replace(/\bfrontmatter\b/gi, 'post details')
    .replace(/\bH1\b/g, 'post title');
}

/** Words for the field a check belongs to, for findings the editor cannot jump to. */
export function pathLabel(path: string): string {
  const root = path.split(/[.[:]/)[0]!;
  return FIELD_NAMES[root] ?? (root === 'sources' || root === 'conflicts' ? 'Sources' : 'Post');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const asDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 27 Sep 2026. Calendar dates are stored at midnight UTC, so read them in UTC. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = asDate(value);
  if (!date) return EMPTY_CELL;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date).replace('Sept', 'Sep');
}

/** 27 Sep 2026, 3:31 pm IST. The team and the site work in IST. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = asDate(value);
  if (!date) return EMPTY_CELL;
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date).replace('Sept', 'Sep');
  const time = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(date).toLowerCase();
  return `${day}, ${time} IST`;
}

/** 10:42, for the editor's save status. */
export function formatTime(value: string | Date | null | undefined): string {
  const date = asDate(value);
  if (!date) return EMPTY_CELL;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date);
}

/** "2 h ago" within seven days, otherwise the date. Pair it with the full form in a title. */
export function formatAgo(value: string | Date | null | undefined, now = new Date()): string {
  const date = asDate(value);
  if (!date) return EMPTY_CELL;
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 0 || minutes >= 7 * 1440) return formatDate(date);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / 1440);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;
}

export type DiffLine = { kind: 'same' | 'add' | 'del' | 'gap'; text: string };

/** Line comparison with two lines of context. Empty when nothing differs. */
export function diffLines(before: string, after: string, context = 2): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) rows[i]![j] = a[i] === b[j] ? rows[i + 1]![j + 1]! + 1 : Math.max(rows[i + 1]![j]!, rows[i]![j + 1]!);
  }
  const all: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      all.push({ kind: 'same', text: a[i]! });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || rows[i]![j + 1]! >= rows[i + 1]![j]!)) all.push({ kind: 'add', text: b[j++]! });
    else all.push({ kind: 'del', text: a[i++]! });
  }
  const keep = all.map(() => false);
  all.forEach((line, index) => {
    if (line.kind === 'same') return;
    for (let k = Math.max(0, index - context); k <= Math.min(all.length - 1, index + context); k++) keep[k] = true;
  });
  const out: DiffLine[] = [];
  all.forEach((line, index) => {
    if (keep[index]) out.push(line);
    else if (out.at(-1)?.kind !== 'gap') out.push({ kind: 'gap', text: 'Unchanged lines' });
  });
  return out.some((l) => l.kind === 'add' || l.kind === 'del') ? out : [];
}

/** Web address for a title: lowercase words joined by hyphens. */
export function slugFrom(title: string): string {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
}
