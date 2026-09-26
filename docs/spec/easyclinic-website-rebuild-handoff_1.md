# EasyClinic Website Rebuild: Developer and Content Handoff

Version 1.0, 17 September 2026. Source: the staging build at staging-easyclinic.vercel.app, the live site at www.easyclinic.io, Search Console (www.easyclinic.io property) and GA4 (Easy Clinic - GA4, property 347728478), 85 SERP checks across India, Kenya, UAE and Nigeria, and a benchmark of 16 competitor sites.

## 0. How to use this document

This is the single specification for the rebuilt marketing site. Sections 1 and 2 are the decisions and rules that apply to every page. Section 3 is the information architecture, URL map and redirects. Section 4 is the keyword map (title, meta, H1 per page). Section 5 is the page-by-page spec. Section 6 is the writing guide and the FAQ rules. Section 7 is the frontend and UI specification. Section 8 is what the analytics data says. Section 9 is the build order and the QA checklist. Section 10 lists sources.

Anything in square brackets, such as [KES price] or [status as of date], is a fact the company must supply before that page is written. Do not publish a page with a bracket still in it.

Three people need to sign off before build starts: whoever owns the product name (section 1.2), whoever can state the compliance status per regulator (section 2.6), and whoever can state local prices (section 5.12).

## 1. Summary and decisions

### 1.1 What the data says

The live site earned about 360,000 clicks in the twelve months to 14 September 2026. Almost all of it was Kenyan patients searching doctor names on the /doctors/ directory, which the company removed in June 2026 and is moving to a separate domain. Queries containing "software" or "EMR" produced 888 clicks in the whole year. The site currently gets about 2,300 clicks a month, led by the India EMR page (position 14) and the Kenya EMR page (position 5).

So the rebuild is not protecting a traffic base. It is building one, from a starting point of under 1,000 buyer-intent clicks a year. The first-year target is 10,000 clicks from software and EMR queries and 400 real demo requests.

### 1.2 Decisions required before build

| Decision | Recommendation | Owner |
| --- | --- | --- |
| AI product naming | EasyClinic is the platform. Cura AI is the name for every AI feature inside the product (ambient notes, AI reception, AI billing, stock prediction). CuraPilot is the clinical copilot studied with Penda Health and OpenAI. The "AI Assistant" line on the $79 plan becomes "Cura AI (documentation)". Exactly two AI names on the site, never four. | Product |
| Brand spelling | "EasyClinic", one word, everywhere. Legal entity stays "Novel Medicare Solutions Pvt Ltd" on About, Privacy and Terms. | Marketing |
| Compliance statements | Each regulator gets one of four states with a date: Live, In certification, Planned (quarter), Not applicable. No page says "in progress" or "confirm in demo". | Product and compliance |
| Local pricing | INR, KES, AED and NGN prices per doctor per month published on /pricing and four country pricing pages. No competitor in these markets publishes local prices. | Founders |
| Free trial | Decided 23 Sep: no free trial. The six-minute product tour is the self-serve door on every page beside "Book a demo". | Decided |
| Imagery | Decided 23 Sep: clinic imagery is generated (environmental only, never presented as customers); product screenshots are taken by the team from a seeded demo tenant. Brief in section 12. | Decided |
| Directory | /doctors/ and /clinics/ URLs return 410 until the new directory domain is live, then 301 per URL. | Engineering |
| Country slugs | Rename every country page to its head keyword at launch with 301s, except /emr-software-in-kenya, which stays because it ranks. | Marketing and engineering |
| Blog | Prune from about 403 posts to about 120, each owned by a landing page. | Marketing |
| Knowledgebase | Either build a real on-domain help centre or 301 /knowledgebase to help.easyclinic.io. | Product |

### 1.3 The strategy in one sentence

Every page gets one query cluster it owns, one promise in the buyer's words, one piece of proof that belongs to that page, five to eight real FAQs, a named author and date, and curated links to the two or three pages its reader needs next.

## 2. Site-wide rules

These apply to every page. Section 5 lists only what is specific to each page.

### 2.1 One page, one query cluster

Each page owns exactly one cluster from section 4 and no other page targets it. Where two pages could chase the same term, the cannibalisation rules in 4.5 decide. If a new page cannot name a cluster that no existing page owns, it is not built.

### 2.2 Answer first

The first paragraph under the H1 answers the page's owning query in two sentences, with a number where one exists. "EasyClinic's Premium plan is $99 per doctor per month" beats "affordable plans for every clinic".

### 2.3 Headings

Where the query is a question, the H2 is that question ("Why do insurance claims get rejected?") and the first 40 to 80 words under it answer it. Where the query is not a question, the H2 is a plain statement ("Pharmacy stock, dispensed from the prescription"). Do not force every H2 into a question; a page where every heading is a question reads as a template. Sentence case in all headings.

### 2.4 Proof

Every page carries one proof block that belongs to that page: a number from the Penda Health study where it answers the page's question, a named customer with city and specialty, a review badge with its count, or a captioned screenshot that repeats the claim. The same six testimonials do not appear on every page; each testimonial is placed on the page it praises.

### 2.5 FAQs

Five to eight questions, each one a prospect has actually asked, answered in the first sentence, with the uncomfortable ones included (what is not live, what the product does not do, what the second branch costs, what happens to the data on leaving). A page with no true FAQs leaves the section out. Section 6.4 lists which staging FAQs to drop.

### 2.6 Compliance statements

Each regulator appears with a state and a date: Live (integration or certificate named), In certification (with the body and the expected quarter), Planned (quarter), or Not applicable. The trust page holds the master table; country pages repeat only the rows for that country and link to the trust page.

### 2.7 Author and date

Every landing and content page shows a named author, a role, and a "Last updated" date. Authors are clinicians, the product lead or a named country lead, never "EasyClinic Team".

### 2.8 Persona vocabulary

Solo doctor pages: minutes, evenings, thirty-second prescription, no IT staff. Polyclinic pages: one record, shared rooms, roles, who sees what. Chain pages: central, standardise, SOP adherence, branch drift, KPIs. Hospital OPD pages: throughput, queue, claims, pharmacy and lab turnaround.

### 2.9 Internal linking

Every hub links down to all its leaves. Every leaf links up to its hub and sideways to the two or three pages its reader needs next. Specifically: every solution page links to the three feature pages its persona cares about most, one specialty page and one country page; every feature page links back to all five solution pages; every country page links to its listicle, its comparison page, its pricing page and its demo page; every specialty page links to the solution page that fits its usual practice size. The shared "Explore the rest of the platform" block and the shared closing CTA block are removed and replaced with these curated links.

### 2.10 Schema

Organization and WebSite (with SearchAction) on Home. SoftwareApplication with Offer on Home, /pricing and each country pricing page. FAQPage on every page that has an FAQ. BreadcrumbList on every page below Home. Article with author and dateModified on blog, guides, listicles and comparison pages. ScholarlyArticle citation on /curapilot. LocalBusiness on Contact. Review and AggregateRating only where the reviews are actually displayed on the page. No Product schema on competitor rows in comparison tables.

### 2.11 What is removed site-wide

The repeated stat line and closing block on 30+ pages; the "Explore the rest of the platform" link list; the six testimonials pasted onto /features and /pricing; the "How do we start?" FAQ; every "confirm in demo" answer; the words listed in section 6.2.

## 3. Information architecture

### 3.1 Site tree

```
Home
├── Product (/features hub)
│   ├── /features/emr
│   ├── /features/appointment-scheduling
│   ├── /features/billing
│   ├── /features/insurance-claims
│   ├── /features/revenue-management
│   ├── /features/pharmacy-and-inventory
│   ├── /features/lab
│   ├── /features/telehealth
│   ├── /features/patient-engagement
│   ├── /features/whatsapp
│   ├── /features/reports-and-dashboards
│   └── /features/multi-location
├── Solutions
│   ├── /solutions/solo-clinic
│   ├── /solutions/polyclinic
│   ├── /solutions/clinic-chain
│   ├── /solutions/hospital-opd
│   ├── /solutions/ngo-clinics
│   └── /doctors (two-question selector)
├── Specialties (/specialties hub): 12 pages, existing slugs kept
├── Countries (/countries hub)
│   ├── /emr-software-in-kenya (slug kept) + /kenyademo + /best-clinic-management-software-kenya + /pricing/kenya
│   ├── /clinic-management-software-india + /indiademo + /best-clinic-management-software-india + /pricing/india
│   ├── /clinic-management-software-uae + /uaedemo + /best-clinic-management-software-uae + /pricing/uae
│   ├── /hospital-management-software-nigeria + /nigeriademo + /best-clinic-management-software-nigeria + /pricing/nigeria
│   └── 7 standard country pages + rest-of-world form on the hub
├── Start a clinic (/start-a-clinic hub): country guides, existing slugs kept
├── AI: /ai, /curapilot
├── Pricing: /pricing + 4 country pricing pages
├── Compare (/compare hub): vs pages, alternatives pages, country listicles
├── Trust: /trust, /integrations, /switch
├── Resources: /blog, /help, /glossary, /customers, /resources
└── Company: /about-us, /contact-us, /partner-with-ec, /careers, /privacy (+ 4 country pages), /terms
```

### 3.2 URL rules

