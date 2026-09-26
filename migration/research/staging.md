# Staging Astro build: research report

Base URL: https://staging-easyclinic.vercel.app. All facts below come from `curl -sL` or `curl -sI` against this site on 2026-09-26, unless another URL is given. No files were written. I did not submit the /devlabs login form.

---

## 1. Stack, CSS and JS on the homepage (`/`)

**Generator**
- `<meta name="generator" content="Astro v7.2.1">` appears on every page I sampled. The target for the rebuild is 7.3.5.

**Hosting**
- Response headers show `server: Vercel`.
- Static pages are served from the edge cache: `x-vercel-cache: HIT`, `age: 600453`, `cache-control: public, max-age=0, must-revalidate`. Last-modified is 19 Sep 2026.
- Some routes run on demand as serverless functions in iad1 (`x-vercel-id: bom1::iad1::…`, `x-vercel-cache: MISS`): `/devlabs/`, `/api/geo` and `/devlabs/dashboard`. This points to `@astrojs/vercel` with `prerender=false` set per route.

**Font**
- Inter, loaded through Astro's built-in Fonts API.
- One self-hosted file, `/_astro/fonts/e868cdf4720e9ea5.woff2` (48,432 B), serves weights 400, 500, 600 and 700, latin range only. It is preloaded.
- Fallback faces are generated automatically: `"Inter-070b084e22c7a773 fallback: Arial"` with `size-adjust:107.1194%` and matching ascent/descent overrides.
- The CSS variable is `--font-inter`.

**CSS approach**
- No Tailwind: there are no `--tw-*` variables and no utility classes.
- Styling uses Astro scoped `<style>` blocks (`data-astro-cid-*`) with plain semantic class names. The most common are `card`, `btn`, `btn-solid`, `btn-ghost`, `lede`, `eyebrow`, `panel`, `inner`, `hero`, `section-head`, `pill`, `shot`.
- The output is Lightning CSS minified, using range media queries (`@media (width<=720px)`), `:has()` and `clamp()` for type sizes.
- Small component stylesheets are inlined into `<head>`.

**Design tokens** (from `/_astro/Header.D9MAy_DW.css`):

```
--brand-blue:#0080f6; --brand-blue-dark:#006fd4; --brand-teal:#04bdaf; --navy:#0a2540;
--ink:#181818; --muted:#474747; --brand-amber:#f2b01e; --brand-red:#fb2c36; --surface:#fff;
--surface-tint:#eff6ff; --border:#e5e7eb; --brand-wash:#e9f3fe; --brand-wash-deep:#d7e8fc; --page-max:1320px
```

**Leftovers from the Astro blog starter (do not carry these over)**
- The same global CSS still contains `--accent:#2337ff`, `--accent-dark:#000d8a` and the `--gray*` variables.
- It also sets `body{font-size:20px;line-height:1.7;background:linear-gradient(...)}`, `main{width:720px}`, `h1{font-size:3.052em}`, and styles for `blockquote` and `a{color:var(--accent)}`.
- Components have to override all of these.

**JS islands and scripts**
- No `<astro-island>` tags on any page I sampled, and no UI framework (React, Svelte, Vue and so on). All scripts are plain Astro `<script>` modules.
- The header menu is built from `<details class="dropdown">` elements, using a mega-menu plus a mobile drawer. A script closes other dropdowns, handles outside clicks and Esc, and sets `--header-h`.
- Scroll-reveal: an inline `<head>` script adds the `js-reveal` class, and an IntersectionObserver on `main.home > section` adds `is-visible`.
- Three tiny module entry files load shared chunks:
  - `Faq…js` (62 B) calls `accordion.D22L_xau.js` (849 B) on `.faq details`.
  - `PatientCare…js` (63 B) calls the same accordion on `.care details`.
  - `Stories…js` (57 B) calls `carousel.CZhN9JLU.js` (596 B) on `.stories`.

**Asset sizes on the homepage** (uncompressed)

