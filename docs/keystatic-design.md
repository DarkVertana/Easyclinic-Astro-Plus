# Keystatic design

How the Keystatic editing screen sits on top of the existing content collections. The goal is that writers
edit the same files the site builds from, in the same shape, and the site's Zod schemas remain the only
authority on what is valid. Keystatic is a form over those files, not a second source of truth.

Versions this design was checked against (26 September 2026): `@keystatic/core` 0.6.9, `@keystatic/astro`
6.0.0 (peer `astro` 5 || 6 || 7), `@astrojs/react` 7.0.0, Astro 7.3.5, Zod 4 (`astro/zod`). Statements marked
**(source)** were read in the published package code (`@keystatic/core` 0.6.9 `dist/`, `@keystatic/astro` 6.0.0,
`astro` 7.3.5 `dist/`). Statements marked **(spike)** still need a check in the running admin before they
can be relied on (see section 9).

## 0. Decisions at a glance

| Topic | Decision |
| --- | --- |
| Scope | All 21 page collections and 6 data collections as Keystatic collections; `site`, `facts`, `study`, `plans`, `nav` as singletons. `redirects`/`gone` (and their generated `*-posts.yaml`) stay code-edited. |
| Files | Same paths, same formats: YAML page files, MDX with YAML frontmatter plus body (`contentField`) for guides, posts and legal. Keystatic ids equal Astro ids. |
| Stored shape | Unchanged. Sections stay `{discriminant, value}` (Keystatic's native `fields.blocks` output). |
| Enums | Imported from `src/schemas/constants.ts`. Inline enums are moved there first. |
| Unknown (`null`) | Wrapper fields that write an explicit `null`; Zod stays strict (the key is required and `null` means unknown); `''` is never a way to say "unknown". |
| Optional objects | Keystatic cannot omit an object. Zod gets an `optionalGroup` helper that treats a blank object as absent. |
| Dates | `fields.date` (YYYY-MM-DD). Zod `isoDate` is tightened to date-only so the two sides accept the same values. |
| Gating | A small integration adds `react()` and `keystatic()` only when the stage is not production, and on deployments only when `KEYSTATIC_STORAGE=github`. Production builds never load either package. **Critique:** it also stays off under Vitest and whenever `VERCEL_ENV=production`, whatever `CONTENT_STAGE` says (3.1). |
| Storage | `local` in `astro dev`; `github` on the preview deployment when `KEYSTATIC_STORAGE=github` and `KEYSTATIC_GITHUB_REPO=owner/name` are set. |
| CSP | Public pages keep Astro's policy unchanged. On `/keystatic/*` only (and only in builds that contain Keystatic), a Keystatic middleware replaces the page policy: script hashes are kept and inline styles are allowed. |
| Comments | 311 comment lines in 86 Keystatic-managed files would be lost on the first save. Move them into `notes` (pages and data) and a new never-rendered `editorNote` on blocks, then add a guard that fails on comments. **Critique:** a YAML lexer finds 310 lines in 85 files. `editorNote` must also be added to every "unrendered key" list, or the rules engine, token resolver and facts report read it (section 5). |
| Trailing slash | **Critique:** rewrite, never redirect, admin URLs. Keystatic's router shows "Not found" for any admin URL with a trailing slash, and Astro's dev server returns a 404 for a missing slash before any Astro middleware runs (3.3). |
| Tests | Parity test (Zod against Keystatic, via field metadata), round-trip test (reader plus a simulated save, compared through Zod), MDX body audit, comment guard, and a production-output check that nothing from Keystatic ships. |
| Block split | The registry has **38** blocks, not 36 (`BLOCK_SCHEMAS` in `src/schemas/sections.ts`, 38 folders in `src/components/blocks/`). Groups of 13, 13 and 12 (section 6). |

## 1. Scope, paths and formats

Keystatic collection keys are the Astro collection names, so `fields.relationship({ collection: 'authors' })`
stores exactly what `reference('authors')` reads.

### Page collections (one Keystatic collection per Astro collection)

| Key | Keystatic `path` | Format | Family (block list) |
| --- | --- | --- | --- |
| `home` | `src/content/home/*` | YAML | `home` |
| `pricing` | `src/content/pricing/*` | YAML | `pricing` |
| `countryPages` | `src/content/country-pages/*` | YAML | `country` |
| `countryDemos` | `src/content/country-demos/*` | YAML | `countryDemo` |
| `company` | `src/content/company/*` | YAML | `company` |
| `kitchenSink` | `src/content/kitchen-sink/*` | YAML | `kitchenSink` (all blocks; hidden from the sidebar, kept for tests) |
| `hubs` | `src/content/hubs/*` | YAML | `hub` |
| `features` | `src/content/features/*` | YAML | `feature` |
| `solutions` | `src/content/solutions/*` | YAML | `solution` |
| `ai` | `src/content/ai/*` | YAML | `ai` |
| `curapilot` | `src/content/curapilot/*` | YAML | `curapilot` (AI list) |
| `trust` | `src/content/trust/*` | YAML | `trust` |
| `specialties` | `src/content/specialties/*` | YAML | `specialty` |
| `guides` | `src/content/guides/*/` | `{ contentField: 'body' }`, `fields.mdx({ extension: 'mdx' })` | `guide` |
| `posts` | `src/content/posts/*/` | same as guides | `post` |
| `comparisons` | `src/content/comparisons/*` | YAML | `comparison` |
| `listicles` | `src/content/listicles/*` | YAML | `listicle` |
| `alternatives` | `src/content/alternatives/*` | YAML | `listicle` |
| `customers` | `src/content/customers/*` | YAML | `customers` |
| `legal` | `src/content/legal/**` | `{ contentField: 'body' }`, MDX | `legal` |
| `glossary` | `src/content/glossary/*` | YAML | `glossary` |

How the paths resolve **(source)**:
- A path ending in `/*` means one file per entry, `<dir>/<slug>.yaml`. That matches `pages()` in
  `src/content.config.ts`.
- A path ending in `/*/` means the entry's data sits in `<dir>/<slug>/index.<ext>`. With `contentField`, the
  extension comes from the `mdx` field (`.mdx`). That matches the guides and posts glob `*/index.mdx`, whose
  id is the folder name.
- `legal/**` lists files at any depth, so `terms`, `privacy` and `privacy/india` all exist even though
  `privacy.mdx` and the `privacy/` folder share a name. That matches the legal glob `**/*.mdx`.
- Frontmatter is split with `/^---\n…\n---\n?/`, parsed with `js-yaml` `load`, and written back as
  `---\n` + `dump(data)` + `---\n` + body.

Every collection needs a `slugField` (required in the 0.6.9 types). Page collections use
`linkLabel: fields.slug({ name: { validation: { length: { min: 2, max: 48 } } }, slug: {...} })`. The name
is stored under `linkLabel`, and the slug is the file or folder name. The slug is the URL for derived paths,
so the slug field's description has to say that renaming the entry changes the live URL. The page then needs a
`redirectFrom` entry, which Keystatic does not add.

**Critique:** `fields.slug` has no default slug pattern. Its `validateText` checks only for empty values, `.`/`..`,
slashes (for `*`), leading or trailing spaces and uniqueness **(source)**. A writer could create `My Page` or
`Privacy_UAE`, and every `internalPath` link to that URL would then fail Zod. Set `slug.validation.pattern` to
`SLUG_ID` (`^[a-z0-9-]+$`) for every page and data collection, and to `^[a-z0-9-]+(?:/[a-z0-9-]+)*$` for `legal`.
Every existing file and folder name already matches, so this breaks no current file.

### Data collections

| Key | Path | Slug field (the name is stored, the slug is the file name) |
| --- | --- | --- |
| `prices` | `src/data/prices/*` | `label` |
| `countries` | `src/data/countries/*` | `name` |
| `regulators` | `src/data/regulators/*` | `name` |
| `testimonials` | `src/data/testimonials/*` | `name` |
| `authors` | `src/data/authors/*` | `name` |
| `integrations` | `src/data/integrations/*` | `name` |

File names are ids that other entries reference. Keystatic does not update references on rename, and a broken
reference fails the build loudly. The slug descriptions must say this.

### Singletons

`site` → `src/data/site`, `facts` → `src/data/facts`, `study` → `src/data/study`, `plans` → `src/data/plans`,
`nav` → `src/data/nav`. A singleton path without a trailing slash is stored as `<path>.yaml` **(source)**.

### Not in Keystatic

- `redirects`, `gone`, `redirects-posts.yaml`, `gone-posts.yaml`. These are routing data with a documented
  comment grammar, and the `*-posts` files are generated by `scripts/posts-redirects.ts`.
- `schemaExtras` (a `z.record` of unknown values). It stays in the file untouched (see `preserved()` below)
  but has no form.

### Sidebar (`ui.navigation`)

- Pages: home, features, solutions, specialties, countryPages, countryDemos, pricing, hubs, ai, curapilot,
  trust, customers, comparisons, listicles, alternatives, company, glossary.
- Articles: guides, posts, legal.
- Shared facts: facts, prices, countries, regulators, integrations, testimonials, authors, study, plans.
- Site: site, nav.

`kitchenSink` is left out of the sidebar but stays in `collections`, so the tests cover every block.

Useful list columns: `['linkLabel', 'status', 'lastUpdated']` for pages, `['name', 'state', 'asOf']` for
regulators and integrations.

## 2. Field mapping

### 2.1 Where things live

- `keystatic.config.ts` is bundled into the browser (the admin page is `client:only="react"`) and into the API
  function. It and everything under `keystatic/` may import only pure modules: `src/schemas/constants.ts`
  and two new pure modules. Nothing that imports `astro:content`, `astro/zod` or the rules engine is allowed.
- New pure modules (added before any Keystatic code):
  - `src/schemas/patterns.ts` holds `INTERNAL_PATH`, `HREF`, `SLUG_ID` (`^[a-z0-9-]+$`), `TIME_24H`, `DIGITS`
    and `ISO_DATE` as `RegExp` constants. `src/schemas/fields.ts` and the block schemas import them instead of
    inline literals.
  - `src/schemas/family-blocks.ts` exports `FAMILY_BLOCKS: Record<PageFamily, readonly BlockName[]>`, moving
    the private `HOME`, `PRICING`, `CORE` … lists out of `families.ts`. It uses a type-only import of
    `BlockName`, and `families.ts` reads its lists from here.
- Enums that are inline today move to `src/schemas/constants.ts`: `TONES`, `MEDIA_KINDS`, `MEDIA_FRAMES`,
  `PROOF_VARIANTS`, `PROSE_WIDTHS`, `SCOPE_VARIANTS`, `TESTIMONIAL_LAYOUTS`, `REGULATOR_KINDS`, `AUTHOR_KINDS`
  and `STATUSED_ITEM_STATES`. The last is the de-duplicated union of `REGULATOR_STATES` and
  `INTEGRATION_STATES`. The Zod schemas and Keystatic then import the same arrays.

### 2.2 Helper API (`keystatic/fields.ts`)

Every helper returns a normal Keystatic field and records what it stands for in an exported
`FIELD_META: WeakMap<object, FieldMeta>`, for example `{ zod: 'string', min, max, pattern, nullable,
zodDefault, presentIf }`. The parity test reads this metadata. Nothing is added to Keystatic's field objects.

| Helper | Keystatic field | Stored value |
| --- | --- | --- |
| `text(label, { required?, min?, max?, pattern?, description? })` | `fields.text` | string; empty → key omitted. **Critique:** `required` is not optional in practice. Every Zod key that is required and has no default (for example a plain `z.string()` such as `clinicTypes.items[].title`, `site.legalName` or `plans.plans[].bestFor`) must use `required: true`, even though Zod allows `''`. Otherwise an emptied field saves with the key omitted and the build fails with "expected string". Parity enforces this (7.1). |
| `md(label, { required? })` | `fields.text({ multiline: true })`, min 1 when required; the description lists the token syntax | string |
| `path(label, { required? })` | `text` with `INTERNAL_PATH` | string |
| `link(label, { required? })` | `text` with `HREF` (internal path, `https://`, `tel:`, `mailto:`) | string |
| `url(label, { required? })` | `fields.url` | string; empty → omitted |
| `email(label, …)` | `text` with an email pattern | string |
| `date(label, { required? })` | `fields.date` | `YYYY-MM-DD` (unquoted); empty → omitted |
| `int(label, { min?, max?, required? })` / `num(…)` | `fields.integer` / `fields.number` | number; empty → omitted |
| `flag(label, { zodDefault })` | `fields.checkbox({ defaultValue: zodDefault })` | boolean, always written |
| `choice(label, OPTIONS, { zodDefault } \| { required: true })` | `fields.select`. With `required`, a `__choose__` option that fails validation, so nothing is picked silently | string |
| `optionalChoice(label, OPTIONS)` | select with a `__default__` option | `__default__` → omitted |
| `choices(label, OPTIONS)` | `fields.multiselect` | string[] (`[]` written). **Critique:** `fields.multiselect` returns the *same* default array instance for every new item **(source: `defaultValue() { return defaultValue }`)**. When two untouched new items share it, `js-yaml` `dump` writes `&ref_0 []` / `*ref_0`. The data is the same, but the output is confusing to hand-edit. The helper overrides `defaultValue: () => []`, and every helper returns fresh objects and arrays. |
| `ref(label, collection, { required? })` | `fields.relationship` | id string; empty → omitted |
| `refs(label, collection, { min?, max? })` | `fields.multiRelationship` | string[] |
| `list(element, { label, min?, max?, itemLabel? })` | `fields.array` with `validation.length` | array (`[]` written). String items are always `required`, so an empty item cannot be saved as `null`. |
| `group(label, shape)` | `fields.object` | object |
| `optionalGroup(label, shape, presentIf)` | `fields.object`; the Zod side uses the same `presentIf` keys (2.5) | object; `{}` or only defaulted keys when unused |
| `unknown(field)` | wraps a basic field (2.4) | value, or an explicit `null` |
| `unknownChoice(label, OPTIONS)` | select with `__unknown__` first | option, or `null` |
| `unknownFlag(label)` | select Unknown / Yes / No | `null` / `true` / `false` |
| `unknownList(label)` | multiline text, one item per line | `null` or `string[]`. **Critique:** `[]` ("none") and `null` ("unknown") both show as an empty box, so a saved `[]` would silently become `null`. Zod side: `unknown(z.array(z.string()).min(1))`, so `[]` is invalid and the two representations are the same. No file has `paymentMethods: []` today. |
| `boolOrText(label)` | text; `yes` ↔ `true`, `no` ↔ `false`, anything else stays a string | `true`, `false` or a string. **Critique:** always required. An empty cell would serialise as `undefined`: in `rolesMatrix` cells, `fields.array` writes that as `null`, and in `plans.matrix` rows the key is dropped. Zod rejects both. |
| `preserved(label)` | `fields.ignored()` that writes `null` back when it read `null` | exactly what the file had. **Critique:** as written this cannot be built. `parseProps` turns `null` into `undefined` before any field sees it **(source: `toFormFieldStoredValue`)**, so the field cannot tell `null` from a missing key, and plain `fields.ignored()` drops both. Use two variants: `preserved()` = plain `fields.ignored()`, which omits the key when absent (`schemaExtras`: `.optional()` rejects `null`, so writing `null` would break every page on its first save); `preserved({ nullable: true })` writes `null` when it read nothing (`internalSource`, a required nullable key). |
| `cta(label, { optional? })` | group of `label` (required), `href` (`link`), `event` | object |
| `media(label, { optional? })` | group: `kind`, `src` (`fields.image`), `needed`, `alt`, `caption`, `frame`, `aiGenerated`, `videoUrl` | object |
| `blockBase()` | `id` (`SLUG_ID`, optional), `eyebrow`, `heading`, `intro` (`md`), `tone` (`optionalChoice(TONES)`), `editorNote` (new, see section 5) | |
| `defineBlock(name, label, shape, itemLabel?)` | `{ label, schema: fields.object({ ...blockBase(), ...shape }), itemLabel }` | `{discriminant, value}` in the parent |

**Optional patterns.** Keystatic runs `pattern` against empty strings too **(source: `validateText`)**, so an
optional field with `^[a-z0-9-]+$` would refuse to save when left empty. The helpers wrap patterns on optional
fields as `^(?:…)?$`, and the parity test compares the inner source.

### 2.3 Construct by construct

| Zod construct | Keystatic | Notes |
| --- | --- | --- |
| `z.string()` (+ `min`/`max`/`regex`) | `text` with the same `length` and `pattern` | Empty values are omitted on save **(source: `text.serialize`)**. |
| `md` (`z.string().min(1)`) | `md` (multiline text, required) | Keep markdown strings as plain text, never Keystatic markdoc or `mdx.inline`: those store a different format. |
| `md.optional()` | `md` (not required) | Empty → omitted. |
| tokens (`{price:…}`, `{fact:…}`, `{fig:…}`, `{contact:…}`, `{plan}`) | plain text | `js-yaml` quotes strings that start with `{` **(verified with the repo's js-yaml 4.3.2)**. Keystatic cannot check token names; unknown tokens fail the build as today. There is no brace pattern, because `{plan}` is a legitimate local placeholder in `pricingCards.planCta.label`. |
| `internalPath`, `href` | `path`, `link` | Same regex constants from `patterns.ts`. |
| `z.url()` | `url` | Keystatic's URL check is looser (relative URLs pass). Zod stays authoritative. |
| `z.email()` | `email` | |
| `z.enum(CONST)` | `choice(label, CONST, …)` | Options, order and default are checked by the parity test. |
| `z.enum(...).default(x)` | `choice(…, { zodDefault: x })` | Keystatic writes the value explicitly, which is harmless. |
| `z.enum(...)` required, no default | `choice(…, { required: true })` | Exception: `status` uses `zodDefault: 'draft'` so new entries start as drafts. |
| `z.enum(...).optional()` (`tone`, `featureRows.plan`) | `optionalChoice` | |
| `z.array(z.enum())` | `choices` | `integrationDirectory.categories`, `testimonials.personas`, `plans.addons.availableOn`. |
| `reference(c)` | `ref(…, c, { required: true })` | Stored as the id string. `reference()` accepts a string. |
| `reference(c).optional()` | `ref(…, c)` | Empty → omitted. |
| `reference(c).nullable()` (`author`) | `unknown(ref(…, 'authors'))` | Writes `author: null`. |
| `z.array(reference(c))` (+ min/max) | `refs(…, c, { min, max })` | `regulatorStrip`, `regulatorTable`, `testimonialRow`, `heroStrip.regulators`. |
| `isoDate` / `.optional()` / `.nullable()` | `date` / `date` / `unknown(date)` | See 2.6. |
| `z.number().int()` (+ positive/min/max) | `int` with `min` (`positive` → `min: 1`) | |
| `z.number().positive()` (prices) | `unknown(num(…, { min: 0.01 }))` | Keystatic has no exclusive bound. |
| `z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3)` | `int(…, { min: 2, max: 4 })` | Empty → omitted → Zod default 3. |
| `z.literal('EasyClinic')` | `choice('Name', ['EasyClinic'], { zodDefault: 'EasyClinic' })` | |
| `z.boolean().default(x)` | `flag(…, { zodDefault: x })` | Always written. |
| `z.union([z.boolean(), z.string()])` | `boolOrText` | `plans.matrix` rows and `rolesMatrix` cells. No existing string cell is `yes` or `no` (checked); the round-trip test keeps it that way. |
| `z.object` / `z.strictObject` | `group` | Keystatic rejects unknown keys when it reads **(source: `parseProps`)**, which is stricter than Zod's default strip. The round-trip test finds any stray key. **Critique:** real data already has stray keys. `kitchen-sink.yaml` lines 57, 78 and 127 use flow mappings with an unquoted comma (`body: Queues, pharmacy and claims.`). YAML reads `body: Queues` plus a key `pharmacy and claims.: null`. Zod strips the stray key, so the page renders truncated text today, and Keystatic will refuse to open the file. Quote those three values in Track 0. **Done (26 September 2026):** the three values are quoted, and the reader opens every entry. |
| `z.object(...).optional()` | `optionalGroup` | See 2.5. |
| `z.array(x).min(a).max(b)` | `list(x, { min: a, max: b })` | The reader enforces length too **(source)**. |
| `.default([])` arrays | `list` | Keystatic writes `[]`, which Zod reads the same as a missing key. |
| `z.string().default('…')` (`faqHeading`, `relatedHeading`, `beforeLabel`, `afterLabel`) | `text` with **no** Keystatic default; the description gives the default | Empty → omitted → Zod default. The default stays in one place. |
| `internalPath.default('/trust/')` (`regulatorStrip.link`) | `path`, empty meaning the default | Same rule. |
| `z.record(z.string(), X)` (`facts.facts`, `site.social`, `prices.addons`) | `group` with a fixed key list (`FACT_KEYS`, `SOCIAL_KEYS`, `ADDON_IDS`) | Keystatic has no map field. The parity test checks each key list against the data file (`facts.yaml`, `site.yaml`, `plans.yaml` addon ids). Adding a fact means adding the key in both places, which is already a code-level decision because it creates a token name. |
| `z.record(z.string(), z.unknown())` (`schemaExtras`) | `preserved()` | |
| `unknown(z.object(...))` (`study.figures[].internalSource`) | `preserved()` | Not editable in Keystatic. The object needs a sign-off (`approvedBy`), so it stays a YAML edit. |
| `media(ctx)` / `image()` | `media()`; `src` is `fields.image({ directory: 'src/assets/screenshots', publicPath: '../../assets/screenshots/' })` | Every YAML page file sits exactly one folder under `src/content/`, so one relative prefix works for every block. Blocks with media are never allowed in the MDX families (the parity test asserts this). No entry has a `src` yet. Guide and post `heroMedia` use `publicPath: '../../../assets/screenshots/'` **(spike)**. **Critique:** Keystatic stores and looks up each image at `<directory>/<entry slug>/<file>`, and the value is `<publicPath><slug>/<file>`. On a save it renames the file to the field path (`heroMedia/src.png`, `sections/2/value/items/0/media/src.png`). When the editor opens an entry, it slices the prefix off the stored `src` without checking that the prefix matches. It then looks the file up, and if the file is not there, `parse` returns `null` and the save **silently drops `src`** **(source: `image.parse`, `useItemData`)**. The reader does not look images up, so reader tests cannot see this. Rules: (1) screenshots added by hand (the first 8 arrive in Phase 1) go in `src/assets/screenshots/<entry slug>/` and are referenced with exactly that prefix; (2) a `lint-content` rule and a unit test check every `src` against that convention; (3) a test asserts entry slugs are unique across all collections that can hold media, because two entries with the same slug would share a folder and overwrite each other's `heroMedia/src.png`. There is no clash today. |
| `family: z.literal(f).default(f)` | not modelled | No file has `family:`. Keystatic would reject it if one did. |
| `sections` (discriminated union) | `fields.blocks(pick(KS_BLOCKS, FAMILY_BLOCKS[family]), { label: 'Sections' })` | See 2.7. |
| MDX body | `body: fields.mdx({ extension: 'mdx', components: { InlineCta }, options })` | See 2.8. |

### 2.4 Unknown values (`null`)

In this repo, `null` means the company has not supplied the value yet. It renders a placeholder in preview and
blocks publishing. How Keystatic handles it **(source)**:

1. **Reading.** Before any field parses a value, `toFormFieldStoredValue()` turns `null` into `undefined`.
   Built-in fields cannot tell `null` from a missing key. Text reads it as `''`, date, number, url and
   relationship read it as `null`, a select reads it as its **default option** (a silent change from unknown to
   `live`), an array reads it as `[]` (a silent change from unknown to "none"), and a checkbox reads it as
   `false`.
2. **Writing.** Built-in fields serialise their empty value as `undefined`, and the object serialiser drops
   `undefined` keys, so the key disappears. The object serialiser keeps `null` (`filter(val !== undefined)`),
   and `js-yaml` writes it as `key: null`.

**Decision.** Every nullable key in the Zod schemas maps to an `unknown*` wrapper that:
- parses `undefined` (which includes a stored `null`) to the field's native empty value (`''`, `null`,
  `__unknown__`);
- serialises that empty value as `{ value: null }`, so the file keeps `key: null`;
- skips inner validation when the value is empty, so "unknown" can always be saved;
- returns `null` from `reader.parse` when empty;
- reuses the inner field's `Input` and `defaultValue`. A new entry therefore starts with every fact unknown
  and writes `null`, which is what the facts report expects.

`FormFieldStoredValue` excludes `null` in the 0.6.9 types, so the wrapper casts. The field unit test pins the
runtime behaviour, and both Keystatic packages are pinned to exact versions.

**Zod side.** `unknown()` stays `schema.nullable()`, a required key. It gains one rule: a string value must
not be `''`, with the message "Write null for an unknown value, not an empty string". There is deliberately no
`.default(null)`. If a Keystatic upgrade ever stopped writing `null`, the build fails loudly instead of quietly
treating a missing key as unknown.

**No `''` against `null` drift:**
- Nullable fields: Keystatic cannot store `''` (empty → `null`), and Zod rejects a hand-written `''`.
- Optional strings: Keystatic omits empty values. A hand-written `''` is read as `''` and dropped on the next
  save, which renders the same way. A new `lint-content` rule forbids empty-string scalars, so there is nothing
  to drift. There are none today (checked).
- Optional non-nullable fields: a hand-written `eyebrow: null` already fails Zod, and Keystatic would drop it.

Nullable keys and their wrappers:
- `unknown(text)`: `countries.contact.{name, role, phone, hours, callbackWindow}`, `office`, `taxInvoicing`,
  `prices.taxNote`, the `prices.addons.*` values, `facts.*.{value, source}`, `study.*.easyclinicRole`,
  `study.figures[].source`, `approvedWording.approvedBy`, `testimonials.{city, outcome}`, `authors.bio`.
- **Critique:** `integrations.expected` is removed from this list. It is `z.string().nullable().default(null)`, and
  none of the 15 files has the key. In this field `null` means "no expected date", not a fact the company owes.
  `unknown(text)` would write `expected: null` into every integration on its first save, and `pnpm facts:report`
  (which lists every raw `null`) would gain 15 false rows. Map it to an optional `text`: empty is omitted and
  Zod's default gives `null`. The component already reads `expected ?? undefined`. Parity allows "nullable with
  a default ↔ optional field".
- `unknown(text)` with `DIGITS`: `countries.contact.whatsapp`.
- `unknown(email)`: `countries.contact.email`.
- `unknown(url)`: `authors.linkedin`.
- `unknown(date)`: `lastUpdated`, every `asOf`, `study.publications[].verifiedOn`.
- `unknown(num)`: `prices.plans.*.{annual, quarterly}`.
- `unknown(ref)`: `author`.
- `unknownChoice`: `regulators.state`, `integrations.state`, `countries.payments[].state`.
- `unknownFlag`: `countries.contact.publishName`, `testimonials.consentOnFile`.
- `unknownList`: `prices.paymentMethods`.
- `preserved`: `study.figures[].internalSource`.

### 2.5 Optional objects

Keystatic always writes an object field. An untouched optional group is saved as `{}`, or with only its
defaulted keys, for example `heroMedia: { kind: screenshot, frame: browser, aiGenerated: false }`. Zod's
`.optional()` would then reject it, because `alt` is required.

**Decision.** Add `optionalGroup(shape, presentIf)` to `src/schemas/fields.ts`. It is
`z.preprocess(blankToUndefined(presentIf), z.object(shape).optional()).optional()`. An object where none of the
`presentIf` keys holds a value (not `''`, `null`, `undefined`, `[]` or `false`) is treated as absent. Inside
these groups, Keystatic does not mark fields as required, because that would stop an empty group from being
saved. Zod enforces completeness once the group counts as present.

| Group | Where | `presentIf` |
| --- | --- | --- |
| media | `heroMedia`; `featureRows.items[].media`, `journeyDiagram.steps[].media`, `moduleGrid.items[].media`, `oldWayNewWay.{old,next}.media`, `proofBlock.media` | `alt`, `src`, `needed`, `caption`, `videoUrl` |
| cta | `ctas.secondary`, `closing.secondary`, `featureRows.items[].link`, `proofBlock.link`, `inlineCta.secondary` | `label`, `href`, `event` |
| navLink | `nav.primary[].footerLink` | `label`, `href`, `description`, `icon` |
| heroStrip | page base | `regulators`, `ratings`, `study` |
| closing | page base | `heading`, `body`, `primary` (recursive) |
| editorialPass | page base | `by`, `on`, `onlyUsCouldWrite`, `readsMachineWritten` |
| claimsReview | page base | `by`, `on` |

`nav.primary[].groups` (an optional array) is written as `[]`. `Header.astro` already reads `groups ?? []` and
checks `.length`, so this is safe.

**Critique: raw-YAML consumers see the blank groups.** Only the Zod output passes through `optionalGroup`.
`scripts/lint-content.ts` calls `auditEntry()` on the **raw** parsed YAML. There, a saved `editorialPass: {}` or
`claimsReview: {}` is truthy, so lint stops reporting `editorial-pass` (`!data.editorialPass`) and skips the claims
rule (`!data.claimsReview`). The build still reports both, so lint would pass pages that fail the build.
Export the preprocess as `blankGroupsToUndefined(data, family)` from `src/schemas/fields.ts`. `lint-content`
(and `report-facts`, which looks at media objects) apply it before auditing. The round-trip test (7.2) also
asserts that `auditEntry` returns the same issues on the raw file before and after the simulated save.

### 2.6 Dates

- Both sides parse YAML with `js-yaml` 4 `load` (Astro: `@astrojs/internal-helpers/frontmatter` and the data
  loader; Keystatic: `generic` reader) **(source)**. An unquoted `2026-09-26` becomes a `Date` at UTC midnight
  on both sides.
- Keystatic `fields.date` reads a `Date` using UTC getters, or reads a string. It validates
  `^\d{4}-\d{2}-\d{2}$` and writes a `Date` whose `toISOString()` returns `2026-09-26`, which `js-yaml` writes
  unquoted. Astro reads that back as the same UTC-midnight `Date`, so `z.coerce.date()` produces an identical
  value. There is no timezone drift.
- The mismatch is that Zod `isoDate` (`z.coerce.date()`) also accepts date-times, while Keystatic would drop
  the time part of an unquoted date-time on save. **Decision:** `isoDate` gains a refinement requiring UTC
  midnight ("Use a date without a time, YYYY-MM-DD"). No file has a date-time today (checked). Quoted dates
  (`'2026-09-26'`) are fine on both sides, and Keystatic rewrites them unquoted.
  **Critique:** a UTC-midnight check alone still accepts the quoted string `'2026-09-26T00:00:00Z'`. Keystatic's
  date field keeps a string as it is and fails `^\d{4}-\d{2}-\d{2}$`, so that entry could not be opened. Make
  `isoDate` accept either a `Date` at UTC midnight or a string matching `ISO_DATE`, then coerce. Note also that
  `lint-content` and `report-facts` parse with the `yaml` package (YAML 1.2), where an unquoted date is a
  *string*, not a `Date`, so the refinement must accept both.
- Normalisation for tests: none needed. The reader returns `YYYY-MM-DD` strings, Zod coerces them, and the
  comparison happens after the Zod parse.

### 2.7 Sections and per-family blocks

- `keystatic/blocks/<name>.ts` exports `export const <name> = defineBlock('<name>', '<Label>', {...})`.
  `keystatic/blocks/index.ts` exports `KS_BLOCKS = {...} satisfies Record<BlockName, KsBlock>` (a type-only
  import of `BlockName`), so a missing block is a type error.
- Each page collection's `sections` field is
  `fields.blocks(pick(KS_BLOCKS, FAMILY_BLOCKS[family]), { label: 'Sections' })`. `fields.blocks` is an array of
  `conditional(select, values)` and writes exactly `{ discriminant, value }`. When the value object is
  present, the key order is `discriminant` then `value` **(source: `blocks`, `serializeProps`)**.
- `itemLabel` shows `heading` when it is set, otherwise the block label.
- Cross-field rules stay Zod-only (section 7.3).

### 2.8 MDX bodies (guides, posts, legal)

- The reader returns the body as the raw string **(source)**. The editor parses it with mdast and MDX
  (`micromark-extension-mdxjs` plus GFM table, strikethrough and autolink) into ProseMirror. **Any node without
  a mapping is an error** that stops the entry opening. That includes `html`, `{expressions}`,
  `import`/`export`, footnotes, and undeclared JSX **(source: `mdxToProseMirror`)**.
- Options: `heading: [2, 3, 4, 5]` (bodies use h2 to h5; no h1), bold, italic, strikethrough, links,
  ordered and unordered lists, blockquote, `table: true`, `divider: true`, `image` pointing at the entry
  folder **(spike)**, and code off. `components: { InlineCta: wrapper({ label: 'Inline CTA', schema: { heading,
  href, label, secondaryHref, secondaryLabel } }) }`.
- **InlineCta form.** All 11 current uses are written on one line
  (`<InlineCta …>text</InlineCta>`). Plain mdast parses that as a paragraph containing a text JSX element,
  which a `wrapper` component cannot accept. Decision: after the posts refresh lands, rewrite those 11 as the
  multi-line flow form, which is what Keystatic writes anyway:

  ```mdx
  <InlineCta heading="…" href="/indiademo/" label="Book a 20-minute demo">
    One or two sentences.
  </InlineCta>
  ```

  Astro renders the child as a `<p>` inside the card's slot `<div>`, which is valid HTML. Astro 7's MDX
  pipeline uses `@astrojs/markdown-satteri`, not micromark, so check once that it renders both forms the same
  way **(spike)**.
- **Critique: the count is 58, not 11, and still rising.** On 26 September, 58 files under `src/content/` used
  `<InlineCta>`, every one on a single line and none in flow form. The posts refresh is adding more, because the
  usage comment in `src/components/mdx/InlineCta.astro` shows the one-line form (`docs/content-guide.md`
  already shows the flow form). Change that comment to the flow form now, so new posts are written that way.
  Do the conversion with a codemod (`scripts/inline-cta-flow.ts`, mdast in, flow element out), not by hand.
  The body audit (7.4) keeps it from coming back.
- **What changes when a body is saved** (measured on 26 September 2026 by running every guide, post and legal body
  through the editor's own field from the browser build of `@keystatic/core` 0.6.9, the build the admin runs:
  `tests/unit/keystatic-mdx-bodies.test.ts`). Keystatic re-serialises the whole body on every save
  (`serializeFromEditorStateMDX`: ProseMirror → mdast → `mdast-util-to-markdown` with GFM and MDX). On the current
  content **no word, link or InlineCta prop is lost**, read with Keystatic's parser and with Astro's (satteri), and a
  second save changes nothing, so the reformatting happens once per file. What the first save changes:
  - **Table column alignment is dropped** (`createAndFill(table, {})` has no align attribute; the separator row is
    written `| --- | --- |` and cells are padded). Three published pages right-align a money column with `---:`:
    the guides `how-much-does-it-cost-to-open-a-clinic-in-mumbai` and `how-much-does-it-cost-to-open-a-clinic-in-nairobi`
    and the post `clinic-setup-cost-in-india`. In all three every body cell of that column is an amount, so PostTable
    marks it `data-numeric` and right-aligns it whatever the Markdown says (`numericColumns` in
    `src/lib/content/post-table.ts`); a save does not change how they look. Any other alignment (centre, or right on
    a column that is not all amounts) would be lost, and the body test fails if one appears.
  - Lists: `-` becomes `*`, loose lists (blank lines between items) become tight, nested lists are indented two spaces.
  - Hard breaks written as two trailing spaces become a backslash at the end of the line (legal pages, imported posts).
  - Headings: setext (`Title` over `===`) becomes ATX (`# Title`); an escaped `1\.` in a heading is written `1.`.
    Levels outside 2 to 5 are kept as they are.
  - Escapes: `*`, `_`, `[`, `{` and `<` in text are backslash-escaped (`snake\_case`, `\[need date]`, `\{`); `&lt;`
    becomes `\<`; `&` in a link URL becomes `\&`. The text read back is the same.
  - Links: bare URLs and emails (GFM autolinks) become explicit links (`[www.example.com](http://www.example.com)`,
    `[hello@example.com](mailto:hello@example.com)`); reference links become inline links and their definitions go;
    a link inside bold or italic is written the other way round (`**[a](/) b**` → `[**a**](/)**&#x20;b**`, with the
    space kept as `&#x20;`), and nested bold collapses. Rendering is the same.
  - InlineCta is written in the multi-line form with its text indented two spaces, props in the form's order.
  - Leading blank lines are dropped, and blocks are separated by exactly one blank line.

  What a save would lose, which none of the current bodies uses (the body test fails if one appears): a link title
  (`[a](/x/ "Title")` → `[a](/x/)`), an image (images are off, so `![Alt](/a.png)` is written back as the literal text
  `!\[Alt]\(/a.png)`) and a footnote (`[^1]` with its definition becomes a link to the note's text).

  What the editor refuses to open at all (its parser throws, so the entry does not open and nothing can be saved):
  HTML tags, `{expressions}`, `import`/`export`, inline code and code blocks, and an `<InlineCta>` written on one line. **On 26 September 2026 every
  InlineCta in the content is on one line** (67 bodies, all published: 11 guides and 56 posts), so none of those
  bodies can be edited in Keystatic until the InlineCta codemod above lands. The body test checks each of them on a copy
  converted to the multi-line form (whitespace only) and lists it as a todo.

## 3. Production gating and storage

### 3.1 Integration: `integrations/keystatic-gate.ts`

```ts
// astro.config.ts: one small edit
integrations: [mdx(), keystaticGate(), vercelRoutes()],
```

In `astro:config:setup({ command, updateConfig, addMiddleware, logger })`, the gate:
1. Reads the environment as `{ ...loadEnv(mode, root, ''), ...process.env }`. Vite's `loadEnv` is needed
   because Astro does not load `.env` into `process.env` at config time.
2. Checks the stage with the same rule as `src/lib/content/stage.ts` (`CONTENT_STAGE`, then `VERCEL_ENV`).
   **Production returns immediately.** Nothing is imported or injected, so no React renderer, no `/keystatic`
   route and no Keystatic middleware exist in the www build.
   **Critique:** two more early returns.
   - `VERCEL_ENV === 'production'` returns immediately, whatever `CONTENT_STAGE` says. `stage.ts` lets
     `CONTENT_STAGE=preview` override `VERCEL_ENV`, so someone previewing drafts on www with that setting
     would otherwise also get the admin on www, if `KEYSTATIC_STORAGE=github` were set there too.
   - `process.env.VITEST` returns immediately. `vitest.config.ts` uses `getViteConfig`, which runs integration
     setup hooks with `command: 'dev'` (Vite's `serve`) **(source: `astro/dist/config/index.js`)**. Without this,
     every `pnpm test` would load React and Keystatic, move `server.host`, replace `optimizeDeps.entries` and
     write `.astro/keystatic-imports.js`. The Keystatic tests import `keystatic.config.ts` directly and do not
     need the integration.
3. Picks the storage: `github` when `KEYSTATIC_STORAGE=github`, otherwise `local`. It enables Keystatic when
   `command === 'dev'` (either storage), or on any build with `storage === 'github'`. A local-storage admin on
   a serverless preview would render and then fail on save, because the function's filesystem is read-only.
   In github mode it throws if `KEYSTATIC_GITHUB_REPO` is missing or not `owner/name`.
4. Imports `@astrojs/react` and `@keystatic/astro` dynamically and calls
   `updateConfig({ integrations: [react(), keystatic()], vite: { define: {
   'import.meta.env.KEYSTATIC_STORAGE': …, 'import.meta.env.KEYSTATIC_GITHUB_REPO': … } } })`. Astro 7 runs
   the setup hook of integrations added this way, because the loop re-reads `updatedConfig.integrations`
   **(source: `integrations/hooks.js`)**. The `define` is needed because `keystatic.config.ts` runs in the
   browser, where only `PUBLIC_*` variables exist.
5. Calls `addMiddleware({ order: 'pre', entrypoint: new URL('./keystatic-middleware.ts', import.meta.url) })`
   (4).
6. **Critique:** adds a Vite plugin whose `configureServer` post hook `unshift`s a connect middleware ahead of
   Astro's own. It handles the dev URL rewrites in 3.3. Integration plugins are placed after Astro's core
   plugins (`core/create-vite.js` merges `config.vite.plugins` after its own), so their post hooks run later,
   and a later `unshift` puts the middleware in front. The plugin must not set `enforce: 'pre'`, which would
   move it ahead of Astro's plugins.

What `@keystatic/astro` itself does **(source)**:
- It injects `/keystatic/[...params]` (an Astro page that renders `<Keystatic client:only="react" />`) and
  `/api/keystatic/[...params]`, both `prerender: false`.
- It writes `.astro/keystatic-imports.js`.
- It sets `server.host: '127.0.0.1'` when no host is configured. Open `http://127.0.0.1:4321/keystatic/`:
  `localhost` can resolve to `::1` on macOS.

Both routes are already reserved in `src/lib/content/registry.ts` (`/keystatic/`, `/api/`).

### 3.2 `keystatic.config.ts`

```ts
const storage = import.meta.env.KEYSTATIC_STORAGE === 'github'
  ? { kind: 'github', repo: import.meta.env.KEYSTATIC_GITHUB_REPO as `${string}/${string}`, branchPrefix: 'content/' }
  : { kind: 'local' };
export default config({ storage, ui: { brand: { name: 'EasyClinic' }, navigation }, collections, singletons });
```

Local mode reads the repo tree (it respects `.gitignore` and skips `node_modules` and `.git`) and writes only
inside the configured collection and singleton directories **(source: `getAllowedDirectories`)**.

### 3.3 Trailing slashes

`trailingSlash: 'always'` does not fit Keystatic's URLs:
- In `astro dev`, `/demo/confirmation` (no slash) returns **404** with no redirect **(verified on the running
  dev server)**.
- Keystatic calls `/api/keystatic/tree`, `/api/keystatic/update`, `/api/keystatic/blob/…` and
  `/api/keystatic/github/*` without a slash, and redirects to `/keystatic` **(source)**. Keystatic issue #1042,
  "Admin panel does not work with trailingSlash: always", is still open.

Deployed, Vercel's adapter already 308-redirects slashless paths, and the API handler drops empty path
segments (`filter(Boolean)`), so `/api/keystatic/update/` works **(source)**. In dev, the Keystatic middleware
does the same: a 308 to `pathname + '/' + search` for `/keystatic…` and `/api/keystatic…` without a trailing
slash. A 308 keeps the method and body. Whether Keystatic's client router copes with a trailing slash on a deep
admin URL after a refresh is **(spike)**.

**Critique: the redirect plan fails on both counts, as the source shows.**
- **The router does not cope.** Keystatic's `RouterProvider` computes
  `pathname.replace(/^\/keystatic\/?/, '').split('/')` with no empty-segment filter. So
  `/keystatic/collection/posts/` gives `['collection', 'posts', '']`, `parseParamsWithoutBranch` returns `null`,
  and the page shows "Not found" **(source: `@keystatic/core` 0.6.9 `dist/index-5d64e651.js`,
  `keystatic-core-ui.js`)**. Every deep admin URL that a 308 adds a slash to breaks on refresh or when opened
  from a link. Only the bare `/keystatic/` works.
- **Astro middleware never sees the dev request.** In `astro dev`, Astro `unshift`s its own
  `trailingSlashMiddleware` onto the connect stack. It answers a slashless, extensionless path with the 404
  "trailing slash mismatch" page before routing, so before any `addMiddleware` code runs **(source:
  `astro/dist/vite-plugin-astro-server/plugin.js`, `trailing-slash.js`)**. `fetch('/api/keystatic/tree')` and
  `fetch('/api/keystatic/update')` would 404. Deployed, Astro's own SSR handler also redirects slashless paths
  (`core/routing/handler.js` → `handleTrailingSlash`), so a plain rewrite to the function is not enough either.

**Decision: rewrite, never redirect.** The admin page is `client:only` and its HTML is the same for every admin
URL, so the server only ever needs to render `/keystatic/`.
- **Dev** (the Vite middleware from 3.1 step 6): set `req.url` to `/keystatic/` for any path under
  `/keystatic`, and append a slash (keeping the query) to a slashless `/api/keystatic/…` path. The browser URL
  never changes, so the router sees what Keystatic pushed.
- **Deployed:** only in builds that contain Keystatic, `routes-core.ts` prepends routes ahead of the adapter's
  slash 308. These rewrite `^/keystatic(?:/.*)?$` to `/keystatic/` and a slashless `^/api/keystatic/(.*[^/])$`
  to `/api/keystatic/$1/`. The Build Output fields (`check: true`, and how the adapter hands the function its
  path) are a spike. Rewriting the API path also keeps the OAuth callback's `?code=…&state=…` without
  depending on whether a 308 keeps the query string.
- The Keystatic middleware (4) no longer does anything with slashes.

### 3.4 GitHub mode on preview deployments

The company has not given GitHub access yet. Everything below is ready to run when it does.

1. **Admin host.** Production deployments never include Keystatic, so the admin needs a stable
   *non-production* URL. Create a `cms` branch that a GitHub Action fast-forwards to `main` on every push, and
   assign it a domain in Vercel (for example `cms.easyclinic.io`, or the stable
   `<project>-git-cms-<team>.vercel.app`). Its `VERCEL_ENV` is `preview`. Editors choose which branch to edit
   inside Keystatic, so the admin host's own branch only supplies the schema.
2. **GitHub App.** Create it in the org's settings (org admin): Developer settings → GitHub Apps → New.
   - Callback URL `https://<admin-host>/api/keystatic/github/oauth/callback`, plus
     `http://127.0.0.1:4321/api/keystatic/github/oauth/callback` to test github mode locally. Keystatic sends
     `redirect_uri = <origin>/api/keystatic/github/oauth/callback` **(source)**, and GitHub requires an exact
     match.
   - "Expire user authorization tokens": on. Keystatic has a refresh-token route.
   - "Request user authorization (OAuth) during installation": on. Webhook: off.
   - Repository permissions: **Contents: Read and write, Metadata: Read-only, Pull requests: Read-only**, the
     same as Keystatic's own app manifest **(source)**.
   - Installable "Only on this account". Install it on the org for the site repository only.

   Alternative: run `KEYSTATIC_STORAGE=github KEYSTATIC_GITHUB_REPO=org/repo pnpm dev`, open
   `http://127.0.0.1:4321/keystatic/` and use Keystatic's "create GitHub App" flow, which writes the
   variables to `.env`. Then make the app private and add the admin-host callback URL. Do this locally only:
   the flow posts a form to github.com, which `form-action 'self'` blocks on deployments.
3. **Vercel variables, Preview scope only** (scope them to the `cms` branch if the plan allows):
   `KEYSTATIC_STORAGE=github`, `KEYSTATIC_GITHUB_REPO=org/repo`, `KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (random, at least 40 bytes as hex) and
   `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Never set them in Production. The stage check ignores them there
   anyway. Add commented entries to `.env.example`.
4. **Who can edit.** Keystatic acts with each editor's own GitHub token, so an editor needs write access to
   the repo, and commits are attributed to them. `branchPrefix: 'content/'` limits the branches Keystatic shows
   and creates. Protect `main` with required pull requests and checks (lint, `astro check`, both builds, e2e).
   Every `content/*` push produces a Vercel preview for review. Merging to `main` publishes.
5. **Deployment Protection.** Vercel Authentication on previews would require every editor to have Vercel
   access. Decide for the admin host whether to use Vercel Authentication, password protection or a bypass.
   GitHub login is the write gate either way, but anyone who can open the host sees draft pages.
6. **Smoke test after setup.** Open `/keystatic/`, log in, create `content/keystatic-check`, save a no-op edit
   to `kitchenSink`, confirm the commit and the preview build, then delete the branch.

## 4. CSP

Findings:
- `astro dev` emits no CSP. The serialised dev manifest has `shouldInjectCspMetaTags: false`, and the running
  dev server's HTML has no CSP meta tag **(source and verified)**. Local-mode editing is unaffected.
- In a build, the on-demand `/keystatic/[...params]` page gets Astro's policy as a **response header**
  (`cspDestination` is `header` for non-prerendered routes, because the Vercel adapter is not set to
  `staticHeaders`) **(source)**. That header contains the site directives plus hashes of what Astro emits,
  which here is the island bootstrap scripts.
- Keystatic's UI cannot run under that policy:
  - `@keystar/ui` inserts `<style>` elements at runtime through Emotion (`@emotion/sheet`), with no way to pass
    a nonce.
  - It loads Inter from `fonts.googleapis.com`.
  - It calls `api.github.com` (GraphQL and REST), shows avatars from `avatars.githubusercontent.com`, uses
    `raw.githubusercontent.com`, and makes `blob:` URLs for image previews **(source)**.
  - Runtime styles cannot be hashed at build time. Adding `'unsafe-inline'` through `context.csp` does not
    help either, because browsers ignore `'unsafe-inline'` when a directive also lists hashes.
- Astro 7.3.5 has no per-route CSP opt-out in either `security.csp` or the runtime `csp` API, which can only
  add to a policy **(source: `fetch-state.js`)**.

**Decision: replace the page policy on the admin route only, in builds that contain Keystatic.**
`integrations/keystatic-middleware.ts`, registered only by the gate:
- matches `pathname.startsWith('/keystatic/')` responses with `content-type: text/html`;
- takes Astro's `script-src` directive **verbatim** (`'self'`, Astro's hashes, no `'unsafe-inline'` or
  `'unsafe-eval'`) and replaces every other directive with:

  ```
  default-src 'self'; script-src <Astro's>; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://avatars.githubusercontent.com
  https://raw.githubusercontent.com; connect-src 'self' https://api.github.com https://raw.githubusercontent.com;
  worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```

- leaves `/api/keystatic/*` alone (JSON and redirects);
- ~~also includes the dev trailing-slash redirect from 3.3.~~ **Critique:** removed. Astro middleware never sees
  those dev requests, and a redirect breaks the router. See 3.3.
- **Critique:** Astro's `script-src` also carries `https://www.googletagmanager.com` from `astro.config.ts`. That
  is harmless on the admin page, because gtag loads only on the production host. Keep it verbatim rather than
  editing it.

`src/middleware.ts` gets one guard, `if (pathname.startsWith('/keystatic/')) return next();`, so the
placeholder pass never rewrites the admin page. It is safe today, but there is no reason to touch that HTML.

Vercel's `HEADER_CSP` (`integrations/routes-core.ts`) still applies to every path, `/keystatic/` included:
`frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. It is compatible, because
Keystatic starts GitHub login with `window.location.href`, not a form.

Why public pages are not weakened:
- `security.csp` in `astro.config.ts` is untouched.
- The middleware only exists in builds that contain Keystatic, and it only matches `/keystatic/`.
- `tests/output/csp.test.ts` stays as it is, and a new production-output test (7.5) asserts the route and
  middleware are absent.
- On preview, a CSP e2e check covers the admin (7.5).

## 5. YAML comments

Keystatic rebuilds the whole file from its schema on save **(source: `serializeEntryToFiles` →
`dump(state)`)**. Comments, key order that differs from the schema, flow style (`{ a: 1 }`), the current
~100-column folding and quoting choices all go on the first save. Only comments carry information. The rest is
formatting, and the round-trip test proves it is semantically neutral.

Inventory (`^\s*#` lines; no trailing comments exist; MDX frontmatter has none today, but the posts are being
rewritten, so re-run the count before migrating):

| Area | Files with comments / total | Comment lines | What the comments say |
| --- | --- | --- | --- |
| `src/data/integrations/` | 15 / 15 | 67 | Provenance: source URLs with quoted live-site wording, "Fetched 2026-09-26", "Status unknown: state and asOf stay null" |
| `src/data/countries/` | 2 / 4 (`ng`, `ae`) | 10 | Provenance of `contact.email` and `cities`, with the caveat that coverage wording is not named clients |
| `src/data/facts.yaml`, `study.yaml`, `plans.yaml`, `nav.yaml` | 4 | 9 | What `asOf: null` means, the study re-verification rule, plan-name source, nav visibility rule |
| `src/content/specialties/` | 14 / 14 | 64 | Keyword ownership (spec 4.5), grounding sources, merge and redirect decisions |
| `src/content/country-pages/` | 4 / 4 | 57 | Why each page is a draft, plus **section-level** notes ("Block 2: local proof strip …") |
| `src/content/comparisons/` | 2 / 3 | 18 | Re-sourcing record for competitor facts, plus section-level notes ("Healthie step 3 …") |
| `src/content/hubs/` | 5 / 8 | 16 | Page purpose and spec references |
| `src/content/features/` | 12 / 12 | 15 | One-line header (spec section and keyword row) |
| `src/content/listicles/`, `alternatives/` | 6 / 6 | 18 | Competitor-fact sourcing dates |
| `pricing`, `solutions`, `company`, `trust`, `ai`, `glossary`, `kitchen-sink`, `home`, `curapilot`, `customers`, `country-demos` | 22 | 37 | Headers; `trust.yaml`, `trust/integrations.yaml`, `nigeriademo.yaml`, `hubs/blog.yaml` also have section-level ones |
| **Total, Keystatic-managed** | **86 files** | **311** | |
| `redirects.yaml`, `gone.yaml`, `*-posts.yaml` (not in Keystatic) | 4 | 27 | Rule grammar and the "GENERATED by …" banner. These stay as comments. |

The 10 files with indented (section-level) comments are the four country pages,
`comparisons/easyclinic-vs-kenyaemr.yaml`, `country-demos/nigeriademo.yaml`, `hubs/blog.yaml`,
`trust/trust.yaml`, `trust/integrations.yaml` and `data/countries/ae.yaml`.

**Critique:** the `^\s*#` count is off by one. `country-demos/nigeriademo.yaml` line 137
(`    #power-internet-whatsapp and #compliance-in-nigeria, …`) is a continuation line inside a `>-` block scalar in
`notes`: it is content, not a comment. Counting with the `yaml` package's `Lexer` (comment tokens) gives **310
lines in 85 files**, and 9 files with indented comments. The guard in step 3 below must use the lexer too. A
regex guard would reject that valid file, and it would also reject Keystatic's own output whenever a folded
string has a line that starts with `#`.

**Recommendation.** Move provenance into fields before Keystatic can save anything:
1. **Schema (Zod and Keystatic together):**
   - Add `notes: z.array(z.string()).default([])` (never rendered) to `integrationSchema`, `countrySchema`,
     `regulatorSchema`, `testimonialSchema`, `authorSchema`, `priceSchema` (which keeps its rendered `note`),
     and to the `facts`, `plans` and `nav` singletons. `study` and every page already have `notes`.
   - Add `editorNote: z.string().optional()` to `blockBase`: never rendered, one note per section. The name
     avoids clashing with the rendered `note` that several blocks already have.
   - **Critique:** "never rendered" is not automatic. Three places treat only `notes` as unrendered:
     `SKIP_KEYS` in `src/lib/rules/walk.ts`, `UNRENDERED` in `src/lib/content/tokens.ts` (`resolveDeep`) and the
     `k === 'notes' || k === 'note'` skip in `scripts/report-facts.ts`. Without a change, provenance moved into
     `editorNote` (source URLs, quoted competitor wording, "[need date]") would be checked for banned words,
     claims and placeholders, which fails published pages. It would also be token-resolved and listed in the
     facts report. Add `UNRENDERED_KEYS = ['notes', 'editorNote']` to `src/schemas/constants.ts` and use it in all
     three places.
2. **Move** (one-off `scripts/move-yaml-comments.ts`, using the `yaml` package's comment-preserving `Document`
   API, followed by a human diff review):
   - A file header becomes the first `notes` entries.
   - A comment above a section becomes that section's `editorNote`.
   - A comment above a data key becomes a `notes` entry prefixed with the key, for example
     `"contact.email: Contact support at … (fetched 2026-09-26) …"`.
   - The general explanations in `facts.yaml` (what `asOf: null` means) and `nav.yaml` belong in
     `docs/content-guide.md` and in the Keystatic field descriptions, not in each file.
3. **Guard:** a unit test and a `lint-content` rule fail when any Keystatic-managed YAML file, or any MDX
   frontmatter, contains a comment line. From then on, provenance can only be written where Keystatic keeps
   it. The routing files are exempt. **Critique:** find comments with the `yaml` `Lexer` (tokens starting with
   `#`), not a line regex. See the inventory note above.
4. **Normalise once:** run the round-trip test's save simulation (7.2) over every managed file and commit the
   result on its own. That covers key order in schema order, block style, the 80-column fold and js-yaml
   quoting (`'on':`, `'n':`, `'yes'`). The first real Keystatic save is then a small, reviewable diff. Do it
   after step 2, because it removes comments. **Critique:** for MDX, rewrite only the frontmatter and leave the
   body byte-for-byte. A body is re-serialised only when a writer saves it (2.8 lists what that changes). Run this
   after the posts refresh and the InlineCta codemod (2.8) have landed.

**As built (26 September 2026).** Steps 1 to 3 are not done: moving comments is a `src/content` edit, and the guard
would fail on the 85 files that still have them. Until then the round-trip test reports them instead of failing:
every Keystatic-managed file (YAML, or MDX frontmatter) that carries a comment is a `todo` under its collection,
named with its comment count ("a save deletes N YAML comment lines in …"), so every `pnpm test` run shows the total
and `pnpm exec vitest run --project unit --reporter=verbose tests/unit/keystatic-roundtrip.test.ts` names the files
(`pnpm test --reporter` is taken by pnpm itself). The count uses the `yaml` lexer, as above: **310 lines in 85
files**, none in MDX frontmatter. Nothing in the admin warns a writer; `docs/content-guide.md` does. Once the
comments are moved, turn the todos into the failing guard of step 3.

Choosing "code-edited only" for the heavily commented files instead was rejected. It would take the four
country pages, all specialties and all integrations (the pages writers most need to edit) out of the admin.

Keystatic's field order is chosen to match the files, to keep churn small. Measured over 74 page files:
`status, path, headKeyword, secondaryKeywords, title, metaDescription, h1, linkLabel, eyebrow, openingAnswer,
summary, author, reviewedBy, country, lastUpdated, <family extension>, heroStrip, heroMedia, ctas, faqHeading,
sections, faq, links, closing, noindex, canonical, redirectFrom, editorialPass, claimsReview, schemaExtras,
notes`. The post extension is `originallyPublished, topic, owner`, placed after `lastUpdated` as in the post
files.

## 6. File layout and block split

```
keystatic.config.ts              config(); storage from the gate's define; navigation
keystatic/fields.ts              helpers of 2.2 and FIELD_META
keystatic/page-base.ts           pageFields(family): ordered base fields and the family extension
keystatic/blocks/index.ts        KS_BLOCKS satisfies Record<BlockName, KsBlock>
keystatic/blocks/<name>.ts       one per block: export const <name> = defineBlock(...)
keystatic/collections/pages.ts   PAGE_TABLE (key, dir, format, family) → 21 collections
keystatic/collections/data.ts    prices, countries, regulators, testimonials, authors, integrations
keystatic/singletons.ts          site, facts (FACT_KEYS), study, plans, nav
integrations/keystatic-gate.ts   stage and storage gate (3.1)
integrations/keystatic-middleware.ts   admin CSP and dev slash redirect (3.3, 4)
src/schemas/patterns.ts          shared regexes (new, pure)
src/schemas/family-blocks.ts     FAMILY_BLOCKS (new, pure)
tests/unit/keystatic-*.test.ts   section 7
```

**Order of work.**
- **Track 0 (lead, before the groups):**
  - Dependencies, added by the dependency owner: `@keystatic/core@0.6.9`, `@keystatic/astro@6.0.0`,
    `@astrojs/react@7.0.0`, `react`/`react-dom` 19, and Keystatic 0.6.9's peer dependencies
    (`react-aria@3.50.0` and `react-stately@3.48.0`, both pinned exactly by Keystatic, and
    `@keystar/ui@~0.10.0`). Markdoc is not needed. Pin exact versions.
  - Every Zod-side change: the lifted enums, `patterns.ts`, `family-blocks.ts`, `unknown()` rejecting `''`,
    `optionalGroup` / `optionalMedia` / `optionalCta` swaps in `base.ts` and the six block schemas that use
    them, `isoDate` date-only, `editorNote` and the new `notes`.
  - **Critique:** also in Track 0:
    - `UNRENDERED_KEYS` in walk, tokens and report-facts (section 5);
    - `blankGroupsToUndefined` used by `lint-content` and `report-facts` (2.5);
    - `prices.paymentMethods` becomes `.min(1)` inside `unknown()` (2.2);
    - quote the three truncated flow values in `kitchen-sink.yaml` (2.3), once `src/content/` is free to edit;
    - change the `InlineCta.astro` usage comment to the flow form (2.8).
    `family-blocks.ts` must hold its own literal `BLOCK_NAMES` list, because `kitchenSink` uses every block and
    today's `BLOCK_NAMES` is a runtime value in `sections.ts`, which imports the block schemas and
    `astro:content`. `sections.ts` then asserts at type level that the two lists are equal, and the parity test
    checks the same at run time.
  - `keystatic/fields.ts`, `page-base.ts`, collections, singletons, the config, the gate and the middleware.
  - `keystatic/blocks/index.ts` importing all 38 files, each created as a stub
    (`export const addOns = todoBlock('addOns')`). The parity test reports stubs as "not implemented" rather
    than failing the type check.
- **Groups A, B and C (parallel):** each group only overwrites its own stub files in `keystatic/blocks/`. It
  edits no shared file and no Zod schema, and checks itself with
  `pnpm test tests/unit/keystatic-parity.test.ts -t <block>`.
- **After the groups:** the lead runs the full parity, round-trip and body-audit tests, the comment migration
  and the normalisation commit, then the dev smoke test (9).

Every block also gets `blockBase()`. In the tables below, "req" means `required: true`, and a range after a
list is its min and max.

**Group A: cards, media and CTAs (13):** `clinicTypes`, `contentCards`, `featureRows`, `hubGrid`, `inlineCta`,
`journeyDiagram`, `moduleGrid`, `oldWayNewWay`, `painBlocks`, `personaRouter`, `proofBlock`, `prose`, `scopeBox`

| Block | Fields |
| --- | --- |
| clinicTypes | items list 2–5 of {persona `choice(PERSONAS, req)`, title req, body `md` req, example `md`, href `path` req} |
| contentCards | items list 1–6 of {href `path` req, label, description} |
| featureRows | items list 1–8 of {heading req, body `md` req, bullets list(text req), media `media(optional)`, plan `optionalChoice(PLAN_IDS)`, link `cta(optional)`} |
| hubGrid | groups list ≥1 of {title, items list ≥1 of {href `path` req, label, description, icon}}; columns `int` 2–4 (default 3) |
| inlineCta | body `md` req; primary `cta`; secondary `cta(optional)` |
| journeyDiagram | steps list 4–12 of {label req, body `text` req (plain `z.string()`, not md), href `path`, media optional} |
| moduleGrid | columns `int` 2–4; items list 2–12 of {title req, outcome req, href `path`, icon, media optional, links list of {label req, href `path` req}} |
| oldWayNewWay | old and next: `group` {title req, items list 2–6 (text req), media optional} |
| painBlocks | items list 2–4 of {heading req, body `md` req, fix `md`, href `path`, linkLabel} |
| personaRouter | items list 2–6 of {persona `choice(PERSONAS, req)`, title req, body `text` req, href `path` req, icon} |
| proofBlock | variant `choice(PROOF_VARIANTS, req)`; figures list(text req); testimonial `ref('testimonials')`; badges list of {label req, rating req, count, href `url`}; media optional; body `md`; link `cta(optional)` |
| prose | body `md` req; aside `md`; width `choice(PROSE_WIDTHS, default 'measure')` |
| scopeBox | variant `choice(SCOPE_VARIANTS, default 'isNot')`; items list ≥1 (`md` req); note `md` |

**Group B: tables, lists and sources (13):** `comparisonTable`, `dataTable`, `dayTimeline`, `decisionMatrix`,
`flowDiagram`, `glossaryList`, `postIndex`, `rolesMatrix`, `sourceList`, `splitTable`, `stepList`,
`studyCard`, `vendorList`

| Block | Fields |
| --- | --- |
| comparisonTable | columns list 2–8 of {name req, us `flag(false)`}; rows list ≥2 of {label req, cells list of {value `md` req, source `url`, checkedOn `date`}}; note `md` |
| dataTable | caption; columns list 2–6 (text req); rows list ≥1 of list(`md` req) (nested arrays, **spike** for usability); note `md` |
| dayTimeline | beforeLabel, afterLabel (Zod defaults; empty means default); entries list 3–10 of {time `text` `TIME_24H` req, title req, before `md`, after `md` req, href `path`} |
| decisionMatrix | options list 2–4 of {title req, items list 2–8 (`md` req), us `flag(false)`} |
| flowDiagram | steps list 3–10 of {label req, body `md`, check}; examples list of {country req, body `md` req} |
| glossaryList | terms list ≥10 of {id `SLUG_ID` req, term req, aka, definition `md` req, href `path`, hrefLabel, source `url`} |
| postIndex | topics list of {topic `choice(POST_TOPICS, req)`, heading, intro `md`}; jumpLinksFrom `int` min 2 (default 3) |
| rolesMatrix | roles list 2–7 (text req); rows list ≥2 of {permission req, cells list(`boolOrText`)}; note `md` |
| sourceList | items list ≥1 of {label req, url `url` req, accessed `date` req} |
| splitTable | left and right: `group` {title req, icon, items list 2–10 (`md` req)}; note `md` |
| stepList | steps list 2–10 of {title req, meta, body `md` req}; note `md` |
| studyCard | publication req; figures list(text req); method `md` req; sites `md` req; limits `md` |
| vendorList | vendors list 2–10 of {id `SLUG_ID` req, name req, rank `int` min 1, us `flag(false)`, bestFor req, url `url`, body `md` req, pros list 1–5 (`md`), cons list 1–5 (`md`), facts list of {label req, value `md` req, source `url`, checkedOn `date`}} |

**Group C: data-backed blocks (12):** `addOns`, `contactCard`, `costExamples`, `countryMoney`, `demoForm`,
`integrationDirectory`, `planMatrix`, `pricingCards`, `regulatorStrip`, `regulatorTable`, `testimonialGrid`,
`testimonialRow`

| Block | Fields |
| --- | --- |
| addOns | currency `ref('prices', req)` |
| contactCard | country `ref('countries', req)`; showClients `flag(true)` |
| costExamples | currency `ref('prices', req)`; period `choice(BILLING_PERIODS, default 'annual')`; examples list 1–4 of {title req, doctors `int` min 1 req, locations `int` min 1 (default 1), plan `choice(PLAN_IDS, req)`, note `md`} |
| countryMoney | country `ref('countries', req)`; currency `ref('prices', req)`; payersNote `md` |
| demoForm | country `ref('countries')`; promise `md` |
| integrationDirectory | categories `choices(INTEGRATION_CATEGORIES)`; countries list(text req); filters `flag(true)` |
| planMatrix | open `flag(false)` |
| pricingCards | currency `ref('prices', req)`; switcher `flag(false)`; showConditions `flag(true)`; planCta `cta` (description explains `{plan}`); enterpriseCta `cta` |
| regulatorStrip | regulators `refs('regulators', 2–8)`; link `path` (empty means `/trust/`) |
| regulatorTable | countries `refs('countries')`; regulators `refs('regulators')`; showClinicMustDo `flag(true)`; trustLink `flag(true)` |
| testimonialGrid | filters `flag(true)`; only list(text req). This could become `refs('testimonials')` (same stored shape), but only if it is added to the parity allowlist. |
| testimonialRow | items `refs('testimonials', 1–3)`; layout `choice(TESTIMONIAL_LAYOUTS, default 'row')`; usePullQuote `flag(true)` |

Group C is lighter. If the groups need balancing, C can also take `keystatic/collections/data.ts`, which is
also reference-heavy.

## 7. Tests

All tests run under the existing `unit` vitest project. `getViteConfig` resolves `astro:content`. Verified: a
scratch vitest run imported `src/schemas/families.ts` and parsed `features/emr.yaml` with a stub
`SchemaContext`.

### 7.1 Parity: `tests/unit/keystatic-parity.test.ts`

The Zod schemas are built with:
- `ctx = { image: () => z.string().meta({ ec: 'image' }) }`;
- `vi.mock('astro:content')`, whose `reference(c)` is Astro's own `createReference()(c)` (from
  `astro/content/runtime`) tagged with its collection. The behaviour is unchanged, but the collection name
  becomes visible.