| Rule | Decision |
| --- | --- |
| Host | www.easyclinic.io only; 301 from the bare domain. Google currently indexes both. |
| Trailing slash | None. 301 the slash form. The live WordPress site uses slashes; the live comparison pages do not. |
| Case and separators | Lowercase, hyphens. |
| Pages that rank today | Keep the slug exactly: /emr-software-in-kenya, /best-clinic-management-software-kenya, /easyclinic-vs-kenyaemr, /easyclinic-vs-practo, /easyclinic-emr-vs-traditional-emr, /kenyademo, the specialty pages, the start-a-clinic guides. |
| Country pages | Rename to the head keyword with "software" in the slug, never "system" or "emr": /clinic-management-software-india, /clinic-management-software-uae, /hospital-management-software-nigeria, /clinic-management-software-{ghana, uganda, tanzania, rwanda, south-africa, ethiopia, qatar}. Kenya is the one exception. |
| New and non-ranking pages | Folders: /features/, /solutions/, /compare/, /pricing/, /privacy/. |
| Category archives | noindex /category/* and /tag/*. |
| Staging | Block indexing until launch. Fix the Nigeria page's canonical, which currently points at production. |

### 3.3 Navigation

Header: Product (mega menu, twelve features grouped Front desk, Chart, Money, Growth), Solutions (by clinic type on the left, by specialty on the right), Countries, AI, Pricing, Resources (Compare, Customers, Start a clinic, Blog, Help, Switch). Right side: Login, WhatsApp, Book a demo.

Footer: the full lists per hub, the trust page, the privacy pages, and the country phone numbers with the named local contact.

### 3.4 Redirect map

The complete file needs the live sitemap export (sitemap-pages.xml, sitemap-posts.xml, sitemap-posts-2.xml, sitemap-posts-3.xml). The rows below cover the audited pages.

| Live URL | New URL | Type |
| --- | --- | --- |
| /clinic-chain-software/ | /solutions/clinic-chain | 301 |
| /hospital-opd-nursing-home-software/ | /solutions/hospital-opd | 301 |
| /cmo-landing-page/, /cfo-landing-page/, /ceo-landing-page/ | /features/reports-and-dashboards | 301 |
| /healthcare-dashboard-software/ | /features/reports-and-dashboards | 301 |
| /appointment-scheduling-at-easy-clinic/ | /features/appointment-scheduling | 301 |
| /patient-engagement-at-easyclinic/ | /features/patient-engagement | 301 |
| /payor-management/ | /features/insurance-claims | 301 |
| /insurance-claim-management-system/ | /features/insurance-claims | 301 |
| /revenue-management/ | /features/revenue-management | 301 |
| /reports-and-dashboards/ | /features/reports-and-dashboards | 301 |
| /ngo-landing-page/ | /solutions/ngo-clinics | 301 |
| /curapilot-ai/ | /curapilot | 301 |
| /emr-software-in-india/ | /clinic-management-software-india | 301 |
| /emr-software-in-uae/ | /clinic-management-software-uae | 301 |
| /emr-software-in-nigeria/ | /hospital-management-software-nigeria | 301 |
| /emr-software-in-{other}/ | /clinic-management-software-{other} or /countries | 301 |
| /physiotherapy-clinic-management-software/ | /physiotherapy-software | 301 |
| /ayurveda-clinic-management-software/, /ayurveda-emr-software/ | one ayurveda specialty page (the two cannibalise each other today) | 301 |
| /questions-to-ask-your-clinic-emr-software-provider/ | rewrite in place as a buyer's guide, or 301 to /switch | 301 or keep |
| /doctors/*, /clinics/* | 410 until the directory domain is live, then per-URL 301 | 410 then 301 |
| /category/*, /tag/* | noindex | header |
| India city pages (Mumbai, Delhi NCR, Hyderabad, Chennai, Bangalore) | keep only with a local client and address; otherwise 301 to /clinic-management-software-india | 301 |
| Micro-market country pages (Maldives, Mauritius, Seychelles, Somalia, Fiji, Suriname, Trinidad and Tobago) | /countries | 301 |

Also pull the GA4 "Page Not Found" report (357 views in the last 28 days) and add every URL in it to the map.

### 3.5 Directory pages

The directory has moved to its own domain. The listing pages for EasyClinic customers on that domain will carry a booking button that runs on the EasyClinic patient portal, so the directory is also a patient acquisition channel for the software. Two pages on easyclinic.io say so once it is live: the patient engagement page ("your clinic is listed and bookable on [directory], and every booking lands in your calendar") and the Kenya country page, with the directory's monthly patient searches as the proof. The two sites share no templates, boilerplate or navigation; a single "runs on EasyClinic" badge on real customers' listings is the only link back.

### 3.6 Blog pruning

About 403 posts live today. Roughly 40 were published in one hour on 3 August 2026 with the same "How AI is..." structure, and a 2025 run covers CRISPR, gene therapy, VR and humanoid robots. Keep posts that answer a buyer question or already rank (the Kenya set, the comparisons, clinic setup cost in India, revenue leaks, the compliance checklist, insurance claim management, the WhatsApp groups post, the start-a-clinic guides). Merge near-duplicate AI explainers into one post per topic. Noindex or delete the frontier-technology posts. Target: 120 posts, each owned by a landing page, each with an author and a date.

## 4. Keyword map

One head keyword per page, chosen from the phrase competitors' title tags and aggregator categories actually use. Titles are 60 characters or fewer; metas 155 or fewer. Demand was estimated from SERP shape and confirmed against Search Console where the site already has impressions; the "SERP today" column says who holds the top three so the writer knows what the page is up against.

### 4.1 Core and product pages

| Page | Head keyword | Secondary keywords | Title tag | Meta description | H1 | SERP today |
| --- | --- | --- | --- | --- | --- | --- |
| / | clinic management software | practice management software, AI EMR software, clinic software for doctors, cloud clinic software | Clinic Management Software for Doctors and Clinics: EasyClinic | Appointments, EMR, billing, pharmacy and WhatsApp reminders in one system, for clinics in India, Kenya, UAE and Nigeria. Since 2003. | Clinic management software that runs the desk, the chart and the till | Listicles and aggregators (Techjockey, SoftwareSuggest, Doccure). Site currently at position 26 for the head term with 13.6K impressions. |
| /features/emr | EMR software for clinics | electronic medical records software for doctors, e-prescription software, EHR for small practice, ABDM ready EMR | EMR and E-Prescription Software for Clinics: EasyClinic | Write the note, print or WhatsApp the prescription and keep every visit on one record. Works on any device. | EMR and e-prescription software for clinics | Capterra and SoftwareSuggest categories; Doctorsapp owns the ABDM long tail. |
| /features/appointment-scheduling | clinic appointment scheduling software | patient appointment software, doctor appointment booking software, online patient booking | Clinic Appointment Scheduling Software: EasyClinic | Book, reschedule and remind patients on WhatsApp and SMS from one calendar that also handles walk-ins. | Appointment scheduling that cuts no-shows | US listicles (PracticeSuite, Zocdoc); nothing localised for India or Africa. |
| /features/billing | medical billing software for clinics | clinic billing software, GST billing software for doctors, OPD billing software | Clinic Billing Software with GST Invoicing: EasyClinic | GST invoices, OPD bills, receipts on WhatsApp and a till that closes clean at day end. | Billing and GST invoicing for your clinic | India: mybillbook, ZYNO Books. US: Forbes, PracticeSuite. |
| /features/insurance-claims | insurance claims software for clinics | TPA software for hospitals, HMO claims management software, cashless claims software | TPA and HMO Claims Software for Clinics: EasyClinic | Submit cashless claims, track TPA approvals and reconcile HMO and SHA payments from your own system. | TPA and HMO claims without a second system | Fragmented by country; no vendor owns it across all four markets. |
| /features/revenue-management | clinic revenue cycle management | revenue leakage in clinics, claims denial management, RCM software for clinics | Clinic Revenue Cycle Management: EasyClinic | See unbilled visits, denied claims and cash variance before month end. | Stop revenue leakage before it reaches your books | US RCM vendors; EasyClinic's own blog post already ranks. |
| /features/pharmacy-and-inventory | pharmacy management software for clinics | clinic inventory management software, in-house pharmacy software, medical inventory software | Pharmacy and Inventory Software for Clinics: EasyClinic | Dispense from the prescription, track batch and expiry, and move stock between branches. | Run your in-house pharmacy from the same system | Enterprise pharmacy vendors; clinic-scale field is thin. |
| /features/lab | lab management software for clinics | laboratory information system, LIS software, pathology lab software | Lab Management Software for Clinics: EasyClinic | Order tests from the chart and get results back into the record, with reports sent on WhatsApp. | Lab orders and results, inside the EMR | ligolab content farm, Capterra. |
| /features/telehealth | telemedicine software for doctors | teleconsultation software, video consultation software for clinics, telemedicine software India | Telemedicine Software for Doctors: EasyClinic | Video consults, e-prescriptions and payment before the call, in the same system as clinic visits. NMC guideline aware. | Teleconsultations beside your clinic visits | Techjockey and Capterra India categories, Doccure, DocEngage. |
| /features/patient-engagement | patient engagement software | patient portal software, patient app for clinics, patient retention software | Patient Engagement and Portal Software: EasyClinic | A portal and app for booking, reports and messages, plus recall campaigns that bring patients back. | Keep patients coming back between visits | US enterprise vendors (Phreesia); portal listicles more open. |
| /features/whatsapp | WhatsApp for clinics | WhatsApp appointment reminders, WhatsApp Business API for healthcare, WhatsApp patient communication | WhatsApp Reminders and Messaging for Clinics: EasyClinic | Reminders, prescriptions, reports and feedback on WhatsApp, sent from your clinic software, with approved templates. | WhatsApp reminders and messaging, built in | Owned by messaging API resellers, not clinic software. Open. |
| /features/reports-and-dashboards | clinic dashboard software | clinic KPI dashboard, healthcare dashboard software, hospital MIS reports, doctor productivity report | Clinic Dashboard and Reports Software: EasyClinic | Revenue, no-shows, doctor productivity, stock and claims across every branch in one morning view. | One dashboard for the numbers a clinic owner checks daily | Thin; EasyClinic's live dashboard page already appears. |
| /features/multi-location | multi-location clinic management software | multi-clinic software, multi-site practice management software | Multi-Location Clinic Software: EasyClinic | One login for every branch, central price lists and SOPs, per-branch reports. | One system for every clinic location | Listicles only (Pabau, AdvancedMD). |
| /ai | AI medical scribe | ambient AI documentation, AI scribe for doctors, AI clinical notes, AI receptionist for clinics | Cura AI: AI Medical Scribe and Clinic Assistant: EasyClinic | Cura AI listens to the consult, drafts the note and prescription, answers WhatsApp and codes the bill. Peer reviewed. | An AI scribe that writes the note while you see the patient | Crowded: Heidi, DeepScribe, Sunoh, athenahealth, Microsoft Dragon. The live /ai page has 59K impressions at position 5.8; check its queries before changing target. |
| /curapilot | AI copilot for doctors | clinical decision support software, AI clinical assistant, point-of-care decision support | CuraPilot: AI Clinical Copilot Proven on 39,849 Visits | CuraPilot flags missed diagnoses, drug interactions and claim errors during the consult. Studied with Penda Health and OpenAI. | The AI copilot studied on 39,849 patient visits | "Clinical decision support" returns regulatory content; "AI copilot for doctors" returns products. |
| /pricing | clinic management software pricing | EMR software cost, clinic software cost India, price per doctor per month | EasyClinic Pricing: Per Doctor, Per Month | Professional $79, Premium $99, Enterprise on quote. Reception included, no setup fee, no contract. See local prices. | Pricing, per doctor per month | India pricing guides (Cufront, Ichelon, ConnectAI); no vendor pricing page in the top three. |
| /trust | HIPAA compliant EMR software | ABDM compliant EMR software, NABIDH approved EMR, EMR data security, SHA ready clinic software | Security and Compliance: EasyClinic | Where your data lives, who can see it, and the current status of ABDM, SHA, NABIDH and NDPA support, with dates. | How EasyClinic keeps patient data safe and compliant | Splits by country; nobody covers all four regions on one page. |
| /integrations | EMR integration | EMR API integration, clinic software integrations, lab and pharmacy integration | EasyClinic Integrations and API | Payment gateways, labs, Tally, Power BI, WhatsApp and FHIR APIs, with the status of each. | Integrations and API | Service agencies; easy to outrank. |
| /switch | EMR data migration | switching EMR systems, migrate from Practo Ray, paper to EMR | Switching to EasyClinic: Data Migration | What we import from your current system, how long it takes, and what happens on day one. | Switch without losing a single record | US migration vendors; a plain product page can compete. |

### 4.2 Solutions and country pages

| Page | Head keyword | Secondary keywords | Title tag | Meta description | H1 | SERP today |
| --- | --- | --- | --- | --- | --- | --- |
| /solutions/solo-clinic | clinic management software for small clinics | single doctor clinic software, solo practice management software, small clinic EMR | Clinic Software for Solo and Single-Doctor Practices | Appointments, prescriptions and billing for a one-doctor clinic. Set up in four days, no IT staff, $79 a month. | Clinic software built for one doctor | Clinicea, Medesk, Noterro listicles. |
| /solutions/polyclinic | polyclinic management software | multi-specialty clinic software, polyclinic EMR, polyclinic software India | Polyclinic Management Software: EasyClinic | One record across every specialist, shared rooms and slots, department-wise billing. | Software for polyclinics and multi-specialty centres | Vendor pages only; low competition. |
| /solutions/clinic-chain | clinic chain management software | multi-branch clinic software, clinic chain EMR, franchise clinic software | Clinic Chain Software for Multi-Branch Practices | Central records, SOPs, stock and a branch-by-branch dashboard for chains of 2 to 100+ locations. | Run every branch like one clinic | Docpulse, Clinicia, Pabau listicle. |
| /solutions/hospital-opd | OPD management software | hospital OPD software, OPD queue management system, nursing home software India | OPD Management Software for Hospitals and Nursing Homes | Token queues, doctor schedules, pharmacy, lab and claims for outpatient departments. Not a full HIS, and honest about it. | OPD software for hospitals and nursing homes | Vendor pages (Healthray, Ezovion). The live page sits at position 18 with 14.7K impressions. |
| /solutions/ngo-clinics | clinic software for NGO and mission hospitals | NGO clinic management software, mission hospital software, low-cost EMR for charitable clinics | Clinic Software for NGO and Mission Clinics | Patient records and donor-ready reports for low-connectivity clinics, with NGO pricing. | Software for NGO clinics and mission hospitals | Almost empty; low volume. Keep lean. |
| /clinic-management-software-india | clinic management software in India | EMR software India, ABDM compliant EMR, clinic software Mumbai Delhi Bangalore | Clinic Management Software in India, ABDM Ready | ABDM-ready EMR, GST billing, UPI and WhatsApp for Indian clinics, from a Kolkata company running clinics since 2003. | Clinic management software for clinics in India | Mocdoc, Dochours, listicles. The live page is at position 13 and converts at 5.77%. |
| /emr-software-in-kenya | clinic management software in Kenya | EMR software Kenya, SHA compliant clinic software, hospital management system Nairobi | Clinic Management Software in Kenya, SHA Ready | M-Pesa billing, eTIMS, SHA e-claims and WhatsApp reminders. Peer reviewed in Nairobi with Penda Health. | Clinic software for clinics in Kenya | Clinicea, Kangai, aggregators. Live page at position 5. |
| /clinic-management-software-uae | clinic management software in UAE | NABIDH compliant EMR Dubai, Malaffi integrated clinic software, Riayati EMR, DHA approved clinic software | NABIDH and DHA Ready Clinic Software in UAE | Clinic software for Dubai, Abu Dhabi and the Northern Emirates with NABIDH, Malaffi and Riayati status stated per emirate. | Clinic software for Dubai and the UAE | Densest market; every competitor puts NABIDH in the title. |
| /hospital-management-software-nigeria | hospital management software in Nigeria | clinic management software Nigeria, EMR software Nigeria, HMO claims software, NDPA compliant | Clinic and Hospital Software in Nigeria: EasyClinic | HMO claim packs, NDPA compliance and a system that keeps working through power and internet outages. | Clinic and hospital OPD software for Nigeria | Aggregators, AjirMed, Mocdoc. |
| /best-clinic-management-software-{country} | best clinic management software in [country] | top clinic software [country] 2026, clinic software comparison [country] | Best Clinic Management Software in Kenya (2026) | Seven options compared for private clinics on SHA readiness, M-Pesa, pricing and support. Updated monthly. | Best clinic management software in Kenya | India saturated; Kenya open and already ranking; Nigeria uses "hospital" phrasing. |

### 4.3 Specialty and comparison pages

| Page | Head keyword | Secondary keywords | Title tag | H1 | SERP today |
| --- | --- | --- | --- | --- | --- |
| /dental-emr-software | dental clinic software | dental practice management software, dental EMR, dental clinic management system | Dental Clinic Management Software: EasyClinic | Software for dental clinics | Open Dental, CareStack globally; Mocdoc, Techjockey regionally. |
| /dermatology-emr-software | dermatology EMR software | dermatology EHR, skin clinic management software, aesthetic clinic software | Dermatology EMR Software: EasyClinic | EMR for dermatology and skin clinics | ModMed, OmniMD. |
| /pediatric-emr | pediatric EMR software | pediatric clinic software, vaccination tracking software | Pediatric EMR Software: EasyClinic | EMR for paediatric clinics | OmniMD, CharmHealth, athenahealth. |
| /cardiology-emr | cardiology EMR software | cardiology EHR, cardiac clinic software | Cardiology EMR Software: EasyClinic | EMR for cardiology clinics | Prognocis, AdvancedMD. |
| /mental-health-emr | mental health EHR software | psychiatry EMR software, therapist practice management software | Mental Health and Psychiatry EHR Software: EasyClinic | EHR for mental health and psychiatry practices | DocVilla, ICANotes. |
| /ophthalmology-emr | ophthalmology EMR software | eye clinic management software | Ophthalmology EMR Software: EasyClinic | EMR for eye clinics | Compulink, ModMed, MaximEyes. |
| /orthopedic-emr | orthopedic EMR software | orthopedic practice management software | Orthopedic EMR Software: EasyClinic | EMR for orthopaedic clinics | PraxisEMR, ModMed. |
| /obgyn-emr | OB-GYN EMR software | gynecology clinic software, prenatal care software | OB-GYN and Gynaecology EMR Software: EasyClinic | EMR for OB-GYN and gynaecology clinics | Prognocis, OmniMD, CureMD. |
| /ivf-emr | IVF clinic management software | fertility clinic EMR, IVF EMR software | IVF Clinic Management Software: EasyClinic | Software for IVF and fertility clinics | Small niche. Live page at position 20 with 22K impressions: a quick win. |
| /physiotherapy-software | physiotherapy practice management software | physiotherapy clinic software | Physiotherapy Practice Management Software: EasyClinic | Software for physiotherapy clinics | Zanda, Cliniko. Live page at position 16. |
| /ayurveda-software | ayurveda clinic management software | ayurveda EMR, ayurvedic hospital software | Ayurveda Clinic Management Software: EasyClinic | Software for ayurveda clinics and hospitals | Live page already at position 9; merge the two ayurveda pages. |
| /easyclinic-vs-practo | EasyClinic vs Practo Ray | Practo Ray review, Practo Ray pricing | EasyClinic vs Practo Ray (2026): Which Fits Your Clinic? | EasyClinic vs Practo Ray | Nobody yet. |
| /easyclinic-vs-healthplix | EasyClinic vs HealthPlix | HealthPlix review, HealthPlix pricing | EasyClinic vs HealthPlix (2026) | EasyClinic vs HealthPlix | Nobody yet. |
| /compare/practo-ray-alternatives | Practo Ray alternatives | switch from Practo Ray, Practo Ray competitors | Practo Ray Alternatives for Clinics (2026) | Alternatives to Practo Ray | G2, SoftwareSuggest, Capterra. |
| /compare/healthplix-alternatives | HealthPlix alternatives | HealthPlix competitors | HealthPlix Alternatives for Clinics (2026) | Alternatives to HealthPlix | G2, Techjockey; Healthray runs its own page. |
| /easyclinic-vs-kenyaemr | KenyaEMR vs private EMR | KenyaEMR alternative, private clinic EMR Kenya | EasyClinic vs KenyaEMR: Which EMR for a Kenyan Clinic? | EasyClinic vs KenyaEMR | EasyClinic already ranks; keep and refresh. |
| /easyclinic-emr-vs-traditional-emr | EMR vs paper medical records | benefits of EMR over paper | EMR vs Paper Records: What Changes for a Clinic | EMR vs paper records | Broad informational; treat as a guide that links into /switch. |

### 4.4 Start-a-clinic guides (existing slugs, kept)

| Page | Head keyword | Impressions (12 months) | Position |
| --- | --- | --- | --- |
| /the-ultimate-guide-to-starting-a-clinic-in-kenya | how to start a clinic in Kenya | 66,341 | 5.8 |
| /how-do-i-get-approval-from-the-kmpdc-in-kenya | KMPDC registration for clinics | 90,547 | 7.2 |
| /how-much-does-it-cost-to-open-a-clinic-in-nairobi | cost of opening a clinic in Nairobi | 41,510 | 6.1 |
| /clinic-in-uganda and /your-essential-guide-to-launching-a-clinic-in-uganda | how to start a clinic in Uganda | 81,011 combined | 4.5 to 5.8 |
| /clinic-in-india and /your-complete-guide-to-starting-a-clinic-in-india | how to start a clinic in India | 85,551 combined | 5.3 to 6.7 |
| /how-much-does-it-cost-to-open-a-clinic-in-mumbai | clinic setup cost in Mumbai | 50,738 | 6.8 |
| /how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci | NMC registration for clinics | 53,691 | 5.6 |
| /how-to-setup-clinic-legally-in-india-compliance-guide | clinic licences in India | 48,346 | 5.8 |
| /patient-data-privacy-laws-in-india | patient data privacy laws India | 46,571 | 6.4 |
| /your-roadmap-to-launching-a-thriving-clinic-in-nigeria, /clinic-in-nigeria | how to start a clinic in Nigeria | 48,565 combined | 5.7 to 8.8 |
| /clinic-in-ethiopia, /your-comprehensive-guide-to-starting-a-clinic-in-ethiopia | how to start a clinic in Ethiopia | | 5.7 to 6.4 |

Where two guides target one country, merge into the better-ranking slug and 301 the other.

### 4.5 Cannibalisation rules

1. Home mentions "AI EMR software" once as a descriptor; /ai owns scribe and documentation terms; /curapilot owns copilot and decision-support terms.
2. Billing owns invoices and GST; insurance-claims owns claim submission, TPA, HMO and SHA mechanics; revenue-management owns leakage, denials and ageing. "Revenue cycle management" appears only on the revenue page.
3. WhatsApp-as-infrastructure (API, templates, message costs) lives on /features/whatsapp; patient-engagement treats WhatsApp as one channel among the portal, app and recall campaigns.
4. Country page = product and compliance intent; country listicle = comparison intent; country pricing page = cost intent; country demo page = conversion. The regulator explainer is written once on the country page and linked from the other three.
5. Specialty pages own "[specialty] EMR"; clinic-type pages own size and structure terms. A dental chain links both ways rather than getting a merged page.
6. "ABDM compliant EMR" is the single best open keyword found (one competitor holds it with blog volume, not product depth). It belongs to /trust, with the India page and /features/emr referencing it in passing.
7. The three executive persona pages (CMO, CFO, CEO) fold into /features/reports-and-dashboards, which owns "healthcare dashboard software".
8. The two ayurveda pages and the two Uganda guides merge into one page each.

## 5. Page specifications

Each spec gives: the promise (the one thing the page says), what it owns (from section 4), the title, meta and H1 (from section 4, repeated only where they matter), the opening answer, the section order with the component to use (section 7 defines the components), the proof block, the CTAs, the FAQ direction, schema, and outbound links. Copy in quotes is directional, not final; the writing rules in section 6 apply to all of it.

### 5.1 Home (/)

Promise: the one clinic operating system that runs the desk, the chart, the till and the pharmacy, with AI proven in a peer-reviewed study, from one doctor to 100+ locations.

Opening answer: "EasyClinic runs appointments, EMR, billing, pharmacy and lab in one cloud system for solo doctors, polyclinics and clinic chains in 18 countries. Its Cura AI layer cut diagnostic errors 16% and denied claims 34% in a peer-reviewed study with Penda Health and OpenAI."

Sections, in order:

1. Hero (component: Hero). H1, opening answer, two CTAs ("Book a 20-minute demo", "See pricing"), badge row (Capterra 4.9, Google 4.8, Nature Medicine study), one product screenshot.
2. Persona router (PersonaRouter). Four cards in the ladder vocabulary: "I run my own clinic", "We share one front door", "We run many branches", "We run a hospital OPD". Each links to its solution page.
3. What EasyClinic replaces (ReplacesStrip). Paper files, WhatsApp chaos, Excel billing, three logins.
4. Four module pillars (ModuleGrid, 4 columns): Front desk, Chart, Money, Growth. One screenshot and one outcome line each, linking to the feature pages.
5. Cura AI block (ProofBlock, study variant). The three study numbers and a link to /curapilot.
6. Built for your regulator (RegulatorStrip). ABDM, SHA, NABIDH, NHIA logos or names with the four-state status, linking to /trust.
7. Testimonials (TestimonialRow, 3). One per persona, not the standard six.
8. Switching is a four-day course (StepList). Day 1 basics 40 min, Day 2 EMR scenarios 40 min, Day 3 practice 20 min, Day 4 road to expertise 20 min, from the pricing FAQ.
9. FAQ (FAQ, 6 to 8). What is clinic management software; is EasyClinic an EMR or a full HIS; what it costs; does it work offline; who owns the data; is the AI optional; can it run multiple locations; how long to go live.
10. Latest guides (ContentCards, 3).

Proof: study numbers, review badges, 5,000+ doctors, 200 cities, since 2003, 92% retention.
CTAs: primary "Book a 20-minute demo"; secondary "See pricing"; sticky WhatsApp.
Schema: Organization, WebSite with SearchAction, SoftwareApplication, FAQPage.
Links out: all five solution pages, /features, /ai, /curapilot, /trust, /pricing, the four deep country pages.

### 5.2 AI overview (/ai)

Promise: every AI feature in EasyClinic, what each does, and which plan includes it. This is the umbrella page; /curapilot is the evidence page.

Opening answer names the six capabilities and the plan each sits in.

Sections: (1) Hero with a 30-second ambient-note demo video. (2) Six jobs Cura AI does (FeatureRows): writes the note while you talk; answers the phone and WhatsApp; flags a missed diagnosis; codes the bill; predicts stockouts; summarises the day for the owner. Each with mechanism, screenshot and plan tag. (3) How it stays safe (TrustList): clinician confirms every suggestion, no training on patient data, audit log, consent language per country. (4) Proof summary linking to /curapilot. (5) Comparison table "Cura AI vs a standalone AI scribe" (ComparisonTable): works inside the EMR, no copy-paste, billing-aware. (6) FAQ, 6 to 8: privacy, languages and accents, Hindi and Swahili status, accuracy, cost, offline, can it be switched off, specialty templates.

Proof: study numbers, a measured minutes-per-note figure [measure and publish], a doctor quote about documentation.
CTAs: "Try Cura AI on your next 10 patients", "Read the study".
Note: the live /ai page has 59K impressions at position 5.8 with 1.9% CTR. Check in Search Console which queries it ranks for before the rewrite; if they are brand variants, the new head keyword is a change of target and the old queries need a home elsewhere.

### 5.3 CuraPilot (/curapilot)

Promise: the only clinic AI whose outcomes were measured on real visits and peer-reviewed.

Keep the current three-leaks and intelligence-layer sections. Add: (a) a study card (StudyCard) with method, sample, sites, publication links and date; (b) "What changed for the clinician" walkthrough with a screenshot of a live alert; (c) "What it costs and how a 90-day POC runs" with milestones; (d) an integration note ("sits on EasyClinic or on your existing HIS") with an honest list of supported systems. Remove the 99.97% uptime stat (it moves to /trust). FAQ, 8: replaces my EMR; what the study showed; clinician stays in control; works with our existing EMR; what happens when the clinician disagrees; available in Kenya, India, UAE, Nigeria; how it is priced; what data leaves the clinic.

Proof: the study, Dr Korom quote (video if available).
CTAs: "Start a 90-day POC", "Download the study summary" (gated PDF).
Schema: ScholarlyArticle citation, FAQPage, VideoObject.

### 5.4 Features hub (/features)

Promise: every module in the order a patient moves through the clinic, with one screenshot and one outcome each; the map to twelve deeper pages.

Sections: (1) Patient-journey diagram (JourneyDiagram): book, arrive, consult, prescribe, pay, dispense, follow up, report. (2) One block per module (ModuleGrid, 12), each with a benefit-and-mechanism name ("Thirty-second prescriptions with drug-interaction checks", "Reminders on WhatsApp that cut no-shows"), a screenshot, one outcome line and a link. All twelve get equal depth. (3) Included-by-plan matrix (PlanMatrix) linking to /pricing. (4) Integrations strip linking to /integrations. (5) FAQ, 6: is the EMR customisable; can modules be bought separately; pharmacy, lab, telehealth, inventory, patient app included; what is not included (inpatient, fundraising CRM).

Proof: one testimonial per pillar chosen for the module it praises. The six-testimonial block is removed.
CTAs: "Watch a 6-minute product tour", "Book a demo".

### 5.5 Solo doctor clinic (/solutions/solo-clinic)

Promise: an EMR you learn in four days that gives you your evenings back, priced for one doctor, with nothing to migrate when you open a second room.

Opening answer: "One that finishes the note with the visit, reminds patients on WhatsApp and balances the till, for $79 per doctor per month with the reception licence included."

Sections: (1) Hero with a single-screen screenshot (today's list, chart, invoice). (2) A Tuesday with and without EasyClinic (DayTimeline): 9:00 walk-in, 9:12 thirty-second prescription, 13:00 reminders sent, 18:30 till closed, no evening charting. (3) Three pains (PainBlocks): why charting takes evenings; why patients do not show up; why billing is done after the fact. Each with the feature and a number [measured no-show reduction]. (4) What you get on day one, tied to the Professional plan. (5) When you grow: add a doctor, a room or a branch without switching. (6) One solo-doctor testimonial with specialty and city (Dr Prabhu, Prashanthi Clinic fits). (7) The four-day learning path. (8) FAQ, 8: overkill for a solo clinic; trial; price; second location; offline; mobile app; own templates; e-prescription legality; data export; who does setup. (9) Links: /features/emr, /features/appointment-scheduling, /features/whatsapp, /specialties, the buyer's country page.

CTAs: "See the product in 6 minutes" (tour), "Book a demo", "See solo pricing".

### 5.6 Polyclinic (/solutions/polyclinic)

Promise: one patient record shared across every specialist, rooms and slots that do not collide, and access rules that decide who sees what.

Opening answer names the four things: shared chart, resource calendar, pharmacy and lab in the loop, role-based access.

Sections: (1) Hero with the resource calendar (doctors, rooms, devices in columns). (2) Where group practices lose the thread (PainBlocks): specialists on islands; rooms double-booked; pharmacy lagging the visit. (3) One record, many workflows: each specialty keeps its own templates on one chart, with a dental and a dermatology screenshot. (4) Roles and permissions matrix (RolesMatrix): owner, doctor, nurse, reception, pharmacist, accountant. (5) Shared billing and package treatments. (6) A polyclinic testimonial (Dr Kolanakuduru, Aditya Women and Infertility, if multi-specialist). (7) FAQ, 8: own workflow per specialist; pharmacy and lab; who sees what; revenue split by doctor; referral between departments; shared front desk; pricing per doctor; migration from two systems; adding a branch later. (8) Links: /features/patient-engagement, /features/insurance-claims, /features/reports-and-dashboards, Premium plan.

CTAs: "Book a polyclinic demo", "See Premium pricing".

### 5.7 Clinic chain (/solutions/clinic-chain)

Promise: one central EMR, one SOP library and one dashboard across every branch, so quality, stock and revenue stop drifting site by site.

Opening answer: central chart, SOP tracking, cross-branch inventory and a KPI dashboard the owner opens every morning; scales from 2 to 100+ locations.

Sections: (1) Hero with the network dashboard (branch KPIs side by side). (2) What breaks when clinics multiply (PainBlocks): care quality drifts by branch; HQ learns about the day the next morning; the patient restarts at every door. (3) Central control, local flexibility (SplitTable): what HQ locks (SOPs, price lists, formulary, templates) against what a branch adjusts (slots, staff, local promotions). (4) Cross-branch inventory and stock transfers, with the 67% stockout and 45-day prediction numbers. (5) Franchise onboarding: "a new branch goes live in [X] days" checklist. (6) Revenue leakage: unbilled orders, downcoded claims, cash variance, with the 34% denied-claims figure. (7) Client logos from the live page (Premier Hospital, Ross Clinics, Seth G S K E M Hospital, German Osteo, Caring Minds) and one chain testimonial. (8) FAQ, 8: franchise plus owned on one EMR; standardise across cities; only for big chains; per-branch pricing; data segregation; roll-out order; Power BI; consolidated GST or VAT invoicing; doctor moving between branches. (9) Links: /features/reports-and-dashboards, /features/insurance-claims, /features/revenue-management, /features/pharmacy-and-inventory, /features/multi-location, Enterprise plan.

CTAs: "Map your network with us", "Get an Enterprise quote".

### 5.8 Hospital OPD and nursing homes (/solutions/hospital-opd)

Promise: high-volume OPD without losing the chart: queue and token flow, pharmacy and lab in sync with the consult, claims that start at the prescription.

Opening answer states up front that EasyClinic covers OPD, day care and nursing homes, and that inpatient is out of scope or partner-served. This resolves the current contradiction between the page title and its FAQ.

Sections: (1) Hero with a queue and token board screenshot. (2) Throughput with a measured number [patients per doctor per hour or minutes from registration to consult]. (3) Where OPD volume breaks software (PainBlocks): front desk; prescription to pharmacy to lab sync; claims dying after the consult. (4) Payor and claims flow diagram (FlowDiagram) from registration to submission, with HMO, TPA, SHA and insurer examples by country. (5) Departments and HR access. (6) What EasyClinic is not (ScopeBox): inpatient, OT, ICU, with what it integrates with. (7) OPD testimonial (Dr Chakrabarti, Institute of Hematology). (8) FAQ, 8: full HIS; pharmacy and lab; insurance billing; token display; multiple departments; bed management; integration with an existing HIS; private cloud; doctor productivity reports; pricing.

CTAs: "Book an OPD walkthrough", "Get an Enterprise quote".

### 5.9 Doctors selector (/doctors)

Promise: the entry page for a doctor who does not yet know which clinic type they are; a real choice, not a redirect.

Sections: (1) Two-question selector (Selector): how many doctors, how many locations; routes to the right solution page and plan. (2) Five cards in the ladder vocabulary with one number each. (3) What every doctor gets regardless of size (EMR, e-prescription, WhatsApp, Cura AI optional). (4) Specialty strip linking to the twelve specialty pages. (5) FAQ, 5, with full answers replacing the current placeholders: do I need the AI; price; trial; migration; mobile; specialty templates; countries.

CTAs: "Find my fit", "Book a demo".

### 5.10 NGO and mission clinics (/solutions/ngo-clinics)

Promise: clinic records and reports that donors understand, on low bandwidth and low budgets, with pricing stated up front.

Sections: (1) Hero with a programme report screenshot (visits, services, stock by month). (2) What donors ask for and what the system produces (Table): visits by programme, services by category, stock consumed, referrals, demographics without identifiers. (3) Connectivity: offline and mobile capability stated plainly, what syncs and when. (4) Pricing: an NGO tier or discount in numbers [decide before launch]. (5) Data protection and consent for vulnerable populations. (6) Not for you if (ScopeBox), kept from staging. (7) A named NGO or mission clinic client, or a pilot offer until one exists. (8) FAQ, 6, replacing the three placeholders: donor portals; offline; pricing; DHIS2 export; multi-site programmes; training on the ground; languages.

CTAs: "Apply for NGO pricing", "Book a demo". Keep the page lean; search demand is low.

### 5.11 Feature pages

All twelve feature pages use the FeaturePage template (section 7.4): hero with screenshot, opening answer, problem-led sections, mechanism with screenshots, country notes where relevant, one proof block, FAQ, links to all five solution pages.

**/features/emr** (new). Promise: the note finishes with the visit and the prescription takes thirty seconds. Sections: thirty-second prescription walkthrough with a timed screenshot sequence; templates by specialty (named, countable); e-prescription legality per country (NMC telemedicine guidelines in India; KMPDC in Kenya; DHA in UAE; MDCN in Nigeria) with a link to /trust; drug database and interaction checks; prescription languages [list them]; Cura AI note drafting; attachments and imaging; audit trail; mobile. FAQ, 8: customise templates and how long; e-prescription valid in India; languages; interactions database source; offline; scanned old records; export; ABDM (points to /trust).

