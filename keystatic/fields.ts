/**
 * Keystatic field helpers: the only file under keystatic/ that calls `fields.*` (docs/keystatic-design.md 2.2).
 *
 * Every helper returns an ordinary Keystatic field and records what it stands for in FIELD_META, which the
 * parity test (tests/unit/keystatic-parity.test.ts) compares with the Zod schemas. The Zod schemas stay the only
 * authority on what is valid; these fields are a form over the same files, in the same shape.
 *
 * This module is bundled into the browser (the admin is a client-only React page), so it imports only pure
 * modules: src/schemas/{constants,patterns,groups,family-blocks}.ts. Never import astro:content, astro/zod or the
 * rules engine from here.
 *
 * Checked against @keystatic/core 0.6.9. The unknown* and preserved wrappers depend on its internals (it turns a
 * stored `null` into `undefined` before a field parses it, and keeps a `null` a field serialises), so keep the
 * package pinned and re-run tests/unit/keystatic-fields.test.ts on every upgrade.
 */
import { fields } from '@keystatic/core';
import type { BasicFormField, ComponentSchema, FormFieldStoredValue, SlugFormField } from '@keystatic/core';
import { wrapper } from '@keystatic/core/content-components';
import { MEDIA_FRAMES, MEDIA_KINDS, MEDIA_ORIGINS, TONES } from '../src/schemas/constants.ts';
import { CTA_PRESENT_IF, MEDIA_PRESENT_IF } from '../src/schemas/groups.ts';
import { EMAIL, HREF, INTERNAL_PATH, SLUG_ID, YEAR_MONTH } from '../src/schemas/patterns.ts';

/* ---------- Metadata for the parity test ---------- */

export type FieldMeta =
  | { kind: 'text'; required: boolean; min: number; max?: number; pattern?: RegExp; multiline: boolean; md: boolean }
  | { kind: 'url' | 'date'; required: boolean }
  | { kind: 'int' | 'num'; required: boolean; min?: number; max?: number; zodDefault?: number }
  | { kind: 'flag'; zodDefault?: boolean; initial?: boolean }
  | { kind: 'choice'; options: readonly string[]; zodDefault?: string; initial?: string; required: boolean }
  | { kind: 'optionalChoice' | 'choices' | 'unknownChoice'; options: readonly string[] }
  | { kind: 'ref'; collection: string; required: boolean }
  | { kind: 'refs'; collection: string; min?: number; max?: number }
  | { kind: 'list'; min?: number; max?: number }
  | { kind: 'group'; block?: string }
  | { kind: 'optionalGroup'; presentIf: readonly string[] }
  | { kind: 'record'; keys: readonly string[] }
  | { kind: 'unknown'; inner: FieldMeta }
  | { kind: 'unknownFlag' | 'unknownList' | 'boolOrText' | 'image' | 'slug' }
  | { kind: 'imagePath'; directory: string; publicPath: string; pattern: RegExp }
  /** The exact config passed to `fields.mdx`: the body audit (tests/unit/keystatic-mdx-bodies.test.ts) builds the editor's own field from it. */
  | { kind: 'mdx'; config: Parameters<typeof fields.mdx>[0] }
  | { kind: 'preserved'; nullable: boolean }
  | { kind: 'sections'; blocks: readonly string[] }
  | { kind: 'stub'; block: string };

/** What each helper-built field stands for, keyed by the field object. Nothing is added to Keystatic's objects. */
export const FIELD_META = new WeakMap<object, FieldMeta>();

function tag<T extends object>(field: T, meta: FieldMeta): T {
  FIELD_META.set(field, meta);
  return field;
}

/** Keystatic's `FieldDataError` is not exported; any error thrown from a field marks the value invalid. */
class FieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldDataError';
  }
}

