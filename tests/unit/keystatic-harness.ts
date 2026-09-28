/**
 * Shared by the Keystatic tests (docs/keystatic-design.md section 7): the Zod schema context, the mapping from
 * Keystatic collections to Zod schemas, known data problems waiting for a src/content edit, and a copy of the
 * @keystatic/core 0.6.9 editor pipeline (parse, validate, serialize) for the simulated save.
 *
 * Not a test file (vitest only runs *.test.ts). It must not import anything that imports `astro:content`: the
 * test files mock that module with `astroContentMock()` below, and the mock factory imports this file.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { Lexer } from 'yaml';
import { FIELD_META, type FieldMeta } from '../../keystatic/fields.ts';
import type { PageFamily } from '../../src/schemas/family-blocks.ts';

export const ROOT = process.cwd();

/* ---------- Zod side ---------- */

/** Zod `reference(collection)` schemas, so the parity test can see which collection each one points at. */
export const REFERENCE_COLLECTION = new WeakMap<object, string>();
/** Schemas made by the stub SchemaContext's `image()`. */
export const IMAGE_SCHEMAS = new WeakSet<object>();

/**
 * `vi.mock('astro:content', async () => (await import('./keystatic-harness.ts')).astroContentMock())`.
 * `reference(c)` is Astro's own `createReference()(c)`, unchanged except that the collection is recorded.
 */
export async function astroContentMock() {
  const { createReference } = await import('astro/content/runtime');
  const make = createReference();
  return {
    reference(collection: string) {
      const schema = make(collection);
      REFERENCE_COLLECTION.set(schema, collection);
      return schema;
    },
  };
}

/** The SchemaContext the collection schemas receive; `image()` is a plain string (the stored path). */
export const zodContext = {
  image: () => {
    const schema = z.string();
    IMAGE_SCHEMAS.add(schema);
    return schema;
  },
} as never;