The test walks the Zod tree (Zod 4 `_zod.def` for structure; `_zod.bag` for `minimum`, `maximum`, `patterns`
and `format`) against the Keystatic tree plus `FIELD_META`. It asserts:
- `Object.keys(KS_BLOCKS)` equals `BLOCK_NAMES`, and no block is a stub.
- For every block, the `value` key set equals the Zod key set (`blockBase` included), and each key has a
  compatible kind. Compatible kinds are the table in 2.3; any other pairing fails and names the path.
- The page base plus each family extension has the same keys, and `sections` offers exactly
  `FAMILY_BLOCKS[family]` for each of the 21 collections.
- Every data collection and singleton matches its schema the same way.
- Every enum is compared: options (sentinels removed) equal `schema.options` in the same order, and the
  select default equals the Zod default.
- String length and pattern checks, array lengths and number bounds are equal.
- Nullable keys map to `unknown*` or `preserved`, and nothing else maps to them.
- Optional objects map to `optionalGroup`, with `presentIf` equal on both sides.
- Relationship collections equal the reference collection.
- Record key lists equal the keys in the data files.
- Blocks with `media` are absent from the `guide`, `post` and `legal` lists.
- Every Astro collection except `redirects` and `gone` has a Keystatic counterpart.

**Critique: ways this test could pass while the two sides drift, and the fixes.**
- **`FIELD_META` only records what a helper says it built.** If a helper records `max: 48` but never passes it
  to `fields.text`, parity still passes. Read everything Keystatic exposes from the real field objects:
  `options` on select and multiselect, `validation.length` on arrays, and `defaultValue()` on every form field.
  Use `FIELD_META` only for what is hidden in closures (text length and pattern, relationship collection,
  wrapper kind), and check those by behaviour. For each leaf, run a set of probe values through both
  `field.validate(field.parse(x))` and the Zod leaf, and require the same accept/reject result. The probes are
  empty, `min − 1`, `min`, `max`, `max + 1`, one real value from the data and one value that breaks the pattern.
