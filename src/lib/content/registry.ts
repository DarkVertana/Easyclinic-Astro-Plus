/**
 * The route registry: the single source of every content-backed URL.
 *
 * - Derives each page's path from its collection prefix and file name (or an explicit `path`).
 * - Fails on duplicate paths, reserved routes and redirect sources that shadow pages.
 * - Resolves tokens, re-runs the publish rules on the resolved data (title and meta lengths after
 *   tokens, unconfirmed facts) and runs cross-entry checks (links, unique head keywords).
 * - Decides visibility: production renders published entries only.
 * - Throws, failing the build, when a published entry has any error.
 *
 * `urlFor()` and `getRegistry()` are the only way templates, nav, sitemaps and breadcrumbs reach pages.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { matchesRule } from '../../../integrations/routes-core.ts';
import { auditEntry, errorsOf, formatIssues, type Issue } from '../rules/audit.ts';
import type { Family, Status } from '../../schemas/constants';
import type { PageFields } from '../../schemas/base';
import { isProduction, STAGE } from './stage.ts';
import { resolveDeep, type TokenData } from './tokens.ts';

export const PAGE_COLLECTIONS = [
  { name: 'home', prefix: '/' },
  { name: 'pricing', prefix: '/pricing/' },
  { name: 'countryPages', prefix: '/' },
  { name: 'countryDemos', prefix: '/' },
  { name: 'company', prefix: '/' },
  { name: 'kitchenSink', prefix: '/' },
] as const;

export type PageCollection = (typeof PAGE_COLLECTIONS)[number]['name'];
export type PageEntry = CollectionEntry<PageCollection>;
export type PageData = PageFields;

/** Routes owned by files in src/pages; content may not claim them. */
const RESERVED = ['/gone/', '/demo/', '/_actions/', '/keystatic/', '/api/', '/og/'];

export interface PageRecord {
  path: string;
  collection: PageCollection;
  id: string;
  family: Family;
  status: Status;
  /** Entry data with tokens resolved (values may carry placeholder sentinels in preview). */
  data: PageData;
  entry: PageEntry;
  visible: boolean;
  indexable: boolean;
  issues: Issue[];
  label: string;
}

export interface Registry {
  stage: typeof STAGE;
  pages: PageRecord[];
  visible: PageRecord[];
  byPath: Map<string, PageRecord>;
  tokenData: TokenData;
  /** Path to link to, or null when the target is not rendered in this stage. */
  urlFor(path: string): string | null;
  get(path: string): PageRecord | undefined;
}

let cached: Promise<Registry> | null = null;

export function getRegistry(): Promise<Registry> {
  cached ??= build();
  return cached;
}

async function loadTokenData(): Promise<TokenData> {
  const [prices, facts, study, countries] = await Promise.all([
    getCollection('prices'),
    getCollection('facts'),
    getCollection('study'),
    getCollection('countries'),
  ]);
  const studyData = study[0]?.data;
  return {
    prices: Object.fromEntries(prices.map((p) => [p.id, p.data])),
    facts: facts[0]?.data.facts ?? {},
    figures: Object.fromEntries((studyData?.figures ?? []).map((f) => [f.id, f])),
    publications: Object.fromEntries((studyData?.publications ?? []).map((p) => [p.id, p])),
    contacts: Object.fromEntries(countries.map((c) => [c.id, c.data.contact as Record<string, unknown>])),
  };
}

function referencedIds(value: unknown, collection: string, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => referencedIds(v, collection, out));
  else if (value && typeof value === 'object' && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    if (obj.collection === collection && typeof obj.id === 'string') out.push(obj.id);
    else Object.values(obj).forEach((v) => referencedIds(v, collection, out));
  }
  return out;
}

function internalLinks(value: unknown, out: Array<{ path: string; href: string }>, path = ''): void {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\]\((\/[^)\s#]*)(?:#[^)]*)?\)/g)) out.push({ path, href: m[1] });
    return;
  }
  if (Array.isArray(value)) return value.forEach((v, i) => internalLinks(v, out, `${path}[${i}]`));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (k === 'href' && typeof v === 'string' && v.startsWith('/')) out.push({ path: p, href: v.split('#')[0] });
      else internalLinks(v, out, p);
    }
  }
}

