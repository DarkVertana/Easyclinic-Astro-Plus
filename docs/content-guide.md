# Writing and publishing pages

For writers and editors working on the EasyClinic website. The full rules are in the handoff spec
(`docs/spec/easyclinic-website-rebuild-handoff_1.md`), sections 2 and 6. This page covers how those rules
work in practice on this site.

## Where things live

| What | Where |
| --- | --- |
| A page | `src/content/<type>/<name>.yaml`: one file per page. The file name becomes the URL unless the page sets `path`. |
| Prices | `src/data/prices/<currency>.yaml`: change a price once and every page that shows it updates. |
| Plan names and what each plan includes | `src/data/plans.yaml` |
| Compliance status per regulator | `src/data/regulators/<country>-<name>.yaml` |
| Country contacts, payments, insurers | `src/data/countries/<code>.yaml` |
| Numbers the site states (doctors, cities, ratings) | `src/data/facts.yaml` |
| Study figures and citations | `src/data/study.yaml` |
| Testimonials (verbatim) | `src/data/testimonials/<name>.yaml` |
| Authors | `src/data/authors/<name>.yaml` |
| Old URLs that move | `src/data/redirects.yaml`, or `redirectFrom` on the page itself |

## Guides and posts (MDX)

Start-a-clinic guides live in `src/content/guides/<slug>/index.mdx`, where the folder name is the URL, with any
images beside the file. The frontmatter uses the same page fields as every other page; the body is Markdown. Two
things differ from YAML pages: tokens such as `{price:...}` only work in the frontmatter (write plain values in the
body), and a literal `{` or `}` in the body must be written `\{` or `\}`. Put one call to action after the licensing
section:

```mdx
<InlineCta heading="Setting up? Get the software sorted before the first patient." href="/kenyademo/" label="Book a 20-minute demo">
One or two sentences.
</InlineCta>
```

`node scripts/import-wp.ts <slug>` imports a post from the live WordPress site as a draft guide.

## A page's status

Every page has `status: draft`, `review` or `published`.

- **draft** and **review** pages appear on preview deployments only, marked noindex, with a toolbar in the
  bottom-left corner listing everything that stops the page from being published.
- **published** pages go to the live site. A published page that breaks a rule stops the whole build, so
  mistakes are caught before they go live, not after.

## Unknown facts

Never guess a price, a status, a date or a number. Write the sentence and leave the fact in square brackets:

```yaml
openingAnswer: It costs [KES price] per doctor per month, and SHA e-claims are [status as of date].
```

In shared data, write `null`. Preview pages highlight both in yellow. `pnpm facts:report` lists every open
item by owner in `reports/facts-report.md`; that report is the fact sheet to send to the company.

## Tokens: facts that live in one place

Use a token when a sentence quotes a price, a contact or a figure, so it can never go out of date:

| Token | Renders |
| --- | --- |
| `{price:inr.professional.annual}` | ₹1,499 |
| `{price:usd.premium.quarterly}` | $129 |
| `{fact:doctors}` | 5,000+ |
| `{fig:visits}` | 39,849 |
| `{contact:ke.phone}` | +254 750 184 357 |

Plan prices must always be tokens. Research and outcome figures (the Penda Health study, the claims and
stockout numbers) must come from `study.yaml` through `{fig:...}`. The build rejects them written as text,
because several of those figures do not yet have a public source.

## What the build checks on every page

- Title 60 characters or fewer; meta description 155 or fewer.
- The opening answer, a named author (never "EasyClinic Team") and a last-updated date.
- One proof block that belongs to this page, and no more than three testimonials.
- Five to eight FAQs (eight to ten on country pages), each answered in a full sentence, or no FAQ.
- None of the banned words (seamless, streamline, empower, robust, comprehensive, leverage, cutting-edge,
  holistic, elevate, unlock, hassle-free, one-stop, end-to-end, revolutionise, next-generation,
  state-of-the-art, "modern clinics").
- No "confirm in demo", "in progress" or "coming soon" in place of an answer.
- "EasyClinic" as one word; the AI features are "Cura AI" and the clinical copilot is "CuraPilot".
- No exclamation marks. Headings in sentence case. CTA labels that say what happens.
- The editor's two-question pass (spec 6.5), recorded in `editorialPass`.

Quotes in `quote` fields are exempt from the vocabulary rules because they are verbatim.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local preview at http://localhost:4321 |
| `pnpm lint:content` | Checks every page against the writing rules in about a second |
| `pnpm facts:report` | Lists every missing fact, grouped by who must supply it |
| `pnpm build` | Full preview build with the post-build checks |
| `pnpm build:prod` | Production build: published pages only, every rule strict |
