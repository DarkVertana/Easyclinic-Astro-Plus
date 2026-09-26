# Staging audit, 23 September 2026

The staging build at staging-easyclinic.vercel.app is the same site that was audited on 17 September, with none of the handoff spec applied yet. 122 URLs are in its sitemap; 120 loaded (two timed out). Every finding below was measured from the HTML, not sampled. The short verdict: of 122 pages, 48 need a rewrite to their spec, 10 merge into a parent page, 22 redirect away, 27 are held until real content exists, 12 can stay with minor fixes, 2 must be removed from the index, one (the knowledgebase) needs a decision, and 34 pages the spec calls for do not exist yet. No page on the site yet meets the publish checklist.

## Site-wide findings

| Check | Result | What to do |
| --- | --- | --- |
| Structured data | 0 of 120 pages carry any JSON-LD | Generate Organization, SoftwareApplication, FAQPage, BreadcrumbList and Article from the content model (spec 7.7) |
| Author and last-updated | 2 of 120 (privacy, terms) | AuthorByline on every landing and content page |
| Shared stat line "5,000+ doctors · 18 countries · Since 2003" | 104 of 120 pages | Remove; one page-specific proof block instead |
| "Confirm in demo" or "in progress" as an answer | 53 pages | Four-state compliance status with dates; nothing else is allowed |
| Words from the banned list | 49 pages | Lint rule in the build (spec 7.2) |
| Under 400 words of body copy | 63 pages | Specialty pages average 290 words; country pages 440; persona pages under 200 |
| Fewer than 5 FAQs, or FAQ answers of one word ("Yes.", "Optional.") | 55 pages | 5 to 8 real questions, answered in a sentence |
| Title over 60 characters | 24 pages | Listicle titles run to 71 characters |
| Meta over 155 characters | 43 pages | Home meta is 182 characters |
| "Explore the rest of the platform" block | 5 feature pages | Replace with RelatedLinks |
| Same six testimonials | Home, /features, /pricing, /about-us | One testimonial per page, chosen for that page |
| Same "Put EMR, billing, and care in one place" closing block | Most pages | CTABand copy per page |
| Sitemap includes /devlabs/ and /devlabs/dashboard/ (CMS login) | Yes | Exclude and noindex |
| Staging indexable | No robots meta, no X-Robots-Tag, no robots.txt (the URL returns the 404 page) | noindex on all non-production deployments |
| Canonicals | Point to www.easyclinic.io with trailing slash | Correct for launch; keep the trailing slash convention (see below) |
| Stack | Astro 7.2 on Vercel, not Next.js | Spec section 7 maps one to one: content collections for the content model, Astro components, integrations for sitemap and JSON-LD |
| AI naming | "Easy Clinic AI" (title of /ai), "Cura AI", "CuraPilot" and "AI Assistant" (pricing) all still in use | Apply the naming decision |
| Brand spelling | "Easy Clinic" and "EasyClinic" both in use, including on Home | One spelling |

One change to the earlier spec: keep trailing slashes. The live WordPress site and the Astro build both use them on every URL, so the "no trailing slash" rule would cost a redirect on every page for nothing. Only the four live comparison pages lack a slash; 301 those to the slash form.

## What exists versus what the spec needs

The staging site has 35 specialty pages, 24 country pages (19 countries plus five Indian cities), 18 country listicles, 5 feature pages, 4 solution pages, 4 persona pages (CEO, CFO, CMO, EMR), 4 comparison pages, 7 blog posts and the company pages. The spec needs 12 feature pages, 5 solution pages, 12 specialties, 4 deep country pages with demo and pricing pages, 4 listicles, a trust centre, integrations, switch, customers, glossary, a start-a-clinic hub and about 24 posts.

Missing entirely (34 pages): /features/emr, /features/billing, /features/pharmacy-and-inventory, /features/lab, /features/telehealth, /features/whatsapp, /features/multi-location, /solutions/ngo-clinics (the current NGO page is a draft), /trust, /integrations, /switch, /customers and three case studies, /glossary, /pricing/india, /pricing/kenya, /pricing/uae, /pricing/nigeria, /indiademo, /uaedemo, /nigeriademo (and /kenyademo is not on staging at all, only on the live site), /compare/practo-ray-alternatives, /compare/healthplix-alternatives, /specialties hub, /countries hub, /start-a-clinic hub and the guide pages (which exist on the live site and rank, but are not in the staging build), the four country privacy pages.

