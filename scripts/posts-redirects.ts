/**
 * Generates src/data/redirects-posts.yaml (301s) and src/data/gone-posts.yaml (410s) from the posts
 * manifest, for rows marketing has marked confirmed=yes. The build loads both files next to the
 * hand-written redirects.yaml and gone.yaml (src/content.config.ts), so the usual checks apply: duplicate
 * sources, loops, and sources that shadow a built page fail the build.
 *
 * Usage: node scripts/posts-redirects.ts [--check | --dry-run]
 *   --check    exit 1 if the generated files are out of date with the manifest (CI)
 *   --dry-run  print what would be written
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { GoneRule, RedirectRule } from '../integrations/routes-core.ts';
import { parseCsvRecords } from './lib/csv.ts';
import { GONE_OUT, MANIFEST_CSV, REDIRECTS_OUT, generatePostRules, renderGoneYaml, renderRedirectsYaml, type ManifestRow } from './lib/posts-rules.ts';

const check = process.argv.includes('--check');
const dryRun = process.argv.includes('--dry-run');

const { header, records } = parseCsvRecords(readFileSync(MANIFEST_CSV, 'utf8'));
for (const column of ['path', 'proposed_decision', 'target', 'confirmed']) {
  if (!header.includes(column)) throw new Error(`${MANIFEST_CSV} has no "${column}" column`);
}

const yamlList = <T>(file: string) => ((existsSync(file) ? parseYaml(readFileSync(file, 'utf8')) : []) ?? []) as T[];
const result = generatePostRules(records as unknown as ManifestRow[], {
  redirects: yamlList<RedirectRule>('src/data/redirects.yaml'),
  gone: yamlList<GoneRule>('src/data/gone.yaml'),
});

const confirmed = records.filter((r) => r.confirmed.trim().toLowerCase() === 'yes').length;
console.log(`${records.length} manifest rows, ${confirmed} confirmed: ${result.redirects.length} redirects, ${result.gone.length} gone, ${result.skipped.length} skipped`);
for (const s of result.skipped) console.log(`  - ${s.path}: ${s.reason}`);
for (const w of result.warnings) console.warn(`  ! ${w}`);
if (result.errors.length) {
  for (const e of result.errors) console.error(`  ✗ ${e}`);
  console.error(`\n${result.errors.length} confirmed rows cannot be used; fix the manifest. Nothing written.`);
  process.exit(1);
}

const outputs: Array<[string, string]> = [
  [REDIRECTS_OUT, renderRedirectsYaml(result.redirects)],
  [GONE_OUT, renderGoneYaml(result.gone)],
];

if (check) {
  const stale = outputs.filter(([file, text]) => !existsSync(file) || readFileSync(file, 'utf8') !== text).map(([file]) => file);
  if (stale.length) {
    console.error(`\nOut of date with ${MANIFEST_CSV}: ${stale.join(', ')}. Run: node scripts/posts-redirects.ts`);
    process.exit(1);
  }
  console.log('Generated files are up to date.');
} else if (dryRun) {
  for (const [file, text] of outputs) console.log(`\n--- ${file}\n${text}`);
} else {
  for (const [file, text] of outputs) writeFileSync(file, text);
  console.log(`Wrote ${outputs.map(([file]) => file).join(' and ')}`);
}
