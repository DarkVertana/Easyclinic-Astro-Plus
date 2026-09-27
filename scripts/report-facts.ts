/**
 * The company fact sheet (spec 9.1 "a one-page fact sheet every writer works from"): every unknown fact
 * (null) and [placeholder] in shared data and page content, grouped by who must supply it.
 * Writes reports/facts-report.md and prints a summary.
 *
 * Usage: node scripts/report-facts.ts
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { PLACEHOLDER } from '../src/lib/rules/text.ts';
import { UNRENDERED_KEYS } from '../src/schemas/constants.ts';
import { blankGroupsToUndefined } from '../src/schemas/groups.ts';

/** Editor-only keys and rendered footnotes (`note`) are not facts to supply. */
const SKIP = new Set<string>([...UNRENDERED_KEYS, 'note']);

const ROOT = process.cwd();
type Row = { file: string; path: string; what: string };
const groups = new Map<string, Row[]>();
const add = (group: string, row: Row) => groups.set(group, [...(groups.get(group) ?? []), row]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.ya?ml$/.test(name) ? [p] : [];
  });
}

const GROUP_FOR: Array<[RegExp, string]> = [
  [/src\/data\/prices\//, 'Prices (founders)'],
  [/src\/data\/regulators\//, 'Compliance status and dates (product and compliance)'],
  [/src\/data\/countries\//, 'Country contacts, payments and invoicing'],
  [/src\/data\/study\.yaml/, 'Study claims and citations'],
  [/src\/data\/facts\.yaml/, 'Measured numbers and ratings'],
  [/src\/data\/testimonials\//, 'Testimonials (consent and details)'],
  [/src\/data\/authors\//, 'Authors'],
  [/src\/content\//, 'Page content'],
];

function walk(value: unknown, file: string, path: string) {
  const group = GROUP_FOR.find(([re]) => re.test(file))?.[1] ?? 'Other';
  if (value === null) return add(group, { file, path, what: 'unknown (null)' });
  if (typeof value === 'string') {
    for (const m of value.matchAll(PLACEHOLDER)) add(group, { file, path, what: m[0] });
    return;
  }
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, file, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('alt' in obj && 'frame' in obj && !obj.src && !obj.videoUrl) add(group, { file, path, what: `screenshot needed: ${obj.needed ?? obj.alt}` });
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP.has(k)) continue;
      walk(v, file, path ? `${path}.${k}` : k);
    }
  }
}

for (const file of [...files(join(ROOT, 'src/data')), ...files(join(ROOT, 'src/content'))]) {
  const rel = relative(ROOT, file);
  if (/redirects|gone/.test(rel)) continue;
  // Blank optional groups (as Keystatic saves an untouched media or CTA group) are absent, as in the build.
  const data = blankGroupsToUndefined(parse(readFileSync(file, 'utf8')));
  walk(data, rel, '');
  if (rel.startsWith('src/content/') && data && !data.author) add('Page content', { file: rel, path: 'author', what: 'named author' });
}

const total = [...groups.values()].reduce((n, rows) => n + rows.length, 0);
const lines = [`# Facts still needed`, '', `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm facts:report\`. ${total} open items.`, ''];
for (const [group, rows] of groups) {
  lines.push(`## ${group} (${rows.length})`, '', '| File | Field | Needed |', '| --- | --- | --- |');
  for (const r of rows) lines.push(`| ${r.file} | ${r.path || '(whole entry)'} | ${r.what.replace(/\|/g, '\\|')} |`);
  lines.push('');
}
mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'reports/facts-report.md'), lines.join('\n'));
for (const [group, rows] of groups) console.log(`${String(rows.length).padStart(4)}  ${group}`);
console.log(`${String(total).padStart(4)}  total -> reports/facts-report.md`);
