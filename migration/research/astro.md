# Astro 7.3.5 building blocks for the EasyClinic rebuild (research report, verified 2026-09-26)

Sources: the official docs source at `raw.githubusercontent.com/withastro/docs/main/src/content/docs/en/...` (rendered at `docs.astro.build/en/...`), the withastro/astro source, vercel.com/docs (`.md` endpoints) and `npm view`. I wrote no files.

## Things that will bite this project

1. **Config redirects are broken on Vercel with `trailingSlash: 'always'`.** Issue withastro/astro#18073 is open (2026-09-19, adapter v11.0.10, Astro 7.3.1). The adapter writes the trailing-slash rule (308 to `/x/`) before the redirect rules, and each redirect compiles to `^/old$`, which can never match `/old/`. The result is a 404, and writing the source as `'/old/'` doesn't help. The fix PR #18085 is open and not merged. The latest release, 11.0.11, does not include it. https://github.com/withastro/astro/issues/18073 , https://github.com/withastro/astro/pull/18085 , https://github.com/withastro/astro/blob/main/packages/integrations/vercel/src/lib/redirects.ts
2. **`@astrojs/check` 0.9.10 only accepts TypeScript `^5.0.0 || ^6.0.0`.** npm `typescript@latest` is now 7.0.2, so pin `typescript@^6.0.3`, which is what `astro` itself uses as a devDependency (npm).
3. **Vercel's own Astro page is out of date.** https://vercel.com/docs/frameworks/frontend/astro (last updated 2026-08-26) still shows `@astrojs/vercel/serverless`, `/static` and `output: 'hybrid'`. Those exports were removed in `@astrojs/vercel` 10.0.0 (adapter CHANGELOG). Use Astro's docs instead.
4. **`@lhci/cli` 0.15.1 is behind.** Last published 2025-06-25, it bundles lighthouse 12.6.1 while lighthouse is at 13.5.0 (npm).

## Package versions (`npm view`, 2026-09-26)

| Package | Version | Notes |
|---|---|---|
| astro | 7.3.5 | node `>=22.12.0`; deps: vite `^8.0.13`, zod `^4.5.4`, `@astrojs/compiler-rs ^0.5.0`, shiki ^4; optional sharp ^0.35.4; optional peer `@astrojs/markdown-remark ^7.3.0` |
| @astrojs/vercel | 11.0.11 | peer `astro ^7.0.0` |
| @astrojs/sitemap | 3.7.4 | deps zod ^4.3.6, sitemap ^9 |
| @astrojs/mdx | 8.0.2 | peer `astro ^7.2.10`, `@astrojs/markdown-satteri ^0.4.0` (0.4.2) |
| @astrojs/react | 7.0.0 | only needed for Keystatic |
| @astrojs/check | 0.9.10 | peer typescript ^5 or ^6 |
| tailwindcss / @tailwindcss/vite | 4.3.3 | vite peer `^5.2 \|\| ^6 \|\| ^7 \|\| ^8` |
| zod (standalone) | 4.6.5 | import from `astro/zod` instead |
| @keystatic/core / @keystatic/astro | 0.6.9 / 6.0.0 | astro peer `5 \|\| 6 \|\| 7`; react 18/19 |
| decap-cms | 3.16.3 | |
| @sveltia/cms | 0.221.1 | |
| tinacms | 3.14.1 | |
| @playwright/test | 1.63.0 | |
| @axe-core/playwright | 4.13.0 | |
| linkinator | 8.1.0 | node >=22 |
| lychee | v0.24.2 | GitHub release 2026-05-01 |
| schema-dts | 2.0.0 | |
| html-validate | 11.16.0 | |
| pa11y-ci | 4.1.1 | |
| vitest | 5.0.2 | vite peer includes ^8 |

## 1. Content collections (Content Layer)

- **Config file:** `src/content.config.ts` (`.js` and `.mjs` also work). The old `src/content/config.ts` throws `LegacyContentConfigError`. Legacy collections were removed in v6. https://docs.astro.build/en/guides/content-collections/ , https://docs.astro.build/en/guides/upgrade-to/v6/#removed-legacy-content-collections
- **Imports:**
  - `defineCollection` and `reference` from `astro:content`
  - `glob` and `file` from `astro/loaders`
  - `z` from `astro/zod`. Importing `z` from `astro:content` or `astro:schema` is deprecated since v6.