**/features/appointment-scheduling** (from /appointment-scheduling-at-easy-clinic). Promise: one calendar for doctors, rooms and teleconsults, reminders that measurably cut no-shows, walk-ins beside fixed slots. Opening answer states the measured no-show reduction [pull from customer data; publish one real percentage]. Sections: how much no-shows cost a clinic (worked example: 20 slots, 15% no-show, consult fee); walk-ins and fixed slots together, with the token screen; self-booking from website, WhatsApp and app; reminders and confirmations with sample messages per country and consent notes; waiting room and no-show handling; multi-location calendars; teleconsult slots in one paragraph linking to /features/telehealth. FAQ, 8: walk-ins plus slots; WhatsApp reminders; self-booking; reminder cost; two-way confirmation; recurring appointments; doctor leave; Google Calendar sync; patients without smartphones. Proof: the no-show number, a front-desk quote, a reminder thread screenshot.

**/features/billing** (new, split from revenue). Promise: every order becomes an invoice, tax applies itself, receipts go out on WhatsApp, the till closes clean. Sections: invoice from EMR, pharmacy and lab orders; GST, VAT and eTIMS invoice formats by country; payment gateways by country (Razorpay/PayU, M-Pesa Daraja, UAE gateways, Paystack/Flutterwave) with status; receipts on WhatsApp; partial payments, refunds, packages; cash registers, shifts and day-end close; Tally export. FAQ, 8: GST on consultations; e-invoice; M-Pesa reconciliation; refunds; package billing; multiple cash counters; accountant access; Tally.

