# EasyClinic live-site facts harvest (retrieved 2026-09-26)

All 16 target URLs returned HTTP 200 with a trailing slash. `/curapilot-ai/` only has a hero section; the full CuraPilot content is on `/curapilot/`. Pages were read with `curl -sL` plus text extraction. Base URL: `https://www.easyclinic.io`.

---

## 1. Pricing (source: /pricing/)

- Headline: **"Easy Plans. Easy Pricing. No Surprises"**
- Toggle: **"Billed Annually (Save 20%)"** (primary tab) / **"Billed Quarterly"** (secondary tab). I checked the tab mapping against the eael-toggle primary/secondary wrappers in the HTML.
- Currency is **INR only**. There is no KES, USD or AED pricing on any page.

| Plan | Best suited for | Annual | Quarterly |
|---|---|---|---|
| PROFESSIONAL | "general practitioners and physicians." | ₹1499 /per doctor per month | ₹1899 /per doctor per month |
| PREMIUM | "specialists & super specialists." | ₹1999 /per doctor per month | ₹2499 /per doctor per month |
| ENTERPRISE | "multi-location clinic chains, polyclinics & nursing homes." | "Please get in touch for a custom price" | same |

- The discount doesn't quite match the label. The Premium gap is 20%, but the Professional gap works out to about 21%.
- **Professional inclusions:** Patient Management; Electronic Medical Records (EMR); AI Assistant; Finance, Billing & Payments; Appointment Scheduling; Dashboard & Reports; Multi-user Management; SMS & Email Communication; Free Unlimited Support & Training. The quarterly tab only adds **"Reception user included free"**. **Ambiguous:** the FAQ says a reception licence is included in every price.
- **Premium:** "Everything in Professional PLUS" Advanced EMR for Specialists; Virtual Clinic - Video Consultation; Online Payment Integration; Custom Clinical Forms and Print Layouts; Package Treatments; Lab Reporting; WhatsApp Communication; Multi-Location Management; Dedicated Account Manager.
- **Enterprise:** "Everything in Premium PLUS" Clinical SOP Tracking; Advanced Financial Accounting; Insurance and 3rd Party Payor Management; Inventory & Logistics Management; Pharmacy Management; Lab Management; Dedicated Reporting Server & Custom Business Analytics; Workflow & Process Manager; Patient Engagement, Patient Portal & App; Integrations & Custom Feature Development; Multi-Location Control & Administration; Custom or Private Cloud Hosting.
- No separately priced add-ons are listed.
- Social proof under the table: "Used by 5000+ Doctors across 200 cities".

**FAQ answers (verbatim):**
- Contracts: **"There are NO binding contracts whatsoever. Use Easy Clinic till you are happy with it."**
- Learning: "...walk you through from being a beginner to an expert on Easy Clinic in less than 1 hour."
- **Four-day training:** "We @ Easy Clinic have a personalised training program for you (and your clinic staff): Day 1 – Basic Training – 40 mins / Day 2 – EMR scenario Training – 40 mins / Day 3 – Practice exercises – 20 mins / Day 4 – Road to expertise – 20 mins"
- Pen and paper: "If you are willing to give us just 2 hours / 10 patient records, we promise to make your prescription writing faster..."
- Reception: "A license for your reception is included in the price... They are not allowed to use the EMR or issue prescriptions."
- Customisation: "hundreds of customisation options... without any charges."
- Security: "bank level security... We never misuse, sell or in any way disclose your data".
- Support: "phone, email and chat". The live page has a typo, "foxcus".

**Conflicting pricing and onboarding claims on other pages:**
- /best-clinic-management-software-kenya/: "Easy Clinic prices per user and per location". The pricing page says per doctor.
- /emr-software-in-india/ FAQ: "typically priced per clinic per month".
- /best-clinic-management-software-kenya/: "2–4 week setup". /kenyademo/: "live in as little as 3 days".

---

## 2. Testimonials