async function build(): Promise<Registry> {
  const tokenData = await loadTokenData();
  const [redirects, gone] = await Promise.all([getCollection('redirects'), getCollection('gone')]);

  const records: PageRecord[] = [];
  const byPath = new Map<string, PageRecord>();
  const structural: string[] = [];

  for (const { name, prefix } of PAGE_COLLECTIONS) {
    const entries = (await getCollection(name)) as PageEntry[];
    for (const entry of entries) {
      const raw = entry.data as unknown as PageFields;
      const path = raw.path ?? `${prefix}${entry.id}/`;
      const where = `${name}/${entry.id}`;

      if (byPath.has(path)) structural.push(`${where}: path ${path} is also used by ${byPath.get(path)!.collection}/${byPath.get(path)!.id}`);
      for (const reserved of RESERVED) {
        if (path.startsWith(reserved)) structural.push(`${where}: path ${path} is reserved for a route file`);
      }
      for (const r of redirects) {
        if (matchesRule(path, r.data.from, r.data.match)) structural.push(`${where}: ${path} is also a redirect source in redirects.yaml (${r.data.from}); remove the redirect row when publishing the page`);
      }
      for (const g of gone) {
        if (matchesRule(path, g.data.path, g.data.match)) structural.push(`${where}: ${path} matches gone pattern ${g.data.path}`);
      }

      const { value: data, issues: tokenIssues } = resolveDeep<PageFields>(raw, tokenData);
      const issues = [...auditEntry(data as never, raw.family), ...tokenIssues];
      const visible = !isProduction || raw.status === 'published';
      const record: PageRecord = {
        path,
        collection: name,
        id: entry.id,
        family: raw.family,
        status: raw.status,
        data,
        entry,
        visible,
        indexable: isProduction && raw.status === 'published' && !raw.noindex,
        issues,
        label: raw.linkLabel,
      };
      records.push(record);
      byPath.set(path, record);
    }
  }

  if (structural.length) throw new Error(`Content registry errors:\n  - ${structural.join('\n  - ')}`);

  // Cross-entry checks.
  // Each testimonial sits on the one landing page it praises (spec 2.4); /customers/ may show all of them.
  const testimonialPages = new Map<string, PageRecord[]>();
  for (const record of records) {
    if (record.path === '/customers/' || record.family === 'kitchenSink') continue;
    for (const id of new Set(referencedIds(record.data, 'testimonials'))) {
      testimonialPages.set(id, [...(testimonialPages.get(id) ?? []), record]);
    }
  }
  for (const [id, pages] of testimonialPages) {
    if (pages.length < 2) continue;
    const livePages = pages.filter((p) => p.status === 'published');
    for (const page of pages) {
      page.issues.push({
        rule: 'testimonial-reuse',
        severity: livePages.length > 1 && page.status === 'published' ? 'error' : 'warning',
        path: 'sections',
        message: `Testimonial "${id}" also appears on ${pages.filter((p) => p !== page).map((p) => p.path).join(', ')}; place each testimonial on the page it praises (spec 2.4)`,
      });
    }
  }

  const keywords = new Map<string, string>();
  for (const record of records) {
    if (record.status === 'published') {
      const key = record.data.headKeyword.toLowerCase();
      if (keywords.has(key)) {
        record.issues.push({ rule: 'cannibalisation', severity: 'error', path: 'headKeyword', message: `"${record.data.headKeyword}" is also owned by ${keywords.get(key)} (spec 2.1)` });
      }
      keywords.set(key, record.path);
    }
    const links: Array<{ path: string; href: string }> = [];
    internalLinks(record.data, links);
    for (const link of links) {
      const target = byPath.get(link.href);
      if (!target) {
        record.issues.push({ rule: 'link', severity: 'warning', path: link.path, message: `Links to ${link.href}, which does not exist yet; hidden in production` });
      } else if (record.status === 'published' && target.status !== 'published') {
        record.issues.push({ rule: 'link', severity: 'warning', path: link.path, message: `Links to ${link.href}, which is ${target.status}; hidden in production` });
      }
    }
  }

  const failing = records.filter((r) => r.status === 'published' && errorsOf(r.issues).length);
  if (failing.length) {
    throw new Error(
      `Published pages fail the publish checklist:\n${failing.map((r) => `${r.path} (${r.collection}/${r.id})\n${formatIssues(errorsOf(r.issues))}`).join('\n')}`,
    );
  }

  const visible = records.filter((r) => r.visible);
  const visiblePaths = new Set(visible.map((r) => r.path));
  return {
    stage: STAGE,
    pages: records,
    visible,
    byPath,
    tokenData,
    get: (path) => byPath.get(path),
    urlFor(path) {
      const [bare, hash] = path.split('#');
      if (!bare.startsWith('/')) return path;
      if (visiblePaths.has(bare)) return path;
      if (!isProduction) return path;
      return null;
    },
  };
}
