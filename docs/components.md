# Component conventions

How the EasyClinic site's components are built. Read this before adding or changing a block.
The requirements behind these rules are in `docs/spec/easyclinic-website-rebuild-handoff_1.md`
(sections 7.1 to 7.7 and 11); section numbers below refer to that document.

## Pages are data

Every page is a YAML entry in `src/content/<collection>/`. Its `sections[]` list is a sequence of typed
blocks stored as `{ discriminant, value }`, the shape Keystatic's `fields.blocks` writes. Writers compose
pages from blocks; they never edit components. Templates own the fixed frame around the sections:
breadcrumbs, hero, byline, FAQ, related links, closing band and JSON-LD.

## Anatomy of a block

```
src/components/blocks/<Name>/
  schema.ts     export const schema = (ctx?) => block('<discriminant>', { ...fields })
  <Name>.astro  the component
```

- The discriminant is the camelCase block name (`pricingCards`, `regulatorTable`).
- `schema.ts` uses `block()` from `src/schemas/block-base.ts`, which adds the shared fields `id`,
  `eyebrow`, `heading`, `intro` (markdown) and `tone` (`plain`, `wash`, `inverse`).
- Register the schema in `src/schemas/sections.ts` and the component in `src/components/blocks/registry.ts`.
  Add its name to `BLOCK_NAMES` and allow it for the page families that use it in `src/schemas/family-blocks.ts`
  (`src/schemas/families.ts` builds the page schemas from those lists).
- Add its Keystatic form in `keystatic/blocks/<discriminant>.ts` with `defineBlock()` and list it in
  `keystatic/blocks/index.ts`, in the same order. `tests/unit/keystatic-parity.test.ts` compares every key with the Zod
  schema, and `keystatic-roundtrip.test.ts` saves a filled-in and an untouched block.
- Component props are the section value plus `ctx`:

```astro
---
import type { SectionValue } from '../../../schemas/sections';
import Section from '../../ui/Section.astro';
import { toneFor, type BlockContext } from '../types';

type Props = SectionValue<'stepList'> & { ctx: BlockContext };
const { id, eyebrow, heading, intro, tone, steps, ctx } = Astro.props;
---
<Section id={id} eyebrow={eyebrow} heading={heading} intro={intro} tone={toneFor(tone, ctx.index)}>
  ...
</Section>
```

`src/components/blocks/Prose`, `StepList`, `TestimonialRow` and `ProofBlock` are the reference blocks.

The blocks, by use: page body (`prose`, `featureRows`, `painBlocks`, `moduleGrid`, `dataTable`, `scopeBox`,
`splitTable`, `rolesMatrix`, `dayTimeline`, `flowDiagram`, `journeyDiagram`, `oldWayNewWay`, `personaRouter`,
`clinicTypes`, `hubGrid`, `contentCards`, `inlineCta`, `stepList`, `glossaryList`, `postIndex`); company (`peopleGrid`);
proof (`proofBlock`, `testimonialRow`, `studyCard`, `testimonialGrid`, `logoStrip`); money (`pricingCards`, `planMatrix`, `addOns`, `costExamples`,
`countryMoney`); country and compliance (`contactCard`, `regulatorTable`, `regulatorStrip`); comparison
(`comparisonTable`, `decisionMatrix`, `vendorList`, `sourceList`); conversion (`demoForm`). Which families may use which
blocks is set in `src/schemas/family-blocks.ts`.

Comparison blocks carry their evidence: every competitor cell in `comparisonTable` and every competitor fact in
`vendorList` needs a `source` URL and a `checkedOn` date (or reads "Not published"), and "Check" is not an answer. `sourceList` renders the
sources at the foot of the page. `testimonialGrid` filters by clinic type and country with CSS only (radio inputs and
`:has()`), so every card stays in the HTML.

`postIndex` (hub family; used on `/blog/`) takes no list of links: it reads the registry and lists every post and
start-a-clinic guide rendered in the stage, grouped by topic and newest first, with title, summary, last-updated date
and reading time (helpers in `src/lib/content/posts.ts`). Content sets only an optional heading and intro per topic
(`topics[]`) and `jumpLinksFrom`, the number of topic groups at which a row of "jump to a topic" links appears.
Topics with nothing to show are left out, so in production it shows only what is published. Topic headings are h2
(h3 when the block has its own heading) and entry titles one level below; each row is one tap target through the
title link's `::after`. No JavaScript. Drafts in preview carry a "Draft" or "In review" label.