- **`glob()` options:** `pattern` (string or string[]), `base`, `generateId`, `retainBody` (default true), `deferRender` (new in 7.x, Markdown only). It handles md, mdx, mdoc, json, yaml and toml.
- **`file()`:** loads one JSON, YAML or TOML file. Each entry needs a unique `id`. A custom `parser` handles CSV or nested JSON. https://docs.astro.build/en/reference/content-loader-reference/
- **References:** use `reference('authors')` or `z.array(reference('blog'))`. They resolve to `{collection, id}` and you fetch them with `getEntry()`.
- **MDX:** needs the `@astrojs/mdx` integration and a pattern like `'**/*.{md,mdx}'`. Render with `render(entry)` from `astro:content`. Build-time collections only; live collections can't render MDX.
- **Images in schemas:** the `schema: ({ image }) => z.object({ cover: image() })` form still works for collections. What v6 removed is the function-style schema on custom loaders (replaced by `createSchema()`). `image().refine()` is unsupported. https://docs.astro.build/en/guides/images/
- **Failing the build:** a schema violation throws `InvalidContentEntryDataError` ("data does not match collection schema"), and `astro build`, `astro sync` and `astro check` exit non-zero. https://docs.astro.build/en/reference/errors/invalid-content-entry-data-error/
- **Zod 4 notes:**
  - `.superRefine()` works, but `ctx.path` is gone.
  - The "superRefine deprecated in favour of `.check()`" section in the Zod changelog is commented out, so it is not officially deprecated.
  - Use `z.email()` / `z.url()` rather than `z.string().email()`.
  - Custom messages use `{ error: '...' }` instead of `{ message }`.
  - `.default()` must match the output type; use `.prefault()` for the old behaviour.
  - Sources: https://zod.dev/v4/changelog , the v6 upgrade guide.

```ts
// src/content.config.ts
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const BANNED = [/\bseamless\b/i, /\brevolutionary\b/i]; // example list
const seoText = (max: number) => z.string().min(1).max(max);

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: seoText(60),
      description: seoText(155),
      hero: image().optional(),
      author: reference('authors').optional(),
      noindex: z.boolean().default(false),
      updated: z.coerce.date().optional(),
    }).superRefine((d, ctx) => {
      for (const key of ['title', 'description'] as const) {
        if (/\[[^\]]*\]/.test(d[key])) ctx.addIssue({ code: 'custom', path: [key], message: 'Unfilled [placeholder]' });
        for (const re of BANNED) if (re.test(d[key])) ctx.addIssue({ code: 'custom', path: [key], message: `Banned word ${re}` });
      }
    }),
});
const authors = defineCollection({ loader: file('src/data/authors.json'), schema: z.object({ id: z.string(), name: z.string() }) });
export const collections = { pages, authors };
```

- **Limitation (my inference):** schemas only validate frontmatter and data, not the Markdown/MDX body. Checking the body for placeholders or banned words needs a separate CI script or test over `entry.body` or the source files, or a Sätteri/remark plugin.

## 2. Routing, redirects and 410

- **`trailingSlash: 'always'`:**
  - Applies to the dev server and on-demand routes.
  - In production, on-demand requests without a slash get a 301 for GET and a 308 for other methods.
  - Docs: "Trailing slashes on prerendered pages are handled by the hosting platform."
  - Pair it with `build.format: 'directory'`, which is the default. The Vercel adapter forces `build.format: 'directory'` and `build.redirects: false` anyway (vercel `src/index.ts`).
  - The adapter maps `'always'` to Vercel `trailingSlash: true` in `config.json`. That produces a 308 for `^/((?:[^/]+/)*[^/\.]+)$` and skips `/.well-known` (`@vercel/routing-utils` `convertTrailingSlash`).
  - It logs an error if `vercel.json` sets a conflicting `trailingSlash`.
  - https://docs.astro.build/en/reference/configuration-reference/#trailingslash
