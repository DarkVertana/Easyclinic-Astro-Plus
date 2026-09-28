/**
 * Round trip through Keystatic over every managed file (docs/keystatic-design.md 7.2). For every entry of every
 * Keystatic collection and singleton:
 *
 * 1. Reader: Keystatic's own `createReader` opens the entry (keystatic-config.test.ts checks the ids it lists).
 * 2. Reader → Zod: the reader's output, normalised as the design says (object keys holding '' dropped, null dropped
 *    unless the field writes null on purpose, the MDX body removed, dates left as strings), passes the site's Zod
 *    schema and gives exactly what the build gets from the file.
 * 3. Simulated save: each form field's own parse, validate and serialize (the editor pipeline, copied from
 *    @keystatic/core 0.6.9 in keystatic-harness.ts), then js-yaml dump and load, as the admin writes the file. The saved
 *    file gives the build exactly the same data; every unknown (`null`) stays null; no yes/no text cell turns into a
 *    boolean; the YAML has no aliases; and the publish rules report the same issues on the raw YAML as before
 *    (lint-content reads raw YAML).
 * 4. New entries: real data leaves many keys unset (docs/keystatic-design.md 7.2, "Coverage"), so for every block,
 *    collection and singleton a form with every field filled in, and an untouched new block the editor would let a
 *    writer save, are serialised the same way and must pass Zod. Only Zod's cross-field rules (custom issues, listed
 *    in keystatic-parity's ZOD_ONLY) may fail on made-up sample text.
 *
 * What it tolerates, and why:
 * - PENDING_DATA_FIXES (keystatic-harness.ts): data problems that need a src/content edit. While the bad text is in the
 *   file, the reader must fail with exactly the listed issue, and steps 2 and 3 run on a copy with the fix applied.
 *   Once the fix lands, the tests fail until the entry is deleted, so the list cannot go stale.
 * - Draft posts with uncommitted changes (another workflow may be rewriting them mid-run): they are read like every
 *   other entry, but a failure is counted and skipped. Published posts are never skipped, and a clean checkout skips
 *   nothing.
 * - Formatting is not compared (key order, quoting, folding, `[]` for defaulted lists, explicit defaults, blank optional
 *   groups): only what the Zod schemas produce from the file, which is what the site builds from.
 * - OPTIONAL_LISTS_SAVED_EMPTY (keystatic-harness.ts): an absent optional list is saved as `[]` where every reader
 *   treats the two the same (2.5); the parity test keeps that list complete.
 * - MDX bodies are not re-serialised here: keystatic-mdx-bodies.test.ts saves every body with the editor's own field.
 * - YAML comments: a save deletes every one (js-yaml writes none), and the Zod comparison cannot see that. Every
 *   managed file that carries comments is listed as a todo under its collection ("a save deletes N YAML comment
 *   lines in …"), so the count shows in every run, and
 *   `pnpm exec vitest run --project unit --reporter=verbose tests/unit/keystatic-roundtrip.test.ts` names the files.
 *   Moving the comments into `notes` / `editorNote` (docs/keystatic-design.md 5) is a src/content edit, not done here.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createReader } from '@keystatic/core/reader';
import { dump, load } from 'js-yaml';
import { afterAll, describe, expect, it, vi } from 'vitest';
import keystaticConfig from '../../keystatic.config.ts';
import { KS_BLOCKS } from '../../keystatic/blocks/index.ts';
import { auditEntry } from '../../src/lib/rules/audit.ts';
import * as dataSchemas from '../../src/schemas/data.ts';
import * as families from '../../src/schemas/families.ts';
import { blankGroupsToUndefined } from '../../src/schemas/groups.ts';
import { BLOCK_NAMES, BLOCK_SCHEMAS } from '../../src/schemas/sections.ts';
import {
  COLLECTION_FAMILY,
  CONTENT,
  DATA_SCHEMA_EXPORT,
  KEYSTATIC_CORE_VERIFIED,
  OPTIONAL_LISTS_SAVED_EMPTY,
  PENDING_DATA_FIXES,
  ROOT,
  describeError,
  editorParse,
  editorSerialize,
  editorValidate,
  entryFile,
  getPath,
  initialState,
  installedKeystaticCore,
  metaOf,
  normaliseReaderOutput,
  pendingFixesFor,
  postStatus,
  resolveDataSchema,
  rootNode,
  splitFrontmatter,
  uncommittedPosts,
  valuesAt,
  withPendingFixes,
  writesNull,
  yamlCommentLines,
  zodContext,
  type EntryInfo,
  type KsNode,
} from './keystatic-harness.ts';

vi.mock('astro:content', async () => (await import('./keystatic-harness.ts')).astroContentMock());

type Collection = { path: string; slugField: string; format: { contentField?: string }; schema: Record<string, KsNode> };
const collections = keystaticConfig.collections as unknown as Record<string, Collection>;
const singletons = keystaticConfig.singletons as unknown as Record<string, { path: string; schema: Record<string, KsNode> }>;

type Reader = {
  collections: Record<string, { list(): Promise<string[]>; readOrThrow(slug: string): Promise<unknown> }>;
  singletons: Record<string, { readOrThrow(): Promise<unknown> }>;
};
const reader = createReader(ROOT, keystaticConfig) as unknown as Reader;

/** Draft posts with uncommitted changes: read, but a failure is counted and skipped (see the header). */
const MID_EDIT_DRAFTS = new Set([...uncommittedPosts()].filter((slug) => (postStatus(slug) ?? 'draft') === 'draft'));