| Person | Role / clinic / city | Pages | Quote (verbatim, abridged only where marked) |
|---|---|---|---|
| Dr. Prantar Chakrabarti | Haematology, Institute of Hematology & Transfusion Medicine | /, /about-us/, /testimonials/ | "I have been an avid user of Easy Clinic since 2008 and have become almost addicted to it. The features I like the most are: Data handling and analytical tools available to generate information from the patient's data." |
| Dr. Seetha Lakshmi Kolanakuduru | Aditya Women & Infertility Clinic, Hyderabad | same | "We have been using Easy Clinic Software since 2012. I found it very useful and user friendly. Their service and support is very prompt. I strongly recommend this software as it is very useful." |
| Dr. T.L. Prabhu | Chief Physician and Managing Director, Prashanthi Clinic | same | "Easy Clinic has touched all aspects of the processes we follow at Prashanthi Clinic and Healthcare Services Pvt Ltd and helped me become more efficient. We have moved from a paper based clinic to a completely paperless setup in about 6 months." |
| Dr. Manish Bhatia | Founder & Director, Asha Homeopathy Medical Center (the pricing page adds ", Jaipur") | /, /about-us/, /testimonials/, /pricing/, /emr-software-in-kenya/, /emr-software-in-india/ | "I have been using Easy Clinic for more than 10 years now. The software is mature and has helped me keep my clinic paperless. It improves my work efficiency, record management, and accounting. The team is very responsive and support is excellent!" |
| Dr. Chao Rochek Buragohain | Orthopaedic, Arogya Orthopaedic Clinic | same set | "I have been using Easy Clinic for the last 5 years in my clinical practice. This software is really user friendly and customizable. I highly recommend Easy Clinic to the busy clinicians for their day to day practice." /about-us/ has "an easy clinic". |
| Dr. Tarun Mishra | Director, City Hospital | same set | "It is very easy, user friendly with world class technology. Easy Clinic people are hard working, soft spoken and play a vital role in patient's management." |
| Dr. N. R. P. Chandra Balaji | Psychiatrist | /pricing/, /hospital-opd-nursing-home-software/ | "I have been using the Easy Clinic for the last 10 years. The software has been truly instrumental in transforming my practice from mere pen & paper prescription to a totally digitized format. The best thing about Easy Clinic is its robust EMR along with a highly energetic support team with very little turnaround time. My best wishes to Team Easy Clinic." The live text has a stray trailing "re.". |
| Dr. Premanand Raya | Pulmonologist | /pricing/ | "I have been using this software for many years. It's quite useful and befitting to my clinical practice. Provision of short-cuts is aptly useful for my style of prescription and I am able to type the entire prescription within a half minute. The support provided at times of need was very prompt and useful." The image file is "Dr.-Premananda-Raya.jpg", so the spelling is **ambiguous**. |
| Dr. Sanjay Teotia | General Physician | /hospital-opd-nursing-home-software/ | "I have been using Easy Clinic medical software for the last 10 years, its very user friendly. Writing notes, advising investigations or prescribing medications, everything is so easy and smooth that it enhances your efficiency and improves the quality of the prescription." |
| Dr. Siddhartha Ghosh | Senior Ophthalmologist, Global Eye Hospital | same | "Great EMR. Easy to use and customizable. The best and most useful feature is that every field is searchable. And a big comfort is the service of Easy Clinic, which is very prompt and appropriate." |
| Dr. Srinivasa Teja | Psychiatrist, Brainwave hospital | same | "I am a regular user of Easy Clinic so much so that it has become a part and parcel of my life. With the software I am able to manage my patient records in a highly structured and efficient manner." |
| Dr. J J Thakkar, Nairobi | Laser Stone & Endoscopy Centre, Lecturer at Agakhan University, Member British Association of Urological Surgeons | /, /emr-software-in-kenya/, /emr-software-in-india/ | "I have recently become a user of Easy Clinic. I am very happy with the software and getting to grips with it. What has impressed me is the dedication of the support team after the installation. The team especially my dedicated to account manager have been there to support my Clinic with great enthusiasm and concern. This is rarely seen when you install other software. All the best Easy Clinic!!!" |
| Mr. Hisham Ismail, Malaysia | Group CIO, Qualitas Health | Kenya and India pages | "We had the pleasure of using the Easy Clinic system, and it transformed how we managed patient care and clinic operations. Easy Clinic helped us streamline workflows, reduce administrative overhead, and improve patient satisfaction. Their support team was responsive and knowledgeable, always ready to assist when needed." |
| Mr. Foster Akaketwa, Zimbabwe | Group CIO, CIMAS Health | Kenya and India pages | "After exploring many options, we found Easy Clinic, a solution with the right foundation and, more importantly, a dedicated team willing to co-create with us. Together, we shaped Easy Clinic into the heart of our operations today. It not only streamlines billing, collections, and inventory, but also enhances clinical workflows, reduces medical errors, and improves patient outcomes." |
| Dr. V Ramanathan, Australia | CEO/Director, SSS Centre for Sexual Health Pvt Ltd | / | "...the price of the product and service is a lot cheaper than what was quoted in Australia but the outcome is very much the same... 'Novel Medical Solutions' were efficient, affordable, prompt..." (abridged) |
| Dr. S.B.Bhattacharyya, Noida | none given | / | "...like a breath of fresh air amongst the usually stale ones that emanate from its competitors. Having been doing similar work since 2001..." (abridged) |
| Dr. Robert Korom | Chief Medical Officer, Penda Health | /kenyademo/, /curapilot/ | Two versions exist; see section 4. |