`logoStrip` (home, customers, solution and countryDemo families) shows client logos from `src/data/clients`: the
listed `clients` in order, or every client by name, optionally only those whose `country` matches the block's
`country`. Logos sit in white tiles, greyscale until hovered, each with `alt` set to the client's name. Each is sized by
area (about 4,000 square pixels inside a 128 x 48 px box), so a square mark and a long wordmark carry the same weight,
and each file is trimmed to its mark with a small even margin (docs/image-plan.md 3.2). It
has no links, no count, no rating and no "trusted by" wording (docs/image-plan.md 7). Production shows a client only
when `logoPermission` is `true` and its logo file exists; preview shows the others with a note saying what is
missing. A strip with nothing left to show in production renders nothing, so a pending permission never blocks a page.

`peopleGrid` (company family; the /about-us/ leadership section) takes `items: [{ author, background }]`. The photo,
name and role come from the author record in `src/data/authors`; `background` is written for the page. A missing
photo shows a placeholder note in preview and is simply left out in production.

**Optional versus required facts.** `need()` is for a fact the page cannot honestly go without (a price, a regulator
status): it blocks publishing. `optional()` is for a detail that can be left out (a testimonial's city, a review
count, office hours): preview shows a placeholder, production omits it.

## Building blocks to reuse

| Import | Use |
| --- | --- |
| `ui/Section.astro` | Every block's outer `<section>`: container, heading (h2), intro, tone background. Props `width="measure"` for reading width, `center` for centred headers. |
| `ui/Md.astro` | Any markdown string from content (`md` fields): `<Md text={body} />`, `<Md text={x} inline />`. Resolves internal links through the registry (hidden when unpublished in production). |
| `ui/Icon.astro` | `<Icon name="circle-check" size={18} />`. Names must be in `ui/icons.ts` (Lucide) or `brand-*` (Simple Icons). Decorative by default; pass `label` for meaningful icons. |
| `ui/Button.astro` | CTA links: `<Button href label variant="cta|solid|outline|ghost" event? track? />`. Adds analytics attributes. |
| `ui/StatusChip.astro` | Four-state compliance or three-state integration status with text label, icon shape and as-of date. `null` state renders a placeholder. |
| `ui/Screenshot.astro` | Media objects from content: framed product screenshot, or a visible "screenshot needed" placeholder. Never stock photos. The frame is only as wide as the file (up to the column), so a small crop is never stretched. An `origin: old-site` screen without `uiConfirmedOn` carries an "Interim capture, {month}" note in preview; `lint-content` warns about it (`interim-media`) but the page can publish (docs/image-plan.md 3.1). |
| `ui/Quote.astro` | One testimonial (name, role, clinic, city, tenure) and, once `photoConsent` is `true`, the person's photo: a round 56px headshot (72px in the large layout). A photo still waiting on consent is never rendered: preview shows a note, production leaves it out. |
| `frame/AuthorByline.astro` | "By {name}, {role} · Last updated". Shows the author's 32px round photo first when the author record has one. |
| `lib/content/need.ts` | `need(Astro, label, value)` for facts from shared data that may be `null`; `unconfirmed(Astro, label, value, confirmed)` for values that exist but are not cleared to publish. Both render highlighted placeholders in preview and fail published pages in production. Never print a null or invent a value. |
| `lib/format/money.ts` | `formatMoney(amount, currency)` and `annualSaving(annual, quarterly)`. |
| `lib/format/date.ts` | `formatDate(date)` for visible dates, `isoDate(date)` for `datetime` attributes. |
| `lib/content/registry.ts` | `const registry = await getRegistry(); registry.urlFor('/x/')` returns the href or `null` if the page is not rendered in this stage. Use it for every internal link that is not inside `Md`. |

Shared data: `getEntry('countries', id)`, `getEntry('prices', 'inr')`, `getEntry('plans', 'plans')`,
`getEntry('facts', 'facts')`, `getEntry('study', 'study')`, `getCollection('regulators')`,
`getEntries(refs)` for reference arrays. Schemas are in `src/schemas/data.ts`.

## Design tokens (Tailwind v4, `src/styles/global.css`)

- Semantic colours (prefer these): `bg-surface`, `bg-surface-alt` (light blue wash), `bg-surface-muted`,
  `bg-surface-inverse`, `text-ink`, `text-ink-heading`, `text-ink-muted`, `text-ink-inverse`,
  `text-ink-inverse-muted`, `border-line`, `border-line-strong`, `text-link`, `bg-cta`/`text-cta-ink`,
  `bg-btn`/`text-btn-ink`, `text-success`/`bg-success-bg`, and the same for `warning`, `danger`, `info`,
  plus `text-journey` for the teal journey line.
- Brand scale: `blue-50/100/200/500/600/700/800`, `navy-900/950`, `teal-50/500/700`, `amber-100/400/500`,
  `coral-500`, `star`, `grey-50/100/200/400/600/900`, `green-*`, `yellow-*`, `red-*`, `whatsapp`.
  There is no default Tailwind palette.