/** Pending fixes applied to copies of their files, for the reader (a reader over the copy only). */
const patchedRoot = mkdtempSync(join(tmpdir(), 'keystatic-roundtrip-'));
for (const file of new Set(PENDING_DATA_FIXES.map((fix) => fix.file))) {
  mkdirSync(join(patchedRoot, dirname(file)), { recursive: true });
  writeFileSync(join(patchedRoot, file), withPendingFixes(file, readFileSync(join(ROOT, file), 'utf8')));
}
const patchedReader = createReader(patchedRoot, keystaticConfig) as unknown as Reader;
afterAll(() => rmSync(patchedRoot, { recursive: true, force: true }));

/** Every managed file that carries YAML comments, which any Keystatic save deletes (docs/keystatic-design.md 5). */
type Commented = { key: string; file: string; lines: number };
const COMMENTED: Commented[] = [];
for (const key of [...Object.keys(collections), ...Object.keys(singletons)]) {
  const ksPath = collections[key]?.path ?? singletons[key].path;
  const slugs = key in collections ? [...(await reader.collections[key].list())].sort() : [undefined];
  for (const slug of slugs) {
    const file = entryFile(ksPath, slug);
    const lines = yamlCommentLines(readFileSync(join(ROOT, file), 'utf8'), file.endsWith('.mdx'));
    if (lines) COMMENTED.push({ key, file, lines });
  }
}

/* ---------- Comparing Zod outputs ---------- */