- **Required keys.** For every Zod key that is required and has no default, the Keystatic field's empty value
  must fail Keystatic validation. Otherwise the key is omitted on save and the build breaks (2.2 `text`).
  Comparing min lengths alone misses this, because `z.string()` and a non-required `text` both have min 0.
- **Defaults beyond selects.** Checkbox and integer `defaultValue()` must equal the Zod default. For example,
  `contactCard.showClients` defaulting to `false` in Keystatic would write `false` into every new block.
- **No untracked leaves.** A leaf without `FIELD_META` fails the test, and a source scan fails if `fields.*` is
  called anywhere under `keystatic/` except `keystatic/fields.ts`.
- **Record keys in order, not just as a set.** `Footer.astro` renders `Object.entries(site.social)`, so the
  order of `SOCIAL_KEYS` is the icon order on every page.
- **Slug patterns** (section 1) and **nullable keys with a default** (2.4) are checked explicitly.

### 7.2 Round-trip: `tests/unit/keystatic-roundtrip.test.ts`

1. **Reader.** `createReader(repoRoot, keystaticConfig)` from `@keystatic/core/reader` (node build) runs
   `.all()` for every collection and `.read()` for every singleton, with no errors. The ids it lists equal the
   Astro ids (the file names found by the same globs as `content.config.ts`).
