/**
 * Parity between the site's Zod schemas and the Keystatic forms (docs/keystatic-design.md 7.1). The Zod schemas are
 * the only authority on what is valid; this test proves the forms are a faithful view of them:
 *
 * - the same blocks, and per page family the same allowed blocks, in the same order;
 * - for every block, page collection, data collection and singleton, the same keys with compatible kinds (block keys
 *   also in the same order), the same enum options and defaults, the same list lengths, the same references;
 * - `null` keys map to the unknown* / preserved fields and nothing else does; optional objects map to optionalGroup
 *   with the same `presentIf` keys;
 * - behaviour, not just metadata: every leaf is probed with a set of stored values. Whatever the form accepts, the
 *   value it saves must pass Zod; whatever Zod accepts, the form must open and save unchanged.
 *
 * What it tolerates, and why (each is documented in docs/keystatic-design.md):
 * - An empty string where Zod allows `''`: Keystatic cannot store `''` (an empty text is omitted on save), so required
 *   plain strings and list items refuse it (2.2), and a hand-written `''` is dropped on save (2.4).
 * - Inside an optional group (2.5) fields are not required, so an unused group can be saved empty; Zod checks
 *   completeness once the group is present.
 * - URL and email fields: Keystatic's checks are looser than Zod's (relative URLs pass); Zod stays authoritative.
 * - Cross-field rules are Zod-only and must be acknowledged in ZOD_ONLY below.
 * - A required value with no Zod default may start on a value only where INITIAL_VALUES says so.
 */
import { isDeepStrictEqual } from 'node:util';
import { z } from 'astro/zod';
import { describe, expect, it, vi } from 'vitest';
import keystaticConfig from '../../keystatic.config.ts';
import { KS_BLOCKS } from '../../keystatic/blocks/index.ts';
import type { FieldMeta } from '../../keystatic/fields.ts';
import * as dataSchemas from '../../src/schemas/data.ts';
import * as families from '../../src/schemas/families.ts';
import { BLOCK_NAMES as LISTED_BLOCK_NAMES, FAMILY_BLOCKS } from '../../src/schemas/family-blocks.ts';
import { href as zodHref, internalPath, isoDate, md as zodMd } from '../../src/schemas/fields.ts';
import { EMAIL, HREF, INTERNAL_PATH, LEGAL_SLUG, SLUG_ID } from '../../src/schemas/patterns.ts';
import { BLOCK_NAMES, BLOCK_SCHEMAS } from '../../src/schemas/sections.ts';
import {
  COLLECTION_FAMILY,
  DATA_SCHEMA_EXPORT,
  IMAGE_SCHEMAS,
  OPTIONAL_LISTS_SAVED_EMPTY,
  REFERENCE_COLLECTION,
  metaOf,
  rootNode,
  zodContext,
  type KsNode,
} from './keystatic-harness.ts';

vi.mock('astro:content', async () => (await import('./keystatic-harness.ts')).astroContentMock());

type Collection = { path: string; slugField: string; format: { data?: string; contentField?: string }; schema: Record<string, KsNode> };
const collections = keystaticConfig.collections as unknown as Record<string, Collection>;
const singletons = keystaticConfig.singletons as unknown as Record<string, { schema: Record<string, KsNode> }>;

/**
 * Zod rules that no form can express (cross-field checks). Each custom check the walk finds must be listed here, so a
 * new refinement has to be acknowledged. Writers see these rules in the dev preview toolbar and in the build.
 */
const ZOD_ONLY: Record<string, { count: number; why: string }> = {
  page: { count: Object.keys(COLLECTION_FAMILY).length, why: 'The publish rules (definePage superRefine → auditEntry), one per page collection' },
  'blocks.comparisonTable': { count: 1, why: 'One cell per column; no "Check"; competitor cells need a source and a checked-on date' },
  'blocks.dataTable': { count: 1, why: 'One cell per column' },
  'blocks.glossaryList': { count: 1, why: 'Unique ids; definitions of 40 to 120 words' },
  'blocks.rolesMatrix': { count: 1, why: 'One cell per role' },
  'blocks.vendorList': { count: 1, why: 'No "Check"; competitor facts need a source and a checked-on date' },
};

/**
 * Required values with no Zod default whose field starts on a value (`choice`/`flag` with `initial`, keystatic/fields.ts):
 * new pages start as drafts, the site name has one option, and a checkbox has to start somewhere.
 */
const INITIAL_VALUES = [
  ...Object.keys(COLLECTION_FAMILY).map((key) => `${key}.status`),
  'site.name',
  'study.publications[].peerReviewed',
].sort();

/* ---------- Zod introspection (Zod 4: `_zod.def`) ---------- */