/** Zod output in a comparable form: Dates as ISO strings, undefined object keys dropped. */
function canonical(value: unknown): unknown {
  if (value instanceof Date) return { $date: Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString() };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/**
 * The first place two canonical values differ, as `path: a ≠ b`. `scope` (the collection key) is set for Zod outputs,
 * where an acknowledged optional list may be absent on one side and `[]` on the other.
 */
function difference(a: unknown, b: unknown, path = '', scope?: string): string | undefined {
  if (isDeepStrictEqual(a, b)) return undefined;
  const generic = `${scope}.${path.replace(/\.\d+(?=\.|$)/g, '[]')}`;
  const emptyList = (v: unknown) => Array.isArray(v) && v.length === 0;
  if (scope && generic in OPTIONAL_LISTS_SAVED_EMPTY && ((a === undefined && emptyList(b)) || (emptyList(a) && b === undefined))) return undefined;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) {
      const found = difference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path}.${key}` : key, scope);
      if (found) return found;
    }
    return undefined;
  }
  const short = (v: unknown) => (JSON.stringify(v) ?? 'undefined').slice(0, 120);
  return `${path || '(root)'}: ${short(a)} ≠ ${short(b)}`;
}

type ZodSchema = { safeParse(data: unknown): { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } };

function zodIssues(result: ReturnType<ZodSchema['safeParse']>): string[] {
  return result.success ? [] : result.error.issues.slice(0, 6).map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
}

/* ---------- One entry ---------- */

type Report = {
  id: string;
  /** Failures here are counted, not failed (mid-edit draft posts). */
  tolerated: boolean;
  reader: string[];
  zod: string[];
  save: string[];
  /** Pending data fixes applied for steps 2 and 3. */
  patched: number;
};

async function analyse(key: string, slug: string | undefined): Promise<Report> {
  const collection = collections[key];
  const isSingleton = !collection;
  const ksPath = collection?.path ?? singletons[key].path;
  const file = entryFile(ksPath, slug);
  const id = slug === undefined ? key : `${key}/${slug}`;
  const report: Report = { id, tolerated: key === 'posts' && slug !== undefined && MID_EDIT_DRAFTS.has(slug), reader: [], zod: [], save: [], patched: 0 };
  const root = rootNode((collection ?? singletons[key]).schema);
  const family = COLLECTION_FAMILY[key];
  const schema: ZodSchema = family
    ? (families as Record<string, (c: unknown) => ZodSchema>)[`${family}Schema`](zodContext)
    : resolveDataSchema((dataSchemas as unknown as Record<string, ZodSchema>)[DATA_SCHEMA_EXPORT[key]]);

  // Step 1: the reader, with pending data fixes expected to fail exactly as listed.
  const source = readFileSync(join(ROOT, file), 'utf8');
  const fixes = pendingFixesFor(key, slug).filter((fix) => source.includes(fix.find));
  const read = async (from: Reader): Promise<{ value: unknown; issues: string[] }> => {
    try {
      return { value: await (isSingleton ? from.singletons[key].readOrThrow() : from.collections[key].readOrThrow(slug!)), issues: [] };
    } catch (error) {
      // "Invalid data for …:" then one line per issue.
      return { value: undefined, issues: describeError(error).filter((line) => !/^Invalid data for /.test(line)) };
    }
  };
  let { value: readerValue, issues } = await read(reader);
  const expected = fixes.map((fix) => fix.issue);
  if (!isDeepStrictEqual([...issues].sort(), [...expected].sort())) {
    report.reader.push(...issues.filter((line) => !expected.includes(line)));
    report.reader.push(...expected.filter((line) => !issues.includes(line)).map((line) => `expected while a pending data fix is open: ${line}`));
  }
  if (fixes.length) {
    report.patched = fixes.length;
    ({ value: readerValue, issues } = await read(patchedReader));
    report.reader.push(...issues.map((line) => `with the pending fixes applied: ${line}`));
  }

  // The data the build reads from the file (with pending fixes applied).
  const text = withPendingFixes(file, source);
  let raw: Record<string, unknown>;
  try {
    const mdx = collection?.format.contentField !== undefined;
    raw = load(mdx ? (splitFrontmatter(text)?.frontmatter ?? '') : text) as Record<string, unknown>;
  } catch (error) {
    report.zod.push(`the file is not valid YAML: ${(error as Error).message.split('\n')[0]}`);
    return report;
  }
  const fromFile = schema.safeParse(raw);
  if (!fromFile.success) {
    report.zod.push(...zodIssues(fromFile).map((line) => `the file fails Zod (the build fails too): ${line}`));
    return report;
  }

  // Step 2: reader output → Zod.
  if (readerValue !== undefined) {
    const fromReader = schema.safeParse(normaliseReaderOutput(root, readerValue));
    if (!fromReader.success) report.zod.push(...zodIssues(fromReader).map((line) => `reader output fails Zod: ${line}`));
    else {
      const diff = difference(canonical(fromFile.data), canonical(fromReader.data), '', key);
      if (diff) report.zod.push(`reader output differs from the file: ${diff}`);
    }
  }

  // Step 3: simulated save.
  const entry: EntryInfo = { key, slug, file, slugField: collection?.slugField, glob: ksPath.endsWith('/**') ? '**' : '*' };
  let state: unknown;
  try {
    state = editorParse(root, raw, entry);
  } catch (error) {
    report.save.push(...describeError(error).map((line) => `the editor cannot open it: ${line}`));
    return report;
  }
  report.save.push(...editorValidate(root, state, entry).map((line) => `the editor would refuse to save it unchanged: ${line}`));
  const yaml = dump(editorSerialize(root, state, entry));
  if (/[&*]ref_\d/.test(yaml)) report.save.push('the saved YAML has aliases (&ref_ / *ref_)');
  const saved = load(yaml) as Record<string, unknown>;
  const fromSave = schema.safeParse(saved);
  if (!fromSave.success) report.save.push(...zodIssues(fromSave).map((line) => `the saved file fails Zod: ${line}`));
  else {
    const diff = difference(canonical(fromFile.data), canonical(fromSave.data), '', key);
    if (diff) report.save.push(`the saved file builds differently: ${diff}`);
  }
  for (const { path, value } of valuesAt(root, raw, writesNull)) {
    if (value === null && getPath(saved, path) !== null) report.save.push(`${path}: null (unknown) is not kept`);
  }
  for (const { path, value } of valuesAt(root, raw, (node) => metaOf(node)?.kind === 'boolOrText')) {
    if (value === 'yes' || value === 'no') report.save.push(`${path}: the text "${value}" would be saved as a boolean`);
  }
  if (family) {
    const issuesOf = (data: unknown) => auditEntry(blankGroupsToUndefined(data) as never, family).map((i) => `[${i.rule}] ${i.path}: ${i.message}`).sort();
    const before = issuesOf(raw);
    const after = issuesOf(saved);
    if (!isDeepStrictEqual(before, after)) {
      report.save.push(`the publish rules on the raw YAML change: ${difference(before, after)}`);
    }
  }
  return report;
}

const cache = new Map<string, Promise<Report[]>>();
function analyseAll(key: string): Promise<Report[]> {
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const slugs = key in collections ? [...(await reader.collections[key].list())].sort() : [undefined];
        return Promise.all(slugs.map((slug) => analyse(key, slug)));
      })(),
    );
  }
  return cache.get(key)!;
}

/** Failures of one step, minus tolerated entries (annotated on the test with their count). */
async function failures(key: string, step: 'reader' | 'zod' | 'save', annotate: (message: string) => Promise<unknown>): Promise<string[]> {
  const reports = await analyseAll(key);
  expect(reports.length, `${key} has entries`).toBeGreaterThan(0);
  const skipped = reports.filter((r) => r.tolerated && r[step].length);
  if (skipped.length) await annotate(`${skipped.length} uncommitted draft post(s) skipped: ${skipped.map((r) => r.id).join(', ')}`);
  const patched = reports.filter((r) => r.patched);
  if (patched.length && step !== 'reader') await annotate(`${patched.map((r) => `${r.id} (${r.patched} pending data fixes)`).join(', ')} checked on a patched copy`);
  return reports.filter((r) => !r.tolerated).flatMap((r) => r[step].map((line) => `${r.id}: ${line}`));
}

/* ---------- Tests ---------- */

describe('Keystatic round trip: set-up', () => {
  it(`the simulated editor pipeline was copied from the installed @keystatic/core (${KEYSTATIC_CORE_VERIFIED})`, () => {
    expect(installedKeystaticCore(), 'Re-check keystatic-harness.ts against the new @keystatic/core source, then update KEYSTATIC_CORE_VERIFIED').toBe(KEYSTATIC_CORE_VERIFIED);
  });

  const commentLines = COMMENTED.reduce((sum, c) => sum + c.lines, 0);
  it(`YAML comments a save deletes: ${COMMENTED.length} files, ${commentLines} lines (each file is a todo under its collection)`, async ({ annotate }) => {
    // What the save writes (js-yaml) never has a comment, and the count follows YAML, not lines starting with `#`.
    const source = '# header\nnotes:\n  - >-\n    a folded line\n    #not-a-comment inside the scalar\nkey: value # trailing\n';
    expect(yamlCommentLines(source, false)).toBe(2);
    expect(yamlCommentLines(dump(load(source)), false)).toBe(0);
    expect(yamlCommentLines(`---\n${source}---\n\n# A heading, not YAML\n`, true)).toBe(2);
    if (COMMENTED.length) await annotate(COMMENTED.map((c) => `${c.file} (${c.lines})`).join(', '));
  });

  for (const fix of PENDING_DATA_FIXES) {
    it(`pending data fix still needed: ${fix.file} "${fix.find}"`, () => {
      const source = readFileSync(join(ROOT, fix.file), 'utf8');
      expect(source.includes(fix.find), `The fix landed: delete this entry from PENDING_DATA_FIXES in tests/unit/keystatic-harness.ts`).toBe(true);
    });
  }
});