/** `in-certification` → "In certification", `notFor` → "Not for". */
export function humanize(value: string): string {
  if (/^[A-Z0-9]+$/.test(value)) return value;
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function optionsFor(values: readonly string[], labels?: Readonly<Record<string, string>>) {
  return values.map((value) => ({ label: labels?.[value] ?? humanize(value), value }));
}

/* ---------- Text ---------- */

export type TextOptions = {
  /**
   * Required whenever the Zod key is required and has no default, even if Zod allows '' (a plain `z.string()`):
   * Keystatic omits an empty text on save, and a missing required key fails the build. Inside an optionalGroup,
   * leave fields optional so an unused group can still be saved empty; Zod checks completeness.
   */
  required?: boolean;
  min?: number;
  max?: number;
  /** Must be anchored at the start (`^…`), as every pattern in src/schemas/patterns.ts is. */
  pattern?: RegExp;
  patternMessage?: string;
  description?: string;
  multiline?: boolean;
};

/**
 * Keystatic checks length and pattern against an empty value too, so an optional field with a pattern or a
 * minimum length could never be left empty. For optional fields the check becomes "empty, or matches".
 */
function textValidation(label: string, { required = false, min = 0, max, pattern, patternMessage }: TextOptions) {
  if (required) {
    return {
      isRequired: true,
      length: { min: Math.max(1, min), max },
      pattern: pattern ? { regex: pattern, message: patternMessage ?? `${label}: ${pattern.source}` } : undefined,
    };
  }
  if (!pattern && min <= 1) return { length: { max } };
  const lengthCheck = min > 1 ? `(?=[\\s\\S]{${min},}$)` : '';
  const inner = pattern ? `^${lengthCheck}(?:${pattern.source})` : `^${lengthCheck}[\\s\\S]*$`;
  const message = patternMessage ?? (pattern ? `${label}: ${pattern.source}` : `${label} must be at least ${min} characters, or empty`);
  return { length: { max }, pattern: { regex: new RegExp(`^$|${inner}`, pattern?.flags), message } };
}

export function text(label: string, options: TextOptions = {}) {
  const { required = false, min = 0, max, pattern, description, multiline = false } = options;
  const field = fields.text({ label, description, multiline, validation: textValidation(label, options) });
  return tag(field, { kind: 'text', required, min, max, pattern, multiline, md: false });
}

const MD_HELP = 'Markdown: **bold**, _italic_, [link](/path/). Tokens: {price:inr.professional.annual}, {fact:doctors}, {fig:visits}, {contact:ke.phone}. Unknown facts: [in square brackets].';

/** Markdown string (Zod `md`): kept as plain text, never Keystatic's markdoc or mdx.inline, which store a different format. */
export function md(label: string, { required = false, description }: { required?: boolean; description?: string } = {}) {
  const field = fields.text({
    label,
    description: description ? `${description} ${MD_HELP}` : MD_HELP,
    multiline: true,
    validation: required ? { isRequired: true, length: { min: 1 } } : undefined,
  });
  return tag(field, { kind: 'text', required, min: required ? 1 : 0, multiline: true, md: true });
}

/** Site-internal path: lowercase, leading and trailing slash (`/features/emr/`), optional #anchor. */
export function path(label: string, options: Omit<TextOptions, 'pattern' | 'patternMessage'> = {}) {
  return text(label, { ...options, pattern: INTERNAL_PATH, patternMessage: 'Use a site path with a trailing slash, e.g. /features/emr/' });
}

/** Internal path, https:// URL, tel: or mailto:. */
export function link(label: string, options: Omit<TextOptions, 'pattern' | 'patternMessage'> = {}) {
  return text(label, { ...options, pattern: HREF, patternMessage: 'Use a site path (/pricing/), an https:// URL, tel: or mailto:' });
}

export function email(label: string, options: Omit<TextOptions, 'pattern' | 'patternMessage'> = {}) {
  return text(label, { ...options, pattern: EMAIL, patternMessage: 'Use an email address' });
}

export function url(label: string, { required = false, description }: { required?: boolean; description?: string } = {}) {
  return tag(fields.url({ label, description, validation: { isRequired: required } }), { kind: 'url', required });
}

/** A date without a time (YYYY-MM-DD), as the Zod `isoDate` requires. */
export function date(label: string, { required = false, description }: { required?: boolean; description?: string } = {}) {
  return tag(fields.date({ label, description, validation: { isRequired: required } }), { kind: 'date', required });
}

type NumberOptions = { required?: boolean; min?: number; max?: number; zodDefault?: number; description?: string };

export function int(label: string, { required = false, min, max, zodDefault, description }: NumberOptions = {}) {
  const field = fields.integer({ label, description, defaultValue: zodDefault, validation: { isRequired: required, min, max } });
  return tag(field, { kind: 'int', required, min, max, zodDefault });
}

export function num(label: string, { required = false, min, max, zodDefault, description }: NumberOptions = {}) {
  const field = fields.number({ label, description, defaultValue: zodDefault, validation: { isRequired: required, min, max } });
  return tag(field, { kind: 'num', required, min, max, zodDefault });
}

/**
 * A boolean, always written. `zodDefault` for `z.boolean().default(x)`; `initial` for a required `z.boolean()`
 * with no default (the checkbox still has to start somewhere).
 */
export function flag(label: string, mode: ({ zodDefault: boolean } | { initial: boolean }) & { description?: string }) {
  const start = 'zodDefault' in mode ? mode.zodDefault : mode.initial;
  const meta: FieldMeta = 'zodDefault' in mode ? { kind: 'flag', zodDefault: mode.zodDefault } : { kind: 'flag', initial: mode.initial };
  return tag(fields.checkbox({ label, description: mode.description, defaultValue: start }), meta);
}

/* ---------- Choices ---------- */

const CHOOSE = '__choose__';
const DEFAULT = '__default__';
const UNKNOWN = '__unknown__';

type ChoiceMode<V extends string> = { zodDefault: V } | { required: true } | { initial: V };
type ChoiceExtras = { description?: string; labels?: Readonly<Record<string, string>> };

/**
 * One of a fixed list (Zod `z.enum`). With `zodDefault` the select starts on the Zod default. With `required` it
 * starts on "Choose…", which cannot be saved, so nothing is picked silently. `initial` is for a required enum
 * whose new entries should start on a value (only `status`, which starts as `draft`).
 */
export function choice<const O extends readonly string[]>(label: string, values: O, mode: ChoiceMode<O[number]>, extras: ChoiceExtras = {}) {
  const options = optionsFor(values, extras.labels);
  if (!('required' in mode)) {
    const initial = 'zodDefault' in mode ? mode.zodDefault : mode.initial;
    const field = fields.select({ label, description: extras.description, options, defaultValue: initial });
    return tag(field, { kind: 'choice', options: values, required: 'initial' in mode, ...('zodDefault' in mode ? { zodDefault: mode.zodDefault } : { initial: mode.initial }) });
  }
  const base = fields.select({ label, description: extras.description, options: [{ label: 'Choose…', value: CHOOSE }, ...options], defaultValue: CHOOSE });
  const validate = (value: string) => {
    if (value === CHOOSE) throw new FieldError(`${label} is required`);
    return value;
  };
  const field: typeof base = {
    ...base,
    validate,
    serialize: (value) => ({ value: value === CHOOSE ? undefined : value }),
    reader: { parse: (value) => validate(base.parse(value)) },
  };
  return tag(field, { kind: 'choice', options: values, required: true });
}

/** An optional enum (Zod `z.enum(...).optional()`): "Default" leaves the key out. */
export function optionalChoice<const O extends readonly string[]>(label: string, values: O, extras: ChoiceExtras = {}) {
  const base = fields.select({ label, description: extras.description, options: [{ label: 'Default', value: DEFAULT }, ...optionsFor(values, extras.labels)], defaultValue: DEFAULT });
  const parse = (value: FormFieldStoredValue) => {
    if (value === DEFAULT) throw new FieldError(`${label}: "${DEFAULT}" is not a stored value`);
    return base.parse(value);
  };
  const field: BasicFormField<string, string, string | null> = {
    ...base,
    parse,
    serialize: (value) => ({ value: value === DEFAULT ? undefined : value }),
    reader: { parse: (value) => (value === undefined ? null : parse(value)) },
  };
  return tag(field, { kind: 'optionalChoice', options: values });
}

/** Several of a fixed list (Zod `z.array(z.enum())`). Each new item gets its own empty array (no YAML aliases). */
export function choices<const O extends readonly string[]>(label: string, values: O, extras: ChoiceExtras = {}) {
  const base = fields.multiselect({ label, description: extras.description, options: optionsFor(values, extras.labels), defaultValue: [] });
  return tag({ ...base, defaultValue: () => [] }, { kind: 'choices', options: values });
}

/* ---------- References ---------- */

/** An entry id in another collection (Zod `reference(collection)`), stored as the id string. */
export function ref(label: string, collection: string, { required = false, description }: { required?: boolean; description?: string } = {}) {
  const field = fields.relationship({ label, collection, description, validation: { isRequired: required } });
  return tag(field, { kind: 'ref', collection, required });
}

export function refs(label: string, collection: string, { min, max, description }: { min?: number; max?: number; description?: string } = {}) {
  const field = fields.multiRelationship({ label, collection, description, validation: { length: { min, max } } });
  return tag(field, { kind: 'refs', collection, min, max });
}

/* ---------- Structure ---------- */

type Shape = Record<string, ComponentSchema>;

export function list<E extends ComponentSchema>(
  element: E,
  { label, min, max, description, itemLabel }: { label: string; min?: number; max?: number; description?: string; itemLabel?: (props: any) => string },
) {
  const field = fields.array(element, { label, description, itemLabel, validation: min === undefined && max === undefined ? undefined : { length: { min, max } } });
  return tag(field, { kind: 'list', min, max });
}

/** A list of required strings (an empty item cannot be saved, so it can never be written as null). */
export function stringList(label: string, itemLabel: string, options: { min?: number; max?: number; description?: string; md?: boolean; multiline?: boolean } = {}) {
  const element = options.md ? md(itemLabel, { required: true }) : text(itemLabel, { required: true, multiline: options.multiline });
  return list(element, { label, min: options.min, max: options.max, description: options.description, itemLabel: (props) => props.value || itemLabel });
}

export function group<S extends Shape>(label: string, shape: S, { description }: { description?: string } = {}) {
  return tag(fields.object(shape, { label, description }), { kind: 'group' });
}

/**
 * An optional object (Zod `optionalGroup`). Keystatic always writes the object; it counts as absent while none of
 * `presentIf` holds a value (src/schemas/groups.ts, the same list the Zod side uses). Build its fields without
 * `required`, so an unused group can be saved empty.
 */
export function optionalGroup<S extends Shape>(label: string, shape: S, presentIf: readonly (keyof S & string)[], { description }: { description?: string } = {}) {
  const help = `Optional: leave ${presentIf.join(', ')} empty to leave it out.`;
  return tag(fields.object(shape, { label, description: description ? `${description} ${help}` : help }), { kind: 'optionalGroup', presentIf });
}

/**
 * A fixed-key object standing for a Zod `z.record` (`facts.facts`, `site.social`, `prices.addons`). Keystatic has
 * no map field, so the keys are listed here; the parity test checks them, in order, against the data files.
 */
export function record<K extends string, F extends ComponentSchema>(label: string, keys: readonly K[], field: (key: K) => F, { description }: { description?: string } = {}) {
  const shape = Object.fromEntries(keys.map((key) => [key, field(key)])) as Record<K, F>;
  return tag(fields.object(shape, { label, description }), { kind: 'record', keys });
}

/* ---------- Unknown values (null) ---------- */


/**
 * An "unknown" slot (Zod `unknown(x)`, a required nullable key). Keystatic reads a stored `null` as a missing key,
 * so built-in fields would drop it or turn it into a default. This wrapper reads either as the field's empty value,
 * writes the empty value back as an explicit `null`, and skips the inner checks while empty, so "unknown" can
 * always be saved. `inner` must be one of the basic helpers (text, md, email, url, date, num, int, ref).
 */
export function unknown<P extends {} | null, R>(
  inner: BasicFormField<P, any, R> | SlugFormField<P, any, R, any>,
  { isEmpty }: { isEmpty?: (value: P) => boolean } = {},
) {
  const empty = isEmpty ?? ((value: P) => (value as unknown) === '' || value === null);
  const innerMeta = FIELD_META.get(inner);
  if (!innerMeta) throw new Error(`unknown(): wrap a field made by a helper in keystatic/fields.ts (${inner.label})`);
  const field: BasicFormField<P, P, R | null> = {
    kind: 'form',
    label: inner.label,
    Input: inner.Input,
    defaultValue: () => inner.defaultValue(),
    parse: (value) => (inner.parse as (v: FormFieldStoredValue, extra?: undefined) => P)(value, undefined),
    serialize: (value) => (empty(value) ? { value: null as unknown as FormFieldStoredValue } : inner.serialize(value)),
    validate: (value) => (empty(value) ? value : (inner.validate as (v: P, extra?: undefined) => P)(value, undefined)),
    reader: { parse: (value) => (value === undefined ? null : inner.reader.parse(value)) },
  };
  return tag(field, { kind: 'unknown', inner: innerMeta });
}

/** A nullable enum: "Unknown" writes `null`. */
export function unknownChoice<const O extends readonly string[]>(label: string, values: O, extras: ChoiceExtras = {}) {
  const base = fields.select({ label, description: extras.description, options: [{ label: 'Unknown', value: UNKNOWN }, ...optionsFor(values, extras.labels)], defaultValue: UNKNOWN });
  const parse = (value: FormFieldStoredValue) => {
    if (value === UNKNOWN) throw new FieldError(`${label}: "${UNKNOWN}" is not a stored value; write null`);
    return base.parse(value);
  };
  const field: BasicFormField<string, string, string | null> = {
    ...base,
    parse,
    serialize: (value) => ({ value: value === UNKNOWN ? (null as unknown as FormFieldStoredValue) : value }),
    reader: { parse: (value) => (value === undefined ? null : parse(value)) },
  };
  return tag(field, { kind: 'unknownChoice', options: values });
}

/** A nullable boolean: Unknown / Yes / No. */
export function unknownFlag(label: string, { description }: { description?: string } = {}) {
  const base = fields.select({
    label,
    description,
    options: [
      { label: 'Unknown', value: UNKNOWN },
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    defaultValue: UNKNOWN,
  });
  const readBoolean = (value: FormFieldStoredValue): boolean | null => {
    if (value === undefined) return null;
    if (typeof value !== 'boolean') throw new FieldError(`${label} must be true, false or null`);
    return value;
  };
  const field: BasicFormField<string, string, boolean | null> = {
    ...base,
    parse: (value) => {
      const bool = readBoolean(value);
      return bool === null ? UNKNOWN : bool ? 'yes' : 'no';
    },
    serialize: (value) => ({ value: value === UNKNOWN ? (null as unknown as FormFieldStoredValue) : value === 'yes' }),
    reader: { parse: readBoolean },
  };
  return tag(field, { kind: 'unknownFlag' });
}

/**
 * A nullable list of strings, edited as one item per line. Empty means unknown (`null`); a known list has at least
 * one item (the Zod side requires it), because the editor cannot show "none" and "unknown" differently.
 */
export function unknownList(label: string, { description }: { description?: string } = {}) {
  const base = fields.text({ label, multiline: true, description: `${description ? `${description} ` : ''}One per line. Leave empty while unknown.` });
  const readList = (value: FormFieldStoredValue): string[] | null => {
    if (value === undefined) return null;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new FieldError(`${label} must be a list of strings or null`);
    return value as string[];
  };
  const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  const field: BasicFormField<string, string, string[] | null> = {
    kind: 'form',
    label,
    Input: base.Input,
    defaultValue: () => '',
    parse: (value) => readList(value)?.join('\n') ?? '',
    serialize: (value) => ({ value: lines(value).length ? lines(value) : (null as unknown as FormFieldStoredValue) }),
    validate: (value) => value,
    reader: { parse: readList },
  };
  return tag(field, { kind: 'unknownList' });
}

/** A cell that is a tick, a cross or a short qualifier (Zod `z.union([z.boolean(), z.string()])`): type yes, no or text. */
export function boolOrText(label: string, { description }: { description?: string } = {}) {
  const base = fields.text({ label, description: description ?? 'yes, no, or a short qualifier ("own patients only").', validation: { isRequired: true, length: { min: 1 } } });
  const read = (value: FormFieldStoredValue): boolean | string => {
    if (typeof value === 'boolean' || typeof value === 'string') return value;
    throw new FieldError(`${label} must be yes, no or text`);
  };
  const field: BasicFormField<string, string, boolean | string> = {
    kind: 'form',
    label,
    Input: base.Input,
    defaultValue: () => '',
    parse: (value) => {
      if (value === undefined) return '';
      const cell = read(value);
      return cell === true ? 'yes' : cell === false ? 'no' : cell;
    },
    serialize: (value) => ({ value: value === 'yes' ? true : value === 'no' ? false : value === '' ? undefined : value }),
    validate: (value) => base.validate(value, undefined),
    reader: {
      parse: (value) => {
        if (value === undefined || value === '') throw new FieldError(`${label} is required`);
        return read(value);
      },
    },
  };
  return tag(field, { kind: 'boolOrText' });
}

/**
 * A value kept exactly as the file has it, with no form. `preserved()` leaves the key out when it is absent
 * (`schemaExtras`, which is optional and must never be written as null). `preserved({ nullable: true })` writes
 * `null` when it read nothing (`study.figures[].internalSource`, a required nullable key: Keystatic reads a stored
 * null as absent, so absent has to be written back as null).
 */
export function preserved({ nullable = false }: { nullable?: boolean } = {}) {
  const base = fields.ignored();
  if (!nullable) return tag(base, { kind: 'preserved', nullable });
  const field: typeof base = {
    ...base,
    serialize: (value) => ({ value: value.value === undefined ? (null as unknown as FormFieldStoredValue) : value.value }),
    reader: { parse: (value) => (value === undefined ? null : value) },
  };
  return tag(field, { kind: 'preserved', nullable });
}

/* ---------- Media and calls to action ---------- */

/**
 * The screenshot library (docs/image-plan.md 4): one folder of descriptively named files, shared by every page, so
 * the same screen can serve several pages. Keystatic's own image field stores a copy per entry and renames it on save,
 * so `media.src` is edited as a path into this folder instead (`imagePath`).
 */
export const SCREENSHOT_DIR = 'src/assets/images/screens';
/** The `src` prefix from a YAML page (`src/content/<collection>/<slug>.yaml`). */
export const YAML_SCREENSHOT_PATH = '../../assets/images/screens/';
/** The `src` prefix from an MDX entry (`src/content/<collection>/<slug>/index.mdx`). */
export const MDX_SCREENSHOT_PATH = '../../../assets/images/screens/';

/**
 * Headshots of named people (testimonials and authors share it): `src/assets/images/people/<entry id>/photo.<ext>`,
 * written `../../assets/images/people/<entry id>/photo.<ext>` in the data file. Testimonial and author ids must not
 * clash, because two entries with the same id would share a folder (tests/unit/keystatic-config.test.ts checks).
 */
export const PEOPLE_DIR = 'src/assets/images/people';
/** The `photo` prefix from a data file (`src/data/<collection>/<id>.yaml`). */
export const DATA_PEOPLE_PATH = '../../assets/images/people/';
/** Client logos: `src/assets/images/clients/<entry id>/logo.<ext>`, written `../../assets/images/clients/<entry id>/logo.<ext>`. */
export const CLIENT_LOGO_DIR = 'src/assets/images/clients';
export const DATA_CLIENT_LOGO_PATH = '../../assets/images/clients/';

/**
 * An `astro:assets` image (Zod `image()`). Keystatic stores and looks up the file at `<directory>/<entry slug>/<file>`
 * and renames it to the field's path on save (`photo.jpg`, `logo.png`), so a file placed by hand must already sit
 * there under that name; anywhere else the editor opens the entry without it and a save drops the key.
 */
export function image(label: string, publicPath: string, { directory, description }: { directory: string; description?: string }) {
  return tag(fields.image({ label, description, directory, publicPath }), { kind: 'image' });
}

/** A library file name: lowercase words joined by hyphens, with an image extension. */
const LIBRARY_FILE = '[a-z0-9]+(?:-[a-z0-9]+)*\\.(?:png|jpe?g|webp|avif|svg)';
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * An `astro:assets` image (Zod `image()`) chosen from a shared library folder, edited as its path: the value is kept
 * exactly as written, and the build fails if the file is missing. For files several entries share, where Keystatic's
 * per-entry image field (`image()`) would copy and rename them.
 */
export function imagePath(label: string, publicPath: string, { directory, description }: { directory: string; description?: string }) {
  const pattern = new RegExp(`^${escapeRegex(publicPath)}${LIBRARY_FILE}$`);
  const help = `A file in ${directory}/, written ${publicPath}<file-name>.png. Add the file first.`;
  const field = fields.text({
    label,
    description: description ? `${description} ${help}` : help,
    validation: textValidation(label, { pattern, patternMessage: `Use ${publicPath}<file-name>.png, a lowercase, hyphenated file in ${directory}/` }),
  });
  return tag(field, { kind: 'imagePath', directory, publicPath, pattern });
}

/** Hero or section media (Zod `media` / `optionalMedia`). Blocks always use the YAML prefix: no block with media is allowed in an MDX family. */
export function media(label: string, { optional = false, publicPath = YAML_SCREENSHOT_PATH }: { optional?: boolean; publicPath?: string } = {}) {
  const shape = {
    kind: choice('Kind', MEDIA_KINDS, { zodDefault: 'screenshot' }),
    src: imagePath('Image', publicPath, { directory: SCREENSHOT_DIR, description: 'Demo data only: no real patient name, phone number, e-mail, registration number, rating, award or compliance badge.' }),
    needed: text('Screen needed', { multiline: true, description: 'The screen from the screenshot brief, until the image exists. A media item without an image cannot be published.' }),
    alt: text('Alt text', { required: !optional }),
    caption: text('Caption'),
    frame: choice('Frame', MEDIA_FRAMES, { zodDefault: 'browser' }),
    aiGenerated: flag('AI-generated image', { zodDefault: false, description: 'Generated imagery must never be presented as a customer.' }),
    videoUrl: url('Video URL'),
    origin: choice('Origin', MEDIA_ORIGINS, { zodDefault: 'demo-tenant' }, {
      labels: { 'demo-tenant': 'Demo tenant (spec 12 capture)', 'old-site': 'Old site (interim capture)' },
      description: 'An old-site screen is interim: it is labelled in preview until the company confirms it matches the product.',
    }),
    capturedOn: text('Captured (month)', { pattern: YEAR_MONTH, patternMessage: 'Use a month, YYYY-MM, e.g. 2025-01', description: 'The month the screen was captured.' }),
    uiConfirmedOn: date('UI confirmed on', { description: 'When the company confirmed this old-site screen matches the current product. Leave empty until then.' }),
  };
  return optional ? optionalGroup(label, shape, [...MEDIA_PRESENT_IF]) : group(label, shape);
}

/**
 * A call to action (Zod `cta` / `optionalCta`). `required: false` is for a CTA inside an optional group (the
 * closing band's primary button), which must be savable empty while the group is unused.
 */
export function cta(label: string, { optional = false, required = !optional }: { optional?: boolean; required?: boolean } = {}) {
  const shape = {
    label: text('Label', { required, description: 'Says what happens: "Book a 20-minute demo".' }),
    href: link('Link', { required }),
    event: text('Analytics event', { description: 'Defaults to the label.' }),
  };
  return optional ? optionalGroup(label, shape, [...CTA_PRESENT_IF]) : group(label, shape);
}

/* ---------- Blocks ---------- */

export type KsBlock = { label: string; schema: ComponentSchema; itemLabel?: (props: any) => string };

/** Fields every section shares (Zod `blockBase`). */
export function blockBase() {
  return {
    id: text('Anchor id', { pattern: SLUG_ID, patternMessage: 'Lowercase letters, digits and hyphens', description: 'For in-page links (#id).' }),
    eyebrow: text('Eyebrow'),
    heading: text('Heading'),
    intro: md('Intro'),
    tone: optionalChoice('Background', TONES),
    editorNote: text('Editor note', { multiline: true, description: 'Sources and decisions for this section. Never shown on the site.' }),
  };
}

/** A section type: blockBase plus its own fields, stored as `{ discriminant, value }` in `sections`. */
export function defineBlock<S extends Shape>(name: string, label: string, shape: S, itemLabel?: (props: any) => string): KsBlock {
  const schema = tag(fields.object({ ...blockBase(), ...shape }, { label }), { kind: 'group', block: name });
  return { label, schema, itemLabel: itemLabel ?? ((props) => (props.fields?.heading?.value ? `${label}: ${props.fields.heading.value}` : label)) };
}

/**
 * Placeholder for a block whose form is not built yet. It keeps the stored value exactly as it is (no form), so
 * pages that use the block still open and save unchanged. The parity test lists these as not implemented.
 */
export function todoBlock(name: string): KsBlock {
  const schema = tag(fields.ignored(), { kind: 'stub', block: name });
  const label = `${humanize(name)} (form not built yet)`;
  return { label, schema, itemLabel: () => label };
}

/** The page's `sections` list, offering only the given block types. */
export function sections(blocks: Record<string, KsBlock>, names: readonly string[]) {
  const offered = Object.fromEntries(names.map((name) => {
    const block = blocks[name];
    if (!block) throw new Error(`sections(): no Keystatic block for "${name}"`);
    return [name, block];
  }));
  return tag(fields.blocks(offered, { label: 'Sections' }), { kind: 'sections', blocks: names });
}

/* ---------- Slugs and MDX bodies ---------- */

/**
 * The entry's name field plus its file name. The name is stored under the field's key; the slug is the file (or
 * folder) name, which is the entry id and, for most pages, the URL.
 */
export function slug(label: string, { min, max, slugPattern, slugDescription }: { min?: number; max?: number; slugPattern: RegExp; slugDescription: string }) {
  const field = fields.slug({
    name: { label, validation: { isRequired: true, length: { min: Math.max(1, min ?? 1), max } } },
    slug: { label: 'File name', description: slugDescription, validation: { pattern: { regex: slugPattern, message: 'Lowercase letters, digits and hyphens' } } },
  });
  return tag(field, { kind: 'slug' });
}

/** The InlineCta component in MDX bodies (src/components/mdx/InlineCta.astro), in its multi-line form. */
const inlineCtaComponent = wrapper({
  label: 'Inline CTA',
  description: 'Mid-article call to action; one after the licensing section.',
  schema: {
    heading: text('Heading', { required: true }),
    href: link('Button link', { required: true }),
    label: text('Button label', { required: true }),
    secondaryHref: link('Second link'),
    secondaryLabel: text('Second link label'),
  },
});

/**
 * An MDX body (guides, posts, legal). Headings h2 to h5, no code (the site has no code styling), no images yet
 * (no body uses one; the folder convention is an open spike in docs/keystatic-design.md section 9). The editor
 * re-serialises the whole body on every save: tests/unit/keystatic-mdx-bodies.test.ts runs every body through this
 * exact config and lists what a save changes, so check it after any change here.
 */
export function mdxBody(label = 'Body') {
  const config: Parameters<typeof fields.mdx>[0] = {
    label,
    extension: 'mdx',
    options: {
      heading: [2, 3, 4, 5],
      bold: true,
      italic: true,
      strikethrough: true,
      code: false,
      codeBlock: false,
      link: true,
      orderedList: true,
      unorderedList: true,
      blockquote: true,
      table: true,
      divider: true,
      image: false,
    },
    components: { InlineCta: inlineCtaComponent },
  };
  return tag(fields.mdx(config), { kind: 'mdx', config });
}