/** Page collection → page family, as src/content.config.ts assigns the schemas. */
export const COLLECTION_FAMILY: Record<string, PageFamily> = {
  home: 'home',
  pricing: 'pricing',
  countryPages: 'country',
  countryDemos: 'countryDemo',
  company: 'company',
  kitchenSink: 'kitchenSink',
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

/** Data collection or singleton → its export in src/schemas/data.ts. */
export const DATA_SCHEMA_EXPORT: Record<string, string> = {
  prices: 'priceSchema',
  countries: 'countrySchema',
  regulators: 'regulatorSchema',
  testimonials: 'testimonialSchema',
  authors: 'authorSchema',
  clients: 'clientSchema',
  integrations: 'integrationSchema',
  site: 'siteSchema',
  facts: 'factsSchema',
  study: 'studySchema',
  plans: 'planSchema',
  nav: 'navSchema',
};

/**
 * A data schema export as the collection receives it: schemas with an `image()` field are functions of the schema
 * context (src/content.config.ts passes them to `defineCollection`), so they are called with the stub context.
 */
export function resolveDataSchema<T>(exported: T | ((ctx: never) => T)): T {
  return typeof exported === 'function' ? (exported as (ctx: never) => T)(zodContext) : exported;
}

/* ---------- Keystatic side ---------- */

/** The @keystatic/core version the simulated editor pipeline below was copied from. */
export const KEYSTATIC_CORE_VERIFIED = '0.6.9';

export function installedKeystaticCore(): string {
  return JSON.parse(readFileSync(join(ROOT, 'node_modules/@keystatic/core/package.json'), 'utf8')).version;
}

/** A Keystatic schema node (form field, object, array or conditional), loosely typed for walking. */
export type KsNode = {
  kind: 'form' | 'object' | 'array' | 'conditional' | 'child';
  formKind?: 'slug' | 'asset' | 'content' | 'assets';
  fields?: Record<string, KsNode>;
  element?: KsNode;
  discriminant?: KsNode;
  values?: Record<string, KsNode>;
  validation?: { length?: { min?: number; max?: number } };
  options?: { label: string; value: string }[];
  directory?: string;
  label?: string;
  [key: string]: any;
};

export const metaOf = (node: object): FieldMeta | undefined => FIELD_META.get(node);

/** Fields whose empty value is written as an explicit `null` (Zod `unknown()` / `.nullable()` keys). */
export function writesNull(node: object): boolean {
  const meta = metaOf(node);
  if (!meta) return false;
  return ['unknown', 'unknownChoice', 'unknownFlag', 'unknownList'].includes(meta.kind) || (meta.kind === 'preserved' && meta.nullable);
}

/** An object node for a collection or singleton schema (Keystatic wraps it the same way). */
export const rootNode = (schema: Record<string, KsNode>): KsNode => ({ kind: 'object', fields: schema });

export type EntryInfo = {
  /** Collection or singleton key. */
  key: string;
  /** Entry slug; undefined for singletons. */
  slug?: string;
  /** Repo-relative path of the data file. */
  file: string;
  /** Slug field key (collections) and the slug glob. */
  slugField?: string;
  glob?: '*' | '**';
};

/** The data file Keystatic reads for an entry: `<dir>/<slug>.yaml`, `<dir>/<slug>/index.mdx` or `<dir>/<slug>.mdx`. */
export function entryFile(ksPath: string, slug?: string): string {
  if (slug === undefined) return `${ksPath}.yaml`;
  if (ksPath.endsWith('/*/')) return `${ksPath.slice(0, -3)}/${slug}/index.mdx`;
  if (ksPath.endsWith('/**')) return `${ksPath.slice(0, -3)}/${slug}.mdx`;
  return `${ksPath.slice(0, -2)}/${slug}.yaml`;
}

/** Keystatic's frontmatter split (0.6.9 `splitFrontmatter`). */
export function splitFrontmatter(source: string): { frontmatter: string; body: string } | null {
  const match = source.match(/^---(?:\r?\n([^]*?))?\r?\n---\r?\n?/);
  return match ? { frontmatter: match[1] ?? '', body: source.slice(match[0].length) } : null;
}

/**
 * Optional lists with no Zod default: Keystatic always writes a list, so an absent one is saved as `[]` and the build
 * then sees `[]` instead of undefined. Accepted only where every reader of the value treats the two the same
 * (docs/keystatic-design.md 2.5). Paths are `<collection>.<key>` with `[]` for list items.
 */
export const OPTIONAL_LISTS_SAVED_EMPTY: Record<string, string> = {
  'nav.primary[].groups': 'Header.astro reads `groups ?? []` and checks its length',
};

/**
 * YAML comment lines in a Keystatic-managed file (for MDX, in its frontmatter; the body is not YAML). Any Keystatic
 * save rebuilds the YAML from the form and deletes them (docs/keystatic-design.md 5). Counted with the `yaml` lexer,
 * not a line regex: a line starting with `#` inside a block scalar (`country-demos/nigeriademo.yaml`, `notes`) is
 * content, and a regex would count it.
 */
export function yamlCommentLines(source: string, mdx: boolean): number {
  const yaml = mdx ? (splitFrontmatter(source)?.frontmatter ?? '') : source;
  return [...new Lexer().lex(yaml)].filter((token) => token.startsWith('#')).length;
}

/* ---------- Known data problems and work in progress ---------- */

export type PendingDataFix = {
  /** Repo-relative file. */
  file: string;
  collection: string;
  slug: string;
  /** Text that is in the file until the fix lands. */
  find: string;
  /** The fix. */
  replace: string;
  /** The issue Keystatic's reader reports while the text is there. */
  issue: string;
};

/**
 * Data problems that need a src/content edit, which this test run may not make (docs/keystatic-design.md 2.3,
 * Track 0). While `find` is still in the file, the reader must fail with exactly `issue`, and the rest of the round
 * trip runs on a copy with the fix applied. Once the fix lands, the tests fail until the entry is deleted here, so
 * this list cannot go stale. Empty since the three unquoted `kitchen-sink.yaml` values were quoted (26 September 2026).
 */
export const PENDING_DATA_FIXES: PendingDataFix[] = [];

export const pendingFixesFor = (collection: string, slug: string | undefined) =>
  PENDING_DATA_FIXES.filter((fix) => fix.collection === collection && fix.slug === slug);

/** The file's text with every pending fix for it applied. */
export function withPendingFixes(file: string, source: string): string {
  return PENDING_DATA_FIXES.filter((fix) => fix.file === file).reduce((text, fix) => text.replace(fix.find, fix.replace), source);
}

/**
 * Post slugs with uncommitted changes (another workflow may be rewriting them while the tests run). Draft posts in
 * this set are read, but a failure is counted and skipped rather than failed. A clean checkout (CI) has none, so
 * nothing is skipped there. Without git, nothing is skipped either.
 */
export function uncommittedPosts(): Set<string> {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '-uall', '--', 'src/content/posts'], { cwd: ROOT, encoding: 'utf8' });
    return new Set(
      out
        .split('\n')
        .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''))
        .map((path) => path.split(' -> ').pop() ?? '')
        .filter((path) => path.startsWith('src/content/posts/'))
        .map((path) => path.split('/')[3])
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