- The /testimonials/ page also embeds three YouTube videos: `youtu.be/EhGn45zbOoU`, `youtu.be/c2trQPH9rcM`, `youtu.be/l4Y5DT20F6M`.
- There is a Trustindex badge site-wide: "4.8 Top Rated Service 2026 verified by Trustindex".

---

## 3. Clients and logos named

- **Logo image alts** on /about-us/ ("Our Esteemed Clients") and /ai/ (image folder `/wp-content/uploads/2024/01/`):
  - Premier Hospital (Dr. Mahesh Marda)
  - ROSS CLINICS
  - SETH G S K E M HOSPITAL
  - German Osteo
  - Caring Minds
  - DAYANAND EDUCATION SOCIETY
  - FLAME UNIVERSITY
  - HAND IN HAND INDIA
  - PRASHANTHI SUPER CLINIC
  - Samonnoy Clinic (Dr. Chinmay Nath)
  - Sri Swasthyaa Clinic (Dr. S Rajassri)
  - THE DALE VIEW
  - Individual doctors: DR AMIT AROSKAR, DR AMIT KUMAR AGARWAL, DR PRANTAR CHAKRABORTY, DR SHAMITA GHOSAL, DR. AMEET G. SATTUR, DR. SUDIP BASU
  - Seven more logos (1a, 2a, 3a, 3aaa, 5a, 6a, 7a .jpg) have alt text "A" and can't be identified.
- **Named in body text:**
  - Penda Health (Nairobi): /curapilot/, /kenyademo/, /partner-with-ec/
  - Qualitas Health (Malaysia) and "From Qualitas Health in Malaysia to Penda Health in Kenya": /partner-with-ec/
  - CIMAS Health (Zimbabwe)
- **Award badges:**
  - /kenyademo/ has eight image-only badges (`/html/kenya-award-badge-1..9`). They have no names.
  - /ai/ has badges with UUID filenames plus `leader-mobile-support-2024.webp`. Vendor names aren't in the markup, so these are **ambiguous**.
  - The homepage hero says "★ 4.9 Capterra · 4.8 Google".

---

## 4. The Penda Health / OpenAI study

**What the site says (/curapilot/):**
- Hero: "Peer-reviewed in Nature Health · 39,849 Patient Visits Studied"
- Stats: "22+ Years in Healthcare Tech", "18 Countries Deployed", "108 Physicians in Study"
- Evidence block: "Measured across 39,849 patient visits"
  - "Penda Health, Nairobi · one of the world's earliest deployments of AI-assisted clinical decision support, developed in collaboration with OpenAI and Easy Clinic. Approved by Kenya Ministry of Health, Kenya Digital Health Agency, and AMREF Ethics Committee."
  - Results: **16%** Fewer Diagnostic Errors; **13%** Fewer Treatment Errors; **32%** Fewer History-Taking Errors; **100%** Clinician Satisfaction; **15** Clinics; **108** Physicians; **10%** Fewer Unnecessary Investigations; **99.97%** Uptime Over 9 Years.
- Problem cards: "16% Diagnostic errors reduced with CuraPilot"; "67% Fewer stockout events with early detection"; "34% Fewer denied insurance claims".
- Supply chain: "spots shortages 45 days before they hit the dispensing counter". Also: "CuraPilot surfaces shortages 45 days in advance. Stockout events fell by 67% across 28 organisations."
- Claims: "Rejections fell from 23% to under 4% in one quarter." (an unnamed "hospital group")
- The use-case text says Korom "manages 12 facilities across Nairobi and Central Kenya". Elsewhere the site says 15 clinics, so this is **ambiguous**.
- /kenyademo/ says "Peer-reviewed in Nairobi."

