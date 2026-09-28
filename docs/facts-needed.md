# Facts needed from the company

Updated 26 September 2026. This is the one list the company works through before the new website can publish
its remaining pages. It starts with problems found while building the site, then lists what each owner must
supply: what is needed, the file the answer goes in, and the pages it unblocks.

## How to answer

- Send answers to the web team, or edit the file named in the item. Paths are relative to the website repository.
- Compliance files (`src/data/regulators/<id>.yaml`): set `state` to `live`, `in-certification`, `planned` or
  `not-applicable`, and `asOf` to the date that was true (for example `2026-09-26`). For `planned` or
  `in-certification`, add `expected` with a quarter, for example `2027 Q1`.
- Connection files (`src/data/integrations/<id>.yaml`) and the `payments` rows in
  `src/data/countries/<code>.yaml`: `state` is `live`, `beta` or `planned`, with `asOf`.
- Prices: plain numbers per doctor per month, no currency sign, plus `asOf`.
- A page file (`src/content/...`) holds its open questions in square brackets. The web team writes each answer
  into the page.
- One answer often fills many pages: a price, status or contact in `src/data/` shows on every page that uses it.
- A draft page stays off the live site until its questions are answered.
- `pnpm facts:report` writes every open gap to `reports/facts-report.md`. It lists each copy of a question
  separately, so the same fact can appear on several rows. It does not read the four country privacy pages
  (listed under Legal below). A few of its rows need nothing from the company: the sample page in
  `src/content/kitchen-sink/`, `internalSource` on the four study figures that already cite the preprint, and the
  FAQ answers that summarise the published comparison pages, which the web team writes.

## Open issues: settle these first

### 1. The live /kenyademo/ says "DHA Certified"; the Digital Health Agency does not list EasyClinic

Owner: Kenya country lead, with product.

- The live /kenyademo/ shows the badges "DHA Certified" and "Kenya Registered", and the live
  /emr-software-in-kenya/ says "DHA-registered, fully audit-ready software" (`migration/research/facts.md`, section 7).
- On 26 September 2026 the agency's public list of certified systems
  (https://service.dha.go.ke/api/public/registry/listings, behind https://certification.dha.go.ke/registry)
  showed 21 active certificates and none for EasyClinic. Notes: `src/content/listicles/best-clinic-management-software-kenya.yaml`.
- The live privacy policy's Kenya section says only "Certification application #APP-2026-HLQYV6 submitted and
  under review" (`src/content/legal/privacy.mdx`).
- The live Kenya pages contradict each other: a Kenya FAQ says SHA, SHIF and eTIMS support is "Not yet",
  while /kenyademo/ lists SHA and eTIMS as integrations and says "eTIMS compliant".
- A clinic that claims from SHA in the 2026/28 contracting cycle must use a DHA-certified system, and SHA has
  set the deadline at 30 September 2026 (Capital FM, 1 September 2026; cited on the Kenya listicle).
- **Needed:** EasyClinic's DHA certification and SHA e-claims status, each with a date. Until then, remove
  "DHA Certified" and "Kenya Registered" from the live site.
- **Put it in:** `src/data/regulators/ke-digital-health-act.yaml` (DHA certification) and `src/data/regulators/ke-sha.yaml`.
- **Unblocks:** /emr-software-in-kenya/, /pricing/kenya/, and ranking EasyClinic by compliance on
  /best-clinic-management-software-kenya/.

### 2. EasyClinic is on neither the NABIDH nor the Malaffi list of connected systems

Owner: product, with the UAE country lead.

- On 26 September 2026 the Dubai Health Authority's NABIDH list (https://nabidh.dha.gov.ae/#/comm/connectedemr,
  68 systems) and Malaffi's list (https://www.malaffi.ae/connected-emrs/, 72 systems) were searched for
  "EasyClinic", "Easy Clinic" and "Novel Medicare"; neither lists EasyClinic. Notes:
  `src/content/listicles/best-clinic-management-software-uae.yaml`.
- The published UAE listicle links both lists and tells readers to check every vendor, EasyClinic included,
  so readers can find this out.
- The live /emr-software-in-uae/ says "Regulations: DHA and DOH compliance with strict data governance".
- **Needed:** NABIDH, Malaffi and Riayati status with dates. If EasyClinic is not connected, remove the live
  compliance line.
- **Put it in:** `src/data/regulators/ae-nabidh.yaml`, `ae-malaffi.yaml`, `ae-riayati.yaml`.
- **Unblocks:** /clinic-management-software-uae/, /uaedemo/, and ranking EasyClinic on
  /best-clinic-management-software-uae/ (it is listed unranked today).

### 3. The privacy policy allows selling de-identified data; the pages say EasyClinic never sells patient data

Owner: legal, with the founders.

- Section 2, clause (d) of the privacy policy says the company "may collect, analyse, use, publish, create and
  sell de-identified information, of which your personal or sensitive personal information might be a
  component" (`src/content/legal/privacy.mdx`).
- The same policy's Kenya section says "We do not sell personal data, health data, or de-identified data
  derived from health data".
- /about-us/ promises "We never sell patient data" and answers "Does EasyClinic sell patient data?" with no
  (notes in `src/content/company/about-us.yaml`). The home page says EasyClinic "never sells or discloses your
  clinic's data", and /solutions/solo-clinic/ says "We never sell your data or disclose it to anyone", though
  section 3 of the policy allows disclosure in several cases. The live /pricing/ FAQ says "We never misuse,
  sell or in any way disclose your data".
