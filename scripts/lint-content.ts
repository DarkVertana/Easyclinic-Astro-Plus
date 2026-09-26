/**
 * Fast pre-commit lint of content YAML with the same rules the build uses (src/lib/rules).
 * The build is the definitive check (it also resolves tokens and references); this gives writers
 * feedback in a second without building.
 *
 * Usage: node scripts/lint-content.ts [--all]   (exit 1 if a published entry has errors; --all lists warnings too)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { auditEntry, errorsOf } from '../src/lib/rules/audit.ts';

const FAMILY_BY_DIR: Record<string, string> = {
  home: 'home',
  pricing: 'pricing',
  'country-pages': 'country',
  'country-demos': 'countryDemo',
  company: 'company',
  'kitchen-sink': 'kitchenSink',
};
const all = process.argv.includes('--all');
let failed = false;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : name.endsWith('.yaml') ? [p] : [];
  });
}

for (const file of files(join(process.cwd(), 'src/content'))) {
  const rel = relative(process.cwd(), file);
  const family = FAMILY_BY_DIR[rel.split('/')[2]] ?? 'feature';
  const data = parse(readFileSync(file, 'utf8'));
  const issues = auditEntry(data, family).filter((i) => all || i.severity === 'error');
  if (!issues.length) continue;
  const published = data.status === 'published';
  if (published && errorsOf(issues).length) failed = true;
  console.log(`\n${rel} (${data.status})`);
  for (const i of issues) console.log(`  ${i.severity === 'error' ? '✗' : '!'} [${i.rule}] ${i.path}: ${i.message}${i.excerpt ? `\n      "${i.excerpt}"` : ''}`);
}
process.exit(failed ? 1 : 0);