const collectionKeys = Object.keys(collections);
const singletonKeys = Object.keys(singletons);

for (const key of [...collectionKeys, ...singletonKeys]) {
  const kind = key in collections ? 'collection' : 'singleton';
  const note = key === 'posts' && MID_EDIT_DRAFTS.size ? ` (${MID_EDIT_DRAFTS.size} uncommitted drafts: failures counted and skipped)` : '';
  describe(`Keystatic round trip: ${kind} ${key}${note}`, () => {
    it('the reader opens every entry', async ({ annotate }) => {
      expect(await failures(key, 'reader', annotate)).toEqual([]);
    });
    it('reader output passes Zod and matches what the build reads', async ({ annotate }) => {
      expect(await failures(key, 'zod', annotate)).toEqual([]);
    });
    it('a save without edits changes nothing the build or the publish rules see', async ({ annotate }) => {
      expect(await failures(key, 'save', annotate)).toEqual([]);
    });
    for (const { file, lines } of COMMENTED.filter((c) => c.key === key)) {
      it.todo(`a save deletes ${lines} YAML comment line${lines === 1 ? '' : 's'} in ${file}: move them into notes or editorNote first`);
    }
  });
}

/* ---------- New entries: every field filled in, and untouched ---------- */

const TEXT_SAMPLES = [
  'A sample value, long enough for any minimum length the site sets.',
  '/features/emr/',
  'sample-id',
  'https://example.com/',
  '09:12',
  '254700000000',
  'hello@example.com',
  '+254 700 000 000',
  '@easyclinic',
  'ke',
  '2025-01',
];
const ids = (n: number) => Array.from({ length: n }, (_, i) => `sample-${i + 1}`);