- Contrast rules: `blue-500` and `teal-500` are for decoration and large text only. Body links use
  `text-link` (blue-600). White text sits on `blue-700` or darker. Amber and coral backgrounds take navy text.
- Type: headings use `font-display` (Fraunces) automatically; body is Inter. Use `font-sans` on small
  headings inside cards if the serif looks heavy. Sentence case everywhere.
- Layout: `container-page` (1200px), `container-measure` (720px), `section-y` for section padding.
  Breakpoints `sm` 640px, `md` 960px, `lg` 1200px. Mobile first. 8px grid (Tailwind spacing steps of 2).
- Components: `.card` (12px radius, 1px border, no shadow), `.btn` + `.btn-cta|solid|outline|ghost`,
  `.eyebrow`, `.lede`, `rounded-card`, `rounded-control`.

## Rules every component follows

1. **Everything in the HTML.** No client-side rendering of copy. Tabs, accordions and switchers keep all
   content in the DOM (spec 7.1). Prefer `<details>` and CSS (`:has()`, radio inputs) over JavaScript.
2. **No motion** except hover states, accordions and the switcher. No scroll-reveal (section 11).
3. **Tables stack into cards below 640px.** Use `<table>` with `data-label` on cells and CSS that turns
   rows into cards under `sm`, keeping `role` attributes so screen readers still read a table. Never a
   horizontal scroll, except the plan matrix, which gets a labelled, focusable scroll region and a visible hint.
   Markdown tables in long-form MDX (posts, guides and legal pages, all rendered by `src/templates/GuidePage.astro`)
   stack the same way: GuidePage maps `table` to `src/components/mdx/PostTable.astro`, which adds the roles and
   gives each body cell its column header as `data-label` (`src/lib/content/post-table.ts`). Every Markdown table
   therefore needs a header row with a label in each column (a cell under an empty header gets no label), and a
   column aligned with `---:` reads from the left once stacked.
4. **Accessibility (WCAG 2.2 AA).** Labels on every control, visible focus (global), 44px tap targets,
   status carries text not just colour, headings in order (blocks use h2 via `Section`, then h3).
5. **No invented facts.** Anything from shared data that can be `null` goes through `need()` or
   `unconfirmed()`. Never hard-code a price, a regulator status, a count or a name in a component.
6. **Links**: plain `<a>` elements with descriptive text; internal hrefs through `registry.urlFor()`.
7. **JavaScript**, when unavoidable: a `<script>` in the component importing a file from `src/scripts/`,
   progressive enhancement only, a few hundred bytes. Analytics use `data-track="<event>"` and
   `data-label` attributes; `src/scripts/track.ts` picks them up.
8. **Images** through `astro:assets` (`Screenshot.astro` does this) with width, height and alt. Only hero media loads
   eagerly (`priority`); every other image, the byline photo included, is `loading="lazy"`. Small fixed-size images
   (headshots, logos) use `<Image layout="fixed">` so they get a 1x and 2x file at exactly the displayed size;
   headshots add `fit="cover" position="top"` and `alt` set to the person's name. Never stock photos, and never a generated or stock person presented as a customer or a member of staff
   (spec 12). An image that shows a rating, an award, a certification or compliance badge, an uptime or outcome figure
   or a partner's logo is a claim and needs the same evidence as the text would (`docs/briefs/page-writing-rules.md`).
   Product screenshots show demo data only.
9. **Screenshots** live in one shared library, `src/assets/images/screens/<descriptive-name>.<ext>` (lowercase,
   hyphenated), so one screen can serve several pages. `media.src` is written `../../assets/images/screens/<name>.png`
   from a YAML page (`../../../` from an MDX entry) and carries `origin`, `capturedOn` (YYYY-MM) and, once the company
   confirms the screen, `uiConfirmedOn`. Keystatic edits `src` as a path into that folder (`imagePath` in
   `keystatic/fields.ts`), because its own image field would copy and rename the file per entry.
10. **Image files for shared data** sit where Keystatic stores them, `<directory>/<entry id>/<field>.<ext>`:
    `src/assets/images/people/<id>/photo.<ext>` for testimonial and author photos and
    `src/assets/images/clients/<id>/logo.<ext>` for client logos, written in the YAML as
    `../../assets/images/people/<id>/photo.jpg`. Keystatic looks a file up only there and renames it to the field's
    name on save, so a file anywhere else opens as empty in the editor and the next save drops the key.
    `tests/unit/keystatic-config.test.ts` checks every `photo` and `logo` value, and that the file exists.