| Asset | Size |
|---|---|
| HTML (`content-length`) | 79,881 B |
| `Header.D9MAy_DW.css` | 12,290 B |
| `index.Xsf269Ja.css` | 20,983 B |
| External JS (about 5 files) | about 1.6 KB total |
| Font | 48,432 B |

- The homepage has 22 `<img>` tags, all WebP with `srcset` and width/height set. The logo uses `fetchpriority="high"`.

**Per-page CSS bundles**
- Component names visible in the bundle filenames: `PageHero`, `WorkflowTests`, `features`, `pricing`, `curapilot`, `Header`.

**Homepage section order**
1. `.hero`: H1 "AI EMR & Clinic Management Software for Modern Healthcare"
2. `.features`
3. `.clinic-types`
4. `.care` (accordion)
5. `.problems`
6. `.proof` (testimonial wall)
7. `.faq`
8. `.stories` (carousel)
9. `.cta`

---

## 2. What is at `/devlabs/`

**It is a custom CMS.** It is not Keystatic, Decap, TinaCMS or Sveltia. Probing `/keystatic`, `/keystatic/`, `/admin`, `/admin/` and `/api/keystatic` returns 404 for all of them.

**The page**
- Title: "DevLabs Login | EasyClinic". It has `<meta name="robots" content="noindex, nofollow">`.
- Copy on the page: "CMS access for the EasyClinic marketing site. Product login stays at app.easyclinic.io."
- The form takes email and password. On submit it runs `fetch('/api/devlabs/login', {method:'POST', body: JSON {email,password}})`. If the response is ok it goes to `/devlabs/dashboard`; otherwise it goes to `/devlabs?error=1`.

**Route behaviour**

| Route | Response |
|---|---|
| `/devlabs/dashboard` | 302 to `/devlabs` when not logged in (SSR session check) |
| `/api/devlabs/login` (GET) | 404 (the route probably only accepts POST) |
| `/api/devlabs/session`, `/me`, `/devlabs/posts`, `/devlabs/pages` | 404 |

- `/devlabs` responds the same with or without a trailing slash (200 both ways).

---

## 3. robots.txt, canonicals and trailing slashes

