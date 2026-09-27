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

### Blog posts

Posts live in `src/content/posts/<slug>/index.mdx` and keep their WordPress URL at the root of the site
(`/clinic-cash-flow/`). They work like guides, with three extra frontmatter fields:

| Field | What it holds |
| --- | --- |
| `topic` | Where `/blog/` lists the post: `switching-to-emr`, `running-a-chain`, `compliance-by-country`, `cura-ai`, `billing-and-claims`, `patient-engagement`, `start-a-clinic` (spec 5.19), or `running-a-clinic` for day-to-day operations (pharmacy, lab, reports) |
| `owner` | The landing page the post feeds, as a path (`/features/billing/`). Required: every post is owned by a landing page (spec 3.6). `/blog/` lists posts but cannot own one; a post owned by `/blog/` cannot be published. |
| `originallyPublished` | The date the post first went live on WordPress (imported posts only); it becomes `datePublished` in the Article markup |

Set `links.hub: /blog/` for the breadcrumb. The page shows the topic above the H1, the author, the last-updated
date and the reading time (about 200 words a minute, rounded up), the `summary` in an "In short" box when it adds
something to the opening answer, and a labelled link to the owner page once that page is live. A post carries an
FAQ only when it has real questions: three to eight, or none.

**The blog index.** `/blog/` (`src/content/hubs/blog.yaml`) lists every post and every start-a-clinic guide
(guides whose hub is `/start-a-clinic/`) by topic, newest first by last-updated date, with the summary and reading
time. The list is built from the pages, so publishing a post adds it; nobody edits the list. Only published entries
appear on the live site, and a topic with nothing published is left out. `/rss.xml` carries the newest 50
published posts and guides: the entries `/blog/` lists, plus any guide it does not (such as the EMR-versus-paper
guide under `/compare/`, filed under "Guides"). The old WordPress feed `/feed/` redirects there.

**Importing the kept posts.** `node scripts/import-wp.ts --from-manifest` imports every row of
`migration/posts-manifest.csv` whose `proposed_decision` is `keep` as a draft post: no author, the owner from
`owner_page`, the topic from the owner (the mapping is at `TOPIC_BY_OWNER` in `scripts/lib/wp-convert.ts`), and a
note that the post needs the spec 5.18/5.19 refresh. A post the manifest gives to `/blog/` has no landing page to
take a topic from, so its topic comes from its slug and title (`TOPIC_BY_KEYWORD`, same file) and its note says the
topic is provisional; check it when marketing names the owner. It skips paths that are already pages (the start-a-clinic
guides and comparison pages), paths that `redirects.yaml`, `gone.yaml` or a page's `redirectFrom` claim, and posts
already imported, then prints what it imported, skipped and could not fetch. Add `--dry-run` to see the list
first. One post: `node scripts/import-wp.ts <slug> --collection posts`. The manifest's decisions are proposals
until marketing confirms them.

**Before publishing an imported post**, refresh it: a named author, a current `lastUpdated`, an opening answer that
answers the post's question in two sentences, a summary that is not the first paragraph again, a real `headKeyword`,
a title under 60 characters, the banned words out, an FAQ only if it has true questions, and the editor's pass.

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

## Share images

Every page gets its own 1200x630 share image (the card shown when its link is pasted into WhatsApp, LinkedIn
or X). The build draws it from the page's `title` without ": EasyClinic" and its `eyebrow` (for a post
without one, the topic; otherwise the page type), so there is nothing to upload. A long title is set smaller;
one that needs more than three lines even then is cut after the last whole word that fits, with an ellipsis,
which is one more reason to keep titles under 60 characters. To look at one, open `/og/<page path>.png` on a
preview (for example `/og/pricing/india.png`; the home page's is `/og/index.png`). Pages outside the content
collections (404, the demo confirmation) use the standard card, `public/og/default.png`.

## Editing in Keystatic

Keystatic is a form-based editing screen over the same files described above. It is a convenience, not a second
copy of the content: it reads and writes `src/content/` and `src/data/` directly, in the same format, and the build
checks what it saves exactly as it checks a hand edit.

**Opening it.** Run `pnpm dev` and open <http://127.0.0.1:4321/keystatic/> (use `127.0.0.1`: Keystatic moves the
dev server to that address). Saves go straight to the files in your checkout; review and commit them with git as
usual. Keystatic is only ever part of `pnpm dev` and of preview deployments set up for it
(`KEYSTATIC_STORAGE=github`, see `docs/keystatic-design.md` section 3.4). The live site never includes it.

