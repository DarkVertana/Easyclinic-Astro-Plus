# Launch checklist

The plan's Phase 4 steps (`/Users/pratik/.claude/plans/hey-we-gonna-rebuild-groovy-lemur.md`, "Phases" and
"Verification"), in the order they need to happen. Each step is marked:

- **Done in repo**: the code, data or check exists; nothing more is needed from engineering.
- **Needs company access**: blocked on an account, a decision or a sign-off from EasyClinic.

Owner decisions that shape this list: `/doctors/` and `/clinics/` are skipped entirely (no 410, no selector page;
their old URLs fall through to the normal 404), and URLs keep their trailing slash.

## 1. Before cutover

### 1.1 Marketing confirms the posts manifest: needs company access

`migration/posts-manifest.csv` holds a **proposed** decision for each of the 403 live posts (spec 3.6): keep,
merge (301 to a landing page), drop (410) or review. Nothing is redirected or removed until marketing puts `yes`
in the `confirmed` column of a row. Then:

```sh
node scripts/posts-redirects.ts        # writes src/data/redirects-posts.yaml and src/data/gone-posts.yaml
node scripts/posts-redirects.ts --check # CI runs this: the generated files must match the manifest
```

Only confirmed merge and drop rows generate anything; keep and review rows never do. A post that
`src/data/redirects.yaml` or `gone.yaml` already covers is left to that row, with a warning when the two disagree.
The generator refuses to write while a confirmed row is unusable (a merge that points at itself, an unknown decision).

A confirmed merge or drop does not need the post's draft deleted first. While the draft MDX is still in
`src/content/posts` with `status: draft`:

- Production does not render the draft, and serves the 301 (merge) or 410 (drop) for its URL.
- Preview renders the draft, so a reviewer can still read it, and skips the redirect or 410 for that one path. Each
  skipped rule is listed, with the reason, in `reports/redirects-skipped.json` and in the build manifest
  (`skippedRedirects`, `skippedGone`).

For each confirmed merge or drop whose post is still in the repo, `node scripts/posts-redirects.ts` prints a line
saying the draft can be deleted once the redirect (or 410) is live in production (on 26 September 2026, 98 proposed
merge rows have a draft post in the repo; no drop row has one). Delete those drafts after the
production deployment that serves the rule. A post that is `published` or `review` on a confirmed row is printed as a
warning instead: the build fails while a published or review page sits on a redirect or 410 path, so set it to
`status: draft` or delete it before deploying. Only exact rules give way to a draft; a draft under a hand-written
`prefix` or `children` rule still fails the build.

Fix before marketing reviews the proposals (found while wiring this up):

- 28 rows propose merging into `/ent-emr-software/`, but only two of them are about ENT
  (`/ent-clinic-management-systems/`, `/ai-software-for-ent-clinics/`). The `ent-` pattern in
  `scripts/posts-manifest.ts` also matches "managem**ent-**", "engagem**ent-**" and "pati**ent-**".
- `/physiotherapy-clinic-management-software/` and `/ayurveda-clinic-management-software/` propose merging into
  themselves (the new specialty pages use those slugs). They should be keep rows.
- `/insurance-claim-management-system/` and `/payor-management-system/` are merge rows, but `redirects.yaml`
  already sends both to `/features/insurance-claims/`, which wins.
- `/healthcare-dashboard-software/` and `/clinic-automation-in-uganda/` are keep rows, but `redirects.yaml`
  redirects both. Either can be imported as a draft post (preview renders it, production serves the redirect), but
  publishing it fails the build (a published page may not sit on a redirect source), so one of the two decisions
  has to change before the post is published.
- Re-running `scripts/posts-manifest.ts` rewrites the CSV without the `confirmed` column and would lose
  marketing's answers. Run it only before marketing starts, or teach it to carry the column over.

### 1.2 Full redirect map: done in repo, except the analytics exports

- `src/data/redirects.yaml` and `gone.yaml` (hand-written), page `redirectFrom` lists, and the generated post files
  above all feed the same routes. Chains are collapsed to one hop at build time; loops, duplicate sources, a
  source that shadows a built page, and a path that is both redirected and gone all fail the build. The one
  exception is a draft post on an exact redirect or 410 path (1.1).
- **Needs company access:** the Search Console pages export and the GA4 "Page Not Found" list (spec 8: the 404
  page was the third most viewed page). Put each export in `migration/legacy-extra/<name>.txt`, one URL or path
  per line, re-run the inventory (1.3), and add redirects for whatever the coverage report lists.
- `/best-clinic-management-software-uganda-new/` appeared on the live sitemap after the research snapshot and has
  no row yet.

### 1.3 Legacy URL coverage at 100%: done in repo; the result is not yet 100%

```sh
node scripts/legacy-urls.ts            # refresh migration/legacy-urls.csv from the live sitemaps (commit it)
pnpm build:prod && pnpm coverage --strict
```