Present but not called for (39 pages): 21 thin specialty pages, five Indian city pages, seven micro-market country pages and their seven listicles, three executive persona pages, the EMR persona page, two devlabs pages. Each has a redirect or hold action in the table.

## Does each page earn its place?

Applying the three tests the brief set (valuable to a human, optimised for one keyword set, needed from a product perspective):

Pages that pass all three today: none. /curapilot, /easyclinic-vs-practo, /best-clinic-management-software-kenya and /pricing come closest; they have real content and a clear query, and each needs schema, an author, a proof block and FAQ fixes rather than a rethink.

Pages with a product reason and a keyword but no human value yet: the 4 core country pages, the 4 solution pages, the 5 feature pages, the 14 specialty pages worth keeping, home, /ai, /features. These are the rewrite list; the spec section for each is in the table.

Pages with a keyword but no product reason: the five Indian city pages (identical to the India page with the city swapped), the seven micro-market country pages and listicles (no regulator, price, client or contact; the Somalia listicle's shortlist is Smart Hospital Manager and Ksatria with "confirm in demo" in every compliance cell). Redirect.

Pages with a product reason but no keyword: the CEO, CFO and CMO pages, the EMR persona page, /doctors. Fold into the pages that own the query.

Pages with neither: /devlabs, the seven 200-word blog posts as they stand.

## Per-page verdicts

Verdicts: Rewrite (keep the URL or move it, rewrite to spec), Merge (301 into a parent as a section), Redirect (301 away), Hold (keep unindexed until the content exists), Keep (minor fixes only), Noindex, Decide. The spec numbers refer to the handoff document.

| Page | Words | FAQs | Verdict | Action |
| --- | --- | --- | --- | --- |
| / | 1157 | 8 | Rewrite | Rewrite to spec 5.1: new H1 and opener, persona router, study proof block, regulator strip, three testimonials not six, real FAQ. |
| /about-us/ | 724 | 0 | Rewrite | Rewrite per 5.19; H1 and body are the old boilerplate (empower, revolutionise, seamless, streamline, Dream Team). |
| /ai/ | 464 | 0 | Rewrite | Rewrite to 5.2: head keyword AI medical scribe, six jobs, safety, comparison table; drop 'Easy Clinic AI' name, remove 'leverage/seamless/streamline'. |
| /appointment-scheduling-at-easy-clinic/ | 591 | 3 | Rewrite | Move to /features/appointment-scheduling, rewrite per 5.11 with the measured no-show number; remove Explore block. |
| /ayurveda-emr-software/ | 250 | 4 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /best-clinic-management-software-india/ | 706 | 6 | Rewrite | Rebuild per 5.14: sourced and dated competitor cells, per-vendor sections, author. Kenya is closest; India and Nigeria have 4 to 10 confirm-in-demo phrases each. |
| /best-clinic-management-software-kenya/ | 842 | 8 | Rewrite | Rebuild per 5.14: sourced and dated competitor cells, per-vendor sections, author. Kenya is closest; India and Nigeria have 4 to 10 confirm-in-demo phrases each. |
| /best-clinic-management-software-nigeria/ | 608 | 5 | Rewrite | Rebuild per 5.14: sourced and dated competitor cells, per-vendor sections, author. Kenya is closest; India and Nigeria have 4 to 10 confirm-in-demo phrases each. |
| /best-clinic-management-software-uae/ | 604 | 5 | Rewrite | Rebuild per 5.14: sourced and dated competitor cells, per-vendor sections, author. Kenya is closest; India and Nigeria have 4 to 10 confirm-in-demo phrases each. |
| /blogs/billing-that-balances-the-till/ | 205 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /blogs/cura-ai-copilot-for-busy-clinicians/ | 213 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /blogs/cut-no-shows-with-smarter-scheduling/ | 214 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /blogs/go-paperless-without-losing-speed/ | 234 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /blogs/inventory-and-pharmacy-without-stockouts/ | 194 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /blogs/patient-engagement-beyond-appointment-sms/ | 195 | 0 | Rewrite | About 200 words, 'EasyClinic team' byline, no FAQ; expand to a real guide with a named author or fold into the owning feature page. |
| /cardiology-emr/ | 337 | 4 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /dental-emr-software/ | 344 | 6 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /dermatology-emr-software/ | 406 | 6 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /doctors/ | 214 | 3 | Rewrite | Rewrite to 5.9: selector plus full-sentence FAQs; the three fragment FAQs are still there. |
| /easyclinic-emr-vs-traditional-emr/ | 689 | 10 | Rewrite | Rewrite as the EMR vs paper guide linking to /switch; 10 FAQs is too many. |
| /easyclinic-vs-healthplix/ | 532 | 5 | Rewrite | Rebuild the table with real data; two 'confirm in demo' cells remain. |
| /emr-landing-page/ | 147 | 3 | Rewrite | Replace with /features/emr per 5.11; this page is 147 words with routing FAQs and no keyword target. |
| /emr-software-in-india/ | 483 | 5 | Rewrite | Rebuild per 5.13 at the new slug (Kenya keeps its slug): regulator table with status and date, local price, named contact, local client; every compliance line still says in progress or confirm in demo. |
| /emr-software-in-kenya/ | 442 | 5 | Rewrite | Rebuild per 5.13 at the new slug (Kenya keeps its slug): regulator table with status and date, local price, named contact, local client; every compliance line still says in progress or confirm in demo. |
| /emr-software-in-nigeria/ | 461 | 6 | Rewrite | Rebuild per 5.13 at the new slug (Kenya keeps its slug): regulator table with status and date, local price, named contact, local client; every compliance line still says in progress or confirm in demo. |
| /emr-software-in-uae/ | 477 | 6 | Rewrite | Rebuild per 5.13 at the new slug (Kenya keeps its slug): regulator table with status and date, local price, named contact, local client; every compliance line still says in progress or confirm in demo. |
| /ent-emr-software/ | 345 | 4 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /features/ | 669 | 0 | Rewrite | Rewrite to 5.4: 12 modules at equal depth, journey diagram, plan matrix, integrations strip; remove the six-testimonial block. |
| /general-practitioner-emr/ | 252 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /ivf-emr/ | 357 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /mental-health/ | 296 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /neurology-emr/ | 341 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /ngo-landing-page/ | 183 | 3 | Rewrite | Rebuild at /solutions/ngo-clinics per 5.10; all three FAQ answers still say confirm in demo. |
| /obgyn-emr-software/ | 353 | 4 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /ophthalmology-emr/ | 391 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /orthopedic-emr/ | 346 | 4 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /partner-with-ec/ | 579 | 4 | Rewrite | Rewrite: state commission range and tiers; H1 is 'Empower clinics. Drive growth. Earn together.' |
| /patient-engagement-at-easyclinic/ | 566 | 3 | Rewrite | Move to /features/patient-engagement, rewrite per 5.11; teleconsult copy moves to /features/telehealth. |
| /payor-management/ | 472 | 3 | Rewrite | Move to /features/insurance-claims, rewrite per 5.11 with payor-by-country table and 34% figure. |
| /pediatric-emr/ | 350 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /physiotherapy-emr/ | 278 | 5 | Rewrite | Keep and rewrite per 5.15: named chart objects, timed workflow, countable templates, specialist testimonial, full-sentence FAQs. Today 250 to 400 words with one-word FAQ answers. |
| /reports-and-dashboards/ | 454 | 3 | Rewrite | Move to /features/reports-and-dashboards; replace '100+ views' with the eight morning numbers; absorb the three executive pages. |
| /revenue-management/ | 485 | 3 | Rewrite | Move to /features/revenue-management; remove the duplicated payor block; billing splits out to /features/billing. |
| /solutions/clinic-chain/ | 315 | 3 | Rewrite | Rewrite to 5.7: HQ vs branch table, study numbers, client logos from live site, 8 FAQs. |
| /solutions/doctor-clinic/ | 347 | 3 | Rewrite | Rewrite to 5.5 at /solutions/solo-clinic: day timeline, numbers, testimonial, 8 FAQs; currently 347 words with 3 FAQs. |
| /solutions/hospital-opd/ | 294 | 3 | Rewrite | Rewrite to 5.8: resolve the HIS contradiction in the opener, queue screenshot, claims flow, scope box. |
| /solutions/polyclinic/ | 306 | 3 | Rewrite | Rewrite to 5.6: roles matrix, shared billing, testimonial, 8 FAQs; same template as the other three today. |
| /aesthetic-emr-software/ | 257 | 5 | Merge | 301 into /dermatology-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /alternative-medicine/ | 293 | 5 | Merge | 301 into /ayurveda-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /cosmetology-emr-software/ | 231 | 4 | Merge | 301 into /dermatology-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /diabetology-emr-software/ | 267 | 4 | Merge | 301 into /endocrinology-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /family-physician-emr/ | 268 | 5 | Merge | 301 into /general-practitioner-emr/ as a section; the page is the shared template with the specialty noun swapped. |
| /immunology-emr/ | 235 | 4 | Merge | 301 into /allergy-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /pathology-emr/ | 282 | 5 | Merge | 301 into /features/lab as a section; the page is the shared template with the specialty noun swapped. |
| /psychiatry-emr/ | 350 | 5 | Merge | 301 into /mental-health/ as a section; the page is the shared template with the specialty noun swapped. |
| /psychology-emr/ | 316 | 4 | Merge | 301 into /mental-health/ as a section; the page is the shared template with the specialty noun swapped. |
| /trichology-emr-software/ | 273 | 4 | Merge | 301 into /dermatology-emr-software/ as a section; the page is the shared template with the specialty noun swapped. |
| /best-clinic-management-software-fiji/ | 486 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-maldives/ | 558 | 6 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-mauritius/ | 501 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-seychelles/ | 484 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-somalia/ | 506 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-suriname/ | 482 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /best-clinic-management-software-trinidad-and-tobago/ | 509 | 5 | Redirect | Shortlist is generic (Smart Hospital Manager, Ksatria) and the compliance line is 'confirm in demo'; 301 to /countries. |
| /ceo-landing-page/ | 197 | 3 | Redirect | 301 to /features/reports-and-dashboards; 197 words, no query owns it. |
| /cfo-landing-page/ | 193 | 3 | Redirect | 301 to /features/reports-and-dashboards; 193 words, eight confirm-in-demo phrases. |
| /cmo-landing-page/ | 171 | 3 | Redirect | 301 to /features/reports-and-dashboards; 171 words. |
| /emr-software-in-bangalore/ | ? | ? | Redirect | Identical to the India page with the city name swapped; 301 to the India page unless a local client and address exist. |
| /emr-software-in-chennai/ | 483 | 5 | Redirect | Identical to the India page with the city name swapped; 301 to the India page unless a local client and address exist. |
| /emr-software-in-delhi-ncr/ | 492 | 5 | Redirect | Identical to the India page with the city name swapped; 301 to the India page unless a local client and address exist. |
| /emr-software-in-fiji/ | 412 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-hyderabad/ | 483 | 5 | Redirect | Identical to the India page with the city name swapped; 301 to the India page unless a local client and address exist. |
| /emr-software-in-maldives/ | 435 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-mauritius/ | 424 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-mumbai/ | 483 | 5 | Redirect | Identical to the India page with the city name swapped; 301 to the India page unless a local client and address exist. |
| /emr-software-in-seychelles/ | 412 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-somalia/ | 423 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-suriname/ | 413 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /emr-software-in-trinidad-and-tobago/ | 433 | 5 | Redirect | Micro market with no regulator, price or client content; 301 to /countries. |
| /knowledgebase/ | 350 | 4 | Decide | Decide: real help centre or 301 to help.easyclinic.io. |
| /allergy-emr-software/ | 248 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /best-clinic-management-software-ethiopia/ | 420 | 3 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-ghana/ | 557 | 5 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-qatar/ | 500 | 5 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-rwanda/ | 386 | 3 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-south-africa/ | ? | ? | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-tanzania/ | 419 | 3 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /best-clinic-management-software-uganda/ | 475 | 4 | Hold | Keep only if the shortlist names real local vendors with sourced data; otherwise 301 to /countries. |
| /emr-software-in-ethiopia/ | 436 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-ghana/ | 452 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-malaysia/ | 428 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-qatar/ | 418 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-rwanda/ | 414 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-south-africa/ | 445 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-tanzania/ | 426 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /emr-software-in-uganda/ | 423 | 5 | Hold | Keep only once the regulator table, local contact and testimonial are filled; otherwise 301 to /countries. Today it is the India template with the currency swapped. |
| /endocrinology-emr-software/ | 255 | 4 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /gastroenterology-emr/ | 298 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /general-surgery-emr/ | 253 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /hematology-emr/ | 253 | 4 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /nephrology-emr/ | 268 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /oncology-emr/ | 291 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /pulmonology-emr/ | 269 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /radiology-emr/ | 257 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /rheumatology-emr/ | 255 | 4 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /sexology-emr/ | 264 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /urology-emr/ | 283 | 5 | Hold | Thin (about 250 words, FAQ answers of one word). Consolidate into a section on /specialties with noindex on the page until the specialty template can be filled. |
| /blogs/ | 248 | 0 | Keep | Hub fine; posts need authors and depth. |
| /careers/ | 568 | 4 | Keep | Fine as is; remove stat line. |
| /contact-us/ | 302 | 0 | Keep | Keep; add WhatsApp, country selector with named contact, calendar embed, LocalBusiness schema. |
| /curapilot/ | 755 | 4 | Keep | Keep bones; add study card, walkthrough, POC section, integrations list; remove uptime stat; FAQ to 8. |
| /custom-healthcare-software-development/ | 375 | 4 | Keep | Keep only with two case studies; otherwise fold into /integrations. |
| /devlabs/ | 18 | 0 | Noindex | Remove from sitemap and noindex; it is the CMS login. |
| /devlabs/dashboard/ | 18 | 0 | Noindex | Remove from sitemap and noindex. |
| /easyclinic-vs-kenyaemr/ | 662 | 5 | Keep | Keep; refresh date, add author and sources. |
| /easyclinic-vs-practo/ | 553 | 6 | Keep | Keep; apply 5.16 table rules (sourced, dated cells), add migration section and author. |
| /pricing/ | 966 | 7 | Keep | Keep structure; add currency switcher and four country pages, quarterly prices, add-on prices, total-cost examples; rename AI Assistant; cut testimonials to two. |
| /privacy/ | 348 | 0 | Keep | Master is fine; add the four country privacy pages. |
| /resources/ | 243 | 0 | Keep | Fine as a finder once the three selectors are added. |
| /solutions/ | 146 | 0 | Keep | Hub is fine as a router; add NGO card and the two-question selector; remove stat line. |
| /terms/ | 318 | 0 | Keep | Fine. |
| /testimonials/ | 387 | 0 | Rewrite | Rename to /customers, add filters, tenure and outcomes, three case studies. |

## Order of work

1. Platform first (one week): content model and validation, JSON-LD generation, AuthorByline, noindex on non-production, sitemap exclusions, banned-word lint, the redirect file. Nothing in the table can ship without these.
2. The 15 pages the data says matter: India country page and /pricing/india, Kenya country page and /kenyademo, home, /pricing, /features/emr (new), the four solution pages, /ai, /curapilot, /features, /trust (new).
3. Redirects and merges (23 redirects, 10 merges) in one release, so the crawl budget goes to the pages being rewritten.
4. The 12 feature pages, the four listicles, the comparison refresh, /switch, /integrations, /customers.
5. The 14 specialty pages, the start-a-clinic hub imported from the live site, blog rewrite.

## Regressions to watch for on the next staging push

The bar for the next review is the publish checklist in the handoff (section 9.2). The quickest way to check a push is the crawl script used here: it reads title and meta length, H1 count, word count, FAQ count and answer length, JSON-LD types, author presence, banned words, the stat line, the Explore block and confirm-in-demo phrases for every URL in the sitemap. It should be run in CI, and a page that fails should not deploy.