/** `status` from a post's frontmatter, or undefined when it cannot be read (a half-written file). */
export function postStatus(slug: string): string | undefined {
  const file = join(ROOT, 'src/content/posts', slug, 'index.mdx');
  if (!existsSync(file)) return undefined;
  return splitFrontmatter(readFileSync(file, 'utf8'))?.frontmatter.match(/^status:\s*['"]?([a-z]+)/m)?.[1];
}

/* ---------- Errors ---------- */

/** Flattens Keystatic's nested AggregateError / PropValidationError into `path: message` lines. */
export function describeError(error: unknown): string[] {
  if (error instanceof AggregateError) return error.errors.flatMap(describeError);
  const e = error as { message?: string; path?: unknown[]; cause?: unknown };
  if (e.path && e.cause) return describeError(e.cause).map((line) => `${e.path!.join('.')}: ${line}`);
  return (e.message ?? String(error)).split('\n');
}

class PathError extends Error {
  constructor(
    readonly path: (string | number)[],
    readonly cause: unknown,
  ) {
    super(`field error at ${path.join('.')}`);
  }
}

/* ---------- The editor pipeline (copied from @keystatic/core 0.6.9) ---------- */

/**
 * Stands in for an MDX body in the frontmatter round trip. The Node build of @keystatic/core has no body parser (an
 * empty stub), so bodies are round-tripped separately, with the browser build's own field, in keystatic-mdx-bodies.test.ts.
 */
export const CONTENT = Symbol('content field');

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

/** A new, untouched value (0.6.9 `getInitialPropsValue`). */
export function initialState(node: KsNode): unknown {
  switch (node.kind) {
    case 'form':
      return node.defaultValue();
    case 'child':
      return null;
    case 'conditional': {
      const discriminant = node.discriminant!.defaultValue();
      return { discriminant, value: initialState(node.values![String(discriminant)]) };
    }
    case 'object':
      return Object.fromEntries(Object.entries(node.fields!).map(([key, child]) => [key, initialState(child)]));
    case 'array':
      return [];
  }
}

/**
 * The editor's read of a stored entry (0.6.9 `parseEntry` → `parseProps` with `validateArrayFieldLength` false): every
 * form field's own `parse`, objects reject unknown keys, a stored `null` reaches fields as `undefined`. Images are
 * looked up where Keystatic looks (`<directory>/<slug>/<src minus prefix>`), so a `src` outside that convention
 * comes back empty, as it would in the admin.
 */
export function editorParse(node: KsNode, stored: unknown, entry: EntryInfo, path: (string | number)[] = []): unknown {
  const value = stored === null ? undefined : stored;
  switch (node.kind) {
    case 'form': {
      try {
        if (path.length === 1 && path[0] === entry.slugField) return node.parse(value, { slug: entry.slug });
        if (node.formKind === 'asset') {
          const filename = node.filename(value, { slug: entry.slug });
          const assetPath = filename ? join(ROOT, node.directory ?? '', entry.slug ?? '', filename) : undefined;
          const asset = assetPath && existsSync(assetPath) ? readFileSync(assetPath) : undefined;
          return node.parse(value, { asset, slug: entry.slug });
        }
        if (node.formKind === 'content' || node.formKind === 'assets') return CONTENT;
        return node.parse(value, undefined);
      } catch (error) {
        throw new PathError(path, error);
      }
    }
    case 'child':
      return null;
    case 'conditional': {
      if (value === undefined) return initialState(node);
      if (!isObject(value)) throw new PathError(path, new Error('Must be an object'));
      const extra = Object.keys(value).filter((key) => key !== 'discriminant' && key !== 'value');
      if (extra.length) throw new PathError(path, new Error(`Must only contain keys "discriminant" and "value", not "${extra[0]}"`));
      const discriminant = editorParse(node.discriminant!, value.discriminant, entry, [...path, 'discriminant']) as string;
      return { discriminant, value: editorParse(node.values![discriminant], value.value, entry, [...path, 'value']) };
    }
    case 'object': {
      const object = value ?? {};
      if (!isObject(object)) throw new PathError(path, new Error('Must be an object'));
      const allowed = new Set(Object.keys(node.fields!));
      const stray = Object.keys(object).find((key) => !allowed.has(key));
      if (stray !== undefined) throw new PathError(path, new Error(`Key on object value "${stray}" is not allowed`));
      const out: Record<string, unknown> = {};
      const errors: unknown[] = [];
      for (const [key, child] of Object.entries(node.fields!)) {
        try {
          out[key] = editorParse(child, object[key], entry, [...path, key]);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors);
      return out;
    }
    case 'array': {
      if (value === undefined) return [];
      if (!Array.isArray(value)) throw new PathError(path, new Error('Must be an array'));
      const errors: unknown[] = [];
      const out = value.map((item, i) => {
        try {
          return editorParse(node.element!, item, entry, [...path, i]);
        } catch (error) {
          errors.push(error);
          return undefined;
        }
      });
      if (errors.length) throw new AggregateError(errors);
      return out;
    }
  }
}

/** The editor's check before it saves (0.6.9 `validateValueWithSchema`): every form field's `validate`, list lengths. */
export function editorValidate(node: KsNode, state: any, entry: EntryInfo, path: (string | number)[] = []): string[] {
  switch (node.kind) {
    case 'form': {
      if (state === CONTENT) return [];
      try {
        if (path.length === 1 && path[0] === entry.slugField) node.validate(state, { slugField: { slugs: new Set(), glob: entry.glob ?? '*' } });
        else node.validate(state, undefined);
        return [];
      } catch (error) {
        return describeError(error).map((line) => `${path.join('.')}: ${line}`);
      }
    }
    case 'child':
      return [];
    case 'conditional':
      return editorValidate(node.values![state.discriminant], state.value, entry, [...path, 'value']);
    case 'object':
      return Object.entries(node.fields!).flatMap(([key, child]) => editorValidate(child, state[key], entry, [...path, key]));
    case 'array': {
      const { min, max } = node.validation?.length ?? {};
      const issues: string[] = [];
      if (min !== undefined && state.length < min) issues.push(`${path.join('.')}: Must have at least ${min} elements`);
      if (max !== undefined && state.length > max) issues.push(`${path.join('.')}: Must have at most ${max} elements`);
      return [...issues, ...state.flatMap((item: unknown, i: number) => editorValidate(node.element!, item, entry, [...path, i]))];
    }
  }
}

/**
 * The editor's save (0.6.9 `serializeProps` visitors): each form field's own `serialize`; objects drop `undefined`
 * values; arrays write `undefined` as `null`; a block without a value keeps only its discriminant. An MDX body is left
 * out here (keystatic-mdx-bodies.test.ts saves bodies).
 */
export function editorSerialize(node: KsNode, state: any, entry: EntryInfo, path: (string | number)[] = []): unknown {
  switch (node.kind) {
    case 'form': {
      if (state === CONTENT) return undefined;
      if (path.length === 1 && path[0] === entry.slugField) return node.serializeWithSlug(state).value;
      if (node.formKind === 'asset') return node.serialize(state, { suggestedFilenamePrefix: path.join('/'), slug: entry.slug }).value;
      return node.serialize(state, undefined).value;
    }
    case 'child':
      return undefined;
    case 'conditional': {
      const value = editorSerialize(node.values![state.discriminant], state.value, entry, [...path, 'value']);
      return value === undefined ? { discriminant: state.discriminant } : { discriminant: state.discriminant, value };
    }
    case 'object':
      return Object.fromEntries(
        Object.entries(node.fields!)
          .map(([key, child]) => [key, editorSerialize(child, state[key], entry, [...path, key])] as const)
          .filter(([, value]) => value !== undefined),
      );
    case 'array':
      return state.map((item: unknown, i: number) => {
        const value = editorSerialize(node.element!, item, entry, [...path, i]);
        return value === undefined ? null : value;
      });
  }
}

/**
 * Reader output → the shape the site's Zod schemas read (docs/keystatic-design.md 7.2): object keys whose value is
 * '' are dropped, `null` is dropped unless the field writes null on purpose (unknown*, preserved), the MDX body is
 * removed, and dates stay YYYY-MM-DD strings (Zod coerces them).
 */
export function normaliseReaderOutput(node: KsNode, value: any): unknown {
  switch (node.kind) {
    case 'form':
      return node.formKind === 'content' ? undefined : value;
    case 'child':
      return undefined;
    case 'conditional':
      return { discriminant: value.discriminant, value: normaliseReaderOutput(node.values![value.discriminant], value.value) };
    case 'array':
      return (value as unknown[]).map((item) => normaliseReaderOutput(node.element!, item));
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.fields!)) {
        const item = normaliseReaderOutput(child, value?.[key]);
        if (item === undefined || item === '') continue;
        if (item === null && !writesNull(child)) continue;
        out[key] = item;
      }
      return out;
    }
  }
}

/** Every value in `data` at a field whose metadata passes `test`, with its path (arrays and blocks followed). */
export function valuesAt(node: KsNode, data: unknown, test: (node: KsNode) => boolean, path: (string | number)[] = []): { path: string; value: unknown }[] {
  const here = test(node) ? [{ path: path.join('.'), value: data }] : [];
  if (data === undefined || data === null) return here;
  switch (node.kind) {
    case 'object':
      return [...here, ...Object.entries(node.fields!).flatMap(([key, child]) => (isObject(data) ? valuesAt(child, data[key], test, [...path, key]) : []))];
    case 'array':
      return [...here, ...(Array.isArray(data) ? data.flatMap((item, i) => valuesAt(node.element!, item, test, [...path, i])) : [])];
    case 'conditional': {
      const block = isObject(data) ? node.values![data.discriminant as string] : undefined;
      return block && isObject(data) ? [...here, ...valuesAt(block, data.value, test, [...path, 'value'])] : here;
    }
    default:
      return here;
  }
}

/** The value at a dotted path (`sections.3.value.steps.0.body`). */
export function getPath(data: unknown, path: string): unknown {
  return path === '' ? data : path.split('.').reduce<any>((value, key) => (value === undefined || value === null ? undefined : value[key]), data);
}
