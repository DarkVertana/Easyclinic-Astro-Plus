/**
 * Blog helpers shared by the post template, the /blog/ index block and the RSS feed (spec 5.19).
 * Pure functions: no Astro imports, so the unit tests and Node scripts can use them.
 */
import { POST_TOPICS, type PostTopic, type Status } from '../../schemas/constants.ts';

/** Fields a post adds to the shared page schema (src/schemas/families.ts, postSchema). */
export interface PostExtras {
  topic: PostTopic;
  /** Internal path of the landing page that owns the post (spec 3.6). */
  owner: string;
  /** Date the post first went live on the WordPress site, when it was imported. */
  originallyPublished?: Date;
}

export const WORDS_PER_MINUTE = 200;

/**
 * Words a reader sees in an MDX body: import/export lines, JSX tags, image syntax, link and image
 * targets, table rules, heading markers and emphasis marks are not words.
 */
export function bodyWordCount(body: string): number {
  const text = body
    .split('\n')
    .filter((line) => !/^\s*(?:import|export)\s/.test(line))
    .join('\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/[#*_>|[\]`~\\]/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Minutes to read, shown beside the date. Posts: about 200 words a minute, rounded up (spec 5.19).
 * Guides keep the figure their template has always shown (every whitespace-separated token at 220 a
 * minute, rounded), so the /blog/ index and the guide page agree.
 */
export function readingMinutes(body: string | undefined, family: string): number {
  const source = body ?? '';
  if (family === 'post') return Math.max(1, Math.ceil(bodyWordCount(source) / WORDS_PER_MINUTE));
  const tokens = source.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(tokens / 220));
}

const normalise = (s: string) =>
  s
    .replace(/[…\s]+$/u, '')
    .replace(/\.{3}$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * True when the summary and the opening answer start the same way, one repeating the other: the summary
 * is the start of the opening answer, or runs on from it (an imported draft cuts both from the post's
 * first paragraph, which follows them on the page). The post page then shows the opening answer once.
 */
export function summaryRepeatsOpening(summary: string | undefined, openingAnswer: string): boolean {
  if (!summary) return true;
  const s = normalise(summary);
  const o = normalise(openingAnswer);
  return s.length === 0 || o.startsWith(s) || (o.length > 0 && s.startsWith(o));
}

/** A page as the index and the feed read it (a structural slice of the registry's PageRecord). */
export interface Listable {
  path: string;
  family: string;
  status: Status;
  data: {
    h1: string;
    summary?: string;
    metaDescription: string;
    lastUpdated: Date | null;
    links: { hub?: string };
    topic?: string;
    originallyPublished?: Date;
  };
  entry: { body?: string };
}

/**
 * The /blog/ topic a page is listed under, or null when it is not a blog entry. Posts carry their own
 * topic; start-a-clinic guides (hub /start-a-clinic/) count as start-a-clinic. Other guides, such as the
 * EMR-versus-paper guide under /compare/, belong to their own hubs.
 */
export function indexTopic(page: Pick<Listable, 'family' | 'data'>): PostTopic | null {
  if (page.family === 'post') return (POST_TOPICS as readonly string[]).includes(page.data.topic ?? '') ? (page.data.topic as PostTopic) : null;
  if (page.family === 'guide' && page.data.links.hub === '/start-a-clinic/') return 'start-a-clinic';
  return null;
}

export interface IndexItem {
  path: string;
  title: string;
  summary: string;
  date: Date | null;
  minutes: number;
  topic: PostTopic;
  status: Status;
}

export function toIndexItem(page: Listable): IndexItem | null {
  const topic = indexTopic(page);
  if (!topic) return null;
  return {
    path: page.path,
    title: page.data.h1,
    summary: page.data.summary ?? page.data.metaDescription,
    date: page.data.lastUpdated,
    minutes: readingMinutes(page.entry.body, page.family),
    topic,
    status: page.status,
  };
}

/** Newest first; undated entries last; then by title so the order is stable. */
export function newestFirst(a: Pick<IndexItem, 'date' | 'title'>, b: Pick<IndexItem, 'date' | 'title'>): number {
  const ad = a.date?.getTime() ?? -Infinity;
  const bd = b.date?.getTime() ?? -Infinity;
  if (ad !== bd) return bd > ad ? 1 : -1;
  return a.title.localeCompare(b.title);
}

export interface TopicGroup {
  topic: PostTopic;
  items: IndexItem[];
}

/**
 * Groups entries by topic in `order` (topics missing from `order` follow in the default order), newest
 * first within each topic. Topics with nothing to show are left out.
 */
export function groupByTopic(items: IndexItem[], order: readonly PostTopic[] = POST_TOPICS): TopicGroup[] {
  const sequence = [...new Set([...order, ...POST_TOPICS])];
  return sequence
    .map((topic) => ({ topic, items: items.filter((i) => i.topic === topic).sort(newestFirst) }))
    .filter((group) => group.items.length > 0);
}