2. **Reader → Zod.** Normalise each read entry:
   - drop keys whose value is `''`;
   - drop `null` unless the field is `unknown*` or `preserved`;
   - remove the MDX `body`;
   - leave dates as strings.

   Parse with the family or data schema. For every entry whose source file passes Zod, the result must pass
   and deep-equal the Zod output of the raw file (the build path). Entries that fail in the source are listed,
   not compared; published ones already fail the build.
3. **Simulated save.** For every managed file, run each form field's own `parse` then `serialize`. The object,
   array and conditional rules are copied from 0.6.9's `serializeProps`: drop `undefined` in objects, write
   `null` for `undefined` in arrays, emit `{discriminant, value}`. Then `js-yaml` `dump` and `load`. Assert:
   - the Zod output equals the original's;
   - every `null` in the original that belongs to an `unknown*` or `preserved` field is still `null`;
   - no `boolOrText` string equals `yes` or `no`.

   Step 5.4 reuses this code for the normalisation commit.

**Critique: additions to the round-trip test.**
- **Coverage.** Real data never sets many keys: `schemaExtras`, `claimsReview`, `canonical`, `reviewedBy`,
  non-empty `redirectFrom`, `heroMedia.src`, `editorNote`, most optional block fields. A clean round trip over
  `src/content` proves nothing about them. Add `tests/fixtures/keystatic/`, a Keystatic-shaped tree with one
  maximal entry per family and data collection (every optional key set, `unknown*` keys both `null` and set) and
  one minimal entry. The reader and the save simulation run over it as well as over the real tree.