**Dr Korom quotes (two different versions):**
- /curapilot/: "Easy Clinic has been a true innovation partner for nearly a decade. Together we implemented one of the world's early deployments of an AI-assisted clinical decision support system developed in collaboration with OpenAI."
- /kenyademo/: "Easy Clinic has been a true innovation partner for nearly a decade. The system's reliability has been exceptional - our total unplanned downtime across nine years has been measured in hours, which is critical where continuity of care matters."

**Links on the live site:**
- The only outbound study link is the OpenAI article, `https://openai.com/index/ai-clinical-copilot-penda-health/` ("Read the Article by OpenAI" on /, /ai/, and the Kenya and India pages). That page returned 403 to both curl and WebFetch.
- No nature.com, arXiv or DOI link appears anywhere.

**Checked against the actual papers:**
- The 39,849-visit study is **arXiv:2507.16947**, "AI-based Clinical Decision Support for Primary Care: A Real-World Study" (Korom et al., submitted 22 Jul 2025, OpenAI co-authors). https://arxiv.org/abs/2507.16947
  - Confirmed: 39,849 visits, 15 clinics, 16% diagnostic, 13% treatment, 32% history-taking, 10% investigation errors.
  - The **108 physicians were the rating panel, not the treating clinicians.**
  - "100%" comes from "all clinicians said that AI Consult improved the quality of care", with 75% saying "substantial".
  - Ethics: Ministry of Health, Kenya DHA, Nairobi County, AMREF ESRC P1795/2024, NACOSTI/P/25/415242.
  - The paper says Easy Clinic "was introduced in 2017" at Penda, and that "AI Consult is embedded in Penda's cloud-hosted EMR (Easy Clinic)."
  - I found no peer-reviewed journal version of this paper.
- The **Nature Health** paper is a *different* study: "Safety of a large language model-based clinical decision support system in African primary healthcare", doi 10.1038/s44360-026-00082-5, online 2026-03-10. It covers 16 clinics and 1,469 records, and found hallucinations in 3.4% and harmful recommendations in 7.8%. So **"Peer-reviewed in Nature Health · 39,849 visits" combines two papers.**
- There is also a **Nature Medicine** RCT, doi 10.1038/s41591-026-04503-6, online 2026-06-26: 9,691 patients, 16 facilities, 103 clinical officers. It found **no significant difference** in treatment failure (2.2% vs 2.0%, P=0.13). The site doesn't cite it.
- The 34% denied claims, 67% stockouts, 45-day, 28 organisations, 23%→<4% and 99.97% uptime figures appear **only in Easy Clinic marketing**. None of these papers contain them.

---

## 5. Company facts

- Legal entity (footer, all pages): "© 2026 Novel Medicare Solutions Pvt Ltd". One testimonial says "Novel Medical Solutions".
- Founded: /about-us/ says "Established in 2003... serving thousands across 18 countries". The homepage says "Since 2003".
- Years in business are **inconsistent** across the site:

| Figure | Where |
|---|---|
| "22+ years" | /kenyademo/, /curapilot/ |
| "20+" (counter) | /about-us/ |
| "15+ years of delivering healthcare software" | / |
| "over 10 years" in Kenya/East Africa | SHA banner |

- Counters on /about-us/: 20+ years; **92%** "Customers who have been using our solutions for over 5 years"; **500+** custom workflows; **98%** support/training satisfaction.
- Scale:
  - "5000+ doctors · 18 countries"; "20 specialties"; "200K+ prescriptions daily" (homepage)
  - "5000+ Doctors across 200 cities" (/pricing/, /hospital-opd-nursing-home-software/)
  - "200K Prescriptions generated every day across 5,000+ providers"; "8+ years Average client relationship" (/kenyademo/)
  - "Used in 18 countries" (/kenyademo/)
  - "From Solo Clinics to 100+ Locations" (/)
  - "5 or 500 clinics" (/clinic-chain-software/)
  - "over 100 graphical dashboards" (/clinic-chain-software/)
