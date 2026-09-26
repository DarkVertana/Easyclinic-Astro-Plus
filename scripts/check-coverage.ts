/**
 * Legacy URL coverage (plan Phase 4: `check-coverage` at 100%). Resolves every URL in
 * migration/legacy-urls.csv, with and without its trailing slash, through the built
 * `.vercel/output/config.json` routes and static files the way Vercel would (scripts/lib/vercel-router.ts,
 * the same emulation `pnpm serve:output` uses), and classifies each:
 *
 *   pass: 200 (built page), 301 (exactly one permanent hop, 301 or 308, to a 200), 410, expected-404 (owner decision)
 *   fail: 404, temporary (one 302 or 307 hop), chain (more than one hop), redirect-to-missing, loop
 *
 * Failures carry the reason where one is known: a redirect skipped until its target publishes, a draft
 * page, a post awaiting marketing's decision in the posts manifest. Writes reports/coverage.md and
 * reports/coverage.json.
 *
 * Usage: node scripts/check-coverage.ts [--strict]   (run after a build; --strict exits 1 on any failure)
 * Launch gate: pnpm build:prod && pnpm coverage --strict
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { normalizePath, type GoneRule, type RedirectRule } from '../integrations/routes-core.ts';
import { checkRow, renderMarkdown, summarise, isFailure, type CoverageReport, type ReasonContext } from './lib/coverage.ts';
import { parseCsvRecords } from './lib/csv.ts';
import { LEGACY_CSV, readLegacyCsv } from './lib/legacy.ts';
import { GONE_OUT, MANIFEST_CSV, REDIRECTS_OUT, type ManifestRow } from './lib/posts-rules.ts';
import { createRouter, listStaticFiles, staticLookup, type Route } from './lib/vercel-router.ts';

const strict = process.argv.includes('--strict');
const OUT = join(process.cwd(), '.vercel/output');

for (const file of ['config.json', 'build-manifest.json', 'static']) {
  if (!existsSync(join(OUT, file))) throw new Error(`.vercel/output/${file} not found: run pnpm build or pnpm build:prod first`);
}

const config = JSON.parse(readFileSync(join(OUT, 'config.json'), 'utf8')) as { routes: Route[] };
const manifest = JSON.parse(readFileSync(join(OUT, 'build-manifest.json'), 'utf8')) as {
  stage: string;
  canonicalHost: string;
  pages: Array<{ path: string; status: string; collection: string }>;
  skippedRedirects?: Array<{ rule: RedirectRule; reason?: string }>;
  hidden?: Array<{ path: string; status: string; collection: string }>;
};
const router = createRouter(config.routes, staticLookup(listStaticFiles(join(OUT, 'static'))));

const postRows = parseCsvRecords(readFileSync(MANIFEST_CSV, 'utf8')).records as unknown as ManifestRow[];
const yamlList = <T>(file: string) => ((existsSync(file) ? parseYaml(readFileSync(file, 'utf8')) : []) ?? []) as T[];
const ctx: ReasonContext = {
  skippedRedirects: manifest.skippedRedirects ?? [],
  hidden: manifest.hidden ?? [],
  pages: manifest.pages.filter((p) => p.collection !== 'static'),
  manifest: new Map(postRows.map((r) => [normalizePath(r.path), r])),
  generatedPostPaths: new Set([
    ...yamlList<RedirectRule>(REDIRECTS_OUT).map((r) => normalizePath(r.from)),
    ...yamlList<GoneRule>(GONE_OUT).map((g) => normalizePath(g.path)),
  ]),
};

const legacy = readLegacyCsv(readFileSync(LEGACY_CSV, 'utf8'));
const rows = legacy.map((row) => checkRow(router, manifest.canonicalHost, row, ctx));
const summary = summarise(rows);
const failures = rows.filter((r) => isFailure(r.cls)).length;
const report: CoverageReport = {
  generatedAt: new Date().toISOString(),
  stage: manifest.stage,
  host: manifest.canonicalHost,
  total: rows.length,
  failures,
  summary,
  rows,
};

mkdirSync('reports', { recursive: true });
writeFileSync('reports/coverage.json', `${JSON.stringify(report, null, 2)}\n`);
writeFileSync('reports/coverage.md', renderMarkdown(report));

const line = Object.entries(summary)
  .filter(([, n]) => n)
  .map(([cls, n]) => `${cls} ${n}`)
  .join(', ');
console.log(`coverage (${manifest.stage} build): ${rows.length} legacy URLs; ${line}`);
console.log(`${failures ? `${failures} failing` : 'all passing'}; details in reports/coverage.md`);
if (!manifest.hidden) console.log('note: this build manifest predates the `hidden` list, so draft pages are not named as a reason');
process.exit(strict && failures ? 1 : 0);
