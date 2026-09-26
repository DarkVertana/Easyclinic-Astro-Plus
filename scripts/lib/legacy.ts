/**
 * The legacy URL inventory (migration/legacy-urls.csv): every URL the WordPress site, its staging copy or
 * the redirect data knows about, with where it was found. Written by scripts/legacy-urls.ts, read by
 * scripts/check-coverage.ts.
 */
import { normalizePath } from '../../integrations/routes-core.ts';
import { parseCsvRecords, stringifyCsv } from './csv.ts';

export const LEGACY_CSV = 'migration/legacy-urls.csv';
export const LEGACY_HOSTS = new Set(['www.easyclinic.io', 'easyclinic.io']);

/** Owner decision (26 Sep 2026): the directory pages are skipped entirely; their URLs fall through to the 404. */
export const EXPECTED_404 = [/^\/doctors(?:\/|$)/, /^\/clinics(?:\/|$)/];

export interface LegacyRow {
  path: string;
  /** Where the URL was found: sitemap file names, `staging-sitemap`, `known:<kind>`, `redirects.yaml`. */
  sources: string[];
  /** Newest lastmod across the sitemaps that list it (YYYY-MM-DD), or ''. */
  lastmod: string;
  /** '404' when a 404 is the intended result (owner decision); '' when it must be 200, a one-hop 301 or a 410. */
  expected: '' | '404';
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** A sitemap index (`<sitemap>` children) or a URL set (`<url>` entries). */
export function parseSitemap(xml: string): { kind: 'index' | 'urlset'; entries: SitemapEntry[] } {
  const kind = /<sitemapindex[\s>]/.test(xml) ? 'index' : 'urlset';
  const tag = kind === 'index' ? 'sitemap' : 'url';
  const entries: SitemapEntry[] = [];
  for (const block of xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))) {
    const loc = block[1].match(/<loc>([\s\S]*?)<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = block[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1];
    entries.push({ loc: decodeXml(loc), ...(lastmod ? { lastmod: decodeXml(lastmod) } : {}) });
  }
  return { kind, entries };
}

/** The site path for a URL on the live host (trailing slash added), or null for other hosts. */
export function toLegacyPath(loc: string): string | null {
  let url: URL;
  try {
    url = new URL(loc, 'https://www.easyclinic.io');
  } catch {
    return null;
  }
  if (!LEGACY_HOSTS.has(url.hostname)) return null;
  return normalizePath(url.pathname);
}

/** YYYY-MM-DD of the newer of two lastmod values ('' when neither parses). */
export function newerDate(a: string, b: string | undefined): string {
  const day = (v: string | undefined) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const x = day(a);
  const y = day(b);
  return x > y ? x : y;
}

export function expectedFor(path: string): '' | '404' {
  return EXPECTED_404.some((re) => re.test(path)) ? '404' : '';
}

/** Collects URLs from many sources into one row per path. */
export class LegacyInventory {
  readonly rows = new Map<string, LegacyRow>();

  add(path: string, source: string, lastmod?: string): void {
    const p = normalizePath(path);
    const row = this.rows.get(p) ?? { path: p, sources: [], lastmod: '', expected: expectedFor(p) };
    if (!row.sources.includes(source)) row.sources.push(source);
    row.lastmod = newerDate(row.lastmod, lastmod);
    this.rows.set(p, row);
  }

  sorted(): LegacyRow[] {
    const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return [...this.rows.values()]
      .map((r) => ({ ...r, sources: [...r.sources].sort(byCodePoint) }))
      .sort((a, b) => byCodePoint(a.path, b.path));
  }
}

const HEADER = ['path', 'sources', 'lastmod', 'expected'];

export function writeLegacyCsv(rows: LegacyRow[]): string {
  return stringifyCsv([HEADER, ...rows.map((r) => [r.path, r.sources.join(';'), r.lastmod, r.expected])]);
}

export function readLegacyCsv(text: string): LegacyRow[] {
  const { header, records } = parseCsvRecords(text);
  for (const column of HEADER) if (!header.includes(column)) throw new Error(`${LEGACY_CSV} has no "${column}" column`);
  return records.map((r) => ({
    path: r.path,
    sources: r.sources ? r.sources.split(';') : [],
    lastmod: r.lastmod,
    expected: r.expected === '404' ? '404' : '',
  }));
}