- Section 3(c) also lets the company pass e-prescriptions to third parties, including outside India, to
  improve its products. Check it against the same promise.
- **Needed:** remove or rewrite clause (d) so the policy and the pages agree. Decide whether "never
  discloses" can stand, or the home and solo clinic pages drop it.
- **Put it in:** `src/content/legal/privacy.mdx`.
- **Unblocks:** /about-us/ can link its promise to /privacy/ again.

### 4. Most live pages still offer a free trial, including the IVF and UAE pages

Owner: marketing.

- Decision of 23 September 2026 (spec section 12): no free trial. The new /indiademo/, /kenyademo/ and
  /pricing/uae/ say EasyClinic does not offer one.
- The live /ivf-emr/ says "14-Day Free Trial, 30-Day Money Back Guarantee" (notes in
  `src/content/specialties/ivf-emr.yaml`). The live /emr-software-in-uae/ says "try Easy Clinic absolutely free -
  no strings attached" (notes in `src/content/pricing/uae.yaml` and
  `src/content/country-pages/clinic-management-software-uae.yaml`).
- These are not a few pages. "See for yourself - try Easy Clinic absolutely free - no strings attached" is in
  the closing band of most live pages: on 26 September 2026 it was on the home page, /pricing/, /about-us/,
  /features/, /testimonials/, the India, Kenya, UAE and Nigeria pages, the specialty pages and the country
  listicles. "14-Day Free Trial, with an extra 30-Day Money Back Guarantee" is on /features/ and the specialty
  pages as well (notes in the specialty, feature and NGO files under `src/content/`). /kenyademo/,
  /contact-us/ and the guides did not carry either line.
- **Needed:** remove both lines from the shared closing band and from each page of the live WordPress site
  now. The new site replaces these pages at launch without them.

### 5. The Dental Council of India was replaced by the National Dental Commission

Owner: marketing, with product.

- The notice on https://dciindia.gov.in/ (read 26 September 2026) says the Dental Council of India was dissolved
  with effect from 19 March 2026 and the National Dental Commission took over the same day. Dentists still
  register with their State Dental Council. Notes in
  `src/content/guides/how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci/index.mdx`.
- The new guide already says this.
- **Needed:** update live pages, blog posts and sales material that name the DCI as today's regulator. Product:
  check whether anything in EasyClinic names the DCI (for example a dentist's registration field or the
  prescription print) and update it.

### 6. Marketing must confirm the posts manifest before old post addresses are redirected or removed

Owner: marketing.

- `migration/posts-manifest.csv` proposes a decision for each of the 403 live posts: 165 keep, 129 merge (301
  to a page), 48 drop (410 Gone), 61 review. On 26 September 2026 no row has `yes` in the `confirmed` column, so
  `src/data/redirects-posts.yaml` and `src/data/gone-posts.yaml` are empty.
- Two keep rows clash with redirects already in `src/data/redirects.yaml`: /healthcare-dashboard-software/ and
  /clinic-automation-in-uganda/. Decide which of the two decisions stands.
- **Needed:** check each row, change the decision or target where needed, and put `yes` in `confirmed`. Then the
  web team runs `node scripts/posts-redirects.ts`. Do not re-run `scripts/posts-manifest.ts` after marketing
  starts: it keeps the `confirmed` column but puts back its own proposed decision and target, so a `yes` could
  end up against a decision marketing changed.
- **Unblocks:** redirects and 410s for old post addresses. Most of the old addresses that return 404 in
  `reports/coverage.md` are posts waiting on this, and launch needs none left.

### 7. Blog posts held back from the refresh

Owner: marketing.

- The blog refresh (145 posts) was still running on 26 September 2026. Each post it holds back stays a draft,
  with a note starting "Triage 2026-09-26: hold" that gives the reason and the page it should merge into.
  Reasons include duplicating a page, competing for another page's search phrase, or too little real content
  once invented stories and unsourced numbers are cut.
- List them, with reasons:

  ```sh
  grep -r "Triage 2026-09-26: hold" src/content/posts/
  ```

- **Needed:** for each held post, merge or keep. To merge, set its row in `migration/posts-manifest.csv` to
  `merge`, with the named page as `target`, and `confirmed` to `yes`. A held post is not published, so without a
  confirmed row its old address returns 404 at launch. For each confirmed merge the web team deletes the held
  draft, which still sits at the old address, and then generates the redirect. To keep it, say what real content
  it should carry.

### 8. Review counts need approval before they are printed

Owner: marketing, with the founders.