type Zod = any;
type Info = {
  core: Zod;
  optional: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
  /** Accepts null (Zod `unknown()` or `.nullable()`). */
  nullable: boolean;
  /** An optionalGroup's preprocess step (a blank object becomes undefined). */
  preprocess?: (value: unknown) => unknown;
};

function unwrap(schema: Zod): Info {
  const info: Info = { core: schema, optional: false, hasDefault: false, nullable: false };
  let s = schema;
  for (;;) {
    if (s === isoDate || REFERENCE_COLLECTION.has(s) || IMAGE_SCHEMAS.has(s)) break;
    const def = s._zod.def;
    if (def.type === 'optional') s = ((info.optional = true), def.innerType);
    else if (def.type === 'default') s = ((info.hasDefault = true), (info.defaultValue = def.defaultValue), def.innerType);
    // unknown() is `.nullable().refine(v => v !== '')`; its refine sits on this node and is probed like any rule.
    else if (def.type === 'nullable') s = ((info.nullable = true), def.innerType);
    else if (def.type === 'pipe' && def.in._zod.def.type === 'transform') s = ((info.preprocess = def.in._zod.def.transform), def.out);
    else break;
  }
  info.core = s;
  return info;
}

type Cls = 'isoDate' | 'reference' | 'image' | 'href' | 'string' | 'email' | 'url' | 'int' | 'intLiterals' | 'number' | 'boolean' | 'enum' | 'literal' | 'boolOrString' | 'array' | 'object' | 'record' | 'other';

function classify(core: Zod): Cls {
  if (core === isoDate) return 'isoDate';
  if (REFERENCE_COLLECTION.has(core)) return 'reference';
  if (IMAGE_SCHEMAS.has(core)) return 'image';
  if (core === zodHref) return 'href';
  const def = core._zod.def;
  switch (def.type) {
    case 'string':
      return def.format === 'email' ? 'email' : def.format === 'url' ? 'url' : 'string';
    case 'number':
      return checksOf(core).some((c) => c.format === 'safeint') ? 'int' : 'number';
    case 'boolean':
    case 'enum':
    case 'literal':
    case 'array':
    case 'object':
    case 'record':
      return def.type;
    case 'union': {
      const types = def.options.map((o: Zod) => o._zod.def.type);
      if (types.every((t: string) => t === 'literal') && def.options.every((o: Zod) => o._zod.def.values.every((v: unknown) => typeof v === 'number'))) return 'intLiterals';
      if (types.length === 2 && types.includes('boolean') && types.includes('string')) return 'boolOrString';
      return 'other';
    }
    default:
      return 'other';
  }
}

const checksOf = (s: Zod): any[] => (s._zod.def.checks ?? []).map((c: Zod) => c._zod.def);

function lengthBounds(s: Zod): { min: number; max: number } {
  let min = 0;
  let max = Infinity;
  for (const c of checksOf(s)) {
    if (c.check === 'min_length') min = c.minimum;
    if (c.check === 'max_length') max = c.maximum;
    if (c.check === 'length_equals') min = max = c.length;
  }
  return { min, max };
}

const enumValues = (core: Zod): unknown[] => (core._zod.def.type === 'enum' ? core.options : core._zod.def.values);

/* ---------- Probes ---------- */

const ABSENT = Symbol('absent');
type Probe = unknown;

const show = (value: unknown): string =>
  value === ABSENT ? '(absent)' : value instanceof Date ? `Date(${value.toISOString()})` : JSON.stringify(value) ?? String(value);

const STRING_PROBES = [
  '', 'a', 'ab', 'Hello world', 'multi\nline text', ' leading space', '/features/emr/', '/features/emr', '/Features/',
  '/privacy/#india', '/sitemap.xml', 'https://example.com/', 'tel:+254700000000', 'mailto:hello@example.com',
  'hello@example.com', 'hello@example', 'ke', 'KE', 'inr', 'ab-12', 'Ab_12', 'a b', '09:12', '9:12', '09:12pm',
  '254750184357', '+254 750', '@easyclinic', 'Africa/Nairobi', '2026-09-26', '{fact:doctors}', 'yes', 'no',
];
const URL_PROBES = ['https://example.com/', 'https://www.capterra.com/p/1/x/reviews/', 'http://example.com/', 'example.com', '/relative/', ''];
const DATE_PROBES = ['2026-09-26', new Date(Date.UTC(2026, 8, 26)), '26 September 2026', '2026-09-26T00:00:00Z', new Date(Date.UTC(2026, 8, 26, 10, 30)), ''];
const NUMBER_PROBES = [-1, 0, 0.5, 1, 1.5, 2, 3, 4, 5, 2026, '3'];
const SLUG_PROBES = ['emr', 'solo-clinic', 'in', 'privacy/india', 'privacy/uae/dubai', 'My Page', 'Privacy_UAE', 'UPPER', 'a.b', 'with space', '..', 'a/../b'];

