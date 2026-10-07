/**
 * Snapshots every legacy URL into migration/legacy-urls.csv (path, sources, lastmod, expected) for the
 * launch coverage check (scripts/check-coverage.ts, plan Phase 4, spec 3.4).
 *
 * Sources, as documented in migration/research/sitemap.md:
 * - both live sitemap sets on www.easyclinic.io: sitemap_index.xml and its children (the "thinkrank" set
 *   robots.txt points to), and the unlinked but fresher page-sitemap.xml and post-sitemap1..3.xml;
 * - the sitemap files themselves and their live aliases (Search Console knows them);
 * - known paths no sitemap lists: the feed, WordPress system paths, category/tag/author archives, the
 *   directory hubs, and the staging sitemap's URLs (§5, which point at www);
 * - every exact `from` in src/data/redirects.yaml;
 * - any exports dropped into migration/legacy-extra/*.txt (one URL or path per line, `#` comments), such as
 *   the Search Console pages export or the GA4 404 list; each file becomes the source `extra:<file name>`.
 *
 * Paths get a trailing slash (file-like paths such as /xmlrpc.php keep none), rows are sorted by path, and
 * /doctors/ and /clinics/ rows carry expected=404 (owner decision: the directory pages are skipped).
 * Requests are sequential with a pause between them and a descriptive User-Agent.
 *
 * Usage: node scripts/legacy-urls.ts [--dry-run]   (--dry-run fetches and prints counts without writing)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { parse as parseYaml } from 'yaml';
import { normalizePath } from '../integrations/routes-core.ts';
import { LEGACY_CSV, LegacyInventory, parseSitemap, toLegacyPath, writeLegacyCsv } from './lib/legacy.ts';

const ORIGIN = 'https://www.easyclinic.io';
const USER_AGENT = 'Easy Clinic site migration (Astro rebuild)';
const PAUSE_MS = 750;
const dryRun = process.argv.includes('--dry-run');

/** Sitemaps to read: the index robots.txt names, and the second set the index does not link (sitemap.md §1). */
const ROOT_SITEMAPS = ['/sitemap_index.xml', '/page-sitemap.xml', '/post-sitemap1.xml', '/post-sitemap2.xml', '/post-sitemap3.xml'];
/** Live aliases that 301 to a sitemap above (sitemap.md §1). */
const SITEMAP_ALIASES = ['/sitemap.xml', '/wp-sitemap.xml', '/post-sitemap.xml'];

/** Known legacy paths that no sitemap lists (sitemap.md §1 and §4, checked 2026-09-26). */
const KNOWN: Record<string, string[]> = {
  feed: ['/feed/'],
  wordpress: ['/wp-admin/', '/wp-login.php', '/xmlrpc.php'],
  // /blog/ 301s to /blogs/ on live. Archives found linked from posts, all 200 on live.
  archive: [
    '/blog/',
    '/category/ai/',
    '/category/bi-software/',
    '/category/billing-software/',
    '/category/cardiology-equipments/',
    '/category/clinic-management-software/',
    '/category/clinic-marketing/',
    '/category/dental-equipments/',
    '/category/easyclinic/',
    '/category/emr-medical-software/',
    '/category/eye-surgery-equipments/',
    '/category/guides/',
    '/category/radiology-emr/',
    '/category/telemedicine-software/',
    '/category/whatsapp-clinic/',
    '/tag/ai/',
    '/author/akshaychandel/',
  ],
  // Both 301 to / on live; /doctors/ is in the staging sitemap.
  directory: ['/doctors/', '/clinics/'],
};

let requests = 0;
async function fetchText(path: string): Promise<string> {
  const url = new URL(path, ORIGIN).href;
  for (let attempt = 1; ; attempt++) {
    if (requests++) await sleep(PAUSE_MS);
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1' }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // A bot challenge or error page comes back as HTML with a 200.
      if (!/<(urlset|sitemapindex)[\s>]/.test(text)) throw new Error('response is not a sitemap');
      return text;
    } catch (error) {
      if (attempt >= 3) throw new Error(`${url}: ${(error as Error).message}`);
      console.warn(`  ${url}: ${(error as Error).message}; retrying`);
      await sleep(2000 * attempt);
    }
  }
}