- **The simulation is a copy of Keystatic's code.** `serializeProps`/`parseProps` are not exported, so the test
  re-implements them. It records the version it was verified against and fails if the installed
  `@keystatic/core` differs. Spike check 6 (section 9) compares, byte for byte, a real admin save of
  `kitchenSink` and one country page with the simulated output.
- **Images.** The harness looks up assets as Keystatic does (`<directory>/<slug>/<src minus prefix>`) and passes
  the result to `image.parse`. A `src` outside the convention then shows up as a dropped key (2.3).
- **Raw-YAML consumers.** Assert that `auditEntry` issues on the raw file are equal before and after the save
  (2.5), and that the dumped YAML contains no `&ref_`/`*ref_` aliases (2.2 `choices`).

**What cannot be made equal, and how the tests tolerate it:**

| Difference | Handling |
| --- | --- |
| Cross-field Zod rules: the publish rules engine (`definePage` `superRefine`), `dataTable` and `rolesMatrix` row length, `comparisonTable` and `vendorList` sourcing and "Check" ban, `glossaryList` duplicate ids and 40–120 words | Zod-only. The parity test counts custom checks per path and requires each to be in a `ZOD_ONLY` allowlist, so a new refinement has to be acknowledged. Writers see these rules in the dev preview toolbar and in the build. |
| Keystatic is stricter: unknown keys, date-only dates, required select choice | The reader pass fails on real data. ~~Nothing in the current data triggers these.~~ **Critique:** `kitchen-sink.yaml` does, with three stray keys from unquoted commas in flow mappings (2.3). Fix the data first. **Fixed:** the three values are quoted; `PENDING_DATA_FIXES` is empty. |
| Keystatic is looser: `url` accepts relative URLs; `num` min 0.01 against `positive` | Zod is authoritative. Parity notes the pairing. |
| Formatting: key order, block style, folding, quoting, `[]` for defaulted arrays, explicit `false` or default selects, `{}` or default-only optional groups | Compared after the Zod parse (defaults and `optionalGroup` make them equal). |
| Records against fixed-key groups | Key lists are compared with the data. |
| `preserved()` fields (`internalSource`, `schemaExtras`) | Round-tripped byte-equal. Excluded from form parity. |
| MDX body | Not compared here; `keystatic-mdx-bodies.test.ts` saves every body (7.4). |
| Images | `media.src` is compared as a string path. There are no images yet **(spike)**. |