`scripts/legacy-urls.ts` reads both live sitemap sets, the sitemap files themselves, the known non-sitemap paths
(feed, WordPress system paths, archives, the staging sitemap's URLs) and every exact source in `redirects.yaml`.
`pnpm coverage` resolves each URL, with and without its trailing slash, through the built
`.vercel/output/config.json` exactly as the local emulator does (route sources match case-insensitively, as on
Vercel), and writes `reports/coverage.md` (summary and failures grouped by reason) and `reports/coverage.json`. It
passes a URL that returns 200, one permanent redirect (301, or the adapter's trailing-slash 308) to a 200, or a
410; a single 302 or 307 fails as `temporary`; `/doctors/` and `/clinics/` must 404. `--strict` exits 1 on any
failure; CI runs it without `--strict` and uploads the report as the `coverage` artifact.

On 26 September 2026 (591 legacy URLs, last production build): 150 pass (45 pages, 100 one-hop redirects,
5 gone), 2 are the expected directory 404s, and 439 fail. Almost all failures wait on the company: 383 posts
waiting for marketing's decisions (1.1) or for import, 34 redirects waiting for their target page to publish
(country pages, `/blog/`, `/rss.xml`, the NGO page), and 14 old sitemap files with no rule yet (for example
`/sitemap_index.xml`, which Search Console knows; a 301 to `/sitemap-index.xml` is the likely answer).

Refresh the inventory again on cutover day: WordPress keeps publishing.

### 1.4 Crawl compared with live: partly done in repo

The inventory above covers every URL in the live and staging sitemaps. Not yet done: a crawl of the live site
for URLs no sitemap lists (images under `/wp-content/uploads/`, paginated archives), and the spec 7.10 crawl of the
new build with Screaming Frog or similar against the URL map. `pnpm coverage` replaces the "301s in one hop" part.

### 1.5 Content Security Policy: done in repo; verify GA4 and the confirmation page on a deployment

- Astro's `security.csp` (astro.config.ts) writes a per-page `<meta http-equiv="content-security-policy">`: every
  script and stylesheet Astro emits is allowed by hash, scripts otherwise only from this origin and
  `https://www.googletagmanager.com`; no `unsafe-inline` or `unsafe-eval` for scripts; `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. MDX table alignment (`style="text-align:..."`) is
  allowed by hash. On-demand pages (`/demo/confirmation/`) get the same policy as a response header instead.
- `integrations/routes-core.ts` sends `frame-ancestors 'self'` (which a `<meta>` cannot carry) with
  `object-src`, `base-uri` and `form-action` as a header on every response, plus `X-Frame-Options: SAMEORIGIN`.
- Checked in repo: `tests/output/csp.test.ts` checks every prerendered page's inline scripts, styles and style
  attributes against its own `<meta>` policy. `tests/e2e/csp.spec.ts` runs with JavaScript on and fails on any
  CSP violation or console error on the pages the per-page e2e sweep does not reach: the demo form's
  JavaScript submission, `/demo/confirmation/` (its header policy and the `demo_form_submitted` script), the
  404 page and the 410 page. `tests/e2e/templates.spec.ts` covers every content page, but ignores console
  errors that mention `googletagmanager`, and gtag.js does not load off www anyway, so no test sees GA4 under
  the policy.
- Not known until a deployment: the confirmation page's header has the same name as the route-level one, and
  which of the two Vercel keeps (or both) cannot be tested locally. The local emulator keeps the function's, as
  `vercel dev` does. `pnpm smoke` checks the deployed page keeps Astro's hashed `script-src` and still refuses
  framing (`frame-ancestors` or `X-Frame-Options`). If the `script-src` check fails, Vercel replaced Astro's
  policy with the route one: exclude the on-demand paths from the header route in `routes-core.ts` so Astro's
  header stands alone (X-Frame-Options keeps the framing protection).
- **Check on production:** open DevTools on www with GA4 loading and confirm no CSP errors, and that hits reach
  GA4 DebugView. The allowlist is the "Google Analytics" section of Google's CSP guide (read 26 September 2026),
  which includes the Signals and ads endpoints and a `frame-src` for www.googletagmanager.com, because whether
  Signals is on for the property is not known. The guide requires each `google.<TLD>` to be listed: the policy
  lists `.co.in`, `.co.ke`, `.ae` and `.com.ng` for the four markets. If Signals and ads features are off, those
  hosts can go.
- The Vercel toolbar (preview comments) is blocked by this policy on preview deployments. If reviewers need it,
  add Vercel's documented toolbar sources to the policy for preview builds only.

### 1.6 Production smoke test in CI: done in repo; needs the Vercel connection

`.github/workflows/smoke.yml` runs on every successful `deployment_status` event created by Vercel
(`vercel[bot]`; other apps' deployment statuses are ignored, so they never receive the bypass secret): it builds
the deployed commit at the deployed stage (for its build manifest) and runs `scripts/smoke.ts` against the
deployment URL: one-hop redirects from both slash forms, 410s with a body, noindex and the disallow-all
robots.txt off www, the trailing-slash 308, both halves of the CSP, the confirmation page's header policy, and
the demo endpoint. `smoke.ts` sends the bypass secret only to `*.vercel.app` and `easyclinic.io` hosts.

- **Needs company access:** connect the GitHub repository to the Vercel project, and add the repository secret
  `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel: Settings, Deployment Protection, Protection Bypass for Automation).

By hand, build the deployed commit at the deployment's stage first (`smoke.ts` reads
`.vercel/output/build-manifest.json`; a preview-stage manifest lists drafts that production does not serve):