- **Endpoints with a file extension** (`/sitemap-index.xml`, `/robots.txt`, `/rss.xml`) can never be reached with a trailing slash, whatever the config (v6 change).
- **Redirects config:**
  - `redirects: { '/old': '/new/', '/blog/[...slug]': '/resources/[...slug]', '/x': { status: 302, destination: '/y/' } }`
  - Defaults are 301 for GET and 308 for other methods.
  - Dynamic routes only work when both sides have the same params.
  - External destinations are allowed (since 5.2).
  - A real page file with the same path takes priority over the redirect.
  - With the Vercel adapter, `getRedirects()` turns them into `config.json` `routes` with a `Location` header and `statusCode` (default 301). No meta-refresh HTML is generated.
  - https://docs.astro.build/en/guides/routing/#configured-redirects
  - **The trailing-slash bug above applies.** Until PR #18085 ships, pick one:
    - (a) put the legacy redirects in `vercel.json` `redirects`, listing both slash forms. Vercel says the build "captures rewrites, redirects, and headers from your framework configuration or vercel.json" (https://vercel.com/docs/fundamentals/builds). I did not verify the precedence between `vercel.json` routes and the adapter's `config.json` routes.
    - (b) patch the adapter.
    - (c) wait for the fix.
    - Test on a preview deploy whichever you choose.
- **Recommended 410 for `/doctors/*` and `/clinics/*`: an on-demand catch-all endpoint.**
  - Middleware won't work here. On Vercel it only runs for on-demand routes, because "prerendered pages are served from Vercel's filesystem and do not invoke your middleware" (Vercel adapter docs).

```ts
// src/pages/doctors/[...path].ts  (same for clinics)
export const prerender = false;
export const ALL = () => new Response(GONE_HTML, {
  status: 410,
  headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
});
```

  - Expected behaviour: `/doctors/abc` first gets Vercel's 308 to `/doctors/abc/`, then the 410.
  - Alternative (not verified): a `vercel.json` `routes` entry such as `{ "src": "^/(doctors|clinics)(/.*)?$", "status": 410 }`. `routes` supports `status` and "can be used alongside" `redirects`/`trailingSlash` (https://vercel.com/docs/project-configuration/vercel-json#routes). I did not verify the response body or where it sits relative to the adapter routes.
- **Reserved file in Astro 7:** `src/fetch.ts` is the entrypoint for the new advanced routing (runs on-demand only). Set `fetchFile: null` if you need that filename for something else. https://docs.astro.build/en/guides/routing/#advanced-routing

## 3. `@astrojs/vercel` 11.0.11, Actions and `astro:env`

- **Output mode:** keep the default `output: 'static'` plus `adapter: vercel()`, and put `export const prerender = false` on the few dynamic routes. `output: 'hybrid'` no longer exists. https://docs.astro.build/en/guides/on-demand-rendering/
- **Adapter options:** `imageService`, `imagesConfig`, `webAnalytics`, `maxDuration`, `skewProtection` (Pro plan), `staticHeaders` (sends CSP as a header; since 10.0), `middlewareMode: 'edge'` (replaces the deprecated `edgeMiddleware`), `isr` (off by default, not needed here). https://docs.astro.build/en/guides/integrations-guide/vercel/
- **Hashed assets:** `/_astro/*` gets `cache-control: public, max-age=31536000, immutable` automatically (fixed ordering in 11.0.11).
- **Preview:** the adapter exports no preview entrypoint (its package `exports` has none). I infer `astro preview` won't work, so use `vercel dev` or preview deployments.
- **Actions:**
  - Put them in `src/actions/index.ts` as `export const server = { requestDemo: defineAction({ accept: 'form', input: z.object({...}), handler }) }`.
  - They are served at `/_actions/<name>` and need an adapter.
  - Calling `actions.requestDemo(formData)` from a `<script>` works on a prerendered page.
  - A no-JS `<form method="POST" action={actions.requestDemo}>` requires the page itself to be on-demand.
  - Form parsing: empty inputs become `null`. Use `z.coerce.boolean()` for checkboxes. `.refine()`, `.transform()` and `.pipe()` are supported. Throw `ActionError({ code: 'BAD_REQUEST' })` for errors.
  - https://docs.astro.build/en/guides/actions/
  - Not verified: POSTs to `/_actions/<name>` under `trailingSlash: 'always'` on Vercel. Action names without a dot match Vercel's 308 slash rule. Test this.
- **`astro:env`:**
  - Declare `env: { schema: { CRM_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret' }), PUBLIC_SITE_KEY: envField.string({ context: 'client', access: 'public' }) } }`.
  - Import from `astro:env/server` or `astro:env/client`.
  - The Vercel adapter declares `envGetSecret: 'stable'`, so secrets are read at runtime.
  - Since v6, `import.meta.env` values are always inlined and never type-coerced.
  - https://docs.astro.build/en/guides/environment-variables/#type-safe-environment-variables

## 4. `@astrojs/sitemap` 3.7.4

- **Options:**
  - `filter(page: fullURL) => boolean`
  - `serialize(item)`: can be async; set `item.lastmod` (ISO string), or return `undefined` to drop the entry.
  - `chunks: { blog: item => /\/blog\//.test(item.url) ? item : undefined, ... }` (since 3.7.0): writes `sitemap-blog-0.xml`; anything unmatched goes to `sitemap-pages-0.xml`. This is the option for splitting by page family.
  - `customPages` is only for pages Astro didn't build. `customSitemaps` adds external sitemaps to the index. Also `entryLimit` (default 45000) and `filenameBase`.
  - https://docs.astro.build/en/guides/integrations-guide/sitemap/
- **Behaviour (from source):**
  - Only routes of type `page` are included; endpoints and redirects are skipped, as are 404 and 500.
  - Dynamic on-demand routes are left out.
  - URLs get a trailing slash under `directory` format.
  - It needs `site`.
  - https://github.com/withastro/astro/blob/main/packages/integrations/sitemap/src/index.ts
- **noindex:** the integration can't read page source (docs note), so noindex needs a URL list the config can reach. For example, a JSON of noindex paths or lastmod dates generated from content, used in `filter` and `serialize`. `astro.config` can't call `getCollection`. This is my design inference, not an official pattern.

## 5. Fonts

- **Stable since Astro 6.0** (the `experimental.fonts` flag was removed): configure top-level `fonts: [...]` and add `<Font cssVariable preload />` from `astro:assets`. https://docs.astro.build/en/guides/fonts/
- **Providers:** local, fontsource, google, bunny, adobe, fontshare, npm, google icons.
- **Local display face:**

```js
{ provider: fontProviders.local(), name: 'Display', cssVariable: '--font-display', fallbacks: ['sans-serif'],
  options: { variants: [{ src: ['./src/assets/fonts/display-600.woff2'], weight: 600, style: 'normal', display: 'swap' }] } }
```

  - Keep font files in `src/`, not `public/`, to avoid duplicate copies in the output.
  - Variable fonts: set `weight: '100 900'`.
- **Inter:**

```js
{ provider: fontProviders.fontsource(), name: 'Inter', cssVariable: '--font-inter', weights: ['100 900'], styles: ['normal'], subsets: ['latin'] }
```

  - Or use it locally with `InterVariable.woff2`.
- **Subsetting:**
  - `subsets` (default `['latin']`) applies to remote providers. Google also has `options.experimental.glyphs`. `unicodeRange` is available on families and on local variants.
  - Docs don't say Astro subsets local files. I assume you need to pre-subset them (e.g. with fonttools `pyftsubset`); not verified.
- **Fallback metric matching:** on by default (`optimizedFallbacks: true`, since 6.0). It uses the last generic family in `fallbacks`, default `sans-serif`.
- **Preload:** `preload` or `preload={[{ subset: 'latin', weight: '400' }]}` (a variable file counts if the weight is in its range).
- **Output:** files are emitted to `_astro/fonts`. https://docs.astro.build/en/reference/modules/astro-assets/#font-
- **Tailwind:** `@theme inline { --font-sans: var(--font-inter); }`.

## 6. Images (`astro:assets`)

- **`<Picture>` with AVIF/WebP:**

```astro
<Picture src={img} formats={['avif','webp']} alt="..." layout="full-width" priority />
```

  - The default `formats` is `['webp']`. The `<img>` fallback is png/jpg.
- **`priority`** (since 5.10) sets `loading="eager"`, `decoding="sync"`, `fetchpriority="high"`. Use it on the hero only.
- **Responsive images are stable** (since 5.10):
  - `layout`: `constrained`, `full-width`, `fixed` or `none`. It auto-generates `srcset` and `sizes`.
  - Config: `image: { layout: 'constrained', responsiveStyles: true }` (`responsiveStyles` defaults to false).
  - `image.breakpoints` defaults to `[640, 750, 828, 1080, 1280, 1668, 2048, 2560]` for local processing.
  - Since v6, styles are a hashed class plus `data-astro-fit`/`data-astro-pos`, which makes them CSP-safe.
- **Width and height:** only required for `public/` or remote images. Imported images are measured automatically.
- **v6 behaviour changes:** images crop by default when both width and height are given, and are never upscaled.
- **Vercel image service:** optional `vercel({ imageService: true })` switches to `/_vercel/image` at runtime. The default is build-time sharp.
- Sources: https://docs.astro.build/en/reference/modules/astro-assets/ , https://docs.astro.build/en/reference/configuration-reference/#image-options

## 7. Styling: Tailwind v4 or plain CSS

- **Setup:** `npx astro add tailwind` installs `@tailwindcss/vite` and adds `vite: { plugins: [tailwindcss()] }`. Then put `@import "tailwindcss";` in `src/styles/global.css`. The old `@astrojs/tailwind` integration is v3 only. https://docs.astro.build/en/guides/styling/#tailwind
- **Tokens:** `@theme { --color-brand-600: #...; }` creates utilities. Use `@theme inline` when a token points at another variable (e.g. a font variable). Use `:root` for variables that shouldn't become utilities. https://tailwindcss.com/docs/theme
- **Dark mode:** it follows `prefers-color-scheme` by default. For a manual toggle, add `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`. https://tailwindcss.com/docs/dark-mode
  - My recommendation: semantic variables (`--surface`, `--ink`) in `:root` and `[data-theme=dark]`, mapped with `@theme inline { --color-surface: var(--surface); }`.
- **Plain CSS with custom properties plus Astro scoped styles:** no build dependency and full control, but you write your own utilities, spacing and breakpoints. Tailwind gives consistent tokens and purged CSS, but markup gets class-heavy.

## 8. Git-based CMS options

| CMS | Status | Fit with Astro 7 |
|---|---|---|
| Keystatic | Active (pushed 2026-09-08). `@keystatic/astro` 5.2.0 added Astro 7; 6.0.0 requires Astro 5+ | Needs `@astrojs/react` and the adapter. It injects `/keystatic/[...params]` and `/api/keystatic/[...params]` with `prerender: false`. Writes md/mdoc/**mdx** (`fields.mdx`) or json/yaml into `src/content/*`, which content collections read directly. Its schema is separate from your Zod schema, so you keep two in step. https://github.com/Thinkmill/keystatic |
| Sveltia CMS | Very active (pushed 2026-09-26), version 0.x | Static SPA in `public/admin/` with a Decap-compatible `config.yml`, so there are no Astro version ties. Its docs say it has its own OAuth client for GitHub/GitLab and supports personal-access-token sign-in, which works off Netlify. https://sveltiacms.app/en/docs/successor-to-netlify-cms |
| Decap CMS | Maintained (3.16.3, pushed 2026-09-22) | Framework-agnostic. On Vercel, GitHub login needs an external OAuth provider (Netlify Identity/git-gateway is not available there). |
| TinaCMS | Active (3.14.1) | Uses `@tinacms/astro` and its own schema in `tina/config.ts`, not native collections. Visual editing needs an SSR adapter plus `<TinaIsland>` regions; targets Astro 5+ (Tina docs; I didn't check the npm peer range). Needs Tina Cloud or a self-hosted backend. https://tina.io/docs/frameworks/astro |

## 9. Testing and QA

- **`astro check`:** exits 1 on errors. Flags include `--minimumFailingSeverity warning` and `--noSync`. Needs `@astrojs/check` plus TypeScript 6. https://docs.astro.build/en/reference/cli-reference/#astro-check
- **Unit tests:** Vitest with `getViteConfig()` from `astro/config` and the Container API. Container renderers are now imported from `@astrojs/<fw>/container-renderer`. https://docs.astro.build/en/guides/testing/
- **E2E:** Playwright 1.63.0 with `@axe-core/playwright` 4.13.0, e.g. `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()`. Because `astro preview` likely won't work with the Vercel adapter, run it against a Vercel preview URL, or against a build without the adapter for static checks.
- **Lighthouse CI:** `@lhci/cli` 0.15.1 (stale, see top). `unlighthouse` 0.18.1 is active.
- **Link checking:** linkinator 8.1.0 (node ≥22) or lychee v0.24.2 (Rust binary, has a GitHub Action).
- **HTML validity:** html-validate 11.16.0 (node `^22.22.0 || >=24.8.0`). Useful because the Rust compiler no longer auto-fixes invalid HTML.
- **JSON-LD:**
  - `schema-dts` 2.0.0 gives compile-time types (`WithContext<Organization>`, etc.).
  - `structured-data-testing-tool` 4.5.0 hasn't been published since 2022-05 (stale).
  - Google Rich Results Test and validator.schema.org have no official CI API (my understanding; not verified).
  - Practical CI approach: parse `<script type="application/ld+json">` from `dist` and validate it with Zod schemas you write.

## 10. Breaking changes from Astro 5 to 7

**Astro 6** (https://docs.astro.build/en/guides/upgrade-to/v6/):
- Node `>=22.12.0`; Vite 7 plus the Environment API; Zod 4; Shiki 4.
- Legacy content collections removed; `z` from `astro:content` and `astro:schema` deprecated.
- `Astro.glob()` removed; `<ViewTransitions />` removed (use `<ClientRouter />`); `emitESMImage()` removed; CommonJS config files removed.
- Stable: CSP (`security.csp`), fonts, live content collections, `prerenderConflictBehavior`.
- `import.meta.env` always inlined; `<script>`/`<style>` render in source order; Markdown heading IDs changed.
- File-extension endpoints can't take a trailing slash; images crop by default and never upscale; `getStaticPaths` params can't be numbers.

**Astro 7** (https://docs.astro.build/en/guides/upgrade-to/v7/):
- Vite 8.
- The Rust compiler is now the only compiler. It errors on unclosed tags and no longer fixes invalid nesting (e.g. a `<div>` inside a `<p>`).
- Sätteri is the default Markdown/MDX processor. remark/rehype plugins now need `@astrojs/markdown-remark` plus `markdown.processor: unified()`.
- **`compressHTML` now defaults to `'jsx'`.** Whitespace between inline elements is stripped, so add `{" "}` or set `compressHTML: true`. This matters for marketing copy.
- `src/fetch.ts` is reserved.
- Stable: `logger`, `cache` / `routeRules`, advanced routing.
- `@astrojs/db` removed; `astro:transitions` internals removed.
- 7.x minor releases added `glob({ deferRender })`, entry `digest`, `session: false`, `experimental.incrementalBuild`, and the `astro dev/preview --ignore-lock` and `astro preview --background` flags (CHANGELOG).

## Could not verify

- Where `vercel.json` `routes`/`redirects` land relative to the adapter's `config.json` routes, and what body a bare `status: 410` route returns.
- Whether Actions POSTs survive `trailingSlash: 'always'` on Vercel.
- Whether Astro subsets local font files (I assume not).
- That `astro preview` is unsupported with `@astrojs/vercel`; this comes only from the missing preview entrypoint in its exports.
- Sveltia's exact 1.0 status. The package is still versioned 0.221.x, while its docs say the feature-parity goal "has been met".
- The npm peer range for `@tinacms/astro`; I didn't query it.