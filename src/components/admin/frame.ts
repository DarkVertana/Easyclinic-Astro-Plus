/** Server-only: the props every admin island needs, and turning server data into plain values for React. */
import { flattenFields, fieldLabel } from '../../lib/admin/review';
import { readFlash } from '../../lib/admin/http';
import { diffLines, FIELD_NAMES, friendlyMessage } from './app/format';
import type { AdminUser } from '../../lib/admin/types';
import { authorOptions, loadWorkflow, ownerOptions, type PostRow } from './data';
import { POST_TOPICS, POST_TOPIC_LABELS, type PostTopic } from '../../schemas/constants';
import type { CompareData, FrameData, NavId, RowData } from './app/types';

export async function frameData(url: URL, user: AdminUser, current: NavId): Promise<FrameData> {
  const { submissions } = await loadWorkflow();
  return {
    user: { name: user.name, email: user.email, role: user.role },
    current,
    waiting: submissions.filter((s) => s.state === 'pending').length,
    flash: readFlash(url),
    undo: url.searchParams.get('undo'),
    q: current === 'posts' ? (url.searchParams.get('q') ?? '') : '',
  };
}

export function rowData(row: PostRow): RowData {
  const { status: _status, ...rest } = row;
  return { ...rest, updated: row.updated ? new Date(row.updated).toISOString() : null };
}

interface Side {
  label: string;
  frontmatter: Record<string, unknown>;
  body: string;
}
// The dates and status change at publishing whatever the editor did, so they are not differences anyone made.
const HIDDEN = new Set(['status', 'lastUpdated', 'editorialPass']);
export function compareData(before: Side, after: Side): CompareData {
  const flat = (fm: Record<string, unknown>) => new Map(flattenFields(fm).filter((row) => !HIDDEN.has(row.path.split(/[.[]/)[0]!)).map((row) => [row.path, row]));
  const a = flat(before.frontmatter);
  const b = flat(after.frontmatter);
  const label = (path: string, raw: string) => FIELD_NAMES[path] ?? friendlyMessage(raw.replace(/^Ctas\b/, 'Calls to action'));
  const changed = [...new Set([...a.keys(), ...b.keys()])]
    .filter((path) => (a.get(path)?.value ?? '') !== (b.get(path)?.value ?? ''))
    .map((path) => ({ label: label(path, fieldLabel(path)), from: a.get(path)?.value ?? '', to: b.get(path)?.value ?? '' }));
  return { beforeLabel: before.label, afterLabel: after.label, changed, lines: diffLines(before.body.trim(), after.body.trim()) };
}

/** Evidence goes to the browser without the fetched source pages, which are large and untrusted. */
export function evidenceData(job: { sources: Array<{ id: string; url: string; title: string; host: string; tier: string }>; claims: unknown[]; rejectedClaims: unknown[]; checks: unknown[]; reviewFindings: unknown[] }) {
  return { sources: job.sources.map(({ id, url, title, host, tier }) => ({ id, url, title, host, tier })), claims: job.claims, rejectedClaims: job.rejectedClaims, checks: job.checks, reviewFindings: job.reviewFindings } as import('./app/types').EvidenceData;
}

const asText = (v: unknown) => (typeof v === 'string' ? v : '');

/** The editor's fields and option lists. */
export async function editorData(content: { frontmatter: Record<string, unknown>; body: string }, _slug: string) {
  const fm = content.frontmatter as Record<string, any>;
  const [authors, owners] = await Promise.all([authorOptions(), ownerOptions()]);
  const owner = asText(fm.owner);
  const ownerList = owner && owner !== '/blog/' && !owners.some((o) => o.path === owner) ? [{ path: owner, label: owner }, ...owners] : owners;
  return {
    fields: {
      h1: asText(fm.h1), body: content.body, author: asText(fm.author), topic: asText(fm.topic), owner, summary: asText(fm.summary), openingAnswer: asText(fm.openingAnswer), linkLabel: asText(fm.linkLabel),
      headKeyword: asText(fm.headKeyword), title: asText(fm.title), metaDescription: asText(fm.metaDescription), faq: Array.isArray(fm.faq) ? fm.faq.map((f: any) => ({ question: asText(f?.question), answer: asText(f?.answer) })) : [],
      ctaPrimaryLabel: asText(fm.ctas?.primary?.label), ctaPrimaryHref: asText(fm.ctas?.primary?.href), ctaSecondaryLabel: asText(fm.ctas?.secondary?.label), ctaSecondaryHref: asText(fm.ctas?.secondary?.href), whatsapp: asText(fm.ctas?.whatsapp),
    },
    authors: authors.map((a) => ({ value: a.id, label: a.name })),
    topics: POST_TOPICS.map((t) => ({ value: t as string, label: POST_TOPIC_LABELS[t] })),
    owners: ownerList.map((o) => ({ value: o.path, label: o.label })),
  };
}

/** Every field that will publish, with human values. New schema fields appear on their own, unseen by nobody. */
export async function publishedFields(fm: Record<string, unknown>) {
  const authors = await authorOptions();
  const readable: Record<string, (value: string) => string> = {
    topic: (v) => POST_TOPIC_LABELS[v as PostTopic] ?? v,
    author: (v) => authors.find((a) => a.id === v)?.name ?? v,
    status: (v) => (v === 'published' ? 'Published' : 'Not published yet'),
  };
  const skip = new Set(['h1', 'title', 'metaDescription', 'openingAnswer', 'editorialPass']);
  return flattenFields(fm)
    .filter((row) => !skip.has(row.path.split(/[.[]/)[0]!) && !row.path.startsWith('faq'))
    .map((row) => ({
      name: FIELD_NAMES[row.path] ?? fieldLabel(row.path).replace(/^Ctas\b/, 'Calls to action').replace(/^Head keyword/, 'Main keyword').replace(/^Link label/, 'Link text').replace(/^Owner/, 'Landing page'),
      shown: readable[row.path]?.(row.value) ?? row.value,
      external: row.external,
    }));
}