**/features/insurance-claims** (from /payor-management). Promise: claims that are clean before they leave. Opening answer: three causes of rejection (wrong plan at registration, uncovered items prescribed, missing pre-auth) and how each is caught. Sections: claim journey diagram (register, link plan, check coverage, prescribe within formulary, pre-auth, invoice, submit, reconcile); payor types by country table (India TPAs and corporates; Kenya SHA and insurers Jubilee, AAR, CIC, Britam, Resolution; UAE DHA eClaims and insurers; Nigeria HMOs and NHIA) with integration state and date; subscription categories and price lists per payor (this is where the block currently duplicated on the revenue page lives); denial analytics. FAQ, 8: multiple payors; reduce rejections; only for hospitals; SHA today; DHA eClaims; HMO claim packs; pre-auth workflow; payor payment reconciliation; corporate plans; patient copay split. Proof: 34% fewer denied claims (study), a finance-manager quote.

**/features/revenue-management** (from /revenue-management). Promise: the owner sees leakage before month end. Opening answer names four leaks (unbilled orders, wrong price list, cash variance, denied claims) and the control for each. Sections: the four leaks as H2 questions with mechanism and a number where measured; price lists by location, payor and package; ageing and denial reports; leakage audit (link to the blog post that already ranks). Billing mechanics and payor mechanics appear as one paragraph each, linking to their pages. FAQ, 6: price lists by location; revenue per doctor; unbilled orders report; denial rate; cash variance; month-end close.

**/features/pharmacy-and-inventory** (new). Promise: dispense from the prescription, never run out, move stock between branches. Sections: dispensing from the prescription; batch, expiry and reorder points; stock transfers between branches; the 67% stockout reduction and 45-day prediction from the study; retail counter and GST on medicines; supplier and purchase orders; materials inventory for dental and dermatology. FAQ, 6: dispensing without a prescription; expiry alerts; multiple stores; transfers; barcode; narcotics register.

**/features/lab** (new). Promise: order from the chart, results back into the record, report on WhatsApp. Sections: orders from the consult; sample tracking; results into the chart with flags; external lab integrations by country (named, with status); report delivery on WhatsApp; lab billing. FAQ, 6: in-house and outsourced; machine interfaces; report templates; radiology; turnaround reporting; accreditation documents.

**/features/telehealth** (new; removes duplicated copy from scheduling and engagement). Promise: video consults with a prescription that lands in the chart and payment before the call. Sections: booking to consult flow; e-prescription in the same record; payment before consult; NMC telemedicine practice guidelines compliance in India, with the equivalent per country; recordings and consent; follow-up scheduling. FAQ, 6: legal in India; patient app needed; low bandwidth; payment; prescription delivery; cross-border consults.

**/features/patient-engagement** (from /patient-engagement-at-easyclinic). Promise: retention as a workflow: portal, app, WhatsApp forms, feedback and loyalty, all writing back to the chart. Opening answer names the five loops (onboard, remind, follow up, ask, reward) and the measured revisit rate [measure]. Sections: the five loops with mechanism and screenshot; what the patient sees (mobile walkthrough); recall campaigns by condition with a sample; feedback and Google review capture; consent and opt-out per country (DPDP, Kenya DPA, UAE PDPL, NDPA); the directory booking channel once live ("your clinic is listed and bookable on [directory]; every booking lands in your calendar"). FAQ, 8: portal and app; WhatsApp forms; loyalty setup; feedback to Google; patients without the app; cost per message; branded app; multi-branch campaigns; data protection.

**/features/whatsapp** (new). Promise: reminders, prescriptions, reports and feedback on WhatsApp, sent from the clinic software with approved templates. Sections: the flows, each with a screenshot of the actual message; template approval and consent; cost per message by country; two-way replies into the front desk; WhatsApp Business API versus a phone on the desk; country availability. FAQ, 6: own number or EasyClinic number; template approval time; cost; patients replying; opt-out; groups (link to the ranking blog post on WhatsApp groups for patient care).

**/features/reports-and-dashboards** (from /reports-and-dashboards; also absorbs /healthcare-dashboard-software and the three executive pages). Promise: the owner's morning view. Opening answer lists the eight KPIs and says all are live. Sections: the eight morning numbers (revenue by branch, collections vs billed, no-show rate, patients per doctor per hour, average ticket, stock days left, claims pending, feedback score) with a screenshot each; the report library as a browsable list by role (owner, doctor, pharmacist, accountant), replacing "100+ views"; scheduled email and WhatsApp summaries; warehouse and Power BI (what is exported, how often, Enterprise only). FAQ, 6: revenue per doctor per branch; Power BI; real time; custom reports; export to Excel; audit trail.

**/features/multi-location** (new). Promise: one login for every branch, central price lists and SOPs, per-branch reports. Sections: architecture (one tenant, many branches); HQ versus branch controls; roll-out plan for a new branch; per-branch reporting; patient record shared across branches with consent; pricing per branch. FAQ, 6. Links: /solutions/clinic-chain, /solutions/polyclinic, Enterprise plan.

### 5.12 Pricing (/pricing and /pricing/{india, kenya, uae, nigeria})

Promise: the price per doctor, in the buyer's currency, with what each plan includes, what add-ons cost, and no lock-in.

Sections: (1) Currency and country switcher at the top (CurrencySwitcher) that rewrites the plan cards; the four country pages are static, indexable versions of the same page in local currency with local taxes and payment methods. (2) Three plan cards (PricingCards): Professional $79, Premium $99 (annual; $99 and $129 quarterly, as on the live site), Enterprise on quote; "AI Assistant" renamed per the naming decision; a "best for" line in the ladder vocabulary. (3) Full feature matrix by plan (PlanMatrix), collapsible. (4) Add-ons with indicative prices or ranges, not "quoted separately". (5) What is a doctor licence and what counts as a location. (6) Total-cost examples for three clinic shapes (1 doctor; 5-doctor polyclinic; 12-branch chain). (7) Implementation: the four-day training path, data migration included or priced. (8) Why pay when free EMRs exist, expanded into a comparison with open-source options. (9) Two testimonials chosen for price and support mentions. (10) FAQ, 8: learning time (the four-day breakdown); support; contracts; customisation (rewritten per 6.4); data security (link to /trust); reception licence; free alternatives; currency and taxes; annual discount; NGO pricing; price of a second branch; what happens on cancelling.

Schema: SoftwareApplication with one Offer per plan per currency; FAQPage.
CTAs: "Start with Professional", "Talk to sales about Enterprise".

### 5.13 Country pages

All country pages share one template (CountryPage, section 7.4), and every block must be filled with country-specific facts. A page that cannot fill blocks 2, 3 and 7 is not published.