### 7.3 Field helpers: `tests/unit/keystatic-fields.test.ts`

- `unknown*` reads `undefined` as empty and writes `null`.
- `optionalChoice` omits its sentinel. `choice({ required })` fails validation on `__choose__`.
- `boolOrText` maps both ways.
- `unknownList` handles `null`, `[]` and lines.
- The Zod `optionalGroup` accepts absent, `{}` and default-only objects as `undefined`, and rejects a partly
  filled group.
- `unknown()` rejects `''`. `isoDate` rejects a time.

### 7.4 MDX body audit: `tests/unit/keystatic-mdx-bodies.test.ts`

This parses every guide, post and legal body with the same mdast stack Keystatic uses. Add
`mdast-util-from-markdown`, `micromark-extension-mdxjs`, `mdast-util-mdx` and the GFM table, strikethrough and
autolink packages as dev dependencies, in Keystatic's ranges. It asserts:
- only node types that `mdxToProseMirror` maps;
- heading depth 2 to 5;
- JSX only `InlineCta`, as a flow element with block children;
- no expressions, ESM or html;
- **Critique:** no `inlineCode` or `code`, because code is off in the editor options and those nodes go to
  `notAllowed`. None exist today;
- table alignment only in the two known files (listed).

The reader cannot catch editor-parse failures, so this test is the automated guard that every body opens in
Keystatic.