const lengths = (...bounds: (number | undefined)[]) =>
  [...new Set(bounds.flatMap((n) => (n === undefined || !Number.isFinite(n) ? [] : [n - 1, n, n + 1])))].filter((n) => n >= 0 && n <= 2000);

function zodResult(key: Zod, value: Probe, inArray: boolean): { ok: true; out: unknown } | { ok: false } {
  if (inArray) {
    const r = z.array(key).safeParse([value === ABSENT || value === undefined ? null : value]);
    return r.success ? { ok: true, out: r.data[0] } : { ok: false };
  }
  const r = z.object({ k: key }).safeParse(value === ABSENT || value === undefined ? {} : { k: value });
  return r.success ? { ok: true, out: (r.data as { k: unknown }).k } : { ok: false };
}

/** Keystatic's editor path for one stored value: parse (a stored null arrives as undefined), validate, serialize. */
function ksResult(field: KsNode, value: Probe): { ok: true; out: unknown } | { ok: false; error: string } {
  const stored = value === ABSENT || value === null ? undefined : value;
  try {
    const state = field.parse(stored, undefined);
    return { ok: true, out: field.serialize(field.validate(state, undefined), undefined).value };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

function readerAccepts(field: KsNode, value: Probe): boolean {
  try {
    field.reader.parse(value === ABSENT || value === null ? undefined : value);
    return true;
  } catch {
    return false;
  }
}

/* ---------- The walk ---------- */

type Ctx = {
  scope: string;
  /** A list item: it can be null but never absent. */
  inArray: boolean;
  /** Inside an optionalGroup: fields may be left empty while the group is unused (2.5). */
  inOptionalGroup: boolean;
  /** A fixed key of a record: always in the file (keystatic-config.test.ts pins the key lists to the data files). */
  fixedKey?: boolean;
  block?: string;
};

const problems = new Map<string, string[]>();
const customChecks = new Map<string, number>();
const initials: string[] = [];
const imageBlocks = new Set<string>();
const leafCount = new Map<string, number>();
const optionalListsSavedEmpty: string[] = [];

function problem(ctx: Ctx, message: string) {
  problems.set(ctx.scope, [...(problems.get(ctx.scope) ?? []), message]);
}

function countCustom(label: string, schema: Zod) {
  const n = checksOf(schema).filter((c) => c.check === 'custom').length;
  if (n) customChecks.set(label, (customChecks.get(label) ?? 0) + n);
}

const LEAF_KINDS: Partial<Record<Cls, FieldMeta['kind'][]>> = {
  string: ['text'],
  email: ['text'],
  href: ['text'],
  url: ['url'],
  isoDate: ['date'],
  int: ['int'],
  intLiterals: ['int'],
  number: ['num'],
  boolean: ['flag'],
  literal: ['choice'],
  reference: ['ref'],
  image: ['image'],
  boolOrString: ['boolOrText'],
};

function expectedKinds(cls: Cls, info: Info): FieldMeta['kind'][] {
  if (info.nullable && !info.hasDefault) {
    return cls === 'enum' ? ['unknownChoice'] : cls === 'boolean' ? ['unknownFlag'] : cls === 'array' ? ['unknownList'] : cls === 'object' ? ['preserved'] : ['unknown'];
  }
  if (cls === 'enum') return info.optional && !info.hasDefault ? ['optionalChoice'] : ['choice'];
  return LEAF_KINDS[cls] ?? [];
}

function compareObject(path: string, zObject: Zod, node: KsNode, ctx: Ctx, opts: { ordered?: boolean; zodOnly?: string[]; ksOnly?: string[]; special?: Record<string, (path: string, zKey: Zod, node: KsNode) => void> } = {}) {
  if (node.kind !== 'object') return problem(ctx, `${path}: Zod object, Keystatic ${node.kind}`);
  const shape = zObject._zod.def.shape as Record<string, Zod>;
  const zKeys = Object.keys(shape).filter((key) => !opts.zodOnly?.includes(key));
  const ksKeys = Object.keys(node.fields!).filter((key) => !opts.ksOnly?.includes(key));
  const missing = zKeys.filter((key) => !ksKeys.includes(key));
  const extra = ksKeys.filter((key) => !zKeys.includes(key));
  if (missing.length) problem(ctx, `${path}: no Keystatic field for ${missing.join(', ')}`);
  if (extra.length) problem(ctx, `${path}: Keystatic field(s) ${extra.join(', ')} not in the Zod schema`);
  if (opts.ordered && !missing.length && !extra.length && zKeys.join() !== ksKeys.join()) {
    problem(ctx, `${path}: key order differs from Zod:\n  zod ${zKeys.join(', ')}\n  ks  ${ksKeys.join(', ')}`);
  }
  for (const key of zKeys.filter((k) => ksKeys.includes(k))) {
    const special = opts.special?.[key];
    if (special) special(`${path}.${key}`, shape[key], node.fields![key]);
    else compareKey(`${path}.${key}`, shape[key], node.fields![key], { ...ctx, inArray: false, fixedKey: false });
  }
}

function compareKey(path: string, zKey: Zod, node: KsNode, ctx: Ctx) {
  const meta = metaOf(node);
  if (!meta) return problem(ctx, `${path}: Keystatic field has no FIELD_META (build it with a keystatic/fields.ts helper)`);
  if (meta.kind === 'stub') return problem(ctx, `${path}: block form not built yet (todoBlock)`);
  const info = unwrap(zKey);
  const cls = classify(info.core);
  const isNullable = info.nullable && !info.hasDefault;

  if (cls === 'object' && !isNullable) {
    countCustom(path, info.core);
    if (info.preprocess) {
      if (meta.kind !== 'optionalGroup') return problem(ctx, `${path}: Zod optionalGroup, Keystatic ${meta.kind}`);
      comparePresentIf(path, info, meta.presentIf, ctx);
      return compareObject(path, info.core, node, { ...ctx, inOptionalGroup: true });
    }
    if (meta.kind !== 'group') return problem(ctx, `${path}: Zod object, Keystatic ${meta.kind} (optional objects use optionalGroup)`);
    return compareObject(path, info.core, node, ctx);
  }

  if (cls === 'record') {
    const valueType = info.core._zod.def.valueType;
    if (valueType._zod.def.type === 'unknown') {
      if (meta.kind !== 'preserved' || meta.nullable) return problem(ctx, `${path}: z.record(unknown) must be preserved() (no form)`);
      return probeLeaf(path, zKey, node, meta, [{ '@type': 'Thing' }, ABSENT], ctx);
    }
    if (meta.kind !== 'record' || node.kind !== 'object') return problem(ctx, `${path}: Zod record, Keystatic ${meta.kind}`);
    // Keystatic has no map field: each fixed key's field must fit the record's value schema.
    for (const [key, field] of Object.entries(node.fields!)) compareKey(`${path}.${key}`, valueType, field, { ...ctx, inArray: false, fixedKey: true });
    return;
  }

  if (cls === 'array' && !isNullable) {
    countCustom(path, info.core);
    const element = info.core._zod.def.element;
    const elementInfo = unwrap(element);
    const elementCls = classify(elementInfo.core);
    const bounds = lengthBounds(info.core);
    if (elementCls === 'enum' && !elementInfo.optional && !elementInfo.nullable) {
      if (meta.kind !== 'choices') return problem(ctx, `${path}: Zod array of enum, Keystatic ${meta.kind}`);
      compareOptions(path, enumValues(elementInfo.core), meta.options, node, ctx);
      const options = enumValues(elementInfo.core) as string[];
      return probeLeaf(path, zKey, node, meta, [[], [options[0]], options.slice(0, 2), ['not-an-option'], ABSENT, null], ctx);
    }
    if (elementCls === 'reference') {
      if (meta.kind !== 'refs') return problem(ctx, `${path}: Zod array of references, Keystatic ${meta.kind}`);
      const collection = REFERENCE_COLLECTION.get(elementInfo.core);
      if (meta.collection !== collection) problem(ctx, `${path}: references ${collection}, Keystatic links to ${meta.collection}`);
      if ((meta.min ?? 0) !== bounds.min || (meta.max ?? Infinity) !== bounds.max) {
        problem(ctx, `${path}: Zod length ${bounds.min}–${bounds.max}, Keystatic ${meta.min ?? 0}–${meta.max ?? Infinity}`);
      }
      const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
      return probeLeaf(path, zKey, node, meta, [...lengths(0, bounds.min, bounds.max).map(ids), ABSENT, null], ctx);
    }
    if (meta.kind !== 'list' || node.kind !== 'array') return problem(ctx, `${path}: Zod array, Keystatic ${meta.kind}`);
    if (info.optional && !info.hasDefault) optionalListsSavedEmpty.push(path);
    const { min = 0, max = Infinity } = node.validation?.length ?? {};
    if (min !== bounds.min || max !== bounds.max) problem(ctx, `${path}: Zod length ${bounds.min}–${bounds.max}, Keystatic ${min}–${max}`);
    if ((meta.min ?? 0) !== min || (meta.max ?? Infinity) !== max) problem(ctx, `${path}: FIELD_META length differs from the field's own validation`);
    return compareKey(`${path}[]`, element, node.element!, { ...ctx, inArray: true });
  }

  // Leaves (and nullable arrays and objects).
  leafCount.set(ctx.scope, (leafCount.get(ctx.scope) ?? 0) + 1);
  if (cls === 'other') return problem(ctx, `${path}: Zod construct the parity test does not know (${info.core._zod.def.type})`);
  if (!isNullable) countCustom(path, info.core);
  const kinds = expectedKinds(cls, info);
  if (!kinds.includes(meta.kind)) return problem(ctx, `${path}: Zod ${isNullable ? 'nullable ' : ''}${cls} needs Keystatic ${kinds.join(' or ')}, found ${meta.kind}`);
  if (meta.kind === 'unknown') {
    const innerKinds = expectedKinds(cls, { ...info, nullable: false, optional: false });
    if (!innerKinds.includes(meta.inner.kind)) return problem(ctx, `${path}: unknown() wraps ${meta.inner.kind}; Zod ${cls} needs ${innerKinds.join(' or ')}`);
  }
  if (meta.kind === 'preserved' && meta.nullable !== isNullable) return problem(ctx, `${path}: preserved({ nullable: ${meta.nullable} }) but Zod nullable is ${isNullable}`);
  if (cls === 'image' && ctx.block) imageBlocks.add(ctx.block);

  const leafMeta = meta.kind === 'unknown' ? meta.inner : meta;
  checkLeafDetails(path, info, cls, node, meta, leafMeta, ctx);
  if (cls !== 'image') probeLeaf(path, zKey, node, meta, probesFor(info, cls, leafMeta), ctx);
}

function comparePresentIf(path: string, info: Info, presentIf: readonly string[], ctx: Ctx) {
  const shape = info.core._zod.def.shape as Record<string, Zod>;
  const sample = (key: string): unknown => {
    const inner = unwrap(shape[key]);
    const cls = classify(inner.core);
    if (cls === 'array') return ['x'];
    if (cls === 'boolean') return true;
    if (cls === 'enum' || cls === 'literal') return enumValues(inner.core)[0];
    if (cls === 'object') return { label: 'x' };
    if (cls === 'number' || cls === 'int' || cls === 'intLiterals') return 2;
    return 'x';
  };
  const zodPresentIf = Object.keys(shape).filter((key) => info.preprocess!({ [key]: sample(key) }) !== undefined);
  if ([...zodPresentIf].sort().join() !== [...presentIf].sort().join()) {
    problem(ctx, `${path}: optional group counts as present on ${zodPresentIf.join(', ')} in Zod, on ${presentIf.join(', ')} in Keystatic`);
  }
  if (info.preprocess!({}) !== undefined) problem(ctx, `${path}: Zod does not treat {} as absent`);
}

function compareOptions(path: string, zodOptions: unknown[], metaOptions: readonly string[], node: KsNode, ctx: Ctx) {
  const fieldOptions = (node.options ?? []).map((o) => o.value).filter((v) => !/^__\w+__$/.test(v));
  if (!isDeepStrictEqual([...metaOptions], zodOptions)) problem(ctx, `${path}: options ${metaOptions.join(', ')} ≠ Zod ${zodOptions.join(', ')}`);
  if (!isDeepStrictEqual(fieldOptions, zodOptions)) problem(ctx, `${path}: the select offers ${fieldOptions.join(', ')} ≠ Zod ${zodOptions.join(', ')}`);
}

function checkLeafDetails(path: string, info: Info, cls: Cls, node: KsNode, meta: FieldMeta, leafMeta: FieldMeta, ctx: Ctx) {
  const start = node.defaultValue?.();
  const genericPath = path.replace(/\.\d+/g, '');
  if (meta.kind === 'choice' || meta.kind === 'optionalChoice' || meta.kind === 'unknownChoice') {
    compareOptions(path, enumValues(info.core), meta.options, node, ctx);
  }
  if (meta.kind === 'choice' || meta.kind === 'flag') {
    if (info.hasDefault) {
      if (meta.zodDefault !== info.defaultValue || start !== info.defaultValue) problem(ctx, `${path}: Zod default ${show(info.defaultValue)}, Keystatic starts on ${show(start)}`);
    } else if (meta.initial !== undefined) {
      initials.push(genericPath);
      if (start !== meta.initial) problem(ctx, `${path}: starts on ${show(start)}, not its initial ${show(meta.initial)}`);
    } else if (meta.kind === 'choice' && (!meta.required || start !== '__choose__')) {
      problem(ctx, `${path}: a required choice must start on "Choose…"`);
    } else if (meta.kind === 'flag') {
      problem(ctx, `${path}: a required boolean with no Zod default needs flag({ initial })`);
    }
  }
  if (meta.kind === 'int' || meta.kind === 'num') {
    const expected = info.hasDefault ? info.defaultValue : null;
    if (start !== expected || (meta.zodDefault ?? null) !== expected) problem(ctx, `${path}: Zod default ${show(expected)}, Keystatic starts on ${show(start)}`);
  }
  if (meta.kind === 'ref' || (meta.kind === 'unknown' && leafMeta.kind === 'ref')) {
    const collection = REFERENCE_COLLECTION.get(info.core);
    if ((leafMeta as { collection: string }).collection !== collection) problem(ctx, `${path}: references ${collection}, Keystatic links to ${(leafMeta as { collection: string }).collection}`);
  }
  if (leafMeta.kind === 'text') {
    if (info.hasDefault && start !== '') problem(ctx, `${path}: a Zod default lives in Zod only; the field must start empty`);
    const isMd = info.core === zodMd;
    if (isMd !== leafMeta.md) problem(ctx, isMd ? `${path}: Zod md, Keystatic plain text (use md())` : `${path}: Keystatic md() for a plain Zod string`);
    const source = leafMeta.pattern?.source;
    if (info.core === internalPath && source !== INTERNAL_PATH.source) problem(ctx, `${path}: Zod internalPath, Keystatic pattern ${source ?? 'none'} (use path())`);
    if (source === INTERNAL_PATH.source && info.core !== internalPath) problem(ctx, `${path}: Keystatic path() for a Zod string that is not internalPath`);
    if (cls === 'href' && source !== HREF.source) problem(ctx, `${path}: Zod href, Keystatic pattern ${source ?? 'none'} (use link())`);
    if (cls === 'email' && source !== EMAIL.source) problem(ctx, `${path}: Zod email, Keystatic pattern ${source ?? 'none'} (use email())`);
    const regex = checksOf(info.core).find((c) => c.check === 'string_format' && c.format === 'regex')?.pattern as RegExp | undefined;
    if (regex && regex.source !== source) problem(ctx, `${path}: Zod regex ${regex.source}, Keystatic pattern ${source ?? 'none'}`);
    const zodHasPattern = cls !== 'string' || info.core === internalPath || checksOf(info.core).some((c) => c.check === 'string_format');
    if (source && !zodHasPattern) problem(ctx, `${path}: Keystatic pattern ${source} but the Zod string has none`);
  }
}

function probesFor(info: Info, cls: Cls, leafMeta: FieldMeta): Probe[] {
  const common = [ABSENT, null];
  switch (cls) {
    case 'string':
    case 'email':
    case 'href': {
      const zb = lengthBounds(info.core);
      const kb = leafMeta.kind === 'text' ? leafMeta : { min: undefined, max: undefined };
      return [...STRING_PROBES, ...lengths(zb.min, zb.max, kb.min, kb.max).map((n) => 'x'.repeat(n)), ...common];
    }
    case 'url':
      return [...URL_PROBES, ...common];
    case 'isoDate':
      return [...DATE_PROBES, ...common];
    case 'int':
    case 'intLiterals':
    case 'number':
      return [...NUMBER_PROBES, ...common];
    case 'boolean':
      return [true, false, 'true', ...common];
    case 'enum':
    case 'literal':
      return [...enumValues(info.core), 'not-an-option', '', ...common];
    case 'reference':
      return ['ke', 'jj-thakkar', 'Some Id', '', ...common];
    // Not "yes"/"no": a string cell with those words would be saved as a boolean (the round trip checks none exists).
    case 'boolOrString':
      return [true, false, 'own patients only', 'Add-on', '', ...common];
    case 'array':
      return [['Card'], ['Card', 'Bank transfer'], [], [''], 'Card', ...common];
    case 'object':
      return [{ description: 'd', period: 'p', approvedBy: 'a' }, ...common];
    default:
      return common;
  }
}

function probeLeaf(path: string, zKey: Zod, field: KsNode, meta: FieldMeta, probes: Probe[], ctx: Ctx) {
  const inner = meta.kind === 'unknown' ? meta.inner : meta;
  const looser = inner.kind === 'url' || (inner.kind === 'text' && inner.pattern?.source === EMAIL.source);
  for (const value of probes) {
    if ((ctx.inArray || ctx.fixedKey) && value === ABSENT) continue;
    const zod = zodResult(zKey, value, ctx.inArray);
    const ks = ksResult(field, value);
    const hasEmptyString = value === '' || (Array.isArray(value) && value.includes(''));
    if (ks.ok) {
      const saved = zodResult(zKey, ks.out === undefined ? ABSENT : ks.out, ctx.inArray);
      const blankInGroup = ctx.inOptionalGroup && (ks.out === undefined || ks.out === null);
      if (!saved.ok) {
        if (!blankInGroup && !(looser && !zod.ok)) problem(ctx, `${path}: Keystatic accepts ${show(value)} and saves ${show(ks.out)}, which Zod rejects`);
      } else if (zod.ok && !hasEmptyString && !isDeepStrictEqual(saved.out, zod.out)) {
        problem(ctx, `${path}: ${show(value)} reads as ${show(zod.out)} but Keystatic saves ${show(ks.out)} (${show(saved.out)})`);
      }
    } else if (zod.ok && !hasEmptyString) {
      problem(ctx, `${path}: Zod accepts ${show(value)}, the Keystatic form refuses it (${ks.error})`);
    }
    if (zod.ok && !hasEmptyString && !readerAccepts(field, value)) problem(ctx, `${path}: Zod accepts ${show(value)}, Keystatic's reader refuses it`);
  }
}

/** The slug field: its name is stored under the key (Zod checks it); its slug is the file name (a lowercase id). */
function compareSlug(path: string, zKey: Zod, node: KsNode, glob: '*' | '**', pattern: RegExp, ctx: Ctx) {
  if (metaOf(node)?.kind !== 'slug') return problem(ctx, `${path}: the slugField must be a slug() field`);
  const validates = (value: { name: string; slug: string }) => {
    try {
      node.validate(value, { slugField: { glob, slugs: new Set() } });
      return true;
    } catch {
      return false;
    }
  };
  const zb = lengthBounds(unwrap(zKey).core);
  for (const name of [...STRING_PROBES, ...lengths(zb.min, zb.max).map((n) => 'x'.repeat(n))]) {
    const zod = zodResult(zKey, name, false).ok;
    const ks = validates({ name, slug: 'ok-slug' });
    if (zod !== ks && name !== '') problem(ctx, `${path}: name ${show(name)}: Zod ${zod ? 'accepts' : 'rejects'}, Keystatic ${ks ? 'accepts' : 'rejects'}`);
  }
  for (const slug of SLUG_PROBES) {
    const expected = pattern.test(slug);
    if (validates({ name: 'A name', slug }) !== expected) problem(ctx, `${path}: file name ${show(slug)} should be ${expected ? 'allowed' : 'refused'} (${pattern.source})`);
  }
}

function compareSections(path: string, zKey: Zod, node: KsNode, family: keyof typeof FAMILY_BLOCKS, ctx: Ctx) {
  const meta = metaOf(node);
  if (meta?.kind !== 'sections') return problem(ctx, `${path}: sections must use sections() (keystatic/fields.ts)`);
  const element = unwrap(zKey).core._zod.def.element;
  const def = element._zod.def;
  const options: Zod[] = def.type === 'union' ? def.options : def.type === 'never' ? [] : [element];
  const zodNames = options.map((o) => o._zod.def.shape.discriminant._zod.def.values[0]);
  const lists = {
    'Zod sections': zodNames,
    'FAMILY_BLOCKS': [...FAMILY_BLOCKS[family]],
    'sections() metadata': [...meta.blocks],
    'Keystatic blocks': Object.keys(node.element?.values ?? {}),
    'Keystatic block picker': (node.element?.discriminant?.options ?? []).map((o: { value: string }) => o.value),
  };
  for (const [name, list] of Object.entries(lists)) {
    if (list.join() !== zodNames.join()) problem(ctx, `${path}: ${name} offers ${list.join(', ')}; Zod allows ${zodNames.join(', ')}`);
  }
  for (const name of zodNames) {
    if (node.element?.values?.[name] !== KS_BLOCKS[name as keyof typeof KS_BLOCKS]?.schema) problem(ctx, `${path}: block ${name} is not KS_BLOCKS.${name}`);
  }
}

/* ---------- Run the walk (synchronously, before the tests read the results) ---------- */

const blockScope = (name: string) => `block ${name}`;
for (const name of BLOCK_NAMES) {
  const ctx: Ctx = { scope: blockScope(name), inArray: false, inOptionalGroup: false, block: name };
  const zBlock = (BLOCK_SCHEMAS[name] as (c: unknown) => Zod)(zodContext);
  countCustom(`blocks.${name}`, zBlock);
  const shape = zBlock._zod.def.shape;
  if (shape.discriminant._zod.def.values[0] !== name) problem(ctx, `Zod discriminant is ${shape.discriminant._zod.def.values[0]}`);
  const ks = KS_BLOCKS[name];
  const meta = metaOf(ks.schema);
  if (meta?.kind === 'stub') problem(ctx, 'form not built yet (todoBlock)');
  else if (meta?.kind !== 'group' || meta.block !== name) problem(ctx, `schema must come from defineBlock('${name}', …)`);
  else compareObject(name, shape.value, ks.schema as KsNode, ctx, { ordered: true });
}

for (const [key, family] of Object.entries(COLLECTION_FAMILY)) {
  const ctx: Ctx = { scope: `collection ${key}`, inArray: false, inOptionalGroup: false };
  const collection = collections[key];
  const zPage = (families as Record<string, (c: unknown) => Zod>)[`${family}Schema`](zodContext);
  countCustom('page', zPage);
  const mdx = collection.format.contentField === 'body';
  const glob = collection.path.endsWith('/**') ? '**' : '*';
  compareObject(key, zPage, rootNode(collection.schema), ctx, {
    zodOnly: ['family'],
    ksOnly: mdx ? ['body'] : [],
    special: {
      sections: (path, zKey, node) => compareSections(path, zKey, node, family, ctx),
      [collection.slugField]: (path, zKey, node) => compareSlug(path, zKey, node, glob, glob === '**' ? LEGAL_SLUG : SLUG_ID, ctx),
    },
  });
  const body = collection.schema.body;
  if (mdx && (metaOf(body)?.kind !== 'mdx' || body.formKind !== 'content')) problem(ctx, 'an MDX collection stores its body with mdxBody()');
}

for (const [key, exportName] of Object.entries(DATA_SCHEMA_EXPORT)) {
  const ctx: Ctx = { scope: `${key in singletons ? 'singleton' : 'collection'} ${key}`, inArray: false, inOptionalGroup: false };
  const zSchema = (dataSchemas as Record<string, Zod>)[exportName];
  countCustom(key, zSchema);
  const collection = collections[key];
  const schema = collection?.schema ?? singletons[key]?.schema;
  compareObject(key, zSchema, rootNode(schema), ctx, {
    special: collection ? { [collection.slugField]: (path, zKey, node) => compareSlug(path, zKey, node, '*', SLUG_ID, ctx) } : {},
  });
}

/* ---------- Tests ---------- */

describe('Keystatic parity: blocks', () => {
  it('KS_BLOCKS, the Zod registry (sections.ts) and family-blocks.ts list the same blocks in the same order', () => {
    expect(Object.keys(KS_BLOCKS)).toEqual([...BLOCK_NAMES]);
    expect([...LISTED_BLOCK_NAMES]).toEqual([...BLOCK_NAMES]);
  });

  for (const name of BLOCK_NAMES) {
    it(`${name}: same keys in the same order, compatible kinds, same options, lengths and defaults`, () => {
      expect(problems.get(blockScope(name)) ?? []).toEqual([]);
      expect(leafCount.get(blockScope(name)) ?? 0).toBeGreaterThan(0);
    });
  }

  it('blocks with media are not offered to the MDX families (guide, post, legal)', () => {
    expect(imageBlocks.size).toBeGreaterThan(0);
    for (const family of ['guide', 'post', 'legal'] as const) {
      expect(FAMILY_BLOCKS[family].filter((name) => imageBlocks.has(name)), family).toEqual([]);
    }
  });
});

describe('Keystatic parity: collections and singletons', () => {
  it('every Keystatic collection and singleton is compared', () => {
    const compared = [...Object.keys(COLLECTION_FAMILY), ...Object.keys(DATA_SCHEMA_EXPORT)].sort();
    expect([...Object.keys(collections), ...Object.keys(singletons)].sort()).toEqual(compared);
  });

  for (const key of Object.keys(COLLECTION_FAMILY)) {
    it(`page collection ${key} (${COLLECTION_FAMILY[key]}): page base, family fields and allowed blocks`, () => {
      expect(problems.get(`collection ${key}`) ?? []).toEqual([]);
    });
  }

  for (const key of Object.keys(DATA_SCHEMA_EXPORT)) {
    const scope = `${key in singletons ? 'singleton' : 'collection'} ${key}`;
    it(`${scope}`, () => {
      expect(problems.get(scope) ?? []).toEqual([]);
    });
  }
});

describe('Keystatic parity: what only one side can say', () => {
  it('every Zod cross-field rule is acknowledged in ZOD_ONLY', () => {
    expect(Object.fromEntries(customChecks)).toEqual(Object.fromEntries(Object.entries(ZOD_ONLY).map(([key, { count }]) => [key, count])));
  });

  it('an optional list with no Zod default (saved as []) is acknowledged in OPTIONAL_LISTS_SAVED_EMPTY', () => {
    expect([...new Set(optionalListsSavedEmpty)].sort()).toEqual(Object.keys(OPTIONAL_LISTS_SAVED_EMPTY).sort());
  });

  it('only the agreed fields start on a value that Zod does not default to', () => {
    expect([...new Set(initials)].sort()).toEqual(INITIAL_VALUES);
  });
});