**robots.txt**
- `/robots.txt` returns **404** (text/html, the site's 404 page). The site has no robots file at all.
- Staging also sends no `X-Robots-Tag` header and no noindex meta tag on public pages. It relies only on canonicals pointing at the production domain.

**Sitemap**
- `/sitemap-index.xml` returns 200 and points to `https://www.easyclinic.io/sitemap-0.xml`, which is the production domain.
- `/sitemap-0.xml` lists **122 URLs**. That count wrongly includes `https://www.easyclinic.io/devlabs/` and `/devlabs/dashboard/`, which should be filtered out.
- The URL list covers:
  - core pages
  - 4 `/solutions/*` pages
  - about 30 specialty EMR pages, e.g. `/dental-emr-software/`, `/cardiology-emr/`
  - 24 `/emr-software-in-{city|country}/` pages
  - 18 `/best-clinic-management-software-{country}/` pages
  - 3 `vs` pages: practo, healthplix, kenyaemr
  - `/easyclinic-emr-vs-traditional-emr/`
  - 6 `/blogs/*` posts
  - landing pages for ceo, cfo, cmo, ngo and emr

**Canonicals**
- Canonicals are absolute, point at production, and always end with a trailing slash. For example, both `/features` and `/features/` output `<link rel="canonical" href="https://www.easyclinic.io/features/">`. The same holds for `/pricing`, `/curapilot`, `/solutions/clinic-chain`, `/emr-software-in-kenya` and `/easyclinic-vs-practo`.

**Trailing slash mismatch**
- Every page returns **200 both with and without the trailing slash**, with no redirect, so each page exists at two URLs.
- Internal links go the other way. All 54 internal hrefs on the homepage have no trailing slash (e.g. `href="/curapilot"`, `href="/features"`). So every internal link points to a URL that is not the canonical one.

**Other SEO gaps** (on all 7 pages I sampled)
- No JSON-LD.
- No `twitter:title` or `twitter:description`; only `twitter:card`.
- No hreflang.
- `og:image` is `https://www.easyclinic.io/_astro/blog-placeholder-1.Bx0Zcyzv.jpg`. This is the blog-starter placeholder image, and it returns **404 on production** (200 on staging).
- Title separators are inconsistent across pages: "Features, EasyClinic", "Clinic Chain Software & Multi-Location EMR | EasyClinic", and "EasyClinic vs Practo (2026) — Clinic Software Comparison".
- Footer column headings are `<h2>` (Product, Solutions, Markets, Resources, Company).

**404 page and production**
- The 404 page has title "Page not found, EasyClinic".
- Production `https://www.easyclinic.io/` is WordPress behind Cloudflare: its `link:` header includes `/wp-json/` and `server: cloudflare`.

---

## 4. Page structures and content worth keeping

### `/features/`
Title "Features, EasyClinic"

1. **hero**
   - H1 "Clinic management software built around the EMR", plus a "View Pricing" button.
   - Module quick links: EMR "Charts & Rx", Scheduling "Slots & walk-ins", Billing "Invoices & till", Cura AI "Clinical copilot", Engagement "Portal & WhatsApp", Reports "KPIs & dashboards".
2. **grid-sec**: "Modules clinics use every day". Ten cards, each with a one-line description:
   - EMR, Scheduling, Billing, Cura AI, Inventory, Pharmacy, Lab
   - Reports ("100+ dashboards for clinical, inventory, and finance…")
   - Engagement
   - Multi-location
3. **detail**: four alternating feature rows, each with 3 bullets and a mock UI card:
   - "EMR notes that keep up with the consult"
   - "A clinic calendar the front desk trusts"
   - "Close the till without the archaeology"
   - "Patients self-serve; you stay branded"
   - **Bug:** the mock-card list items are cut off mid-phrase. The text reads "Point-and-click templates by" followed by "Ready", and "Allergies, meds, and" followed by "Ready".
4. **proof** (`id="customers"`): "Reviews from doctors who use it daily", six 5-star testimonials:
   - Dr. Tarun Mishra, City Hospital
   - Dr. T. L. Prabhu, Prashanthi Clinic
   - Dr. Chao Rochek Buragohain, Arogya Orthopaedic
   - Dr. Manish Bhatia, Asha Homeopathy
   - Dr. Prantar Chakrabarti, Institute of Hematology & Transfusion Medicine
   - Dr. Seetha Lakshmi Kolanakuduru, Aditya Women & Infertility Clinic
5. **cta**: "Put EMR, billing, and care in one place"
   - Trust line "5,000+ doctors · 18 countries · Since 2003"
   - Badge "Rated 4.9 on Capterra"

### `/solutions/clinic-chain/`
1. **hero**
   - H1 "EMR for multi-location clinic chains"
   - Stat pills: "One record / Across every site", "SOPs / Care that stays consistent", "HQ view / KPIs while the day is open"
2. **problems**: "What breaks when clinics multiply", three cards:
   - Every branch invents its own process
   - HQ can't see the day
   - Patients restart at every door
3. **fit**: "When one clinic becomes a network", 3 bullets
4. **modules**: "What the chain runs centrally", seven cards:
   - Multi-location EMR, Central control, Clinical SOPs, Inventory & logistics, Payor & finance, Engagement, Cura AI
5. **faq**: 3 questions
6. **cta**: "Run the chain from one clinic platform"

### `/emr-software-in-kenya/`
This is the template for the country landing pages.

1. **hero**
   - H1 "Clinic management & EMR software for modern clinics in Kenya"
   - Note "SHA / SHIF and eTIMS work in progress."
   - Pills: Cloud EMR, M-Pesa, Cura AI
2. **who**: "Clinics we set up across Kenya", four cards:
   - Solo practice, Specialist/polyclinic, Clinic chain, NGO/outreach
   - The NGO card has no link.
3. **modules**: eight cards, including "Billing & M-Pesa, cards, cash"
4. **why**: "Why switch now", numbered 01 to 03:
   - Paper and evening catch-up
   - Fragmented tools
   - No operational visibility
5. **benefits**: 5 items
6. **compliance**: "Compliance status in Kenya — We share live capability in demo — no checkbox marketing."
   - "SHA / SHIF claim workflows: in progress — confirm in demo"
   - "eTIMS invoicing: in progress — confirm in demo"
   - "Role-based access, encryption, audit logs"
   - "Data protection controls: current status shared in demo"
7. **faq**: 5 questions, covering cost, SHA/SHIF, M-Pesa, branches and WhatsApp
8. **cta**

### `/pricing/`
1. **hero**: H1 "Simple pricing, priced per doctor", with "no servers, no setup fee, no lock‑in contracts".
2. **plans**: "Built for how you practise", with a toggle between "Billed annually (Save 20%)" and "Billed quarterly".

   **Real price data** (from `data-*` attributes):

   | Plan | USD annual | USD quarterly | INR annual | INR quarterly |
   |---|---|---|---|---|
   | Professional ("Best for GPs and physicians running an EMR day to day") | $79 | $99 | ₹1,499 | ₹1,875 |
   | Premium ("Most chosen", "Best for specialists who need advanced EMR and telehealth") | $99 | $129 | ₹1,999 | ₹2,499 |
   | Enterprise ("Best for multi-location clinic chains, polyclinics & nursing homes") | Custom | Custom | Custom | Custom |

   All prices are per doctor per month.

   **Professional includes:**
   - Patient Management
   - EMR
   - AI Assistant
   - Finance, Billing & Payments
   - Appointment Scheduling
   - Dashboard & Reports
   - Multi-user Management
   - SMS & Email Communication
   - Free Unlimited Support & Training
   - Reception license included

   **Premium adds:**
   - Advanced EMR for Specialists
   - Virtual Clinic / Video Consultation
   - Online Payment Integration
   - Custom Clinical Forms and Print Layouts
   - Package Treatments
   - Lab Reporting
   - WhatsApp Communication
   - Multi-Location Management
   - Dedicated Account Manager

   **Enterprise adds:**
   - Clinical SOP Tracking
   - Advanced Financial Accounting
   - Insurance and 3rd Party Payor
   - Inventory & Logistics
   - Pharmacy Management
   - Lab Management
   - Dedicated Reporting Server & Custom Analytics
   - Workflow Manager
   - Patient Portal & App
   - Integrations & Custom Features
   - Multi-Location Control
   - Custom or Private Cloud Hosting

   **How the currency is chosen** (inline script):
   - It first checks localStorage keys `ec_pricing_region` and `ec_pricing_region_expires` (14-day TTL, `12096e5` ms).
   - It then guesses from the timezone (`Asia/Kolkata`) or browser language (`en-in`, `hi*`).
   - Finally it calls `fetch('/api/geo')`, a Vercel function that returns `{"country":"IN"}` with `cache-control: private, max-age=86400`.
   - If that fails, it falls back to client-side calls to the third parties `https://ipapi.co/country/` and `https://ipinfo.io/country`. This sends the visitor's IP to third parties, which is a privacy concern.
3. **addons**: "Enhance EasyClinic with add‑ons", four cards:
   - Pharmacy management
   - Integrations & custom development
   - Insurance & third-party payors
   - Lab management
4. **proof**: the same 6 testimonials. Its "See customer stories" link goes to `/#customers`.
5. **faq**: 7 questions. One contains the 4-day training plan:
   - "Day 1, Basic training, 40 minutes"
   - "Day 2, EMR scenario training, 40 minutes"
   - "Day 3, Practice exercises, 20 minutes"
   - "Day 4, Road to expertise, 20 minutes"

   The other questions cover support, no contracts, customisation, security, reception license, and "Why pay for an EMR when there are free alternatives?"
6. **cta**

### `/curapilot/`
Title "CuraPilot, EasyClinic"

1. **hero**
   - H1 "The AI copilot built into your healthcare organisation"
   - Pills: Clinical, Operational, Financial intelligence
   - Mock alert card: "Longitudinal pattern detected… Fatigue (8x), Weight gain (6x), Headaches (5x), Blurred vision (3x)… Clinician decides / Advisory by design"
2. **problems**: "Three leaks" (quoted in full below)
3. **capabilities**: "One intelligence layer" (quoted in full below)
4. **proof**: "Proven in a clinic, not a demo"
   - The AI Consult copilot at Penda Health, Nairobi, with OpenAI, across 39,849 visits. Peer-reviewed follow-ups in Nature Health and Nature Medicine.
   - Link: https://openai.com/index/ai-clinical-copilot-penda-health/
   - Stats: 16% fewer diagnostic errors, 13% fewer treatment errors, 32% fewer history-taking errors, 34% fewer denied claims, 67% fewer stockout events, 99.97% uptime over 9 years
   - Quote from Dr Robert Korom, CMO, Penda Health
   - Closing block: "Your data. Your baseline. Your results." (proof of concept in 90 days or less)
5. **faq**: 4 questions
6. **cta**

**"Three leaks" section, verbatim**

> *Why AI, why now*
> ## Three leaks hiding inside clinic operations
> Better outcomes rarely come from bigger budgets. They come from clinical, operational and financial data working as one layer on the EMR.
>
> **Clinical — Blind spots across visits**
> No single visit contains enough information. Diagnoses hide across encounters, facilities, and time, unless the record is read as one story.
> **16%** Fewer diagnostic errors
>
> **Operations — Stockouts found too late**
> Medicine shortages surface when patients arrive, not weeks before. The signal already exists, it is just scattered across stores and sites.
> **67%** Fewer stockout events
>
> **Revenue — Claims lost at the prescription**
> Treatments get written without knowing what the plan covers. The denial is a clinical decision, weeks before billing sees it.
> **34%** Fewer denied claims

**"Intelligence layer" section, verbatim**

> *What it does*
> ## One intelligence layer, working everywhere your clinic does
> CuraPilot is not a chatbot bolted onto the side of your software. Its capabilities read from the same live record and feed each other: the prescription informs the claim, the claim informs the ledger, the ledger informs the reorder.
>
> **01 — Clinical intelligence**
> Sharper decisions at the point of care, with the paperwork done for you. *(img: A clinician working on a laptop with a stethoscope beside it)*
> - **Clinical decision support** — Real-time, protocol-based guidance at the point of care, tailored to the patient in front of you, not a generic checklist.
> - **Safety alerts** — Drug interaction checks, allergy flags, and dosage verification before a prescription is finalised.
> - **Diagnostic analysis** — Cross-visit pattern recognition that connects symptoms across encounters to surface diagnoses no single visit could reveal.
> - **Voice commands** — Hands-free documentation. Dictate notes, orders, and observations without leaving the patient.
> - **Telemedicine** — Integrated virtual consultations with the full record open, and AI assistance during the call.
> - **Lab & radiology** — Results land in the clinical workflow. Abnormal findings are flagged automatically.
>
> **02 — Operational intelligence**
> The front desk, the pharmacy shelf and every branch dashboard, connected. *(img: Easy Clinic inventory and pharmacy dashboards)*
> - **Supply chain intelligence** — Consumption-based forecasting that spots shortages about 45 days before they hit the dispensing counter.
> - **Operations analytics** — Live dashboards across every facility. See what is happening now, not in last month's report.
> - **Patient engagement** — Automated follow-ups, chronic-disease monitoring, and post-care advice in the patient's language.
>
> **03 — Financial intelligence**
> Revenue that stays where it was earned. *(img: Billing paperwork with a calculator)*
> - **Claims optimisation** — Every claim audited against payer rules before it leaves the facility. Rejections caught at the source.
> - **Executive insights** — Network-wide performance for leadership: facility comparisons, trend analysis, and outcome tracking.

---

## 5. `/easyclinic-vs-practo/`

- Title: "EasyClinic vs Practo (2026) — Clinic Software Comparison". It uses the `PageHero` and `WorkflowTests` components.
- Section order:
  1. **hero**: eyebrow "India · vs Practo"; H1 "EasyClinic vs Practo — 2026 comparison for doctors and growing clinics"; lede "Not a feature laundry list — four clinic tests: front desk, doctor context, follow-ups, and owner visibility."; tagline "Practo = discovery + Ray clinic tools. EasyClinic = clinic operating system."
  2. **context**: "The real choice"
  3. **tests**
  4. **diff**: the comparison table
  5. **fit**: "Where each wins"
  6. **verdict**
  7. **faq**: 6 questions
  8. **cta**: "Run the four tests on your clinic day"

**The four clinic tests, verbatim**

> *Four tests*
> ## How to judge EasyClinic vs Practo
> Run the same four tests on a real schedule — not a demo checklist.
> - **01 Front desk test** — Booking, walk-ins, queue, and WhatsApp requests without three tools open.
> - **02 Doctor context test** — Last Rx, labs, and history ready when the patient enters; Cura AI optional for notes.
> - **03 Follow-up test** — Reminders and Rx re-share without pulling the doctor out of consult.
> - **04 Owner visibility test** — Visits, collections, and no-shows in one minute — not end-of-month archaeology.

**Comparison table, verbatim**

Heading "Side-by-side". Note above the table: "✓ = native. Partial / marketplace / plan-dependent called out. Always get a current India quote."

| Capability | EasyClinic | Practo / Ray |
|---|---|---|
| Primary job | Clinic OS (EMR + ops) | Discovery marketplace + Ray CMS |
| AI documentation | Cura AI | Check Ray plan |
| WhatsApp ops | Native reminders / Rx share | Varies |
| Billing | Visit-tied billing | Ray billing |
| Multi-branch | Strong | Check plan |
| Patient discovery | Not the core product | Practo strength |

**Other copy on the page**
- **Context:** "Growing clinics rarely fail on clinical skill — they fail on coordination… Practo is widely known for patient discovery and appointments; Ray is the clinic-management side. EasyClinic is built as the operating system for the floor — EMR, WhatsApp, billing, pharmacy/lab, and multi-branch — without tying your day to a discovery marketplace."
- **Where each wins:**
  - "EasyClinic wins when: Ops friction is the pain — desk calm, charts, billing, and branches…"
  - "Practo wins when: New-patient discovery / marketplace presence is the growth lever. Many clinics run Practo for discovery and still need a dedicated clinic OS for the day."
- **Verdict:** "If discovery is the growth lever, keep Practo in the mix. If the desk, charts, WhatsApp, and till have to move together — EasyClinic is the stronger clinic operating system for Indian private clinics and growing multi-doctor practices."

---

## What to reuse and what to avoid

**Reuse**
- Colour tokens and the Inter setup through the Fonts API.
- The zero-framework approach: `<details>`-based navigation and accordions, and small vanilla scripts. Total JS is about 1.6 KB.
- Scoped component CSS and WebP images with `srcset`.
- The section sequence: hero → problems → modules → proof → faq → cta.
- Page copy and data: pricing matrix, testimonials, Penda Health stats, Kenya compliance wording, the Practo tests and table, the 122-URL map.

**Avoid**
- The blog-starter global CSS and the placeholder `og:image`.
- Having no robots.txt, leaving staging indexable, and listing /devlabs pages in the sitemap.
- Pages answering 200 both with and without the trailing slash, while internal links point at the non-canonical URL.
- No JSON-LD, missing Twitter tags, and inconsistent title separators.
- Cut-off text in the features mock cards.
- Client-side calls to third-party IP lookup services.
- Tying the custom DevLabs CMS to the Vercel adapter's server routes, if the rebuild goes a different way.