/** Stored values to try for a form field, in order of preference; the first one the field accepts is used. */
function sampleCandidates(node: KsNode): unknown[] {
  const meta = metaOf(node);
  const kind = meta?.kind === 'unknown' ? meta.inner.kind : meta?.kind;
  const options = (node.options ?? []).map((o) => o.value).filter((v) => !/^__\w+__$/.test(v));
  switch (kind) {
    case 'text':
      return TEXT_SAMPLES;
    case 'url':
      return ['https://example.com/'];
    case 'date':
      return ['2026-09-26'];
    case 'int':
    case 'num':
      return [3, 2, 1, 4];
    case 'flag':
      return [true];
    case 'choice':
    case 'optionalChoice':
    case 'unknownChoice':
      return options;
    case 'choices':
      return [options.slice(0, 1)];
    case 'ref':
      return ['sample-1'];
    case 'refs':
      return [2, 1, 3, 4, 5, 6, 7, 8].map(ids);
    case 'unknownFlag':
      return [true];
    case 'unknownList':
      return [['Card', 'Bank transfer']];
    case 'boolOrText':
      return [true, 'own patients only'];
    default:
      return [];
  }
}

/** A form with every field filled in (lists at their minimum length, or two items). Images stay empty: no file exists. */
function filledState(node: KsNode): unknown {
  switch (node.kind) {
    case 'form': {
      const meta = metaOf(node);
      if (node.formKind === 'content' || node.formKind === 'assets') return CONTENT;
      if (node.formKind === 'asset') return null;
      if (meta?.kind === 'imagePath') return node.defaultValue();
      if (meta?.kind === 'slug') return { name: 'Sample name', slug: 'sample' };
      if (meta?.kind === 'preserved') return { value: undefined };
      for (const candidate of sampleCandidates(node)) {
        try {
          return node.validate(node.parse(candidate, undefined), undefined);
        } catch {
          // try the next one
        }
      }
      throw new Error(`no sample value fits the field "${node.label}"`);
    }
    case 'object':
      return Object.fromEntries(Object.entries(node.fields!).map(([key, child]) => [key, filledState(child)]));
    case 'array': {
      const { min = 0, max = Infinity } = node.validation?.length ?? {};
      return Array.from({ length: Math.min(Math.max(min, 2), max) }, () => filledState(node.element!));
    }
    case 'conditional': {
      const discriminant = node.discriminant!.defaultValue();
      return { discriminant, value: filledState(node.values![discriminant]) };
    }
    default:
      return null;
  }
}