/** The staging sitemap's URL list, recorded in sitemap.md §5 (the staging site's sitemap lists www URLs). */
function stagingPaths(): string[] {
  const md = readFileSync('migration/research/sitemap.md', 'utf8');
  const start = md.indexOf('Full staging list:');
  if (start < 0) throw new Error('migration/research/sitemap.md: "Full staging list:" not found');
  const open = md.indexOf('```', start);
  const close = md.indexOf('```', open + 3);
  const paths = md.slice(open + 3, close).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('/'));
  if (paths.length < 100) throw new Error(`staging list has only ${paths.length} URLs; sitemap.md changed shape`);
  return paths;
}

const inventory = new LegacyInventory();
const counts: Record<string, number> = {};
const visited = new Set<string>();

async function readSitemap(path: string, depth = 0): Promise<void> {
  if (visited.has(path) || depth > 2) return;
  visited.add(path);
  const name = path.replace(/^\//, '');
  const { kind, entries } = parseSitemap(await fetchText(path));
  inventory.add(path, 'known:sitemap-file');
  console.log(`  ${name}: ${entries.length} ${kind === 'index' ? 'sitemaps' : 'URLs'}`);
  for (const entry of entries) {
    const loc = new URL(entry.loc, ORIGIN);
    if (kind === 'index') {
      if (loc.hostname === new URL(ORIGIN).hostname) await readSitemap(loc.pathname, depth + 1);
      continue;
    }
    const legacy = toLegacyPath(entry.loc);
    if (!legacy) continue;
    inventory.add(legacy, name, entry.lastmod);
    counts[name] = (counts[name] ?? 0) + 1;
  }
}

console.log(`Reading sitemaps from ${ORIGIN}`);
for (const path of ROOT_SITEMAPS) await readSitemap(path);
for (const path of SITEMAP_ALIASES) inventory.add(path, 'known:sitemap-file');

for (const [kind, paths] of Object.entries(KNOWN)) for (const path of paths) inventory.add(path, `known:${kind}`);
for (const path of stagingPaths()) inventory.add(path, 'staging-sitemap');

const redirects = parseYaml(readFileSync('src/data/redirects.yaml', 'utf8')) as Array<{ from: string; match?: string }>;
for (const rule of redirects) if ((rule.match ?? 'exact') === 'exact') inventory.add(normalizePath(rule.from), 'redirects.yaml');

const EXTRA_DIR = 'migration/legacy-extra';
for (const name of existsSync(EXTRA_DIR) ? readdirSync(EXTRA_DIR).filter((f) => f.endsWith('.txt')).sort() : []) {
  let added = 0;
  for (const line of readFileSync(`${EXTRA_DIR}/${name}`, 'utf8').split('\n')) {
    const value = line.replace(/#.*$/, '').trim();
    if (!value) continue;
    const path = value.startsWith('/') ? normalizePath(value.split(/[?#]/)[0]) : toLegacyPath(value);
    if (!path) continue;
    inventory.add(path, `extra:${name.replace(/\.txt$/, '')}`);
    added++;
  }
  console.log(`  ${EXTRA_DIR}/${name}: ${added} URLs`);
}

const rows = inventory.sorted();
const posts = rows.filter((r) => r.sources.some((s) => /^(sitemap-posts|post-sitemap)/.test(s))).length;
const pages = rows.filter((r) => r.sources.some((s) => /^(sitemap-pages|page-sitemap)/.test(s))).length;
// Guard against a partial snapshot (sitemap.md: 403 posts, 121 pages on 2026-09-26).
if (posts < 350 || pages < 100) throw new Error(`Only ${posts} posts and ${pages} pages found; not writing ${LEGACY_CSV}`);

console.log(`\n${rows.length} legacy URLs (${pages} pages, ${posts} posts, ${rows.filter((r) => r.expected === '404').length} expected 404) from ${requests} requests`);
for (const [name, n] of Object.entries(counts).sort()) console.log(`  ${name}: ${n}`);
if (dryRun) {
  console.log(`\n--dry-run: ${LEGACY_CSV} not written`);
} else {
  writeFileSync(LEGACY_CSV, writeLegacyCsv(rows));
  console.log(`\nWrote ${LEGACY_CSV}`);
}