- Country pages linked from the site (19): Ethiopia, Fiji, Ghana, India, Kenya, Malaysia, Maldives, Mauritius, Nigeria, Qatar, Rwanda, Seychelles, Somalia, South Africa, Suriname, Tanzania, Trinidad and Tobago, UAE, Uganda.
- Leadership (/about-us/):
  - **Girish Mohata**, Founder & CEO
  - **Mrinal Pasari**, Co-Founder ("Solution Architect Enterprise Architect with 20 years")
  - **Vikas Malpani**, Director – Business Growth & Strategy
  - **Gaurab Chatterjee**, Head of Software Development ("since 2010", "over 16 years")
  - **Subhashish Saha**, Head of Customer Success ("since 2012")
- Blog author on the vs pages: Akshay Chandel (vs-KenyaEMR dated March 2, 2026; vs-Practo dated March 23, 2026).
- Address: **"30 Circus Avenue, Kolkata - 700 017, India"** (/contact-us/, /partner-with-ec/)
- Phone: **+91 91477 70277** (also in the schema.org ContactPoint). WhatsApp: `api.whatsapp.com/send?phone=919147770277`
- Email: **hello@easyclinic.io**. /curapilot/ also has "Prefer email? Write to girish@easyclinic.io".
- Other URLs:
  - App: app.easyclinic.io
  - Help: help.easyclinic.io
  - Social: facebook.com/Easycliniconline, x.com/easyclinic, instagram.com/easycliniconline, youtube.com/@EasyClinicSoftware, linkedin.com/company/easy-clinic

---

## 6. Kenya (/kenyademo/, page-id 95040)

- Title: "Easy Clinic Kenya - Book a Free Demo"
- Meta description: "Easy Clinic is clinic management software for Kenya. EMR, billing, SHA claims, M-Pesa, eTIMS, pharmacy & lab in one system. Book a free 30-min demo."
- Hero: "Made for Kenyan Clinics / You care for your patients. Leave everything else to us." / "One connected system for patient records, billing, insurance claiming, pharmacy, lab reports, compliance and AI. Used in 18 countries. Peer-reviewed in Nairobi."
- Badges: "22+ years experience · 200K prescriptions daily · DHA Certified · Kenya Registered"
- **Walter Brian Maguke:**
  - Static HTML: "Or call Walter directly: +254 750 184 357" and "Or contact Walter Brian Maguke: +254 750 184 357 · walter@easyclinic.io"
  - **Ambiguous:** a script scoped to this page rewrites these at runtime to "Or call us directly: +254 750 184 357" and "Or contact us: ...". A browser visitor therefore doesn't see Walter's name.
  - This is the only country-specific contact on the site. No other country page has a local person or number.
- Demo form: Practice type (Solo Practice / Specialist Clinic / Clinic Group / Hospital / Specialist Centre / Health NGO); Locations (1 / 2-5 / 6-15 / 15+). "30 minutes. No commitment."
- "Kenya Integrations" strip: **M-Pesa, eTIMS, SLADE, SMART, WhatsApp, SHA**
- Insurers:
  - "Integrated with **Jubilee, AAR, CIC, Britam and Resolution** through SLADE." The modules card lists only "Jubilee, AAR, CIC and Britam".
  - /emr-software-in-kenya/ says "e-claims directly to 50+ insurers with hassle-free SLADE integration".
- **Three-problem framework:**
  1. "Your clinic works. But it is exhausting you." → "One system. Everyone on it. The chaos stops." → "The day ends with medicine done. Not paperwork."
  2. "You are providing services you are not being paid for." → "Every service billed. Every claim submitted cleanly." → "The losses become visible. And they stop."
  3. "The bigger you grow, the less you can see." → "One clinic or fifteen. You see everything." → "Decisions made from information. Not feel."
- **Eight modules:**
  1. Appointments
  2. Medical Records
  3. Billing and Payments
  4. Insurance and Claims
  5. Inventory and Pharmacy
  6. Lab Reports
  7. Compliance and Reporting ("MOH 705 and DHIS2 done automatically")
  8. AI and Automation ("Voice dictation. Clinical Decision Support. Post Visit Automation.")