- Capterra (https://www.capterra.com/p/10026882/Easy-Clinic/reviews/) showed 4.9 from 11 reviews on
  26 September 2026 (notes in the Kenya listicle; the Nigeria listicle also leaves the count out). Competitors' scores on those pages carry their
  counts; EasyClinic's does not.
- The Google rating (4.8) comes from the Trustindex badge in the live footer, which gives no count and no link.
- **Needed:** approval to print the Capterra count; the Google review count and a link to where it can be
  checked. Recheck both on the day they are filled.
- **Put it in:** `src/data/facts.yaml`: `capterraReviews` (value, asOf) and `googleReviews` (value, source, asOf).
- **Unblocks:** counts on the rating badges across the site (home, features, specialties, comparisons,
  listicles), as spec 2.4 asks.

### 9. Product screenshots do not exist

Owner: marketing, with product.

- Spec section 12 (`docs/spec/easyclinic-website-rebuild-handoff_1.md`, "Screenshot list") lists 31 screens to
  take from a demo account seeded with realistic data, the first eight first. None exist, so pages meant to
  publish carry no product pictures, and drafts show "screenshot needed" boxes (the "screenshot needed" rows in
  `reports/facts-report.md`). The Nigeria page also needs a naira invoice with the HMO and patient shares split,
  which the spec list does not include.
- The six-minute product tour from the same brief does not exist either, so "See the product in 6 minutes"
  appears on no page.
- **Needed:** the screens as WebP at 1440 x 900, plus 390 x 844 phone captures where marked. Send the files to
  the web team, which places each on the page that asks for it.
- **Unblocks:** product pictures on the home, feature, solution, specialty and country pages.

### 10. Other contradictions to settle

- **Go-live time** (product): the site says "as little as 3 days" (live /kenyademo/); the live Kenya listicle
  said "2 to 4 week setup". Confirm, with typical times for a single clinic and a group
  (`src/data/facts.yaml`, `goLiveDays`).
- **Demo length** (marketing): the live /kenyademo/ says 30 minutes; the new site says 20 minutes everywhere.
  Confirm 20.
- **Nigeria** (Nigeria lead): the live /emr-software-in-nigeria/ says features are "aligned with the NDPA 2023"
  and that "Plans are priced in naira", though no naira price exists. Confirm or remove before launch.
- **India** (product): the live home page says "Compliance with: ABHA, HIPAA, GDPR" while the live India page
  calls ABDM, NABH and DPDP work "in progress"; two live solution pages claim HIPAA, PCI-DSS and GDPR. The new
  site repeats none of these.

### 11. The privacy policy states Kenyan registrations the rest of the site may not use (found in the 27 September audit)

- **Evidence:** the live privacy policy (https://www.easyclinic.io/privacy-policy/, imported word for word as
  `src/content/legal/privacy.mdx`) says EasyClinic is registered with Kenya's Office of the Data Protection
  Commissioner as a data processor (certificate serial 16499, valid 2 December 2025 to 2 December 2027), that a
  Digital Health Agency certification application (#APP-2026-HLQYV6) is under review, and that a Kenyan serving copy
  of the data is "in implementation".
- **Why it matters:** the rest of the site treats EasyClinic's regulator status as unknown and never states it. If
  these statements are right, they are the first confirmed Kenyan facts and can go on /trust/ and the Kenya pages
  (`src/data/regulators/ke-dpa.yaml`, `ke-digital-health-act.yaml`, with an as-of date). If they are not, the policy
  needs correcting.
- **Owner:** legal and the Kenya lead. Confirm or correct; the build uses nothing from the policy until then.
- **Also in the policy:** it still names the old domain easycliniconline.com, which no longer resolves.

## Draft pages and what holds them

| Page | Waiting on |
| --- | --- |
| /clinic-management-software-india/ | Product (ABDM, GST, payments, hosting, product details), India lead, finance (GST in the price), screenshots |
| /emr-software-in-kenya/ | Issue 1, finance (KES prices), product (SHA, eTIMS, SMART, M-Pesa, DHIS2, hosting), Kenya lead (clients), screenshots |
| /clinic-management-software-uae/, /uaedemo/ | Issue 2, finance (AED prices), product (UAE statuses, Arabic, claims), UAE lead (contact, clients, quote), legal checks |
| /hospital-management-software-nigeria/, /nigeriademo/ | Finance (NGN prices), product (HMO claims, NHIA, NDPA, Paystack, Flutterwave), Nigeria lead (contact, clients, quote) |
| /pricing/kenya/, /pricing/uae/, /pricing/nigeria/ | Finance (prices, VAT, invoicing company, payment methods, licence rules), product (eTIMS, eClaimLink, gateways) |
| /trust/ | Product (hosting, security, data on leaving, AI data), legal (data processing agreement), UAE and Nigeria contacts |
| /integrations/ | Product (15 connection statuses, API), finance (integration pricing), marketing (custom development page, M11) |
| /solutions/ngo-clinics/ | Finance (NGO discount, licence rule), product (connectivity, DHIS2, languages) |
| /partner-with-ec/ | Founders (programme terms, two named partners) |
| /privacy/india/, /privacy/kenya/, /privacy/uae/, /privacy/nigeria/ | Legal, product (hosting, breach notice, consent), country leads (registration, data protection officer) |

## Founders and finance

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| F1 | Kenya prices in KES: Professional and Premium, annual and quarterly | `src/data/prices/kes.yaml` (`plans`, `asOf`) | /pricing/kenya/, /emr-software-in-kenya/; a KES price on /easyclinic-vs-kenyaemr/ |
| F2 | UAE prices in AED, same four numbers | `src/data/prices/aed.yaml` | /pricing/uae/, /clinic-management-software-uae/, /uaedemo/ |
| F3 | Nigeria prices in NGN, same four numbers | `src/data/prices/ngn.yaml` | /pricing/nigeria/, /hospital-management-software-nigeria/, /nigeriademo/ |
| F4 | Add-on prices or ranges (pharmacy, lab, claims, integrations) in each currency | `addons` in `src/data/prices/usd.yaml`, `inr.yaml`, `kes.yaml`, `aed.yaml`, `ngn.yaml` | Add-on prices on /pricing/ and /pricing/india/ (shown without one today) and the three country pricing drafts |
| F5 | Whether INR prices include 18% GST or it is added; whether KES, AED and NGN prices include VAT, and the rate | `taxNote` in `inr.yaml`, `kes.yaml`, `aed.yaml`, `ngn.yaml` | /pricing/india/ and the India page FAQ; /pricing/kenya/, /pricing/uae/, /pricing/nigeria/; Nigeria page FAQ |
| F6 | How clinics pay the subscription in each country (card, bank transfer, M-Pesa, other) | `paymentMethods` in `inr.yaml`, `kes.yaml`, `aed.yaml`, `ngn.yaml` | The four country pricing pages |
| F7 | Which company invoices clinics in Kenya, the UAE and Nigeria: Novel Medicare Solutions Pvt Ltd in Kolkata or a local company. The privacy policy names a Kenyan subsidiary, Novel Software Solutions Private Ltd | `src/content/pricing/kenya.yaml`, `uae.yaml`, `nigeria.yaml`; `src/content/legal/privacy/kenya.mdx` | The three pricing drafts, /privacy/kenya/ |
| F8 | How these are licensed and charged: a Kenyan clinical officer who writes notes and prescriptions; a UAE part-time or visiting doctor; a Nigerian locum; a nurse or clinical officer who sees patients alone at an NGO clinic | `src/content/pricing/kenya.yaml`, `uae.yaml`, `nigeria.yaml`; `src/content/solutions/ngo-clinics.yaml` | Those four pages |
| F9 | What a second branch adds to the monthly bill in Nigeria; whether and how often NGN prices are reviewed when the naira moves, and the notice clinics get | `src/content/country-pages/hospital-management-software-nigeria.yaml`, `src/content/pricing/nigeria.yaml` | Nigeria page, /pricing/nigeria/ |
| F10 | Whether hosting UAE patient data inside the UAE is included or costs extra | `src/content/pricing/uae.yaml` | /pricing/uae/ |
| F11 | Cancelling: notice period and refunds; any fee for a clinic's data export | `src/content/trust/trust.yaml`, `src/content/country-pages/clinic-management-software-india.yaml` | /trust/, India page |
| F12 | From the company's tax advisers: how VAT applies to a clinic's own bills (consultations, medicines, cosmetic procedures) in the UAE and in Nigeria | `src/content/pricing/uae.yaml`, `src/content/pricing/nigeria.yaml` | /pricing/uae/, /pricing/nigeria/ |
| F13 | NGO tier or discount, in numbers, and which organisations qualify | `src/content/solutions/ngo-clinics.yaml` | /solutions/ngo-clinics/ |
| F14 | Partner programme: commission on what EasyClinic invoices, or a partner price and resale margin, with the range; each tier's name, who it suits, what it pays and asks; what moves a partner up a tier; how and how often partners are paid, and for how long; what happens to the share when a clinic cancels; training hours, format and trainer; what the demo environment contains and how long access lasts; co-marketing by tier | `src/content/company/partner-with-ec.yaml` | /partner-with-ec/ |
| F15 | Two partners who agree to be named: name, country, what they do, the clinics they bring, year joined | `src/content/company/partner-with-ec.yaml` | /partner-with-ec/ |
| F16 | How an integration project is priced, with a typical range, and the time from scoping to a working connection | `src/content/trust/integrations.yaml` | /integrations/ |
| F17 | Research claims: approve the short study wording; confirm whether CuraPilot is the "AI Consult" system in the Penda Health preprint; verify title, authors and EasyClinic's role for the Nature Health and Nature Medicine papers, or drop them; for 34% fewer denied claims, 67% fewer stockouts, 45 days' warning of a shortage and 99.97% uptime, give what was measured, the period and who approves it, or retire the figure | `src/data/study.yaml` | Pages citing the study (/ai/, /curapilot/, home, /about-us/, /customers/, Kenya pages). The four unsourced figures appear on no page until sourced |

## Product

Product, customer success and whoever runs hosting answer these.

### Compliance status

Each file needs `state` and `asOf` (see "How to answer"). Describing a rule is allowed today; stating
EasyClinic's status is not, until these are filled.

| # | Files in `src/data/regulators/` | Unblocks |
| --- | --- | --- |
| P1 | India: `in-abdm-m1.yaml`, `in-abdm-m2.yaml`, `in-abdm-m3.yaml` (ABDM milestones 1 to 3), `in-dpdp.yaml`, `in-gst.yaml`, `in-nabh.yaml`, `in-nmc-telemedicine.yaml` | /clinic-management-software-india/ (its title says "ABDM Ready", which stays only if the status supports it), /trust/; status lines on /indiademo/ and feature pages |
| P2 | Kenya: `ke-sha.yaml`, `ke-etims.yaml`, `ke-digital-health-act.yaml`, `ke-dpa.yaml`, `ke-kmpdc.yaml`, `ke-moh-reporting.yaml` (see issue 1) | /emr-software-in-kenya/ (its title says "SHA Ready"), /pricing/kenya/, /trust/, /integrations/ |
| P3 | UAE: `ae-nabidh.yaml`, `ae-malaffi.yaml`, `ae-riayati.yaml`, `ae-adhics.yaml`, `ae-eclaims.yaml`, `ae-pdpl.yaml` (see issue 2). Also Shafafiya, Abu Dhabi's claims platform, which has no file yet; the web team adds one | /clinic-management-software-uae/, /uaedemo/, /pricing/uae/ |
| P4 | Nigeria: `ng-nhia.yaml`, `ng-hmo-claims.yaml`, `ng-ndpa.yaml`; also what a clinic must do for NHIA and HMO claims | /hospital-management-software-nigeria/, /nigeriademo/, /pricing/nigeria/ |

### Connections, payments and claims

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| P5 | Status and date for each of the 15 connections: accounting software, Azure Data Factory, DHIS2, eTIMS, KenyaEMR, lab devices, M-Pesa, online payments, OpenMRS, Power BI, SHA, SLADE, SMART, SMS and email, WhatsApp; the quarter each planned one is due; what "beta" means and which clinics can use a beta connection | `src/data/integrations/<name>.yaml`; `src/content/trust/integrations.yaml` | /integrations/, Kenya pages |
| P6 | Payment status: UPI, Razorpay, PayU (India); M-Pesa, and whether through Daraja, a Till or a Paybill and whether it matches payments to bills automatically (Kenya); Paystack and Flutterwave (Nigeria); UAE card terminals or gateways (none listed) | `payments` in `src/data/countries/in.yaml`, `ke.yaml`, `ng.yaml`, `ae.yaml` | Country pages, /uaedemo/, /nigeriademo/, /pricing/nigeria/, /pricing/uae/, /integrations/ |
| P7 | Tax invoices on the clinic's patient bills: GST (India), eTIMS (Kenya), VAT invoices showing the clinic's TRN (UAE), VAT (Nigeria) | `taxInvoicing` in `src/data/countries/in.yaml`, `ke.yaml`, `ae.yaml`, `ng.yaml` | Country pages, /uaedemo/, pricing drafts |
| P8 | Claims: Indian TPAs connected, and corporate or PSU credit billing; UAE insurers and TPAs clinics claim with today, and whether EasyClinic checks for prior authorisation before a claim goes out; Nigerian HMOs with claim packs built, how a claim reaches each, which receive claims electronically, whether enrollee eligibility is checked online, and which NHIA accreditation documents EasyClinic produces | `insurers` in `src/data/countries/ae.yaml`, `ng.yaml`; the country page and demo files | Country pages, /uaedemo/, /nigeriademo/, /pricing/nigeria/ |

### Hosting, security and data

These fill /trust/ and repeat on the country and privacy pages. The privacy policy's Kenya section already
names Microsoft Azure (United States region), OpenAI for de-identified data, WATI and TextLocal: confirm these
are current and say what applies to the other countries.

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| P9 | Hosting region and provider, and backup region, for Indian, Kenyan, UAE and Nigerian clinics; whether a serving copy of Kenyan data is held in Kenya; whether any Indian, UAE or Nigerian patient data is stored or processed abroad, where, by whom and why | `src/content/trust/trust.yaml`; the four country page files; `src/content/legal/privacy/<country>.mdx` | /trust/, country pages, country privacy pages |
| P10 | Encryption in transit (protocol and version) and at rest (who holds the keys), and whether attachments are encrypted the same way | `src/content/trust/trust.yaml` | /trust/ |
| P11 | Backups: how often, how long kept, where stored; whether restores are tested and the last test date; whether a clinic can get a deleted record back, and how long it takes | `src/content/trust/trust.yaml` | /trust/ |
| P12 | Access: other roles a clinic can set (such as pharmacist or branch manager), and what each sees; two-step sign-in and on which plans; what the audit log records, how long it is kept and who reads it; which EasyClinic staff can open a clinic's data, why, and whether the clinic is told; log retention for Indian clinics (the DPDP rules ask for at least a year) | `src/content/trust/trust.yaml`, `src/content/legal/privacy/india.mdx` | /trust/, /privacy/india/ |
| P13 | Uptime measured, over what period and how; whether it is published; when planned maintenance runs in each country and how clinics are told | `src/content/trust/trust.yaml` | /trust/ |
| P14 | Security certification held (ISO 27001, SOC 2 or other, with certifier and date), or none; security contact email; how soon a report is acknowledged; any disclosure programme | `src/content/trust/trust.yaml` | /trust/ |
| P15 | Breach notice to clinics: hours after EasyClinic becomes aware, channel, what the notice contains (the Kenya section of the policy promises 24 hours) | `src/content/trust/trust.yaml`; `src/content/legal/privacy/<country>.mdx` | /trust/, country privacy pages |
| P16 | Sub-processors (hosting, SMS, WhatsApp, email, payment, AI) with the country each processes data in; how clinics are told before a new one is added, and whether they can object; whether EasyClinic signs a data processing agreement with every clinic, and in which countries (with legal) | `src/content/trust/trust.yaml` | /trust/ |
| P17 | Leaving EasyClinic: what a clinic gets back (records, prescriptions, bills, attachments), in what format, within how many days; whether and when EasyClinic deletes its copy, and when backups holding it expire; whether the customer contract says the same, and in which clause | `src/content/trust/trust.yaml`; the four country page files | /trust/, country pages |
| P18 | AI: what patient data leaves EasyClinic for the AI model, which provider processes it, in which country | `src/content/trust/trust.yaml` | /trust/ |
| P19 | Consent: whether EasyClinic gives clinics a consent notice template and in which languages; whether the product records each patient's consent and withdrawal (the Kenya section of the policy describes consent fields: confirm they exist); the name of the agreement with each Indian clinic that serves as its DPDP contract, and where clinics can read it | `src/content/legal/privacy/india.mdx`, `kenya.mdx`, `nigeria.mdx` | Country privacy pages |
| P20 | UAE: how records are kept for at least 25 years, including after a clinic leaves; which DHA and DoH (ADHICS) requirements EasyClinic meets, with evidence; documents EasyClinic provides for a DHA licence or inspection | `src/content/legal/privacy/uae.mdx`, `src/content/country-pages/clinic-management-software-uae.yaml` | /privacy/uae/, UAE page |

### How the product works

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| P21 | Offline and slow connections: what still works without internet; what is saved when the connection or power drops mid-consult; behaviour on slow mobile data and data used per day; the slowest connection a site can work on, measured; whether private cloud hosting on Enterprise keeps a site running when its internet drops | The four country page files, `src/content/solutions/ngo-clinics.yaml` | Country pages, /solutions/ngo-clinics/ |
| P22 | Self-hosted option per country: which plans, cost (with finance), what still needs internet, who runs backups | The four country page files | Country pages |
| P23 | Doctor app: Android, iOS or mobile browser only, and which screens work on a phone | The four country page files | Country pages |
| P24 | Languages: prescription languages besides English in India, and how regional text is produced (saved templates or translation); how Swahili text is produced; Arabic on prescriptions, invoices, reminders and the patient app, whether it prints right to left, and whether staff screens run in Arabic; Hausa, Yoruba, Igbo or Pidgin prescriptions; time to add a language; screen languages for NGO sites | The country page files, `src/content/country-demos/uaedemo.yaml`, `src/content/solutions/ngo-clinics.yaml`; `languages` in `src/data/countries/in.yaml` (empty) | Country pages, /uaedemo/, /solutions/ngo-clinics/ |
| P25 | WhatsApp sender in India, the UAE and Nigeria: the clinic's own number or EasyClinic's, and who pays the message charges | The India, UAE and Nigeria page files | Those pages |
| P26 | India: fields on an EasyClinic e-prescription (registration number, signature), whether it carries everything the NMC guidelines ask for, and what is checked against the NMC medicine lists; Tally export status, format and entries; the help given with HFR and HPR registration | `src/content/country-pages/clinic-management-software-india.yaml` | India page |
| P27 | Kenya and NGOs: whether EasyClinic submits MOH figures to DHIS2 or the clinic uploads them | `src/content/country-pages/emr-software-in-kenya.yaml`, `src/content/solutions/ngo-clinics.yaml` | Kenya page, NGO page |
| P28 | UAE: whether one account connects a Dubai branch to NABIDH and an Abu Dhabi branch to Malaffi at once; time to connect a new clinic to NABIDH, Malaffi or Riayati | `src/content/country-pages/clinic-management-software-uae.yaml` | UAE page |
| P29 | Developers: whether there is an API for a clinic's own developer and on which plans; FHIR version and resources; how credentials are issued, and whether there is a sandbox; a documentation link or address; lab analyser and radiology device makes and models connected; whether KenyaEMR and EasyClinic can run side by side and what moves between them; whether Tally has been connected for any clinic | `src/content/trust/integrations.yaml` | /integrations/ |
| P30 | Setting up: migration time per country, which systems EasyClinic imports from, and whether migration is in the price; go-live time for a multi-branch group (see issue 10) | The four country page files, the UAE and Nigeria demo files | Country pages, /uaedemo/, /nigeriademo/ |
| P31 | Measured results: one real no-show reduction after WhatsApp reminders, and minutes per note with Cura AI, each with source and date | `src/data/facts.yaml` (`noShowReduction`, `minutesPerNote`) | /features/appointment-scheduling/; a time-saved claim for Cura AI (no page makes one today) |
| P32 | Specialty features the pages leave out until confirmed, and the plan that carries each (for example a periodontal chart for dental, an INR log for cardiology, weight-based dosing for paediatrics, which plan carries IVF cycle screens) | Listed in the notes of each `src/content/specialties/<page>.yaml` | Fuller specialty pages |
| P33 | Old-site screenshots held back in the 28 September image review (`docs/image-plan.md` 5.4): whether the "Clinical decision" alert (#115) is CuraPilot or the "AI Consult" panel, the tool named in the Penda Health study; whether "Allied TPA", "Ashok Lab" and "Quick Service Pharmacy" in the demo data are invented names; the prescription print languages (P24) for the three print-language screens | `docs/image-plan.md` 10 and `migration/images/image-sources.csv` (`company_to_confirm`) | Screens on /ai/, /curapilot/, /kenyademo/, /features/emr/, /features/insurance-claims/, /features/lab/, /features/revenue-management/, /features/pharmacy-and-inventory/, /solutions/polyclinic/, /indiademo/ and the neurology and orthopaedics pages |

## Country leads

### India

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| IN1 | India contact: name, whether they agree to be named on the site, role, hours, call-back window (phone and email exist) | `contact` in `src/data/countries/in.yaml` | /indiademo/, India page, /contact-us/ |
| IN2 | A named Indian clinic chain on EasyClinic: name, city, number of branches, with consent | `src/content/country-pages/clinic-management-software-india.yaml` | India page |
| IN3 | Grievance officer for India: name, designation, email, postal address, and the response time in days (at most 90) | `src/content/legal/privacy/india.mdx` | /privacy/india/ |

### Kenya

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| KE1 | Issue 1: DHA certification and SHA status with dates, and the live "DHA Certified" badge | See issue 1 | See issue 1 |
| KE2 | Whether Walter Brian Maguke agrees to be named on the site; his role, WhatsApp number, hours, call-back window; a Kenya office address | `contact` and `office` in `src/data/countries/ke.yaml` | /kenyademo/, Kenya page, /pricing/kenya/ |
| KE3 | Named Kenyan clients: a polyclinic or specialist centre, and a hospital OPD or nursing home, each with town and consent | `clients` in `src/data/countries/ke.yaml`; `src/content/country-pages/emr-software-in-kenya.yaml` | Kenya page |
| KE4 | Confirm or correct the Kenya facts in the privacy policy (imported word for word from the live site): the Kenyan subsidiary Novel Software Solutions Private Ltd; ODPC registration as a data processor (987-106F-72C3, valid 2 December 2025 to 2 December 2027); the DHA application #APP-2026-HLQYV6; dpo@easyclinic.io as the data protection officer; hosting on Azure in the United States with a Kenyan copy "in implementation"; transfers to the United States and India; breach notice within 24 hours | `src/content/legal/privacy.mdx` (Kenya section), `src/content/legal/privacy/kenya.mdx` | /privacy/kenya/, /privacy/ |

### UAE

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| AE1 | UAE contact: name, consent to be named, role, phone, WhatsApp, email, hours, call-back window; an office or partner address; EasyClinic's registered representative or partner in the UAE, by name | `contact` and `office` in `src/data/countries/ae.yaml`; `src/content/country-demos/uaedemo.yaml` | /uaedemo/, UAE page, /pricing/uae/, /trust/ |
| AE2 | Who gives demos to UAE clinics (a UAE team, a partner or the Kolkata team) and their hours in UAE time; whether training runs online or at the clinic; support number and hours | `src/content/country-pages/clinic-management-software-uae.yaml`, `src/content/country-demos/uaedemo.yaml` | UAE page, /uaedemo/ |
| AE3 | Named UAE clients (solo clinic, polyclinic, group, hospital OPD, or a launch partner), each with emirate and consent; one UAE testimonial with name, role, clinic, emirate and consent on file | `clients` in `src/data/countries/ae.yaml`; a new file in `src/data/testimonials/` | UAE page, /uaedemo/, /pricing/uae/ |
| AE4 | Whether EasyClinic has a data protection officer for the UAE (name or role, contact) | `src/content/legal/privacy/uae.mdx` | /privacy/uae/ |

### Nigeria

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| NG1 | Nigeria contact: name, consent to be named, role, phone, WhatsApp, hours, call-back window in West Africa Time, and who calls clinics back; an office or partner address (today the site shows only hello@easyclinic.io) | `contact` and `office` in `src/data/countries/ng.yaml` | Nigeria page, /nigeriademo/, /pricing/nigeria/, /trust/ |
| NG2 | Whether demos are video only or also in person in Lagos or Abuja; whether training is given on site and what it costs; support number and hours | `src/content/country-demos/nigeriademo.yaml`, the Nigeria page file | /nigeriademo/, Nigeria page |
| NG3 | Named Nigerian clients (solo clinic, polyclinic, group, hospital OPD) with city and consent; the cities where EasyClinic has clinics (Lagos and Abuja are listed from coverage wording only); one Nigerian testimonial with consent on file | `clients` and `cities` in `src/data/countries/ng.yaml`; a new file in `src/data/testimonials/` | Nigeria page, /nigeriademo/, /pricing/nigeria/ |
| NG4 | Whether EasyClinic is registered with the NDPC (controller or processor of major importance, class, date), and whether it has a data protection officer for Nigeria | `src/content/legal/privacy/nigeria.mdx` | /privacy/nigeria/ |
| NG5 | Confirm the clinic details on the demo page read true in Nigeria: HMO authorisation codes in the register margin, transfer alerts on the receptionist's phone, the fee-for-service shortfall at month end | `src/content/country-demos/nigeriademo.yaml` | /nigeriademo/ |

## Legal

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| L1 | Issue 3: remove or rewrite privacy policy clause (d) | `src/content/legal/privacy.mdx` | /about-us/ link to /privacy/ |
| L2 | Sign off the privacy policy and terms, imported word for word from the live site; confirm the registered office they give (188/2 Bankim Mukherjee Sarani, New Alipore, Kolkata 700053) is current, beside the office the site shows (30 Circus Avenue, Kolkata 700017) | `src/content/legal/privacy.mdx`, `src/content/legal/terms.mdx`, `src/data/site.yaml` | /privacy/, /terms/ at launch |
| L3 | For each country privacy page: which document prevails where it and the main policy differ; EasyClinic's role for patient records (processor for the clinic, controller or fiduciary, or both); the lawyer or firm who reviewed it, and the date | `src/content/legal/privacy/india.mdx`, `kenya.mdx`, `uae.mdx`, `nigeria.mdx` | The four country privacy pages |
| L4 | India: exact DPDP commencement day in May 2027; whether EasyClinic is a Significant Data Fiduciary; any countries notified under section 16(1), and any health rule requiring hosting in India; when the main policy will be updated for the DPDP Act; who tells the Board and patients of a breach where EasyClinic is the fiduciary; "grievance officer" or the Act's own terms | `src/content/legal/privacy/india.mdx` | /privacy/india/ |
| L5 | Kenya: whether the Kenya section stays in the main policy or moves to this page; that a Kenyan clinic needs its own ODPC registration; how section 47 of the Digital Health Act applies to hosting outside Kenya; the transfer basis under sections 48 and 49; what the Digital Health Act regulations require of clinic software; check the consolidated Data Protection Act for amendments | `src/content/legal/privacy/kenya.mdx` | /privacy/kenya/ |
| L6 | UAE: which parts of the PDPL apply beside the ICT Health Law; whether the PDPL Executive Regulations are issued and their breach period; the exact title of the 2021 decision on storing medical data outside the UAE; rules for clinics licensed by MOHAP or Emirates Health Services; whether private clinics in Sharjah and the Northern Emirates must connect to Riayati, and from when; check the rules stated on the UAE page (NABIDH for a DHA licence, Malaffi, ADHICS, VAT zero-rating of healthcare) | `src/content/legal/privacy/uae.mdx`, `src/content/country-pages/clinic-management-software-uae.yaml` | /privacy/uae/, UAE page |
| L7 | Nigeria: the transfer basis under sections 41 and 43; that the GAID 2025 on the NDPC site is current; the reading on the Nigeria page that a private clinic counts as a data controller of major importance | `src/content/legal/privacy/nigeria.mdx`, `src/content/country-pages/hospital-management-software-nigeria.yaml` | /privacy/nigeria/, Nigeria page |

## Marketing

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| M1 | Issue 6: confirm the posts manifest | `migration/posts-manifest.csv` (`confirmed`) | Redirects and 410s for old post addresses |
| M2 | Issue 7: merge or keep each held blog post | The post's manifest row | Old addresses of held posts |
| M3 | Issue 8: approve review counts | `src/data/facts.yaml` | Counts on rating badges |
| M4 | Issue 4: remove free-trial offers from the live site | Live WordPress pages | Consistent answer before launch |
| M5 | Issues 9 and 5: screenshots and the six-minute tour; remove Dental Council of India wording from live material | Files to the web team | Product pictures; tour links |
| M6 | Photos: a real photograph of Girish Mohata (spec 12 says the founder block does not run without one) and of each leader on /about-us/ | `photo` in `src/data/authors/<id>.yaml` | Founder block on home, /about-us/ |
| M7 | Authors: Akshay Chandel's role; a short bio and LinkedIn address for all six authors | `src/data/authors/*.yaml` | Bylines, /about-us/, author details shown to search engines |
| M8 | Testimonials: a measured result the doctor stands behind, or none, for all 16 quotes; the city for 11 of them (Chao Rochek Buragohain, Foster Akaketwa, Hisham Ismail, NRP Chandra Balaji, Prantar Chakrabarti, Premanand Raya, Sanjay Teotia, Siddhartha Ghosh, Srinivasa Teja, Tarun Mishra, TL Prabhu) | `city`, `outcome` in `src/data/testimonials/<id>.yaml` | Testimonial cards |
| M9 | New named testimonials, with consent on file, for the specialty pages without one (ayurveda, cardiology, dental, dermatology, ENT, GP, mental health, neurology, OB-GYN, ophthalmology, orthopaedics, paediatrics, physiotherapy) and for /solutions/polyclinic/ | New files in `src/data/testimonials/` | Those pages |
| M10 | Confirm the demo is 20 minutes (issue 10) | Tell the web team | Demo pages |
| M11 | Redirect decisions marked "confirm" in `src/data/redirects.yaml`: /emr-software-in-malaysia/, /newsletter/, /siliconindia/, /jarico/ and the specialty address choices. /custom-healthcare-software-development/ now redirects to /integrations/ (to /features/ while /integrations/ is a draft), because no case studies are on record; if there are two real case studies with API details, say so and it becomes /services/custom-development/ instead | `src/data/redirects.yaml`; `src/content/trust/integrations.yaml` | Legacy address coverage, /integrations/ |
| M12 | A human read-aloud pass of each page before launch (spec 6.5). Every page records an AI review with this pass still pending | `editorialPass` in each page file | Every page |
| M13 | UAE page title: every competitor puts NABIDH in its title; the new title leaves it out until NABIDH is live with a date (issue 2) | `src/content/country-pages/clinic-management-software-uae.yaml` | UAE page search ranking |

## Engineering access

| # | What is needed | Put it in | Unblocks |
| --- | --- | --- | --- |
| E1 | Search Console "Pages" export and the GA4 "Page Not Found" list | `migration/legacy-extra/<name>.txt`, one address per line | Redirects for old addresses no sitemap lists |
| E2 | Search Console domain property, verified and shared with the web team and marketing | Search Console | Sitemap submission and 404 monitoring after launch |
| E3 | Access to GA4 property 347728478 | GA4 | The demo form's key event, Search Console link, bot filter |
| E4 | GitHub repository connected to the Vercel project, and the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel: Settings, Deployment Protection, Protection Bypass for Automation) | GitHub and Vercel | The check that runs after each deployment |
| E5 | Vercel Production settings: `CRM_WEBHOOK_URL` (and `CRM_WEBHOOK_TOKEN` if the CRM needs one), `DEMO_REF_SECRET`, `PUBLIC_GA4_ID`; a CRM test bin for a preview test | Vercel project settings | Demo form leads reaching the CRM, conversion counting |
| E6 | Domains: www.easyclinic.io and easyclinic.io added to Vercel; Cloudflare records pointed at Vercel, DNS only; TTLs lowered a day ahead | Vercel and Cloudflare | Launch |
| E7 | A separate, unlinked host name for the WordPress copy kept for 90 days, noindexed | Hosting for WordPress | Rollback |
| E8 | A demo account seeded with realistic data, as spec 12 describes | EasyClinic product | Screenshots and the tour (issue 9) |