1. H1 with the regulator in it, an opener with the local price and one local proof point.
2. Local proof strip: a named local contact with a direct phone number (the Kenya demo page's "Or call Walter directly" pattern), clinics in the country, cities, a named client, local office or partner, a link to the country demo page.
3. Regulatory deep-dive: one block per authority with the four-state status and date, what the integration does, what the clinic must do.
4. Money: local currency pricing card, local payment rails, tax invoicing, payor landscape.
5. Connectivity and language: offline behaviour, mobile, prescription languages, WhatsApp-first flows.
6. Who it is for locally: the four clinic types with a local example each.
7. Local testimonial or case study.
8. FAQ, 8 to 10, in the country's own terms.
9. Links: the country listicle, the country comparison, the country pricing page, the country demo page, /trust.

**India (/clinic-management-software-india).** Promise: ABDM-ready clinic software with GST invoicing, UPI, WhatsApp and prescriptions in Indian languages, from a Kolkata company that has run Indian clinics since 2003. Opener gives the INR price and "5,000+ doctors across 200 cities". Specific blocks: ABDM milestones M1 (ABHA creation), M2 (health records linking), M3 (HIE) each with status and date; HPR and HFR registration help; DPDP Act 2023 obligations; NMC e-prescription and telemedicine guidelines; GST invoice formats; UPI and card gateways; Tally export; prescription languages [list]; NABH documentation support. Proof: Kolkata address, Indian testimonials by city and specialty (Guwahati, Kolkata, Hyderabad from the existing seven). FAQ adds: which ABDM milestones today; INR cost; GST; offline; Practo Ray comparison; HealthPlix comparison; Hindi and regional prescriptions; data hosted in India. This is the best-converting page on the site today (5.77%); it is built first.

**Kenya (/emr-software-in-kenya, slug kept).** Promise: M-Pesa-native clinic software from the team whose AI was proven in Kenyan clinics with Penda Health, with SHA claims and eTIMS on a stated timeline. Opener gives the KES price and the Penda Health study in one sentence. Specific blocks: SHA and SHIF claim workflow and status; eTIMS status; Digital Health Act 2023 and Kenya DPA 2019 obligations; KMPDC facility licensing documentation; M-Pesa (Daraja, Till, Paybill) integration state; insurers (Jubilee, AAR, CIC, Britam, Resolution); SLADE and SMART; MOH 705 and DHIS2 reporting; offline behaviour for county clinics; Swahili templates. Proof, lifted from the live /kenyademo page: Walter Brian Maguke as the named contact with his direct number, Penda Health and the Dr Korom quote, "live in as little as 3 days", the directory's patient search volume once live. Keep /kenyademo as the conversion page (its form asks practice type and location count) and make this page the search page that feeds it. FAQ adds: SHA today; M-Pesa reconciliation; KenyaEMR vs EasyClinic; Helium vs EasyClinic; eTIMS; internet outages; migration time; KES cost.

**UAE (/clinic-management-software-uae).** Promise: a cloud EMR for Dubai, Abu Dhabi and the Northern Emirates with NABIDH, Malaffi and Riayati status stated per emirate, eClaims and VAT invoicing. Opener gives the AED price and the emirates covered. Specific blocks: per-authority table (DHA NABIDH; DoH Malaffi and ADHICS; MOHAP Riayati) with status and date; DHA eClaims and insurer pre-auth flow; VAT invoicing; UAE PDPL and the ICT Health Law data residency answer; Arabic patient-facing content; multi-emirate licensing. Proof: a UAE client or a stated launch partner, a UAE number. FAQ adds: NABIDH approval; Malaffi; Riayati; eClaims; data hosted in UAE; Arabic; DHA licence documentation; AED cost; small Dubai clinic vs large group; implementation time.

**Nigeria (/hospital-management-software-nigeria).** Promise: clinic software built for HMO claims, unreliable power and internet, and WhatsApp-first patients, with NHIA and NDPA compliance explained rather than assumed. Opener gives the NGN price and the offline behaviour. Specific blocks: HMO claim packs and encounter forms; NHIA accreditation documentation; NDPA 2023 obligations and the DPO question; Paystack and Flutterwave status; offline and low-bandwidth mode; WhatsApp Business flows; power-outage behaviour (what is saved locally). Proof: a Lagos or Abuja client, a Nigerian number. FAQ adds: HMO claims; NDPA; unreliable internet; WhatsApp; branches; NGN cost; NHIA; Paystack; AjirMed comparison; training on site.

**Other countries.** Ghana, Uganda, Tanzania, Rwanda, South Africa, Ethiopia and Qatar stay live only once blocks 2, 3 and 7 are filled (regulators: Ghana NHIA and Data Protection Act; Uganda NDPA; Tanzania NHIF; Rwanda RSSB and CBHI; South Africa POPIA and medical aid schemes; Ethiopia CBHI; Qatar MOPH). The seven micro-market pages 301 to /countries, which carries a rest-of-world form.

**Country demo pages (/kenyademo, /indiademo, /uaedemo, /nigeriademo).** Same structure as the live Kenya demo page: headline "You care for your patients. Leave everything else to us."; demo form (name, phone, email, clinic name, practice type, locations); "Or call [name] directly: [number]"; the three-problem framework; eight modules; local integrations and insurers; local compliance; local testimonial; "From demo to live in as little as 3 days". noindex is not needed; they can rank for "[brand] [country] demo".

### 5.14 Country listicles (/best-clinic-management-software-{india, kenya, uae, nigeria})

Promise: an honest ranked comparison for private clinics in the country, with the compliance and pricing facts aggregator listicles omit, and a stated verdict.

Sections: (1) Author byline, last-updated date, reading time. (2) Verdict in three sentences by clinic type. (3) How we compared (criteria, date, sources). (4) Ranked table (ComparisonTable): vendor, best for, regulator status, WhatsApp, pricing model and published price, multi-branch, AI documentation, review score with count and link. Every competitor cell is sourced and dated; "Check" is not allowed. (5) One section per vendor, 120 to 180 words, pros and cons, EasyClinic treated with the same structure. (6) When to choose which (DecisionMatrix). (7) FAQ, 8. (8) Sources list. Build Kenya to the current Kenya depth (KenyaEMR, Helium Health, Streamline Health, Clinicea, ClinikEHR, OpenMRS, HospitalOS) and raise India to match; add UAE and Nigeria in phase 3.

Schema: Article with author, ItemList, FAQPage.

### 5.15 Specialty pages (12)

Template (SpecialtyPage): (1) H1 in the form "Dental EMR software: charting, treatment plans and billing on one screen." (2) Opener with the three things the specialty needs that a generic EMR lacks. (3) Built around the [specialty] chart, with named objects and a screenshot of each. (4) Workflow walkthrough for the specialty's most common visit, timed. (5) Specialty templates and forms, named and countable. (6) Integrations and devices for the specialty. (7) Specialty billing and packages. (8) Cura AI for the specialty: which note types it drafts, with an example. (9) A named specialist testimonial. (10) FAQ, 6 to 8. (11) Links to the solution page that fits the usual practice size and the two most relevant country pages. Remove the shared "Where clinics lose time" filler unless each pain is specialty-specific.

| Page | Specialty-specific content that must appear |
| --- | --- |
| /dental-emr-software | Odontogram and periodontal chart; treatment plan with phases and estimates; imaging attachments (state DICOM or file-based); dental lab orders; hygiene recall; package pricing for implants and orthodontics; materials inventory; dentist testimonial |
| /dermatology-emr-software | Before-and-after image timelines; body-map annotation; procedure and laser session tracking; consent forms; cosmetic package billing; product retail inventory; dermatologist testimonial |
| /pediatric-emr | WHO growth charts; national immunisation schedules (India UIP, Kenya KEPI, Nigeria NPI); weight-based dosing; parent WhatsApp reminders; well-baby templates; paediatrician testimonial |
| /cardiology-emr | ECG and echo attachments; trend charts for BP, lipids, HbA1c; anticoagulation tracking; chronic-care recall; device follow-up; FAQ expanded from 4 to 8; cardiologist testimonial |
| /mental-health-emr | Session notes separate from the shared chart; restricted roles; outcome scales (PHQ-9, GAD-7); medication audit; teletherapy; consent language per country; fix the duplicated placeholder sentence on the staging page; merge /psychiatry unless it has distinct content |
| /ophthalmology-emr | Refraction, IOP trends, imaging attachments, optical retail |
| /orthopedic-emr | Imaging, implant tracking, physio referrals, surgical packages |
| /obgyn-emr | Antenatal timeline, EDD, ultrasound records, delivery packages |
| /ivf-emr | Cycle tracking, embryology records, package billing; page is at position 20 with 22K impressions, rewrite early |
| /physiotherapy-software | Session plans, outcome scores, packages, home-exercise sharing on WhatsApp |
| /ayurveda-software | Panchakarma scheduling, classical formulations, AYUSH documentation; merge the two existing ayurveda pages |
| /specialties (hub) | Grid of twelve with one line each; "not listed?" form |

### 5.16 Comparison pages

**/easyclinic-vs-practo and /easyclinic-vs-healthplix.** Structure: (1) At-a-glance verdict by clinic type. (2) Comparison table with sourced, dated cells: primary job, AI documentation, WhatsApp operations, billing and GST, multi-branch, patient discovery, pricing model and published price, review score with count. No "Check" cells; unknowns say "not published" with a date. (3) The four clinic tests from the current Practo page (front desk, doctor context, follow-ups, owner visibility). (4) "Choose Practo Ray if" and "Choose EasyClinic if" lists. (5) Migration from the competitor: what is imported, how long. (6) FAQ, 6, objection-led (is it cheaper; can I keep Practo for discovery; what breaks at switch; the biggest adoption risk). (7) Sources. Rebuild HealthPlix with the same rigour as Practo. Schema: Article, FAQPage.

**/compare/practo-ray-alternatives and /compare/healthplix-alternatives.** Listicle form: six to eight sourced alternatives including EasyClinic, why clinics switch, migration notes, FAQ. Healthray proves a vendor page can outrank the aggregators here.

**/easyclinic-vs-kenyaemr.** Keep, refresh the date, apply the table rules above.

**/easyclinic-emr-vs-traditional-emr.** Rewrite as a guide ("EMR vs paper records: what changes for a clinic") with a mid-article path to /switch.

### 5.17 Trust, integrations, switch

**/trust.** One block per regulator per country with the four-state status and date (the master table that country pages repeat); hosting regions; encryption, backups, uptime (the 99.97% figure lives here); data ownership and export policy in plain words; DPDP, Kenya DPA, UAE PDPL and ICT Health Law, NDPA summaries linking to the country privacy pages; ISO or SOC status; sub-processor list; security contact. Owns "ABDM compliant EMR software". FAQ, 8.

**/integrations.** Directory by category (payments, labs, accounting, BI, messaging, national health systems) and country, each with status (live, beta, planned) and a one-line description; API and FHIR documentation link; a request form.

**/switch.** Migration steps; what is imported from each named competitor (Practo Ray, HealthPlix, KenyaEMR, paper, Excel); timeline; downtime; checklist download; the four-day training path; a named migration lead. FAQ, 6.

### 5.18 Start-a-clinic hub (/start-a-clinic)

The guides in section 4.4 keep their slugs and are grouped under one hub with one page per country. Each guide is refreshed with a current date, a licensing checklist with links to the regulator's own pages, a cost table in local currency, a named author who has opened a clinic (or a quoted owner who has), and a "choosing software before opening day" section that links to the country page, the pricing page and the demo page. Add a mid-article CTA card (component: InlineCTA) after the licensing section: "Setting up? Get the software sorted before the first patient." These pages reach clinic owners at the moment they are about to buy and currently convert at under 1%.

### 5.19 Company and resource pages

**/about-us.** One-paragraph story (2003, first clinics, cloud, 18 countries, the Penda study); milestone timeline; sourced numbers (retention, doctors, cities, support satisfaction); leadership with photos, roles and LinkedIn (Girish Mohata, Mrinal Pasari, Vikas Malpani, Gaurab Chatterjee, Subhashish Saha); Kolkata office and country partners; research and publications; values cut to three lines; replace vision and mission boilerplate with what the company will not do (no selling patient data, no lock-in). Schema: Organization with founders and sameAs.

**/contact-us.** Keep the address (30 Circus Avenue, Kolkata 700017), phone and email; add WhatsApp click-to-chat, a country selector showing the local number, hours and named contact, a booking calendar embed, and two lines on what happens after submitting. Schema: LocalBusiness.

**/customers (from /testimonials).** Filters by specialty, clinic type and country; each testimonial with name, specialty, clinic, city, tenure and one measured outcome; three written case studies (solo, chain, OPD) with before-and-after numbers; review badges linking to Capterra and Google; video where it exists. Recruit one Kenyan, one UAE and one Nigerian story before the country pages relaunch. Schema: Review and AggregateRating only for what is shown.

**/blog.** Hub by persona and topic (Switching to EMR, Running a chain, Compliance by country, Cura AI, Billing and claims, Patient engagement, Start a clinic); each post with author, date, reading time, a short summary, FAQ where warranted, and a link to its owning landing page.

**/help.** A real on-domain help centre structured by the eight existing categories with the 30 most-asked how-to articles, each titled as the question and marked up as HowTo or FAQPage; or a 301 to help.easyclinic.io. Decide before build.

**/glossary.** Forty definitions of 60 to 100 words (EMR vs EHR, clinic management software, ABDM, ABHA, SHA, SHIF, NABIDH, Malaffi, Riayati, NDPA, TPA, HMO, eTIMS, and so on), each its own anchor and each linking to the page that goes deeper.

**/resources.** The human sitemap, with three selectors (country, specialty, clinic type) and the four most-read guides.

**/partner-with-ec.** State the commission or margin range, partner tiers, enablement (training hours, demo environment, co-marketing) and two named partners. FAQ, 6.

**/custom-healthcare-software-development.** Keep as /services/custom-development only with two real case studies (what was built, for whom, how long), HL7, FHIR, DICOM and ABDM API specifics and a scoping form; otherwise fold into /integrations.

**/careers.** Honest "not hiring" copy, culture paragraph, Kolkata office, open-application form; JobPosting schema only when roles exist.

**/privacy (master) and /privacy/{india, kenya, uae, nigeria}.** The master carries everything true everywhere: controller and processor (Novel Medicare Solutions Pvt Ltd and the clinic), sub-processor list, encryption, backups, retention, export and deletion process, cookie and WhatsApp consent, security contact, hosting regions table. Each country page states only what differs, with the law named and a last-reviewed date: India (DPDP Act 2023: data fiduciary duties, consent notices, grievance officer, breach notification, hosting in India); Kenya (Data Protection Act 2019 and Digital Health Act 2023: ODPC registration, cross-border transfer basis, health data as sensitive); UAE (PDPL 2021 and ICT Health Law Federal Law No. 2 of 2019, which keeps health data inside the UAE unless exempt, plus DHA and DoH rules); Nigeria (NDPA 2023: NDPC registration, DPO, cross-border transfer, breach timelines). Each links up to the master and sideways to the country page and /trust. Legal review of each country page is a phase 1 task.

**/terms.** One page unless governing law or venue differs by country.

## 6. Writing guide

The best-written page EasyClinic has is the live Kenya demo page: "You care for your patients. Leave everything else to us.", a named rep ("Or call Walter directly: +254 750 184 357"), the actual insurers, the actual integrations, "From demo to live in as little as 3 days". That is the voice for the whole rebuild: a person who has run a clinic, talking in names, numbers and days.

### 6.1 The voice

Write as the clinic administrator who has seen the mess, not as the software company. Short sentences mixed with longer ones. Specific nouns: the till, the queue, Tuesday evening, KES 2,400, the pharmacist. Admit what the product does not do; the live Kenya page and the OPD FAQ already do this and it reads as trustworthy. No exclamation marks anywhere on the site. "You" is the doctor or owner; "we" is EasyClinic. When a number exists, use it; when it does not, say what will be measured rather than reaching for an adjective. One metaphor per page at most.

### 6.2 Words and patterns to remove

| Remove | Found in | Write instead |
| --- | --- | --- |
| "for modern healthcare", "modern clinics" | Home H1, every country H1 | Say who it is for: "for clinics in Kenya" |
| "Enhance patient care, improve revenue, and cut admin overload" | Home subhead | One concrete outcome with a number, or the things the software does |
| seamless, streamline, empower, robust, comprehensive, leverage, cutting-edge, holistic, elevate, unlock, hassle-free, one-stop, end-to-end, revolutionize, next-generation, state-of-the-art | Features and partner pages | Delete the word; the sentence usually survives |
| "a till that balances before you leave", "without the archaeology", "dashboards that stay honest" | Solution and feature H1s | Good instinct, overdone; one per page |
| Groups of three ("charts, calendars, and tills") | Nearly every subhead | Two items or four |
| Em dashes as the main punctuation | Everywhere | Full stops and commas |
| "It's not X, it's Y", "not just X" | Engagement page | State the point directly |
| The same stat line and closing block on every page | 30+ pages | One proof point chosen for that page |
| "confirm in demo", "discuss on the call" as an answer | Country, NGO, doctors pages | The status and a date |
| Title Case Headings | Live site | Sentence case |
| "Frequently Asked Questions for AI Featured Snippets" as a visible heading | Live dashboard page | "Questions clinic owners ask" or simply "FAQ" |

### 6.3 Before and after

Home hero. Before: "AI EMR & Clinic Management Software for Modern Healthcare. Enhance patient care, improve revenue, and cut admin overload, one clinic management system that scales from solo practice to 100+ locations." After: "Clinic software that runs the desk, the chart and the till. EasyClinic has been running clinics since 2003, from one doctor in Guwahati to chains with more than 100 branches. Its AI was tested on 39,849 patient visits in Nairobi and the results were published in Nature Medicine. Most clinics are live in four days."

Solo clinic pains. Before: "What slows a busy solo clinic: charts stealing evenings, no-shows and phone tag, billing after the fact." After: "If you run your own clinic you already know where the day goes. The notes get finished at 9pm. Three of the 4pm patients did not turn up and nobody called them. The receipt book and the bank balance disagree by a few hundred rupees and nobody knows why. EasyClinic fixes those three things first, and the rest of the product can wait until you want it."

Kenya opener. Before: "Clinic management & EMR software for modern clinics in Kenya. Cloud EMR, appointments, billing, pharmacy, inventory, and analytics, for solo doctors, polyclinics, and clinic chains across Kenya. SHA/SHIF and eTIMS work in progress." After: "EasyClinic is clinic software built for how a Kenyan clinic actually gets paid: M-Pesa at the desk, Jubilee or AAR on the claim, eTIMS on the invoice. It costs KES [x] per doctor per month. Penda Health has run on it for nine years, and the AI copilot was studied across 39,849 of their patient visits. SHA e-claims: [status as of date]. Walter in Nairobi will show you the system on your own patient flow, +254 750 184 357."

Pricing FAQ. Before: "Why pay for an EMR when there are free alternatives?" answered with a paragraph about value and support. After: "Why pay when there are free EMRs? Free EMRs are free until you need the second doctor, the WhatsApp reminders, someone to answer the phone when the printer will not talk to the system, or your data back when you leave. The $79 plan includes unlimited support and training and a reception login. If your clinic is one doctor with no staff and no plans to grow, a free EMR may be enough, and we will say so on the call."

### 6.4 FAQs worth having

A FAQ earns its place when a prospect asked it in the last quarter, when the answer is not simply "yes, we do that", and when the answer would still be useful if the question were asked of a competitor. Five or six real questions beat twelve invented ones. Answer in the first sentence and stop when the answer is complete.

| Drop (from staging) | Why | Replace with |
| --- | --- | --- |
| "How do we start?" | The button next to it answers this | Delete |
| "Solo only?", "AI required?", "Where next?" (/doctors) | Fragments; the answers are routing | "Do I need the AI to use EasyClinic?" answered with what the classic EMR does without it |
| "Donor portals?", "Offline outreach?", "Pricing for NGOs?" answered with "confirm in demo" | Placeholders | Real answers or no FAQ |
| "Is EasyClinic ABDM compliant?" answered "in progress" | A non-answer to the page's main question | "Which ABDM milestones does EasyClinic support today?" with M1, M2, M3 status and date |
| "How many dashboards does EasyClinic include?" | Nobody asks this | "Can I see revenue per doctor per branch for last month?" |
| "Is patient engagement only for large clinics?" | Leading question written to be answered "no" | "What does a WhatsApp reminder cost per message in India?" |
| "Can EasyClinic be customised to my needs?" | Always yes; says nothing | "Can I build my own prescription template, and how long does it take?" |

Keep: "Is EasyClinic overkill for a solo doctor clinic?", "Does it work if I later open a second location?", "Is EasyClinic a full hospital HIS?" with its honest answer, "What is the biggest adoption risk?" on the Practo page, "Am I locked into any contracts?", "How much time will it take to learn EasyClinic?" with the four-day breakdown.

### 6.5 Editing pass

Before a page is published, one editor reads it aloud and answers two questions in writing: what on this page could only have been written by someone who knows this clinic type and this country, and what on this page would read as obviously machine-written to a doctor. Anything in the second list is rewritten or cut. A page passes when it has at least one named person, one local fact, one number that was measured, and one admission of a limit.

## 7. Frontend and UI specification

Assumption: the staging site is a Next.js App Router project deployed on Vercel. If the stack differs, map each item to its equivalent; the requirements do not change.

### 7.1 Principles

1. Content-first pages. Every page type is a template fed by structured content, so a country page or a specialty page is data, not a hand-built route. Writers should be able to fill a page without touching components.
2. Fast on the phones clinics actually use. Most of the audience is on Android in India, Kenya and Nigeria on mobile data. Targets: LCP under 2.0 s, INP under 200 ms, CLS under 0.05, total JavaScript under 150 KB gzipped on landing pages, no client-side rendering of above-the-fold copy.
3. Nothing hidden from crawlers. All copy, FAQs, tables and schema are in the server-rendered HTML. Accordions are open in the DOM and collapsed with CSS.
4. One design system. Tokens, a small component set, and page templates composed from them. No page-specific CSS.
5. Honest UI. No fake counters ("0+" animated stats appear on the live About page when JS is slow), no fake chat widgets, no urgency banners.

### 7.2 Content model

Define one content type per page family, stored as MDX or in a headless CMS, with these fields. The same fields drive the head tags, the schema and the components.

| Field | Type | Used by |
| --- | --- | --- |
| slug, family (home, feature, solution, specialty, country, countryDemo, listicle, comparison, pricing, trust, guide, post, company) | string, enum | routing, template choice |
| headKeyword, secondaryKeywords | string, string[] | editorial checks, not rendered |
| title, metaDescription, h1, openingAnswer | string | head, Hero |
| author { name, role, photo, linkedin }, lastUpdated, reviewedBy | object, date | AuthorByline, Article schema |
| heroMedia { type: image or video, src, alt, caption } | object | Hero |
| ctas { primary { label, href, event }, secondary, whatsapp { number, prefilledText } } | object | Hero, CTABand, sticky bar |
| sections[] | ordered array of typed blocks (see 7.3) | page body |
| proof { type: study, customer, badge, screenshot; fields } | object | ProofBlock |
| faq[] { question, answer (markdown), lastVerified } | array | FAQ, FAQPage schema |
| links { hub, related[] } | object | RelatedLinks, breadcrumbs |
| country { code, currency, contact { name, phone, whatsapp, hours }, regulators[] { name, body, status, asOf, note, link }, payments[], insurers[], languages[] } | object | CountryPage blocks |
| pricing { currency, plans[] { name, monthly, quarterly, bestFor, includes[] }, addons[], taxNote } | object | PricingCards, Offer schema |
| specialty { chartObjects[], templates[], integrations[], packages[] } | object | SpecialtyPage |
| comparison { rows[] { label, us, them, source, checkedOn } } | object | ComparisonTable |
| schemaExtras | JSON | additional JSON-LD |
| noindex, canonical | boolean, string | head |

Validation at build time: title 60 characters or fewer, meta 155 or fewer, exactly one H1, at least one proof block, FAQ between 5 and 8 items (or none), no bracketed placeholders, no words from the 6.2 list in body copy (a lint rule with an allowlist for quotes), author and lastUpdated present. A page that fails validation does not build.

### 7.3 Component library

Build these once and compose every page from them. Names match the ones used in section 5.

| Component | Purpose | Notes |
| --- | --- | --- |
| Hero | H1, opening answer, two CTAs, badge row, media | One variant with a screenshot, one with video (poster image, no autoplay on mobile data) |
| PersonaRouter | Four or five cards routing by clinic type | Card copy in the ladder vocabulary |
| Selector | Two-question router (doctors, locations) | Client component; result deep-links to a solution page and plan |
| ModuleGrid | 4 or 12 module cards with screenshot, one outcome line, link | Equal depth for every module |
| FeatureRows | Alternating text and screenshot rows | Used for "six jobs" and feature mechanics |
| PainBlocks | Two or three problem blocks with the fix | H2 as a question only when the query is a question |
| DayTimeline | Timed vertical timeline (solo page) | |
| JourneyDiagram | Patient journey with 8 steps | SVG, not an image |
| FlowDiagram | Claim journey | SVG |
| SplitTable | HQ vs branch two-column table | |
| RolesMatrix | Roles by permission grid | |
| ProofBlock | Study, customer, badge or screenshot proof | Study variant renders the three numbers with the source link |
| StudyCard | Method, sample, sites, publication links, date | CuraPilot only |
| RegulatorStrip and RegulatorTable | Regulator name, body, status chip (Live, In certification, Planned, Not applicable), as-of date, note | Status chips have text labels, not colour alone |
| StatusChip | Four-state compliance and integration status | |
| TestimonialRow and TestimonialCard | Name, role, clinic, city, tenure, outcome, photo | Never more than three per page |
| StepList | The four-day training path, migration steps | |
| PlanMatrix | Feature by plan, collapsible groups | Open in DOM, collapsed by CSS |
| PricingCards | Three plans with monthly and quarterly, best-for line | Reads pricing object; currency from CurrencySwitcher or static per country page |
| CurrencySwitcher | USD, INR, KES, AED, NGN | On /pricing only; country pricing pages are static |
| ComparisonTable | Us vs them with a source and checked-on date per row | Cells never contain "Check" |
| DecisionMatrix | "Choose X if" and "Choose Y if" lists | |
| ScopeBox | "Not for you if" and "What EasyClinic is not" | |
| FAQ | Accordion, all answers server-rendered, FAQPage schema generated from the same data | |
| AuthorByline | Author, role, last updated, reviewed by | On every landing and content page |
| InlineCTA | Mid-article CTA card | Used on guides after the licensing section |
| CTABand | Closing CTA; primary, secondary, WhatsApp | Copy is per page, never the shared block |
| RelatedLinks | Curated hub and sideways links | Replaces "Explore the rest of the platform" |
| Breadcrumbs | Hub > page | BreadcrumbList schema |
| DemoForm | Name, phone (with country code default), email, clinic name, practice type, locations, country | Server action; posts to CRM; fires the key event on success |
| WhatsAppButton | Click-to-chat with a prefilled message naming the page | Number per country; fires an event |
| ContentCards | Blog and guide cards with date and reading time | |
| Glossary | Alphabetical anchors | |

### 7.4 Page templates

| Template | Composition |
| --- | --- |
| HomePage | Hero, PersonaRouter, ReplacesStrip, ModuleGrid(4), ProofBlock(study), RegulatorStrip, TestimonialRow, StepList, FAQ, ContentCards, CTABand |
| FeaturePage | Hero, opening answer, PainBlocks or FeatureRows, country notes (RegulatorStrip or table where relevant), ProofBlock, FAQ, RelatedLinks (all five solutions), CTABand |
| SolutionPage | Hero, DayTimeline or PainBlocks, ModuleGrid(subset), persona-specific table (RolesMatrix, SplitTable, ScopeBox), TestimonialCard, StepList, FAQ, RelatedLinks, CTABand |
| SpecialtyPage | Hero, chart objects section, workflow walkthrough, templates list, integrations, packages, Cura AI example, TestimonialCard, FAQ, RelatedLinks, CTABand |
| CountryPage | Hero (H1 with regulator), local proof strip (contact card, clients, cities), RegulatorTable, money block (PricingCards static in local currency, payments, insurers), connectivity and language block, clinic types with local examples, TestimonialCard, FAQ, RelatedLinks (listicle, comparison, pricing, demo, trust), CTABand |
| CountryDemoPage | Headline, DemoForm beside "Or call [name] directly", three-problem framework, modules, local integrations and insurers, compliance, TestimonialCard, "live in 3 days" |
| ListiclePage | AuthorByline, verdict, method, ComparisonTable (ranked), per-vendor sections, DecisionMatrix, FAQ, Sources |
| ComparisonPage | AuthorByline, verdict, ComparisonTable, four tests, DecisionMatrix, migration section, FAQ, Sources |
| PricingPage | CurrencySwitcher (main only), PricingCards, PlanMatrix, add-ons, licence explainer, total-cost examples, StepList, free-EMR comparison, TestimonialRow(2), FAQ |
| TrustPage | RegulatorTable (all countries), hosting table, security list, data ownership, law summaries, sub-processors, FAQ |
| GuidePage | AuthorByline, table of contents, body with H2s, checklist, cost table, InlineCTA, FAQ, RelatedLinks |
| PostPage | AuthorByline, summary, body, FAQ optional, owning landing page link |
| CompanyPage | Free-form sections from the component set |

### 7.5 Design tokens and layout

Keep the existing brand colours; define them as tokens (primary, primary-strong, accent, surface, surface-alt, text, text-muted, border, success, warning, danger) with a dark-mode set even if dark mode is not launched, so components are not hard-coded. Type scale: 16 px base, 1.25 ratio, headings in the brand face, body in a system or variable font subset to Latin plus the characters needed for names in the markets served. Line length 60 to 75 characters. Spacing on an 8 px grid. Container 1200 px, with a 720 px measure for long-form pages (guides, comparisons, posts). Breakpoints at 640, 960 and 1200. Mobile first; every table becomes a stacked card list below 640 px, never a horizontal scroll for comparison and pricing tables (a horizontal scroll is acceptable only for the plan matrix, with a visible scroll hint).

Screenshots are the main visual. Use real product screens with real-looking but synthetic data, cropped to the feature being described, captioned with the claim, served as WebP or AVIF with width and height set. No stock photography of smiling doctors. Illustrations only for diagrams, as SVG.

### 7.6 Accessibility

WCAG 2.2 AA. Colour contrast 4.5:1 for text; status chips carry a text label as well as a colour; every interactive element reachable by keyboard with a visible focus ring; accordions and the currency switcher use proper ARIA states; forms have labels, not placeholders, and inline error text; skip link; landmarks on every page; alt text on screenshots describes what the screen shows, not "screenshot".

### 7.7 Technical SEO

- Metadata from the content model through the Next.js metadata API: title, description, canonical (absolute, self-referencing, www host), Open Graph and Twitter images generated per page from the H1.
- JSON-LD generated from the same content fields (Organization and WebSite on Home; SoftwareApplication with Offer on Home, pricing and country pricing pages; FAQPage from the faq array; BreadcrumbList from the links.hub field; Article on guides, posts, listicles and comparisons; ScholarlyArticle on CuraPilot; LocalBusiness on Contact). Validate in CI with a schema test.
- Redirects in next.config (or middleware for the pattern-based ones): all 301s from section 3.4; 410 for /doctors/* and /clinics/* until the directory domain is live, then per-URL 301s from a mapping file; bare domain to www; trailing slash to no slash.
- robots.txt disallows nothing on production and everything on staging and preview deployments (use the Vercel environment variable to switch); X-Robots-Tag noindex on preview.
- sitemap.xml generated from the content model, split by family, with lastmod from lastUpdated; exclude noindex pages, category archives and demo thank-you pages.
- Category and tag archives, if kept, carry noindex.
- No hreflang: all pages are English; country pages target by content, not language.
- Every image has width, height, alt and lazy loading below the fold; the hero image is preloaded.
- Fonts self-hosted, subset, with font-display swap and a fallback metric-matched to avoid layout shift.
- Third-party scripts (GA4, chat, any pixel) loaded after interaction or with the Vercel-recommended strategy; no tag manager container that injects unknown scripts.
- Internal links are plain anchors with descriptive text; no "click here"; no links that only work with JavaScript.
- 404 page suggests the hub pages and logs the missing path to analytics so the redirect map can grow.

### 7.8 Analytics and events

Key events in GA4, replacing the current generate_lead definition: demo_form_submitted (server-confirmed, with country, practiceType, locations, page as parameters), whatsapp_click (with page and country), pricing_contact_click, trial_started (if a trial exists), study_download. Non-key events: cta_click (label, page), faq_open (question), currency_switch (currency), selector_result (doctors, locations, destination). Remove or rename the "Sub-Domain - GA4" custom event. Exclude bot and firewall traffic (the /.well-known/sgcaptcha sessions) with a filter. Connect Search Console to GA4 and share the Search Console domain property with the marketing account.

### 7.9 Forms and CTAs

Demo form fields, in this order: name, phone (country code defaulted from the page's country or the visitor's locale), email, clinic name, practice type (Solo practice, Specialist clinic, Clinic group, Hospital or specialist centre, Health NGO), number of locations (1, 2 to 5, 6 to 15, 15+), country. No other fields. Submit is a server action that writes to the CRM and returns a confirmation page that states what happens next and the local contact's name. The WhatsApp button prefills a message naming the page ("Hi, I was reading about EasyClinic for polyclinics and would like a demo"). Every CTA label says what happens ("Book a 20-minute demo"), never "Get started" or "Learn more".

### 7.10 Performance budget and QA

Per landing page: HTML under 60 KB, CSS under 40 KB, JavaScript under 150 KB gzipped, images under 400 KB total above the fold, no layout shift from fonts or late-loading badges. Test on a mid-range Android over throttled 3G in Lighthouse and in the field via CrUX once live.

Build-time checks: content validation (7.2), schema validation, link checker (no internal 404s, no links to old slugs), redirect tests for every row in the redirect map, a banned-words lint, one H1 per page, title and meta lengths, image dimensions present.

Pre-launch checks: crawl the staging build with Screaming Frog or equivalent and compare against the URL map; verify the 301s return the new URL in one hop; verify 410s on directory paths; verify robots and sitemap on production only; test the demo form end to end into the CRM; test the currency switcher and the four static pricing pages; test the FAQ accordions with JavaScript disabled; run axe on every template; read every page on a phone.

## 8. What the analytics data says

Read on 17 September 2026 from the www.easyclinic.io URL-prefix property in Search Console and the Easy Clinic GA4 property (347728478), for 15 September 2025 to 14 September 2026 unless stated. The Search Console domain property is not shared with the account used, so subdomain traffic is not included.

| Measure | Value |
| --- | --- |
| Clicks / impressions / CTR / average position | 360K / 12.3M / 2.9% / 8.2 |
| Clicks from /doctors/ directory pages (top 1,000 pages only) | 109,144 across 798 pages |
| Clicks from all other pages in the top 1,000 | 34,232 across 202 pages |
| Queries containing "software" | 768 clicks, 249K impressions, CTR 0.3%, position 28.8 |
| Queries containing "emr" | 120 clicks, 72K impressions, CTR 0.2%, position 29.2 |
| Brand queries | about 5,200 clicks |
| Last 28 days, whole site | 2,310 clicks, 196K impressions, position 15.1 |
| Last 28 days, /doctors/ pages | 171 clicks |
| GA4 sessions / users / new users | 489,626 / 386,647 / 383,930 |
| GA4 average engagement time per session | 34 seconds |
| GA4 key events (generate_lead) | 11,740, a 2.08% session rate (definition unreliable, see 7.8) |
| GA4 distinct landing pages | 31,492 |

Daily clicks ran between 800 and 2,400 until mid-June 2026, when the directory was removed, then fell to 100 to 200 a day. The top queries for the year were "easy clinic" (2,526), "easyclinic" (1,596), "easy clinic login" (472), then doctor names. "clinic management software" produced 97 clicks from 13,625 impressions at position 25.7.

Pages that carry the buyer traffic today (12 months):

| Page | Clicks | Impressions | Position | GA4 sessions | Key events (rate) |
| --- | --- | --- | --- | --- | --- |
| / | 4,343 | 120,000 | 22.3 | 53,449 | 1,221 (1.82%) |
| /emr-software-in-india | 1,209 | 12,222 | 13.2 | 1,195 | 93 (5.77%) |
| /ai | 1,130 | 58,947 | 5.8 | | |
| /the-ultimate-guide-to-starting-a-clinic-in-kenya | 1,087 | 66,341 | 5.8 | 1,587 | 11 (0.57%) |
| /clinic-in-uganda | 904 | 56,241 | 4.5 | 1,056 | 1 (0.09%) |
| /emr-software-in-kenya | 571 | 3,404 | 6.3 | 2,554 | 60 (1.92%) |
| /your-essential-guide-to-launching-a-clinic-in-uganda | 555 | 24,770 | 5.8 | 834 | 8 (0.96%) |
| /how-much-does-it-cost-to-open-a-clinic-in-nairobi | 511 | 41,510 | 6.1 | | |
| /whatsapp-groups-for-patient-care | 479 | 8,368 | 7.5 | | |
| /how-do-i-get-approval-from-the-kmpdc-in-kenya | 408 | 90,547 | 7.2 | | |
| /clinic-in-india | 402 | 57,481 | 5.3 | | |
| /how-to-setup-clinic-legally-in-india-compliance-guide | 374 | 48,346 | 5.8 | | |
| /how-much-does-it-cost-to-open-a-clinic-in-mumbai | 359 | 50,738 | 6.8 | | |
| /patient-data-privacy-laws-in-india | 279 | 46,571 | 6.4 | | |
| /pricing | 130 | 16,177 | 5.5 | 824 | |
| /ayurveda-clinic-management-software | 127 | 6,774 | 8.9 | | |
| /physiotherapy-clinic-management-software | 86 | 7,143 | 16.4 | | |
| /free-clinic-management-software-vs-premium | 77 | 8,126 | 17.7 | | |
| /ivf-emr | 74 | 22,235 | 20.2 | | |
| /hospital-opd-nursing-home-software | 72 | 14,731 | 18.3 | | |

In the last 28 days the order is the India EMR page (199 clicks), the Kenya EMR page (190), the homepage (130), the WhatsApp groups post, the Kenya and Uganda guides, /clinic-in-india and /emr-software-in-uganda (79).

Measurement problems to fix before launch: the generate_lead key event fired 11,715 times from 9,389 users, which cannot be demo requests (redefine per 7.8); a "Page Not Found" page was the third most viewed page in the last 28 days (357 views); 15,807 sessions land on "(not set)" and 3,428 on /.well-known/sgcaptcha (bot and firewall traffic; filter); a custom event "Sub-Domain - GA4" fired 367,764 times; the Search Console domain property is not shared; Search Console is not connected to GA4.

## 9. Build order and checklists

### 9.1 Phases

| Phase | Weeks | Work | Done when |
| --- | --- | --- | --- |
| 1. Decide and gather | 1 to 2 | Naming signed off; four-state compliance status per regulator per country with dates; local prices in INR, KES, AED, NGN; measured numbers (no-show reduction, minutes per note, branch go-live days); customer stories recruited for Kenya, UAE, Nigeria and one chain; author roster; live sitemap export, redirect map and blog keep/merge/drop list; head keyword per page confirmed; GA4 key events, 404 list and bot filtering fixed; legal review of country privacy pages; component library and content model built | A one-page fact sheet exists that every writer works from, and the design system renders every template with placeholder content |
| 2. Core pages | 3 to 6 | India country page and /pricing/india first; page-two quick wins (/ivf-emr, /solutions/hospital-opd, /physiotherapy-software, homepage for "clinic management software"); then Home, /features, /ai, /curapilot, five solution pages, /pricing and the other country pricing pages, /trust, /features/emr, /features/whatsapp, /features/billing, /customers; InlineCTA added to the six ranking start-a-clinic guides | Each page passes the checklist below; schema, bylines, dates and curated links live sitewide |
| 3. Country and comparison | 7 to 10 | Kenya, UAE, Nigeria country pages and demo pages; India listicle to Kenya depth; UAE and Nigeria listicles; Practo and HealthPlix comparisons rebuilt; two alternatives pages; /switch; the remaining feature pages; /integrations | The seven standard country pages either meet the template or are consolidated into /countries |
| 4. Specialty and content | 11 to 14 | Twelve specialty pages; NGO page; start-a-clinic hub with refreshed guides; glossary; three case studies; first 12 blog posts; knowledgebase decision executed; blog pruning executed | Every landing page has at least one guide or post feeding it |

### 9.2 Per-page publish checklist

- Owns one query cluster from section 4 and no other page targets it
- Title 60 characters or fewer, meta 155 or fewer, one H1, canonical correct, slug per section 3.2
- Opening answer states the promise in two sentences with a number
- Headings in sentence case; questions only where the query is a question
- One page-specific proof block
- FAQ of 5 to 8 real questions, answered in the first sentence, no "confirm in demo"; or no FAQ
- Persona vocabulary matches the ladder; AI naming matches the decision; no words from 6.2
- No bracketed placeholders
- Author, role and last-updated date visible; schema validates
- Curated links in and out per 2.9; no shared closing block
- Local currency where relevant; compliance rows carry status and date
- Editor's two-question pass (6.5) recorded
- Passes build validation, axe, Lighthouse mobile budget, and reads correctly on a phone

### 9.3 First 24 blog posts, each owned by one landing page

1. How to choose clinic management software in 2026: a 12-point checklist (Home)
2. What clinic software costs in India, Kenya, UAE and Nigeria (Pricing)
3. Is e-prescription legally valid in India? The NMC rules explained (EMR)
4. Who owns your patient data in a cloud EMR, and how to export it (Trust)
5. Switching from paper to EMR in 30 days without losing a record (Switch)
6. How to reduce no-shows: what WhatsApp reminders did for five clinics (Scheduling)
7. Where clinics lose revenue: a leakage audit you can run in one afternoon (Revenue)
8. Why insurance claims get rejected, and the three checks that stop it (Insurance claims)
9. How to standardise clinical protocols across branches (Clinic chain)
10. Onboarding a new clinic branch in 10 days: the checklist (Clinic chain)
11. Doctor productivity metrics that chain owners actually use (Reports)
12. ABDM for private clinics: what M1, M2 and M3 mean for you (India)
13. SHA and SHIF for private clinics in Kenya: what to prepare (Kenya)
14. NABIDH, Malaffi and Riayati: a plain guide for UAE clinic owners (UAE)
15. NDPA for Nigerian hospitals: eight obligations and how software helps (Nigeria)
16. Running a clinic through power and internet outages (Nigeria, Kenya)
17. What an AI scribe does with your consultation audio, and what it must not (AI)
18. Inside the Penda Health study: what 39,849 visits taught us about clinical AI (CuraPilot)
19. Dental treatment plans that patients accept: pricing and presentation (Dental)
20. Growth charts and vaccine schedules: what a paediatric EMR must get right (Pediatric)
21. Confidentiality in mental-health records: roles, notes and consent (Mental health)
22. Open-source EMR vs paid clinic software for a small clinic (Pricing)
23. Practo Ray vs EasyClinic vs HealthPlix for a Mumbai polyclinic (Comparison)
24. Donor reporting for NGO clinics without extra paperwork (NGO)

### 9.4 Measures to track

Rankings and AI-answer citations for the clusters in section 4 (check Google AI Overviews, ChatGPT and Perplexity monthly for the ten highest-intent queries per country); organic clicks from software and EMR queries (baseline 888 a year; target 10,000); demo form submissions by landing page (baseline unknown until the key event is fixed; target 400 a year); Enterprise quote requests from chain and OPD pages; pricing page views by currency; the six start-a-clinic guides' conversion rate after the InlineCTA is added.

## 10. Sources

Staging pages fetched 17 September 2026 on staging-easyclinic.vercel.app. Live site: www.easyclinic.io, including /kenyademo/, /clinic-chain-software/, /pricing/, /about-us/, /best-clinic-management-software-kenya/, /easyclinic-vs-kenyaemr, /emr-software-in-kenya/, /healthcare-dashboard-software/, and the sitemaps at /sitemap-pages.xml and /sitemap-posts.xml. Search Console: www.easyclinic.io property. GA4: Easy Clinic - GA4 (347728478).

Benchmarks: tebra.com (home, independent practices, features, pricing, specialties); athenahealth.com (home, small practices, practice management, cost and value); simplepractice.com (home, pricing, group practice features); practicefusion.com/pricing; advancedmd.com (multi-site management, software pricing, vs SimplePractice); deepscribe.ai; curemd.com (EHR for small practices); elationhealth.com; hipaajournal.com (best EMR for small practices); healthplix.com (home, best EMR in India); mocdoc.com (clinic management software, Nigeria, ABDM); healthray.com (best EMR India, Practo alternative, HealthPlix alternative, Nigeria); clinicea.com (Kenya, Dubai); clinicsoftware.ae; ajirmed.com; medinous.com (Kenya); meridianhims.com; hanmak.co.ke.

Query research: softwaresuggest.com (Practo Ray alternatives, Kenya and Nigeria categories), techjockey.com (HealthPlix alternatives, clinic management category), g2.com (Ray by Practo alternatives), capterra.com, doctorsapp.in (ABDM compliant EMR list), medbookafrica.com (SHA integration), mondaq.com (NDPR in the health sector), naijahealth.ng (NDPR vs NDPA), medhive.in (cost of EMR in India), amnhealthcare.com (EMR holdouts), bluebrix.health (data ownership), quora.com (affordable clinic software India), cufront.com and ichelonconsulting.com (clinic software cost India), doccure.io, connectai.care, zoftwarehub.com (UAE category), clinicgateway.ae.


## 11. Design and UX direction (added 23 September 2026)

Studied on 23 September 2026: zandahealth.com (home, physiotherapy page, pricing), heidihealth.com, carepatron.com, pabau.com, jane.app, cliniko.com, gethealthie.com, simplepractice.com, getfreed.ai, semble.io and nookal.com, against the EasyClinic staging home and Kenya pages, on desktop and at phone width. The short version: the new-age sites win on three things EasyClinic's staging build lacks, which are a recognisable visual identity, product shown as product (real screens, real steps, real numbers), and a self-serve path beside "book a demo". None of them is a template to copy; the section at the end says what not to import.

## What the staging build looks like today

The staging site is a competent Tailwind-blue SaaS layout with no identity: navy headline, light-blue wash, blue buttons, Inter throughout, chips and cards. Three things hurt it more than the palette. Sections fade in on scroll, so on first paint and on slow devices the page is blank below the hero (the screenshots taken during scroll show white space and ghosted text where the "Clinics we set up across Kenya" section should be). The hero product image on the Kenya page is a grey blurred placeholder and on the home page it renders as an empty box before the screenshot loads, which is the first thing a visitor sees. And the proof is the same on every page: the stat line, the four logos, the six testimonials, the closing block. Nothing on the page says "clinic in Nairobi" or "clinic in Kolkata"; it could be a site for any software.

## What the reference sites do well

| Pattern | Best example | What it looks like | Why it works |
| --- | --- | --- | --- |
| An identity you remember | Zanda: purple and yellow, a bee mascot, hand-drawn loops, real practitioner photos in organic cut-outs | Every page is unmistakably Zanda within a second | A clinic owner comparing five tabs remembers the one that looked like something |
| Compliance badges in the hero | Zanda (ISO, HIPAA, ADA icons above the H1), Carepatron ("HIPAA +12 more" as a stat) | Trust before the pitch | The buyer's first question is "is this safe", and the answer is on screen before scrolling |
| Product as the hero image | Zanda physiotherapy page: a full calendar screenshot with named appointments, colours and icons | The product is the picture, not a stock photo | Buyers judge software by its screens |
| Self-segmentation | Zanda "Professions we serve" carousel, Pabau "Who we're for" three ways, Carepatron nav by profession | Tap your kind of clinic in the first scroll | Nobody reads generic copy when their own page exists |
| Old way vs new way | Pabau "The old way / The Pabau way" split panel | Paper, WhatsApp, Excel on the left; one system on the right | Makes the consolidation pitch visual in one panel |
| The client journey | Zanda "The client journey, from first booking to final invoice" (11 steps), Carepatron six-step carousel with a screenshot per step | The whole product in one walk-through | Answers "what does it actually do" without a demo |
| A live number | Heidi "Heidi has enabled care for 2,995,359 patient visits this week" | A ticking counter under the logos | Current, specific, hard to fake |
| Price on the page | Cliniko and Freed put the pricing table on the home page; Zanda opens pricing with "Start from US$19 per month", 14-day trial, no card, 12-month money-back | Price before the form | Removes the biggest reason a price-sensitive buyer leaves |
| Two doors, not one | Pabau "Take product tour" beside "Book a demo"; Heidi "Get Heidi free" beside "Book a demo" | A self-serve path for the 90% who will not book a call | Doubles the number of visitors who do something |
| Founder story | Zanda "Because we're practitioners too", Freed founder photo and narrative | A named person and a reason | Trust from people, not from adjectives |
| Region-specific trust pages | Heidi: separate compliance pages for AU/NZ, Canada, UK, plus a trust centre and status page | One page per jurisdiction | The exact model for ABDM, SHA, NABIDH, NDPA |
| A quote that is a sentence a doctor would say | Heidi: "I go to lunch on time, I go home on time." Dr Theresa Colina, Tuggerah Family Doctors | Large, alone, attributed | Beats six five-star paragraphs about "world class technology" |
| Answer-engine pages by design | Healthie's /aeo-comparison-pages/ namespace: TL;DR, who it is for, table, FAQ | Built to be quoted | This is what the comparison and listicle specs already ask for |

## Design direction for EasyClinic

Identity. Keep the brand blue as the primary but give the site one memorable secondary colour and one visual device, the way Zanda has yellow and loops. A warm accent (the WhatsApp green is already on every page in the markets served, so an amber or coral reads better beside it) used for CTAs, badges and highlights, plus one device: the patient-journey line, a thin drawn path that connects book, arrive, consult, prescribe, pay, dispense, follow up on the home page and reappears as a section divider elsewhere. No mascot; a mascot would read as unserious to a hospital OPD buyer.

Type. A distinctive display face for H1 and H2 (a humanist sans or a soft serif in the Heidi register), Inter or the system stack for body. Sentence case everywhere. Headlines at 44 to 56 px on desktop, 32 on phone, with a measure of 12 to 14 words.

Imagery. Three sources only: real product screens with synthetic but realistic data (Indian and Kenyan names, INR and KES amounts, WhatsApp threads), photographs of real customer clinics and named doctors (commission a shoot in Kolkata and Nairobi; two days each), and SVG diagrams. No stock photography, no 3D illustrations, no AI-generated doctors. The hero on every page is a product screen relevant to that page: the calendar on scheduling, the odontogram on dental, the claims screen on insurance.

Layout. One container width (1200) with a 720 measure for reading pages, a 12-column grid, 8 px spacing. Cards with 12 px radius and a one-pixel border rather than drop shadows. Screenshots in a browser-frame or phone-frame with a caption that states the claim. Sections alternate white and a light wash; never more than two consecutive card grids.

Motion. Remove scroll-reveal fades. Content is visible on first paint; the only motion allowed is a hover state, an accordion, the ticking counter, and the tour.

## Content direction, page by page

Home. Section order, revised from the earlier spec after this study: (1) hero with H1, one-sentence answer, two CTAs ("Start with a 20-minute demo" and "See the product in 6 minutes"), a compliance and rating strip under the buttons (ABDM, SHA, NABIDH, NDPA status chips plus Capterra 4.9 and Google 4.8), and a real screenshot; (2) "Pick your clinic" segment grid, five tiles; (3) old way vs EasyClinic way panel: paper register, WhatsApp on a personal phone, Excel billing, three logins against one screen; (4) the patient journey, eight steps, a screenshot per step, the drawn line running through them; (5) the study block with the three numbers and Dr Korom's one-line quote; (6) live counter ("appointments booked on EasyClinic this week"), fed by the product; (7) pricing table in local currency with a note on what is included; (8) three quotes, one line each, one per clinic type, with city; (9) founder block, Girish Mohata and the 2003 story, one photo; (10) trust section linking to the four country compliance pages; (11) FAQ; (12) resources teaser and closing CTAs with WhatsApp.

Solution and specialty pages. The hero image is the screen that persona uses most; the second section is the day timeline (solo), the roles matrix (polyclinic), the HQ-versus-branch panel (chain) or the queue board (OPD), already in the spec; the quote is one line, large, attributed with city and specialty; the FAQ stays at five to eight.

Country pages. Borrow Heidi's compliance model: the country page carries a "Compliance in Kenya" panel with the regulator chips and a link to /privacy/kenya and /trust; the local contact card ("Or call Walter directly") sits in the hero, not the footer; the pricing card is in KES; the testimonial is Kenyan.

Pricing. Adopt Zanda's opener: the starting price in the first sentence, then the three conditions in a row (no setup fee, no contract, reception licence included), then the cards. Add a "what a 5-doctor polyclinic pays" worked example beside the cards.

Comparison and listicle pages. Adopt Healthie's structure exactly: TL;DR, who each is for, table with sourced cells, workflow comparison, pricing, FAQ.

## UX direction

1. Two doors on every page: a demo CTA and a self-serve one. The self-serve door is a six-minute guided tour (a clickable prototype or a Storylane or Navattic-style tour, or a plain video with chapters if budget is short) that needs no form to start and asks for an email to save progress. Whether a free trial or free tier is offered is a product decision; if it is, it becomes the self-serve door and the tour becomes the secondary.
2. WhatsApp as a persistent contact, bottom right on phones, with the message prefilled with the page name and routed to the country contact.
3. The demo form: six fields, country code defaulted, practice type and locations as chips, a confirmation page that names the person who will call and the time window. No chatbot pop-ups.
4. Segment routing in the first scroll on home, features, pricing and every country page, so a visitor is on their own page within two taps.
5. Compliance status chips (Live, In certification, Planned) rendered as text with colour, clickable to the trust page, repeated in the hero of country pages.
6. Sticky sub-navigation on long pages (features, pricing, comparisons) listing the sections, as Jane and Pabau do.
7. Search in the header, as Zanda and Heidi have, once the help centre and glossary exist.
8. Phone first: the Android buyer on mobile data gets a static hero image under 120 KB, no video autoplay, tables that stack into cards, and tap targets of 44 px.
9. Nothing hidden behind motion or interaction: FAQs open in the DOM, tabs render all panels for crawlers, the tour has a transcript page.
10. Every screenshot has a caption that repeats the claim and an alt text that describes the screen.

## What not to import

Card-required trials and promo pricing that reverts (SimplePractice), because the audience reads it as a trap. Video-background heroes (Freed, Nookal), because of mobile data. US badges as the only trust signal (SOC 2, HITRUST); use them on the trust page, lead with the local regulator. Enterprise "talk to us" with no number, except for the Enterprise tier itself. A mascot. Stock photography of smiling clinicians. The Carepatron discount banner above the nav, which pushes the H1 below the fold on a phone.

## What this changes in the handoff spec

Section 5.1 (home) takes the revised section order above. Section 7.3 gains four components: OldWayNewWay, LiveCounter, TourLauncher, StickySubnav. Section 7.5 gains the identity decisions (secondary colour, display face, the journey-line device, no scroll-reveal). Section 7.9 adds the tour as the self-serve door. Section 9.1 phase 1 adds the photo shoot and the tour build.


## 12. Image and screenshot brief (added 23 September 2026)

Decisions recorded on 23 September 2026: no free trial, so the six-minute product tour is the self-serve door on every page beside "Book a demo"; clinic imagery will be generated rather than photographed; product screenshots will be taken by the team. This tab is the brief for both, so the images arrive matching the pages that need them.

## Ground rules for generated images

Generated pictures work as setting and mood; they do not work as proof. So the rule is: a generated image is never captioned or placed as if it were a customer, a named doctor, or a real clinic, and it never carries a readable logo, badge, brand name, regulator name, phone number or document. Proof on every page comes from screenshots with real-looking data, named testimonials with text only (or a real photo the doctor supplies), and the numbers. Within that rule, generated images do three jobs well: the environment behind a hero screenshot, the "old way" side of the old-way panel (paper registers, a phone on a desk, a shelf of files), and the texture of a country page (a Nairobi or Kolkata street-level clinic frontage without signage, a reception counter, an M-Pesa till, a pharmacy shelf).

Style: photographic, natural light, 35 mm look, muted colour, real clutter, no smiles-at-camera, no white coats posed with stethoscopes, no glowing screens. Faces either turned away, out of focus, cropped at the shoulder, or absent; where a face is visible, the person is a background figure, not the subject. Regionally accurate details matter more than polish: Indian and Kenyan clinic architecture, ceiling fans, plastic chairs, a queue token board, a WhatsApp notification on a phone, an inverter, a water dispenser, handwritten registers. No Western hospital corridors. Aspect ratios: hero backgrounds 3:2, section images 4:3, phone-column images 4:5. Export WebP at 1600 px wide, under 150 KB.

## Generation prompts by use

| Use | Pages | Prompt (adjust the city and specialty) |
| --- | --- | --- |
| Hero environment | Home, solution pages | "Interior of a small private clinic in Kolkata, reception counter with a laptop and a card machine, patients waiting on plastic chairs out of focus, ceiling fan, afternoon light through a barred window, documentary photograph, 35mm, muted colours, no visible signage or text, no faces in focus" |
| Old way | Home, solution and feature pages | "Cluttered clinic reception desk with a paper appointment register, a stack of patient files with handwritten labels, a personal smartphone showing notification badges, a calculator and receipt book, overhead fluorescent light, documentary photograph, no readable text" |
| Country texture, Kenya | Kenya page, Kenya demo page | "Street-level frontage of a small private medical clinic in Nairobi, Kenya, concrete building, corrugated awning, a motorbike parked outside, late afternoon, documentary photograph, no readable signage or text" and "Pharmacy counter inside a Nairobi clinic, shelves of medicine boxes, a pharmacist's hands counting tablets, a phone on the counter, natural light, no readable labels" |
| Country texture, India | India page, city pages if kept | "Reception of a polyclinic in an Indian city, token number display, a receptionist's hands at a keyboard, patients' feet and bags in the waiting area, ceiling fan, documentary photograph, no readable text" |
| Country texture, UAE | UAE page | "Reception of a modern clinic in Dubai, marble counter, a nurse's hands with a tablet, soft daylight, minimal, documentary photograph, no readable text or logos" |
| Country texture, Nigeria | Nigeria page | "Small private hospital outpatient waiting area in Lagos, wooden benches, a wall fan, an inverter unit in the corner, a nurse walking past out of focus, documentary photograph, no readable text" |
| Specialty texture | Each specialty page | "Dental treatment room, chair and light from a low angle, instruments on a tray, no people" and equivalents for a physiotherapy room, an ophthalmology slit lamp, a paediatric consulting room with a growth chart on the wall (chart unreadable), a pharmacy dispensing counter, a lab bench with a centrifuge |
| Founder block | Home, About | Do not generate. Use a real photograph of Girish Mohata; the block does not run until one exists |
| Testimonials | All | Do not generate. Text only, or a photo the doctor supplies |

Each generated file is named by use and page (hero-kolkata-reception.webp, oldway-desk-01.webp, kenya-frontage-01.webp) and stored in the media library with an "AI-generated, environmental" tag so nobody later drops one into a customer story.

## Screenshot list

Screens are the proof on every page, so they are taken from the real product, in a demo tenant seeded with realistic data: Indian and Kenyan patient names, INR and KES amounts, WhatsApp threads with sample reminder text, today's date, no "Test" or "Demo" strings visible, no personal data. Capture at 1440 by 900 on a clean browser profile, light theme, browser chrome cropped, exported as WebP, with a second phone capture (390 by 844) for the screens marked phone. One screen per row; the caption is the claim the page makes about it.

| Screen | Data to set up | Pages | Phone too |
| --- | --- | --- | --- |
| Today view: appointment list with walk-ins, fixed slots and a teleconsult | 14 appointments, two walk-ins, one video, one no-show marked | Home hero, scheduling, solo clinic | Yes |
| Resource calendar: doctors, rooms and devices in columns | 4 doctors, 3 rooms, one device | Polyclinic | No |
| Thirty-second prescription: the Rx screen mid-entry with a drug interaction warning | Two drugs, one interaction flagged, Hindi print option visible | EMR feature, solo clinic, home journey step | Yes |
| Cura AI note draft beside the consult | A drafted SOAP note with "review and sign" state | AI page, CuraPilot, EMR | Yes |
| CuraPilot alert in a live consult | A missed-diagnosis or safety alert with the clinician's accept/dismiss controls | CuraPilot | No |
| WhatsApp reminder thread as the patient sees it | Reminder, confirmation reply, prescription PDF, report PDF | WhatsApp feature, scheduling, engagement | Yes |
| Invoice from an encounter with GST lines and a part payment | INR invoice; second capture in KES with M-Pesa | Billing, revenue, country pages | Yes |
| Day-end cash close | Cash, card, UPI or M-Pesa totals with a variance line | Billing, revenue | No |
| Payor setup and coverage check at registration | Two insurers, one TPA, a coverage validation result | Insurance claims, hospital OPD | No |
| Claim status list with denials and reasons | 20 claims, 3 denied with reasons | Insurance claims, revenue | No |
| Pharmacy dispensing from a prescription with batch and expiry | One expiring batch flagged | Pharmacy, hospital OPD | No |
| Stock transfer between branches and reorder alert | Two branches, one item below reorder point | Pharmacy, clinic chain | No |
| Lab order from the chart and result back with a flag | One abnormal value | Lab | No |
| Teleconsult in progress with the prescription panel open | Video tile plus Rx | Telehealth | Yes |
| Patient app: booking, reports, messages | Three screens on a phone | Patient engagement, home | Yes |
| Recall campaign for a condition with the sent list | Diabetes review recall, 40 patients | Patient engagement | No |
| Owner dashboard: the eight morning numbers | Revenue by branch, collections vs billed, no-show rate, patients per doctor per hour, average ticket, stock days, claims pending, feedback score | Reports, clinic chain, home | Yes |
| Branch-by-branch KPI comparison | Five branches | Clinic chain, multi-location | No |
| SOP tracking or checklist adherence by branch | Three SOPs, adherence percentages | Clinic chain | No |
| Queue and token board | Waiting, in consult, done; token display view | Hospital OPD, scheduling | No |
| Roles and permissions matrix | Owner, doctor, nurse, reception, pharmacist, accountant | Polyclinic, trust | No |
| Audit log | A day's entries | Trust | No |
| Odontogram with a treatment plan | Two procedures planned across visits | Dental | No |
| Dermatology before-and-after image timeline | Three visits (synthetic images) | Dermatology | No |
| Growth chart and immunisation schedule | One child, WHO chart, next vaccine due | Pediatric | No |
| Cardiology trend chart | BP and lipids over six visits | Cardiology | No |
| IVF cycle tracker | One cycle in progress | IVF | No |
| Physiotherapy session plan with outcome score | Six sessions, one score | Physiotherapy | No |
| Mental health restricted note | Session note with restricted-access badge | Mental health | No |
| Programme report for an NGO | Visits by programme, stock consumed by month | NGO | No |
| Currency-localised pricing cards | INR, KES, AED, NGN | Pricing pages | Yes |

Thirty-one screens cover every page in the spec. The first eight are needed for phase 2 and should be taken first.

## The tour

With no trial, the tour is the second door and needs building in phase 1. Six minutes, eight chapters that follow the patient journey (book, arrive, consult, prescribe, pay, dispense, follow up, report), using the same seeded tenant as the screenshots so the screens match. No form to start; an email prompt at the end to save progress and receive the demo booking link. A transcript page at /tour/transcript so the content is crawlable. CTA label everywhere: "See the product in 6 minutes".