```sh
# Preview deployment
git checkout <deployed sha> && pnpm build && pnpm smoke --base https://<preview>.vercel.app --bypass <secret>
# Production deployment on its vercel.app URL
git checkout <deployed sha> && pnpm build:prod && pnpm smoke --base https://<production>.vercel.app --bypass <secret>
```

### 1.7 Legal sign-off: needs company access

The privacy policy and terms are verbatim imports of the live pages; `/privacy/<country>/` pages are drafts
waiting on legal review (plan Phase 2). Open issue for legal: privacy policy clause (d) allows selling
de-identified data, while pages say the company never sells patient data.

### 1.8 Production environment: needs company access

In the Vercel project's Production environment: `CRM_WEBHOOK_URL` (and `CRM_WEBHOOK_TOKEN` if the CRM needs one),
`DEMO_REF_SECRET` (without it production sends leads but counts no conversions), `PUBLIC_GA4_ID`. Test the demo
form end to end into the CRM's test bin on a preview first (spec 7.10).

### 1.9 Old-site screenshots confirmed: needs company access

Every `origin: old-site` screenshot has `uiConfirmedOn`, or has been replaced by the demo-tenant capture. The
screens and the pages they sit on are listed in `docs/image-plan.md` (sections 5.1 and 5.2) and
`migration/images/image-sources.csv`.

## 2. Cutover day

### 2.1 DNS: needs company access

- Add `www.easyclinic.io` and `easyclinic.io` to the Vercel project. Set `easyclinic.io` to redirect to
  `www.easyclinic.io` (apex to www) in Vercel's domain settings.
- In Cloudflare, point both records at Vercel as **DNS only** (grey cloud, no proxy), so Vercel issues the
  certificates and its routing (redirects, 410s, headers) is what visitors get.
- Lower the TTLs a day ahead so a rollback propagates quickly.

### 2.2 Turn indexing on: needs company access

Set `INDEXING_ENABLED=true` in the Vercel Production environment and redeploy. Until then every host, www
included, sends `X-Robots-Tag: noindex, nofollow` and a disallow-all robots.txt. After it, only non-www hosts do.
Check:

```sh
curl -sI https://www.easyclinic.io/ | grep -i x-robots-tag        # no output on www
curl -s https://www.easyclinic.io/robots.txt                        # "Allow: /" and "Sitemap: https://www.easyclinic.io/sitemap-index.xml"
curl -s -o /dev/null -w '%{http_code}\n' https://www.easyclinic.io/sitemap-index.xml   # 200
curl -s https://www.easyclinic.io/sitemap-index.xml | grep -c '<sitemap>'              # 17 child sitemaps (count at audit, 2026-09-27)
curl -sI https://easyclinic.io/ | grep -i location                  # https://www.easyclinic.io/
curl -sI https://www.easyclinic.io/clinic-chain-software | head -3  # 301 to /solutions/clinic-chain/ in one hop
curl -sI https://www.easyclinic.io/wp-login.php | head -1           # 410
```

Then run the smoke test against www, from a production-stage build of the commit that is live (`smoke.ts`
refuses a preview-stage manifest for www). On www it asserts the launched state: no `X-Robots-Tag` on the
pages it fetches, a robots.txt with `Allow: /` and the sitemap line and no `Disallow: /`, and a sitemap index
that answers 200. Run it against www only after the switch above; before it, those checks fail by design, so a
www left noindexed or disallowed cannot pass:

```sh
git checkout <deployed sha> && pnpm build:prod && pnpm smoke --base https://www.easyclinic.io
```

### 2.3 Search Console and GA4: needs company access

- Search Console: verify the domain property (spec 8: it is not shared with marketing yet), submit
  `https://www.easyclinic.io/sitemap-index.xml`, remove the old WordPress sitemaps, and watch the Pages report
  for 404s over the following weeks; add redirects for any that matter.
- GA4 (property 347728478): confirm `demo_form_submitted` arrives once per real submission (DebugView), mark it
  the key event in place of `generate_lead`, link Search Console, and filter the `/.well-known/sgcaptcha` bot
  traffic (spec 7.8).

### 2.4 Keep WordPress as the rollback, noindexed, for 90 days: needs company access

Move WordPress to a separate host name that is not linked anywhere, set it to noindex (Settings, Reading,
"Discourage search engines", plus an `X-Robots-Tag: noindex` header), and keep its files and database untouched
for 90 days. Rollback is pointing the DNS records back.

## 3. No longer blocking

- The directory domain date: the directory pages are skipped entirely (owner decision, 26 September 2026), so no
  `/doctors/` redirects or 410s wait on it.