**What it edits.** Every page type (Pages), guides, posts and legal pages with their Markdown body (Articles),
the shared facts (prices, countries, regulators, integrations, testimonials, authors, `facts.yaml`, `study.yaml`,
`plans.yaml`) and the site settings and navigation. Redirects and gone lists (`redirects.yaml`, `gone.yaml` and the
generated `*-posts.yaml`) stay hand-edited. Section types whose form is not built yet show as "(form not built
yet)": Keystatic keeps those sections exactly as they are, and you edit them in the YAML file for now.

> **Warning: a save deletes every YAML comment in the file, with no warning in Keystatic.** A comment is a line
> starting with `#` (outside a long text), such as `# Source: … Fetched 2026-09-26`. Many files keep their sources
> and decisions only in comments: on 26 September 2026, 85 files had 310 comment lines, including every integration,
> specialty and feature page, the four country pages and `facts.yaml`, `study.yaml`, `plans.yaml` and `nav.yaml`.
> Before you save a file in Keystatic, open it in a text editor. If it has comments, edit it by hand instead, or
> first move each comment into `notes` (on a page or data file) or `editorNote` (on a section), which are never
> shown on the site. To list the files that still have comments, run
> `pnpm exec vitest run --project unit --reporter=verbose tests/unit/keystatic-roundtrip.test.ts | grep "a save deletes"`.
> If you saved one by mistake, `git diff` shows the deleted lines: put them back before you commit.

**Before your first save, know this:**

- **Saving rewrites the whole file.** Keystatic rebuilds the file from its form: YAML comments are deleted (see the
  warning above), keys are put in the form's order and long lines are re-wrapped. What the page says does not
  change, but anything written only in a comment is lost.
- **Unknown facts.** A field for a fact the company must supply (a price, a status, a date) saves as `null` when
  you leave it empty, exactly as writing `null` by hand does: the page shows a placeholder and cannot publish.
  Never type a guess or leave a blank space to get past it.
- **Keystatic checks structure only**: required fields, lengths, link formats and list sizes. The writing rules
  (banned words, placeholders, facts that need confirming, FAQ counts) are checked by the preview toolbar after you
  save, by `pnpm lint:content`, and by the build for published pages.
- **Renaming an entry changes its id.** For a page that is its URL: add the old URL to "Redirect from". For shared
  data (a regulator, a country, an author) other entries refer to it by that id, and a broken reference stops the
  build, so search for the old id first.
- **Guides and posts.** The body editor opens Markdown with headings (h2 to h5), lists, tables, links and the
  Inline CTA. It cannot open a body that contains HTML, code, `{...}` expressions or an `<InlineCta>` written on one
  line; write the Inline CTA in the multi-line form shown above. Every Inline CTA in the content is still on one
  line, so for now guides and posts that have one are edited by hand. When the editor does save a body, it rewrites
  the Markdown but keeps every word, link and Inline CTA:
  - Table column alignment (`---:`) is dropped. Three published pages right-align a money column this way (the
    Mumbai and Nairobi clinic-cost guides and the post `clinic-setup-cost-in-india`); they still line up on the
    right, because the site right-aligns any table column whose cells are all amounts. A centred column, or a
    right-aligned column of words, would lose its alignment.
  - Bullets become `*`, blank lines between list items go, a line break written as two trailing spaces becomes a
    `\` at the end of the line, bare web addresses and emails become `[text](address)` links, and characters such as
    `*`, `_`, `[`, `{` and `<` get a `\` in front. The page reads the same.
  - A link title (`[text](/page/ "Title")`) is dropped, an image is written back as plain text and a footnote
    becomes a link. No body uses these today; if you add one, edit that body by hand.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local preview at http://localhost:4321, and the Keystatic editor at http://127.0.0.1:4321/keystatic/ |
| `pnpm lint:content` | Checks every page against the writing rules in about a second |
| `pnpm facts:report` | Lists every missing fact, grouped by who must supply it |
| `pnpm build` | Full preview build with the post-build checks |
| `pnpm build:prod` | Production build: published pages only, every rule strict |