**As built (26 September 2026): a real save, not a node-type audit.** The browser build of `@keystatic/core` (its
`exports["."].default`, the build the admin runs) loads in Node, and its `fields.mdx` field has the real parser and
serializer; the Node build's body parse is an empty stub. So instead of re-implementing the checks above, the test
builds the body field from the exact `mdxBody()` config (`FIELD_META`), opens each body with it and saves it without
edits, as the admin does. For every guide, post and legal body it asserts:
- the editor opens the body (this covers every node type, heading, JSX, expression and code rule above at once,
  because the editor's own parser raises them);
- the saved body keeps every word, link (URL and title) and InlineCta prop, read with Keystatic's mdast stack;
- Astro renders the saved body with the same words, links and InlineCta props: the same comparison through satteri,
  the engine `@astrojs/mdx` compiles bodies with, with GFM and smart punctuation on as the build has them;
- a save drops table alignment only on a right-aligned column whose cells are all amounts, which PostTable
  right-aligns anyway (`numericColumns`, `src/lib/content/post-table.ts`); today the three pages listed in 2.8.

It does not compare formatting. A last group of tests pins the list of changes in 2.8 against the installed serializer
(each change, that a second save changes nothing, that a link title, an image or a footnote would be lost, and what the
editor refuses to open), so an upgrade that changes any of it fails there first; `KEYSTATIC_CORE_VERIFIED` fails before
that. Tolerated: a one-line `<InlineCta>` (the editor cannot open it; the body is checked on a copy converted to the
multi-line form, whitespace only, and listed as a `todo`), and uncommitted draft posts, as in 7.2. Any other reason a
body does not open fails.

### 7.5 Output and e2e

- `tests/output/vercel-config.test.ts`: when the manifest stage is `production`, assert no route matches
  `^/(api/)?keystatic`, no function bundles `@keystatic`, and no `_astro/*.js` contains React DOM.
- `tests/e2e/keystatic.spec.ts` (opt-in, `KEYSTATIC_E2E=1`): build with `KEYSTATIC_STORAGE=github`, a dummy
  repo and dummy secrets, serve with `scripts/serve-output.ts`, open `/keystatic/`, and expect the GitHub login
  screen with no CSP violations or console errors (same watcher as `csp.spec.ts`). Also check that the policy
  header's `script-src` has no `'unsafe-inline'`.
- Comment guard (section 5.3) in `lint-content` and a unit test.

## 8. Writer-facing behaviour worth documenting in `docs/content-guide.md`

- Keystatic checks structure only: required fields, lengths, patterns and list sizes. The publish rules
  (banned words, placeholders, facts that need confirming) appear in the preview toolbar after saving in dev,
  and block the build for published entries.
- An empty field in an "unknown" slot saves as `null`. The page shows a placeholder and cannot publish.
- Renaming an entry changes its URL or id. Add a `redirectFrom`, or fix references.
- Saving reformats the file. It never changes what the page says.

## 9. Spike checks before the groups start (in `astro dev`, local mode)

Astro 7 allows one dev server per project; one was already running on :4321 while this was written. Reuse it
or stop it first. Then check:
1. `/keystatic/` loads. A save to `kitchenSink` works through the dev slash redirect (3.3). Refreshing a deep
   admin URL works (Keystatic issue #1042). **Critique:** the source already answers this check: the redirect
   fails (3.3). Check the dev *rewrite* instead: refresh `/keystatic/collection/posts` and
   `/keystatic/collection/posts/item/<slug>`, and save through `/api/keystatic/update`. Every spike save
   strips comments, so run the spike in a scratch worktree and throw it away.
2. A save of a page with `null` facts keeps `null` (2.4). An untouched optional group saves as `{}` and the
   page still builds (2.5).
3. A guide opens in the MDX editor with the flow-form `InlineCta`, and Astro renders the flow form correctly
   (2.8).
4. Nested lists (`dataTable.rows`, `rolesMatrix.rows[].cells`) are usable.
5. `fields.image` with the relative `publicPath` round-trips a screenshot for a YAML page and for a guide.
6. **Critique (new):** save `kitchenSink` (after its data fix) and one country page with no edits, then diff each
   written file against the round-trip simulation's output. They must be byte-identical (7.2).

If check 1 fails because of the client router, the fallback is to keep the redirect for `/api/keystatic/*`
and rewrite, rather than redirect, `/keystatic/*` in dev. On Vercel, add a route in `routes-core.ts` ahead of
the adapter's slash redirect for the admin paths. **Critique:** this is no longer a fallback. It is the plan
(3.3). On the preview deployment, also check that the GitHub OAuth callback keeps its `code` and `state` query
through the routes.

## 10. Track 0 as built (26 September 2026)

What exists now, and where it differs from the sections above.

- **Files.** `keystatic.config.ts`, `keystatic/fields.ts`, `keystatic/page-base.ts`,
  `keystatic/collections/{pages,data,singletons}.ts` (singletons live under `collections/`, not `keystatic/singletons.ts`),
  `keystatic/blocks/index.ts` plus 38 block files, `integrations/keystatic-{gate,core,middleware}.ts`, and the pure modules
  `src/schemas/{patterns,family-blocks,groups}.ts`. `groups.ts` holds every `presentIf` list and
  `blankGroupsToUndefined`; `src/schemas/fields.ts` re-exports the latter.
- **Zod side done:** lifted enums and `UNRENDERED_KEYS` (walk, tokens, report-facts), `patterns.ts`, `family-blocks.ts`
  (families.ts reads it; sections.ts asserts the block lists match), `unknown()` rejects `''`, `isoDate` is date-only,
  `optionalGroup` / `optionalCta` / `optionalMedia` in the page base, nav and the six block schemas, `editorNote` on
  `blockBase`, `notes` on the data schemas and the facts, plans and nav singletons, `paymentMethods` `.min(1)`,
  `blankGroupsToUndefined` in lint-content and report-facts, and the InlineCta usage comment. The three
  `kitchen-sink.yaml` quotes landed on 26 September 2026. Not done, because each needs a `src/content` edit: the comment
  migration (the round-trip test lists the 85 files as todos, section 5), the InlineCta codemod (the body test lists
  the 67 bodies it blocks as todos, 2.8) and the normalisation commit.
- **Block stubs.** `todoBlock(name)` is `fields.ignored()` as the block's value schema: a page using a stubbed block
  opens and saves with that section's value unchanged, and the item shows "(form not built yet)".
  `tests/unit/keystatic-config.test.ts` lists stubs as `todo`.
- **Writing a block (groups A to C).** Replace the stub file only:

  ```ts
  import { defineBlock, group, list, md, path, text } from '../fields.ts';

  export const painBlocks = defineBlock('painBlocks', 'Pain points', {
    items: list(
      group('Pain point', { heading: text('Heading', { required: true }), body: md('Body', { required: true }), fix: md('Fix'), href: path('Link'), linkLabel: text('Link label') }),
      { label: 'Items', min: 2, max: 4, itemLabel: (props) => props.fields.heading.value || 'Pain point' },
    ),
  });
  ```

  Import every helper from `keystatic/fields.ts` (the config test fails if anything else imports `fields`), enums from
  `src/schemas/constants.ts`, patterns from `src/schemas/patterns.ts` and `presentIf` lists from `src/schemas/groups.ts`.
  Keys in the same order as the Zod schema.
- **Helper details.** Optional fields with a pattern or a minimum length validate as `^$|<pattern>` (not `^(?:…)?$`,
  which breaks prefix-only patterns such as `EXTERNAL_HREF`). `choice(…, { initial })` and `flag(…, { initial })` are for
  required values with no Zod default (`status`, `site.name`, `study.publications[].peerReviewed`); `zodDefault` is only
  for real Zod defaults. `record()` builds the fixed-key groups. MDX bodies have images off until spike check 5.
- **Gate.** `@astrojs/react` and `@keystatic/astro` are imported statically: the Vite module runner that loads
  `astro.config.ts` is closed by the time hooks run, so a dynamic import inside the hook fails. Nothing is added unless
  the decision says so, and `tests/output/keystatic-absent.test.ts` checks the built output.
- **Dev rewrite.** A `/keystatic/…` path whose last segment has a file extension is not rewritten: Vite serves this repo's
  `keystatic/*.ts` modules at `/keystatic/fields.ts` and so on, and the admin loads them from there.
- **Verified in `astro dev` (curl, no browser):** every admin URL returns the admin HTML, `/api/keystatic/tree` (with
  Keystatic's `no-cors: 1` header) and `/api/keystatic/blob/…` answer through the slashless URLs, and the client modules
  (`keystatic.config.ts`, `keystatic/*`, the pure schema modules, the optimised Keystatic and React deps) all load. Spike
  checks 1 to 6 still need a browser.
