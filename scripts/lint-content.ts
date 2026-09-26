/**
 * Fast pre-commit lint of content YAML with the same rules the build uses (src/lib/rules), plus the
 * collection schemas (block shapes, field types), loaded outside Vite through scripts/lib/astro-hooks.mjs.
 * The build is the definitive check (it also resolves tokens and references); this gives writers
 * feedback in a second without building.
 *
 * Usage: node scripts/lint-content.ts [--all]   (exit 1 if a published entry has errors; --all lists warnings too)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { register } from 'node:module';
import { join, relative } from 'node:path';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { auditBody, auditEntry, errorsOf, type Issue } from '../src/lib/rules/audit.ts';

register('./lib/astro-hooks.mjs', import.meta.url);
const families = (await import('../src/schemas/families.ts')) as unknown as Record<string, (ctx: { image: () => z.ZodType }) => z.ZodType>;
/** Family name to its schema export (`countryDemo` → `countryDemoSchema`). */
const schemaFor = (family: string) => families[`${family}Schema`];
const ctx = { image: () => z.string() };

const FAMILY_BY_DIR: Record<string, string> = {
  home: 'home',
  pricing: 'pricing',
  'country-pages': 'country',
  'country-demos': 'countryDemo',
  company: 'company',
  'kitchen-sink': 'kitchenSink',
  hubs: 'hub',
  features: 'feature',
  solutions: 'solution',
  ai: 'ai',
  curapilot: 'curapilot',
  trust: 'trust',
  specialties: 'specialty',
  guides: 'guide',
  posts: 'post',
  comparisons: 'comparison',
  listicles: 'listicle',
  alternatives: 'listicle',
  customers: 'customers',
  legal: 'legal',
  glossary: 'glossary',
};
const all = process.argv.includes('--all');
let failed = false;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(yaml|mdx)$/.test(name) ? [p] : [];
  });
}

/** Shape errors from the collection schema (the rules engine's own issues, which it re-adds as `[rule]`, are skipped). */
function schemaIssues(data: unknown, family: string): Issue[] {
  const schema = schemaFor(family);
  if (!schema) return [];
  const result = schema(ctx).safeParse(data);
  if (result.success) return [];
  return result.error.issues
    .filter((i) => !/^\[[a-z-]+\] /.test(i.message))
    .map((i) => ({ rule: 'schema', severity: 'error', path: i.path.map(String).join('.'), message: i.message }) as Issue);
}

for (const file of files(join(process.cwd(), 'src/content'))) {
  const rel = relative(process.cwd(), file);
  const family = FAMILY_BY_DIR[rel.split('/')[2]] ?? 'feature';
  const source = readFileSync(file, 'utf8');
  const fm = file.endsWith('.mdx') ? source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) : null;
  const data = parse(fm ? fm[1] : source);
  const bodyIssues = fm && family !== 'legal' ? auditBody(fm[2]) : [];
  const issues = [...schemaIssues(data, family), ...auditEntry(data, family), ...bodyIssues].filter((i) => all || i.severity === 'error');
  if (!issues.length) continue;
  const published = data.status === 'published';
  if (published && errorsOf(issues).length) failed = true;
  console.log(`\n${rel} (${data.status})`);
  for (const i of issues) console.log(`  ${i.severity === 'error' ? '✗' : '!'} [${i.rule}] ${i.path}: ${i.message}${i.excerpt ? `\n      "${i.excerpt}"` : ''}`);
}
process.exit(failed ? 1 : 0);