/** Saves `state` as the editor would and parses the file with Zod; returns the issues other than cross-field rules. */
function saveAndParse(node: KsNode, state: unknown, entry: EntryInfo, schema: ZodSchema, wrap = (data: unknown) => data, onlyShape = true): string[] {
  const refused = editorValidate(node, state, entry);
  if (refused.length) return refused.map((line) => `the editor refuses the sample: ${line}`);
  const saved = load(dump(editorSerialize(node, state, entry)));
  const result = schema.safeParse(wrap(saved));
  if (result.success) return [];
  return result.error.issues
    .filter((i) => !onlyShape || (i as { code?: string }).code !== 'custom')
    .map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
}

const blockEntry: EntryInfo = { key: 'block', slug: 'sample', file: '' };

describe('Keystatic round trip: new entries', () => {
  for (const name of BLOCK_NAMES) {
    it(`block ${name}: every field filled in, and an untouched new block, save as data Zod accepts`, () => {
      const node = KS_BLOCKS[name].schema as KsNode;
      const schema = (BLOCK_SCHEMAS[name] as (c: unknown) => ZodSchema)(zodContext);
      const wrap = (value: unknown) => ({ discriminant: name, value });
      expect(saveAndParse(node, filledState(node), blockEntry, schema, wrap)).toEqual([]);
      // An untouched block is only checked when the editor would save it (otherwise a required field stops the save).
      const untouched = initialState(node);
      if (!editorValidate(node, untouched, blockEntry).length) expect(saveAndParse(node, untouched, blockEntry, schema, wrap, false)).toEqual([]);
    });
  }

  for (const key of [...Object.keys(collections), ...Object.keys(singletons)]) {
    it(`${key in collections ? 'collection' : 'singleton'} ${key}: every field filled in saves as data Zod accepts`, () => {
      const collection = collections[key];
      const node = rootNode((collection ?? singletons[key]).schema);
      const family = COLLECTION_FAMILY[key];
      const schema: ZodSchema = family
        ? (families as Record<string, (c: unknown) => ZodSchema>)[`${family}Schema`](zodContext)
        : resolveDataSchema((dataSchemas as unknown as Record<string, ZodSchema>)[DATA_SCHEMA_EXPORT[key]]);
      const entry: EntryInfo = { key, slug: collection ? 'sample' : undefined, file: '', slugField: collection?.slugField };
      expect(saveAndParse(node, filledState(node), entry, schema)).toEqual([]);
    });
  }
});