- Screens: "Smart bilingual prescription in under 30 seconds" (English and Swahili); "SLADE submitted to Jubilee Health. M-Pesa received. eTIMS compliant. Balance zero."
- **"From demo to live in as little as 3 days"**, in four steps: Live Demo → Staff Training ("Most clinics fully operational within 24 hours") → Data Migration → Support.
- "Why Easy Clinic" tiles: 8+ years; 200K; 22+ years ("Not a startup. Not a pivot."); Award-winning; Built local; Always current ("Cloud-based, monthly upgrades").
- /curapilot/ integrations list: KenyaEMR, OpenMRS, M-Pesa, eTIMS, SMART e-claiming, SLADE, SHA, DHIS2, HL7 FHIR, Open APIs.
- /curapilot/ proof of concept: "The 90-Day Proof of Concept". Stages: Understand (Weeks 1-3), Deploy (4-6), Measure (7-10), Decide (11+).

---

## 7. Compliance and regulator statements (as written today)

- **SHA** (/kenyademo/, /emr-software-in-kenya/, /best-clinic-management-software-kenya/):
  - "Kenya · In development / Getting Kenyan clinics ready for SHA e-claims... Built to Digital Health Agency integration requirements... Early access for existing clients"
  - FAQ: "Is Easy Clinic compliant with Kenya's SHA and SHIF? **Not yet** — SHA, SHIF and KRA eTIMS support is in active development." Comparison table: SHA/SHIF "Soon".
  - **Conflict:** /kenyademo/ lists SHA under "Kenya Integrations".
- **eTIMS:**
  - Comparison table says "Soon"; "KRA eTIMS e-invoicing is on the same roadmap".
  - **Conflict:** /kenyademo/ says "eTIMS keeps compliance clean", "eTIMS compliant", and lists eTIMS as an integration.
- **Kenya DHA:** "DHA Certified", "Kenya Registered" (/kenyademo/); "DHA-registered, fully audit-ready software" (/emr-software-in-kenya/).
- **Outdated:** /emr-software-in-kenya/ still says "Regulations: NHIF workflows and KMPDC compliance standards" and "integrates M-Pesa and NHIF workflows". The comparison page itself notes NHIF became SHA on 1 October 2024.
- **ABDM / ABHA / NABH / DPDP** (/emr-software-in-india/):
  - "Indian compliance — work in progress"; "Is Easy Clinic ABDM compliant? Indian compliance, including ABDM, is work in progress"
  - "ABHA-related workflows... in progress"; "EasyClinic's own NABH-related work is in progress"
  - DPDP Act 2023: "Work to align... is in progress". GST: "being expanded".
  - **Conflict:** the homepage says "Compliance with: ABHA, HIPAA, GDPR".
- **HIPAA / PCI-DSS / GDPR:** "Meets international privacy and data security standards such as HIPAA, PCI-DSS, and GDPR" (/clinic-chain-software/, /hospital-opd-nursing-home-software/).
- **NABIDH:** not mentioned anywhere. /emr-software-in-uae/ only says "Regulations: DHA and DOH compliance with strict data governance." Note that DHA means Dubai Health Authority here, not Kenya's DHA.
- **NDPA:** /emr-software-in-nigeria/ says "Role-based access, consent and audit trails aligned with the NDPA 2023 and Nigeria Data Protection Commission rules" (the FAQ answers "Yes.").
- **Other countries:**
  - Ghana: NHIS/NHIA, Data Protection Act 2012 and Mobile Money are all "planned"; "Ghana compliance work in progress".
  - Mauritius: "DPA 2017 compliance built in".
  - Malaysia: "ensures PDPA compliance".
  - South Africa: "ensures compliance with POPIA".
  - Ethiopia: "aligned with the Personal Data Protection Proclamation of 2024".
- Offline: "It does not run fully offline today"; a self-hosted option exists (/best-clinic-management-software-kenya/).

---

## 8. Copy defects not to carry over

- /emr-software-in-india/:
  - The FAQ "How do I get started with Easy Clinic?" appears twice; the first copy has the wrong answer.
  - "accessible across facilities and islands" and "remote care across islands" were copied from an island-country template.
- /emr-software-in-ghana/: "across Ghan".
- /best-clinic-management-software-kenya/: "Dr Wanjiku" in Westlands and the "six-doctor clinic in Mombasa" are illustrative personas, not clients.
- /kenyademo/ says "All names, patient records... shown are illustrative only."
- /curapilot/ patients "David Kamau" and the Kenya Pharma Ltd / MedSupply supplier names are demo data. The same page still shows "NHIF claim rejection".
- Product naming is inconsistent across pages: "Cura AI" (nav and Kenya comparison page) vs "CuraPilot" / "Curapilot AI".