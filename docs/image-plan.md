# Images from the old site: placement plan

Written 28 September 2026. This plan says which images from easyclinic.io can go on the new site, where each one
goes, and what has to change first. No image has been copied into the repo yet, and `docs/briefs/page-writing-rules.md`
is unchanged. The replacement rule text is in section 3.1. The import manifest is `migration/images/image-sources.csv`,
with one row for each repo file, its old URL and how it is prepared.

Rules applied: spec section 12 (screens are the proof; never stock photos; generated or stock people are never shown
as customers or staff; testimonials are text only unless the person supplies a photo), `docs/components.md` (images
through `astro:assets` with width, height and alt; `Screenshot.astro` for media objects),
`docs/briefs/page-writing-rules.md` (an image that shows a certification, a compliance or integration status, a rating,
an award or an outcome figure is a claim and needs the same evidence as text), `src/data/testimonials/*.yaml` and
`src/data/authors/*.yaml` (the only named people allowed). Product screenshots must show demo data only.

## 1. Summary

- The old site's pages and media library gave 1,966 files, which came to 920 distinct images once size variants and
  re-uploads were merged. A first pass by filename and use dropped 585 of them: blog covers and post thumbnails, stock
  photos, icons and page furniture, and unused library items (section 12.2). The other 335 were classified as "use" or
  "maybe", and each of those was opened at full size for this plan.
- Of the 335: **74 are placed now** (60 product screenshots, 9 client logos, 5 leadership photos), **24 are
  conditional** (13 client logos, 8 testimonial photos and 3 payer screens, each waiting on one named confirmation),
  **87 are kept but not placed** because no published row describes them or a better image was chosen, and **150 are
  excluded**. The 150 break down as 36 duplicates, 35 with real personal or client data, 28 claims without evidence,
  28 with visible errors, 12 stock or not EasyClinic's product, 9 with unnamed or unconsented people, and 2 for pages
  that do not exist. Section 12 lists each one.
- The placed and conditional screenshots become 67 repo files, because 3 source images give two or three crops each.
  They fill 93 slots on 31 published pages (section 5). Every one of them is an **interim** capture, uploaded between January 2024 and July
  2025, and should be replaced by the seeded demo-tenant capture that spec 12 asks for. The company has to
  confirm that each one still matches the current UI (section 3.1).
- **Review, 28 September 2026.** A second check held back 14 of those files, which were on 28 slots, and moved them
  to `migration/images/held/` (section 5.4). Three need a confirmation before they can return: the "Clinical
  decision" alert may be the "AI Consult" panel rather than CuraPilot, and the print-language list is not a confirmed
  fact. Six more show a third-party name or a diallable mobile number. Four have redactions that left empty or broken
  labels, and one had no row that it matched. One new crop, the interaction dialog alone, replaces the full screen in
  the home page's journey. That leaves **51 screenshot files on 62 slots across 27 published pages**. The nine client
  logos were trimmed to their marks and are now sized by area (section 3.2).
- The old captures carry problems that the page text does not. The demo location is called "Bellevue Clinic", which
  is also the name of a real Kolkata hospital that is not a listed client. The demo doctor prints a real-format West
  Bengal council number, "70472WBMC". The product shows "AI Co-pilot", "AI Consult" and "Easy Clinic" as labels.
  Some captures show real-format mobile numbers, and some templates have typos. Every placed image is cropped or
  redacted around these (section 5.2), and section 9 turns the list into a brief for the recapture.
- The header logo already in the repo is the old live logo, byte for byte. It reads "Easy Clinic" as two words, which
  conflicts with the naming rule, but no old file is any better. Section 8 recommends keeping it until the brand owner
  supplies a one-word wordmark.

## 2. How each image was checked

Every candidate was opened at full size, and small text was read in crops where it mattered. Five checks were made.

1. **Personal data.** Is there a patient name, a mobile number that starts with 6 to 9 and has 10 digits (a dialable
   Indian mobile), an e-mail address, a registration or membership number, a real person's face, or data from a
   client's own tenant? Masked +91 XXXXX numbers and numbers that start with 1 to 5 passed. A ten-digit number that
   starts with 6 to 9 fails even when it looks like a placeholder (+91 8888800000, +91 9900000000), because it can be
   dialled; this matches sections 9 and 11. Anything else was redacted, cropped out or excluded.
2. **Claims.** Does the image show a rating, an award, a certification or a compliance word, an integration partner's
   logo or name, or an outcome percentage? Anything without evidence under the page-writing rules was excluded or
   cropped out. The BI gauges pasted into some composites ("Claim Settlement Ratio 85.44%", "Fill Rate 66.38%",
   "Defect Rate 1,9%") count as outcome figures.
3. **People.** Is the person named, and are they in `src/data/authors` or `src/data/testimonials` with consent on file?
   If not, the image was excluded. That covers every group photo, the African officials' photo, the patient-app
   doctors and the acne patient's face.
4. **Logos.** Did the old live site show the logo as a customer, and where? All the client logos come from one
   section, "Physicians, Specialists & Clinic Chains using Easy Clinic across the World". It appeared on /, /about-us/,
   /ai/, /best-clinic-management-software-india/, /best-clinic-management-software-kenya/, /countries/,
   /pricing/india/ and /solutions/clinic-chain/.
5. **Fit with the page.** Does the screen show what the row's text says? Section 5.3 lists the screens left off
   because they do not.

Duplicates were found with a perceptual hash across all 920 images, and each match was then checked by eye. Where
the same screen exists more than once, the plan keeps the sharpest, least-cropped copy and records the others as
duplicates.

## 3. Changes needed before any image is published

### 3.1 Page-writing rule (replacement text for `docs/briefs/page-writing-rules.md`)

Replace the line "Screenshots do not exist yet: on pages meant to publish, no heroMedia and no media objects." with:

> - Product screenshots: on pages meant to publish, `heroMedia` and `media` may use only the files in
>   `src/assets/images/screens/` that `docs/image-plan.md` places on that slot, with the alt text and caption given
>   there. They are real product screens showing demo data only, with no real patient name, phone number, e-mail,
>   registration or membership number, client or third-party name, rating, award, compliance word or outcome figure.
>   The caption says only what the screen shows; it never says more than the row's text, and it never calls a screen
>   the tool from the Penda Health study. Screens taken from the old site carry `origin: old-site` and the month they
>   were captured. The company must confirm that each one matches the current product, and the confirmation is
>   recorded as `uiConfirmedOn`. Until then preview labels the image "Interim capture", and the launch checklist
>   lists every old-site screen without a confirmation. Conditional images (marked in the plan) stay out until their
>   confirmation is recorded. A media object without `src` is still a placeholder and blocks publishing. Generated
>   images (`aiGenerated: true`) are never used as proof.

Add a line to the checklist in `docs/launch-checklist.md`: "Every `origin: old-site` screenshot has `uiConfirmedOn`, or
has been replaced by the demo-tenant capture."

### 3.2 Schema and component changes

1. **Media** (`src/schemas/fields.ts`, `media`). Add three fields: `origin` (`'demo-tenant' | 'old-site'`, default
   `'demo-tenant'`), `capturedOn` (a month, for example `2025-01`) and `uiConfirmedOn` (a date or null).
   `Screenshot.astro` shows a small "Interim capture, {month}" note in preview when `origin` is `old-site` and
   `uiConfirmedOn` is null. `scripts/lint-content.ts` reports those files as a warning, not a ✗, so the pages can
   publish now. Some crops are narrow, such as the 265 px invoice-balance crop, so give the `<figure>` a
   `max-width` equal to the source width. A small crop is then never stretched to 580 px.
2. **Testimonials** (`src/schemas/data.ts`, `testimonialSchema`). The existing `photo: z.string()` becomes
   `photo: image().optional()`, which means the collection's schema becomes a function of `{ image }` in
   `src/content.config.ts`. Add `photoConsent: unknown(z.boolean())`. `ui/Quote.astro` renders a 56 px round photo
   (72 px when `size="large"`) with `alt=""` beside the name, because the name is already the text. The photo shows
   only when `photoConsent === true`. In preview, a photo waiting on consent shows a placeholder note, and in
   production it is left out rather than failing the page. `TestimonialRow`, `TestimonialGrid` and `ProofBlock` all
   render through `Quote`, so they need no change of their own.
3. **Authors** (`authorSchema`). `photo` becomes `image().optional()`. `frame/AuthorByline.astro` shows a 32 px round
   photo before "By …".
4. **Leadership on /about-us/.** A `dataTable` cannot hold photos. Add a `peopleGrid` block for the company family
   with a heading, an intro and `items: [{ author: reference('authors'), background: md }]`. It renders the photo,
   name, role (from the author record) and background. It replaces the "Who runs EasyClinic" `dataTable` in
   `src/content/company/about-us.yaml` and keeps the same five rows. The home page founder block in spec 11 (item 9)
   can use Girish Mohata's photo, but the 2003 story has to be written from confirmed facts first. That is a copy
   task and is not part of this plan.
5. **Clients.** Add a `clients` data collection in `src/data/clients/*.yaml` with these fields: `name`, `logo`
   (`image()`), `country` (unknown until confirmed), `sourcePage` (the old live URL where the logo appeared),
   `sourceHeading`, `testimonial` (an optional reference), `logoPermission` (`unknown(z.boolean())`) and `notes`.
   Add a `logoStrip` block with a heading, an intro, and either `clients: reference('clients')[]` or a `country`
   filter. It renders a `<ul>` of logos sized by area (about 4,000 square pixels each, inside a 128 x 48 px box, so a square mark and a long wordmark weigh the same), from files trimmed to the mark, with `alt` set to the client's name. It has no links, no
   rating and no "trusted by" figure. A client whose `logoPermission` is not `true` shows as a placeholder in preview
   and is left out in production. Register the block in `src/schemas/sections.ts` and
   `src/components/blocks/registry.ts`, and allow it for the home, customers, solution and countryDemo families in
   `src/schemas/family-blocks.ts`.
6. **Keystatic** (`keystatic.config.ts`). Add image fields for testimonials, authors and clients, and add the new
   media fields.

## 4. Repo layout and file rules

- `src/assets/images/screens/<descriptive-name>.<ext>` for product screenshots. The longest side is at most 2,000 px;
  every file placed here already is.
- `src/assets/images/people/<author-or-testimonial-id>.<ext>` for leadership and testimonial photos, at most 600 px on
  the longest side. #281 is the only one that needs resizing, from 800 to 600 px.
- `src/assets/images/clients/<client-id>.<ext>` for client logos, at most 600 px wide. SVG stays SVG when a client
  supplies one.
- `src/assets/images/media/` for media and award logos. It stays empty for now, because none qualifies (section 7.4).
- Names are lowercase and kebab-case, and they describe the screen, not the old filename. The source format is kept
  (PNG for UI captures, WebP where the old file was WebP), and `astro:assets` makes the AVIF and WebP variants at
  build time. Each file is the prepared version: cropped, with redactions burned in. The original downloads are not
  committed, and the CSV records the old URL of each one so it can be fetched again.
- `migration/images/image-sources.csv` (written with this plan) has one row per repo file, with these columns:
  `repo_path`, `old_image_no` (the # used in this plan), `old_url`, `shown_on_old_pages`, `kind`, `processing`
  (crop box and redactions), `frame`, `status` (`planned` or `conditional`), `company_to_confirm` and `placed_on`.
- In YAML the `src` path is relative to the content file. For example, from `src/content/features/emr.yaml` it is
  `../../assets/images/screens/prescription-drug-interaction.png`, and from `src/data/testimonials/x.yaml` it is
  `../../assets/images/people/x.jpg`.

## 5. Product screenshots

Frames: `browser` for a plain app screen, `none` for designed composites and panels that already have their own
border or shadow, and `phone` for the two phone captures. The journey diagram on the home page renders media at about
280 px wide. Each of its images is therefore a tight crop of one panel. If the lead finds them unreadable at that size,
the journey can run without media and lose nothing, because the same screens appear on the feature pages.

### 5.1 Placements by page

**/** (`src/content/home/home.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| heroMedia | `scheduling-two-doctor-calendar.png` (#27) | browser | Day calendar with a column for each of two doctors and each patient's appointment status | Two doctors' days side by side, with each patient's status. |
| sections[2] journeyDiagram steps[0] Book | `online-booking-slots.png` (#137) | none | Online booking page listing a doctor's open slots for today and the next days | The slots a patient picks from online. |
| sections[2] journeyDiagram steps[3] Prescribe | `prescription-drug-interaction-dialog.png` (#352) | browser | Drug-to-drug interaction warning: Zocor 10 mg with Biaxin 500 mg, increased statin levels | The interaction warning appears while the prescription is written. |

**/ai/** (`src/content/ai/ai.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[0] featureRows items[0] Writes the note while you talk | `consult-voice-transcription.webp` (#117) | none | Complaints, allergies and comorbidities picked out beside a recorded doctor-patient conversation and its transcript | The consultation, recorded and transcribed beside the chart. |

**/features/emr/** (`src/content/features/emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] Templates for your specialty | `visit-template-specialty-components.png` (#363) | browser | Visit template settings with each section, including Obs Gynae and Glass prescription, switched on or off | Each specialty section is switched on for the clinics that need it. |
| sections[1] featureRows items[2] A warning when two medicines interact | `prescription-drug-interaction.png` (#352) | browser | Drug-to-drug interaction warning: Zocor with Biaxin raises statin levels | The warning shows while the second medicine is added. |

**/features/appointment-scheduling/** (`src/content/features/appointment-scheduling.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[0] Doctors and consulting rooms on one calendar | `scheduling-two-doctor-calendar.png` (#27) | browser | Day calendar with two doctors side by side | Two doctors' days side by side on one calendar. |
| sections[2] featureRows items[1] Walk-ins beside booked slots | `scheduling-priority-walk-in.png` (#136) | browser | Day visits list with a patient flagged as priority beside the day's calendar | A patient marked priority moves up the day's list. |
| sections[2] featureRows items[2] Reminders by SMS and email on every plan | `message-templates-by-channel.png` (#506) | browser | Communication settings with the email templates open, including the appointment reminder (the row is on Professional, so the alt text does not name WhatsApp) | Reminder and other message templates, set up once per channel. |
| sections[2] featureRows items[6] Patients who book themselves | `online-booking-slots.png` (#137) | none | Online booking page with a doctor's open slots | The page a patient books from. |

**/features/billing/** (`src/content/features/billing.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[1] The doctor's orders arrive on the bill | `invoice-lines-from-orders.png` (#272) | browser | Invoice with a consultation, a blood count and a chest X-ray as separate lines, and an Add payor button | The consult, the blood count and the X-ray arrive as lines on the bill. |
| sections[3] featureRows items[0] Part payments and advances | `invoice-part-payment-balance.png` (#105) | none | Invoice balance: 950 invoiced, 800 paid in cash, 150 still due | A part payment recorded, and the balance still owed. |

**/features/insurance-claims/** (`src/content/features/insurance-claims.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[0] A profile for each payer | `payer-exclusions.png` (#436) (conditional) | none | Payer exclusions: a dental procedure category, X-rays, malaria tests and some medicines | What a payer does not cover, set once on its profile. |
| sections[2] featureRows items[1] Plan categories inside each payer | `payer-plan-category-rule.png` (#435) (conditional) | none | Category rule with a maximum cover, a co-payment percentage and patient gender and age rules | The cover limit and co-payment for one plan category. |
| sections[2] featureRows items[3] One visit, two payers | `payer-exclusion-check.png` (#433) (conditional) | none | Message saying dental is excluded for this payer and offering to move the line to another payer | A line the payer excludes is moved to another payer before the bill is raised. |

**/features/lab/** (`src/content/features/lab.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[0] A test catalog with your own packages | `lab-investigation-profiles.png` (#349) | browser | Investigation picker with test profiles such as coronary artery disease that expand into their tests | A profile orders its set of tests in one pick. |
| sections[2] featureRows items[7] Billing the tests | `lab-billable-on-sample-collected.png` (#561) | browser | Order settings adding the test to the bill when the sample is collected | The test goes on the bill at the step you choose, here when the sample is collected. |

**/features/multi-location/** (`src/content/features/multi-location.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] Each branch is a location in one account | `locations-list.png` (#284) | none | Locations list with three clinics under one account | Each branch is a location in the same account. |
| sections[1] featureRows items[2] One login for each person, at whichever branch they work | `role-permissions.png` (#107) | none | Permissions by role, with appointment access limited to the location or the organisation | What each role can open, and whether it reaches one location or all of them. |
| sections[1] featureRows items[5] Stock moved between branches | `stock-transfer-between-branches.png` (#284) | none | Stock transfer form from the Delhi clinic's dispensing room to the Mumbai clinic | A stock transfer from one branch to another. |

**/features/patient-engagement/** (`src/content/features/patient-engagement.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[0] Booking the next visit from the portal or app | `online-booking-slots.png` (#137) | none | Online booking page with a doctor's open slots | Open slots the patient books from. |
| sections[2] featureRows items[3] A registration form the patient fills in at home | `patient-self-registration-phone.png` (#501) | phone | Registration form open on a phone: name, gender, date of birth, mobile, blood group and address | The registration form, filled in on the patient's phone. |
| sections[2] featureRows items[4] Reminders by SMS and email | `message-templates-by-channel.png` (#506) | browser | Communication settings with the email templates open, including the appointment reminder | The email templates, with the appointment reminder among them. |

**/features/pharmacy-and-inventory/** (`src/content/features/pharmacy-and-inventory.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[3] Stock transfers between branches | `stock-transfer-between-branches.png` (#284) | none | Stock transfer form between two branches | A transfer between branches. |

**/features/reports-and-dashboards/** (`src/content/features/reports-and-dashboards.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] Revenue for each branch and for the group | `finance-analytics-branch.png` (#555) | browser | Finance dashboard for one branch: revenue, outstanding, revenue by service and by day | One branch's revenue by service and by day. |
| sections[1] featureRows items[4] Stock, where the clinic runs a pharmacy | `inventory-valuation-report.png` (#551) | browser | Inventory valuation report by product and batch with expiry, quantity, average cost and value | Stock value by batch, with each expiry date. |
| sections[1] featureRows items[6] Clinical cases across every branch | `clinical-analytics.png` (#554) | browser | Clinical dashboard with first and repeat visits and the ten commonest diagnoses and complaints | The commonest diagnoses and complaints for the period you choose. |
| sections[3] featureRows items[1] Filters, and reports of your own | `reports-library.png` (#550) | browser | Report library with a search box, a category filter and each report listed with its category | The report library, with a category filter. |
| sections[3] featureRows items[2] Excel and PDF | `report-pdf-export.webp` (#258) | browser | Inventory valuation report exported as a PDF | A report exported to PDF. |

**/features/revenue-management/** (`src/content/features/revenue-management.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[4] Who can see the money | `invoice-permissions-pii.png` (#266) | none | Invoice permissions for administrator, doctor and nurse, and a setting that shows personal details masked | Who can take payments or see personal details, set by role. |

**/features/whatsapp/** (`src/content/features/whatsapp.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] The prescription, after the consult | `prescription-send-actions.png` (#366) | browser | Prescription with Email, WhatsApp, Download and SMS highlighted | The prescription goes out on WhatsApp from the same screen. |
| sections[1] featureRows items[3] The receipt, after payment | `message-events-invoice-channels.png` (#507) | browser | The invoice event mapped to an email, an SMS and a WhatsApp template | Which template carries the invoice on each channel. |
| sections[1] featureRows items[4] A feedback request after the visit | `feedback-request-activity.png` (#504) | none | Feedback timeline: score requested, score received, comment received, follow-up sent | A feedback request and what happened after the reply. |
| sections[1] featureRows items[5] A registration link before the first visit | `whatsapp-registration-link-phone.png` (#500) | phone | WhatsApp message from the clinic with a registration link | The registration link as the patient receives it on WhatsApp. |

**/solutions/clinic-chain/** (`src/content/solutions/clinic-chain.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[1] Stock that moves between branches | `stock-transfer-between-branches.png` (#284) | none | Stock transfer form between two branches | A transfer from one branch's dispensing room to another branch. |
| sections[2] featureRows items[2] A new branch goes live on the same record | `locations-list.png` (#284) | none | Locations list with three clinics under one account | A new branch is one more location in the account. |

**/solutions/polyclinic/** (`src/content/solutions/polyclinic.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] Specialty templates on one chart | `specialty-templates-on-one-chart.png` (#364) | browser | Examination section with General, Endocrinology and Family Physician templates as tabs on one visit | Several specialty templates as tabs on the same visit. |
| sections[1] featureRows items[1] Your own forms and print layouts | `visit-template-builder.png` (#362) | browser | Visit template builder with each section set visible or mandatory | A visit form set up by the clinic, section by section. |

**/solutions/solo-clinic/** (`src/content/solutions/solo-clinic.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] featureRows items[1] The appointment book and reminders | `scheduling-day-visits-walk-in.png` (#27) | none | Day visits list with a walk-in and booked patients and their status | Walk-ins and booked patients on one list for the day. |

**/specialties/ayurveda-clinic-management-software/** (`src/content/specialties/ayurveda-clinic-management-software.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[3] Your own case sheet for Prakriti and Nadi Pariksha | `ayurveda-prakriti-assessment.png` (#150) | browser | Prakriti assessment form with Vata, Pitta and Kapha options for body type, skin, hair, appetite and sleep | A Prakriti assessment built as a digital form. |

**/specialties/cardiology-emr/** (`src/content/specialties/cardiology-emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] Blood pressure and lab values as trend charts | `fasting-glucose-trend.png` (#344) | browser | Fasting blood glucose readings plotted by date | A lab value charted reading by reading. |
| sections[1] featureRows items[2] The history and risk factors on the facesheet | `medical-history-risk-factors.png` (#351) | browser | Medical history form with hypertension, hyperlipidaemia, diabetes, a CABG and heavy smoking | The history and risk factors, recorded once. |
| sections[1] featureRows items[3] A drug interaction check when you prescribe | `prescription-drug-interaction.png` (#352) | browser | Drug-to-drug interaction warning: Zocor with Biaxin raises statin levels | The interaction warning shows while the second medicine is on the prescription. |
| sections[1] featureRows items[4] Follow-ups set in the note, with reminders | `visit-follow-up-and-guidelines.png` (#345) | browser | Visit note with stable angina, ECG, echo, lipid profile and treadmill test ordered, medicines, the next follow-up date and advice | The next follow-up date set in the note. |
| sections[3] featureRows items[1] The consult, by point and click | `cardiology-cvs-examination.png` (#169) | browser | Cardiovascular examination form with the vitals and the latest lab values above it | The CVS examination by point and click, with the vitals already on it. |
| sections[3] featureRows items[3] The prescription goes home on paper or on WhatsApp | `cardiology-prescription.png` (#335) | browser | Cardiology prescription with Print, Email, WhatsApp, Download and SMS buttons | Printed, or sent on WhatsApp from the same screen. |

**/specialties/dental-emr-software/** (`src/content/specialties/dental-emr-software.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[4] Your own forms and print layouts | `dental-oral-examination.png` (#320) | browser | Oral examination form: gums, teeth, plaque, alignment, soft tissues and the jaw joint | An oral examination form by point and click. |

**/specialties/dermatology-emr-software/** (`src/content/specialties/dermatology-emr-software.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] Skin type, allergies and past treatments | `dermatology-skin-assessment.png` (#102) | browser | Skin examination form: overall skin condition, skin type and skin colour | Skin condition and skin type on the record. |
| sections[1] featureRows items[4] Specialty templates and your own forms | `dermatology-lesion-template.png` (#326) | browser | Skin lesion template: distribution, type of lesion, colour, surface and borders | A skin lesion template by point and click. |

**/specialties/ent-emr-software/** (`src/content/specialties/ent-emr-software.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] ENT templates, with the ear examination form | `ent-ear-examination.png` (#393) | browser | Ear examination form for the left and right ear, with tympanic membrane and tuning fork findings | The ear examination form, left and right. |

**/specialties/general-practitioner-emr/** (`src/content/specialties/general-practitioner-emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] The facesheet and the history | `emr-facesheet-last-visit.png` (#38) | none | Facesheet with conditions, procedures, hospital history and lifestyle, beside a summary of the last visit | The facesheet and the last visit, side by side. |
| sections[1] featureRows items[1] Chronic conditions over the years | `longitudinal-visit-comparison.png` (#170) | browser | Two visits side by side with vitals, abnormal values in red, and the diagnosis | Two visits side by side, the abnormal values in red. |
| sections[1] featureRows items[4] Your own templates for the conditions you see most | `diabetic-foot-examination.png` (#327) | browser | Diabetic foot examination for each foot, with the latest glucose and HbA1c above it | A diabetic foot examination template. |
| sections[2] featureRows items[0] At the desk: the token and the queue | `scheduling-token-list.png` (#27) | none | Token list for one doctor with each patient's token number and arrival status | Token numbers and arrival status for the day. |
| sections[2] featureRows items[1] Before the consult: triage | `visit-workflow-with-triage.png` (#337) | browser | Visit workflow from registration to triage to the doctor, with the moves allowed at each step | Triage as a step between the desk and the doctor. |
| sections[2] featureRows items[2] In the consult: point and click | `attend-visit-point-and-click.png` (#471) | browser | Consult screen with complaints, vitals, a notes editor and the facesheet | The consult on one screen, recorded by point and click. |
| sections[2] featureRows items[3] The prescription, checked and sent | `prescription-drug-interaction.png` (#352) | browser | Drug-to-drug interaction warning on the prescription | The interaction check while prescribing. |

**/specialties/mental-health/** (`src/content/specialties/mental-health.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[1] Session notes and treatment plans | `psychiatry-observations-form.png` (#532) | browser | Observation form: appearance, speech, eye contact, motor activity, affect and mood | Observations recorded by point and click. |

**/specialties/neurology-emr/** (`src/content/specialties/neurology-emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] Neurological examination templates | `neurology-examination-template.png` (#457) | browser | Neurological examination form: orientation, optic discs, sensation, vibration, reflexes and coordination | A neurological examination template. |

**/specialties/obgyn-emr-software/** (`src/content/specialties/obgyn-emr-software.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] The pregnancy record, visit by visit | `pregnancy-calculator-weeks.png` (#357) | browser | Pregnancy calculator listing each week of the first trimester by date | Weeks and trimesters worked out from the dates. |
| sections[1] featureRows items[1] Obstetric and menstrual history on the facesheet | `obstetric-history.png` (#355) | browser | Obstetric history: pregnancies, births, miscarriages and terminations, with the patient marked pregnant | Obstetric history in the G-P-M-T form. |

**/specialties/ophthalmology-emr/** (`src/content/specialties/ophthalmology-emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[2] Eyeglass prescriptions from the chart | `eyeglass-prescription.png` (#354) | browser | Glass prescription with sphere, cylinder, axis and visual acuity for each eye, distance and near | The eyeglass prescription written in the visit. |

**/specialties/orthopedic-emr/** (`src/content/specialties/orthopedic-emr.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[1] featureRows items[0] Orthopaedic history and templates | `orthopaedic-examination-template.png` (#488) | browser | Orthopaedic examination form with deformity, position and imaging fields | An orthopaedic examination template. |

**/indiademo/** (`src/content/country-demos/indiademo.yaml`)

| Slot | Image (old #) | Frame | Alt text | Caption |
| --- | --- | --- | --- | --- |
| sections[2] moduleGrid items[0] Appointments | `scheduling-day-visits-walk-in.png` (#27) | none | Day visits list with a walk-in and booked patients | Walk-ins and booked patients on one list. |
| sections[2] moduleGrid items[2] Billing and payments | `invoice-part-payment-balance.png` (#105) | none | Invoice balance after a part payment | A part payment and the balance due. |
### 5.2 Screenshot files and how each is prepared

Coordinates are `x0,y0,x1,y1` in the original file's pixels and are approximate; check each crop by eye. "Redact" means a solid box in the surrounding background colour, not a blur, so nothing can be recovered. The template crops remove the blue toolbar, which carries the "AI Co-pilot" label (the site names only Cura AI and CuraPilot), and the faded "Eye Examination" rows that every template shows at its foot.

| Repo file (`src/assets/images/`) | Old # | Old URL | Preparation | Company confirms |
| --- | --- | --- | --- | --- |
| `screens/scheduling-two-doctor-calendar.png` | 27 | …/uploads/2024/01/Clinic-Management_Carousal_1.png | crop 0,0,900,525 (the calendar only) | matches the current UI |
| `screens/scheduling-day-visits-walk-in.png` | 27 | …/uploads/2024/01/Clinic-Management_Carousal_1.png | crop 20,475,305,1060 (Day visits panel) | matches the current UI |
| `screens/scheduling-token-list.png` | 27 | …/uploads/2024/01/Clinic-Management_Carousal_1.png | crop 486,768,842,1015 (token list below the reminder overlay) | matches the current UI |
| `screens/scheduling-priority-walk-in.png` | 136 | …/uploads/2024/11/2.png | redact both mobile numbers (+91 93xxxxxx91) | matches the current UI |
| `screens/online-booking-slots.png` | 137 | …/uploads/2024/09/img5.png | crop 455,372,990,968 (booking page without its URL bar; nothing else from the collage) | product logo on the booking page reads "Easy Clinic" |
| `screens/message-templates-by-channel.png` | 506 | …/uploads/2024/09/6.2.png | none | matches the current UI |
| `screens/message-events-invoice-channels.png` | 507 | …/uploads/2024/09/6.3.png | none | matches the current UI |
| `screens/visit-template-specialty-components.png` | 363 | …/uploads/2025/01/2-8.png | none | matches the current UI |
| `screens/visit-template-builder.png` | 362 | …/uploads/2025/01/1-9.png | none | matches the current UI |
| `screens/prescription-drug-interaction.png` | 352 | …/uploads/2025/01/3-4.png | crop 0,72,1919,890 (drop the browser bar: URL with patient and visit IDs, internal bookmarks) | matches the current UI |
| `screens/prescription-drug-interaction-dialog.png` | 352 | …/uploads/2025/01/3-4.png | crop 840,96,1360,324 (the Interaction dialog only, for the ~280 px journey column on the home page) | matches the current UI |
| `screens/emr-facesheet-last-visit.png` | 38 | …/uploads/2024/01/EMR_Carousal_3.png | crop 0,120,1960,1200 (drop the blue bar and the empty lower half) | matches the current UI |
| `screens/consult-voice-transcription.webp` | 117 | …/uploads/2025/07/Frame-3-scaled.webp | none | matches the current UI |
| `screens/invoice-part-payment-balance.png` | 105 | …/uploads/2024/01/Invoice_Feature_01.png | crop 15,688,280,1030 (Invoice balance panel) | matches the current UI |
| `screens/invoice-lines-from-orders.png` | 272 | …/uploads/2024/12/22-2.png | none | matches the current UI |
| `screens/invoice-permissions-pii.png` | 266 | …/uploads/2024/12/52-1.png | crop 0,0,900,425 (permissions and PII panels; drop the legacy workflow panel) | matches the current UI |
| `screens/payer-exclusions.png` | 436 | …/uploads/2024/09/Payor-5.png | crop 176,30,1085,740 (drop the "Jubilee"/44xxxxxx44 background and the extension icon) | capture came from a test tenant, not a client's |
| `screens/payer-plan-category-rule.png` | 435 | …/uploads/2024/09/Payor-4.png | crop 87,43,939,744 (the modal) | capture came from a test tenant, not a client's |
| `screens/payer-exclusion-check.png` | 433 | …/uploads/2024/09/Payor-12.png | crop 419,321,1349,632 (the "Not allowed!" modal) | capture came from a test tenant, not a client's |
| `screens/lab-investigation-profiles.png` | 349 | …/uploads/2025/01/3-3.png | crop 40,200,1110,670 (investigations panel; drops the patient header and the "AI Consult" toolbar) | matches the current UI |
| `screens/lab-billable-on-sample-collected.png` | 561 | …/uploads/2024/11/ORD2.png | none | matches the current UI |
| `screens/locations-list.png` | 284 | …/uploads/2024/01/19_Multi_location.png | crop 270,15,720,402 (Locations panel; no cartoon background) | matches the current UI |
| `screens/stock-transfer-between-branches.png` | 284 | …/uploads/2024/01/19_Multi_location.png | crop 1230,773,1680,1068 (Add stock transfer panel) | matches the current UI |
| `screens/role-permissions.png` | 107 | …/uploads/2024/01/18_User.png | crop 498,390,1255,690 (permission management + appointment permissions; drops the staff e-mail, registration number and roster) | matches the current UI |
| `screens/patient-self-registration-phone.png` | 501 | …/uploads/2024/09/2.3.png | redact the mobile number 95xxxxxx65 | product form reads "Welcome to Easy Clinic" |
| `screens/whatsapp-registration-link-phone.png` | 500 | …/uploads/2024/09/2.2-1.png | redact the live short link (4dqo.short.gy/...) | message footer reads "Powered by Easy Clinic" |
| `screens/feedback-request-activity.png` | 504 | …/uploads/2024/09/4.2.png | none | matches the current UI |
| `screens/prescription-send-actions.png` | 366 | …/uploads/2025/01/2-11.png | redact "Reg no: 70472WBMC" and the clinic logo | matches the current UI |
| `screens/cardiology-prescription.png` | 335 | …/uploads/2025/01/Prescription-2-24.png | redact "Reg no: 70472WBMC" and the clinic logo | matches the current UI |
| `screens/finance-analytics-branch.png` | 555 | …/uploads/2024/11/4-3.png | none | matches the current UI |
| `screens/inventory-valuation-report.png` | 551 | …/uploads/2024/09/1-3.png | none | matches the current UI |
| `screens/clinical-analytics.png` | 554 | …/uploads/2024/11/5-1.png | none | matches the current UI |
| `screens/reports-library.png` | 550 | …/uploads/2024/09/2-1.png | crop 73,0,660,847 (drop the "Last access by" names) | matches the current UI |
| `screens/report-pdf-export.webp` | 258 | …/uploads/2024/12/4-1.webp | crop 405,60,1355,735 (PDF viewer only; drop the Excel window and its Document Recovery pane) | matches the current UI |
| `screens/specialty-templates-on-one-chart.png` | 364 | …/uploads/2025/01/4-5.png | crop 40,210,1110,860 (examination panel; drop the "AI Consult" toolbar) | matches the current UI |
| `screens/ayurveda-prakriti-assessment.png` | 150 | …/uploads/2025/01/Ayurveda_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/fasting-glucose-trend.png` | 344 | …/uploads/2025/01/2-2.png | none | matches the current UI |
| `screens/medical-history-risk-factors.png` | 351 | …/uploads/2025/01/2-5.png | none | matches the current UI |
| `screens/visit-follow-up-and-guidelines.png` | 345 | …/uploads/2025/01/1-4.png | none | matches the current UI |
| `screens/cardiology-cvs-examination.png` | 169 | …/uploads/2025/01/Cardiology_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/dental-oral-examination.png` | 320 | …/uploads/2025/01/Dental_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/dermatology-skin-assessment.png` | 102 | …/uploads/2024/12/Aesthetic_EXM-2.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/dermatology-lesion-template.png` | 326 | …/uploads/2025/01/Dermatology_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/ent-ear-examination.png` | 393 | …/uploads/2025/01/ENT_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/attend-visit-point-and-click.png` | 471 | …/uploads/2024/12/52.png | crop 40,190,1780,822 (drop the "AI Consult" toolbar) | matches the current UI |
| `screens/visit-workflow-with-triage.png` | 337 | …/uploads/2025/01/Workflow.png | none | matches the current UI |
| `screens/longitudinal-visit-comparison.png` | 170 | …/uploads/2025/01/Longitudinal-View.png | none | matches the current UI |
| `screens/diabetic-foot-examination.png` | 327 | …/uploads/2024/03/Diabetology_Examination_Template.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/psychiatry-observations-form.png` | 532 | …/uploads/2024/12/Psychiatry_EXM-2.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/neurology-examination-template.png` | 457 | …/uploads/2024/05/Neurology_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |
| `screens/pregnancy-calculator-weeks.png` | 357 | …/uploads/2025/01/4-3.png | none | matches the current UI |
| `screens/obstetric-history.png` | 355 | …/uploads/2025/01/2-6.png | crop 40,210,1110,750 (Obs Gynae panel; drops the patient header with a mobile number and the "AI Consult" toolbar) | matches the current UI |
| `screens/eyeglass-prescription.png` | 354 | …/uploads/2025/01/1-7.png | crop 40,120,1110,615 (drop the "AI Consult" toolbar) | matches the current UI |
| `screens/orthopaedic-examination-template.png` | 488 | …/uploads/2024/05/Orthopedics_EXM.png | crop the blue toolbar (Print/Invoice/WhatsApp/"AI Co-pilot") and the faded "Eye Examination" rows at the foot | matches the current UI |


### 5.3 Where an old screenshot does not match the page, so the slot stays empty

- **Home, journey "Arrive" and "Follow up".** No old screen shows a coverage check at registration or a reminder
  reaching the patient. The only payer-at-registration screen (#431) comes from a client's tenant.
- **Kenya demo, all modules.** The AI module's alert (#115) is held (section 5.4). The old screens show rupees, Indian names and +91 numbers. The language list
  on the prescription screens (Bangla, English, Hindi, Marathi, Tamil) contradicts the page's "English and Swahili".
  They need the KES capture in spec 12.
- **Every "Cura AI drafts the note" row** (EMR, specialties, solo clinic, India demo). #117 shows a transcript beside
  the chart, not a drafted SOAP note in a "review and sign" state. It is used only on /ai/, where the text says Cura AI
  "listens to the consultation".
- **Telehealth.** The only video-consult screens (#104, #108) have a stock-model doctor in the video tile.
- **Dental "A visual chart, tooth by tooth", dermatology "Before-and-after photographs", paediatric "Growth charts",
  IVF "Cycle tracking", physiotherapy "Session-wise treatment plans", and mental health "Who can open the record" (the
  restricted note).** No old screen shows any of them. The dermatology image screens (#321, #322) show a real
  patient's face.
- **Ophthalmology "OCT and fundus reports beside the visits".** #483 shows OCT and FFA *ordered*, not reports.
- **Neurology "Years of follow-up on one screen".** The longitudinal views (#170, #394) are a heart-failure patient and
  an ear patient. #170 is used on the GP page instead.
- **Polyclinic "Doctors and shared rooms on one calendar".** The old calendar (#27) has doctors in its columns and no
  rooms.
- **Clinic chain "Every branch on one morning screen" and reports "Revenue for each branch and for the group".** The
  only multi-branch dashboards are Power BI reports that name real Malaysian government clinics (#256, #267). #555, a
  single branch's view, goes on the reports row with a caption that says so.
- **Reports and revenue: claims dashboards, denial and ageing reports.** No old screen shows them. The claims charts
  on #118 and #292 are BI template widgets in US dollars.
- **Draft country pages.** India's hero asks for an invoice "with GST shown line by line". The old invoices (#105,
  #272) show no GST lines, so the placeholder stays.
- **Charts with inpatient series** (#39, #58). They contradict the site's statement that EasyClinic does not run
  inpatient wards.

### 5.4 Held back after review (28 September 2026)

These files passed the first check but fail the truth or privacy checks in section 2, or match no row. Each was taken
off every page and moved, unchanged, to `migration/images/held/`, so nothing prepared is lost. None is edited to pass:
a screen returns only when the confirmation in the last column is recorded, or it is replaced by the demo-tenant
capture. The CSV row for each gives its old URL, its preparation and the slots it was on.

| File (`migration/images/held/`) | Old # | Was on | Why it is held | What releases it |
| --- | --- | --- | --- | --- |
| `curapilot-clinical-decision-alert.webp` | 115 | /ai/ "Flags a missed diagnosis", the /curapilot/ hero, /kenyademo/ AI module | The captions called it CuraPilot, but the same consult screen has an "AI Consult" button and panel, and AI Consult is the tool in the Penda Health study. Nothing confirms the alert is CuraPilot (question 6) | Product confirms the alert is CuraPilot and not the AI Consult panel |
| `prescription-dosage-and-print-language.png` | 288 | /features/emr/, /indiademo/ | Shows a print-language list (Bangla, English, Hindi, Marathi, Tamil); only English and Swahili are confirmed | The supported print languages are recorded (facts-needed P24) |
| `prescription-print-language-neurology.png` | 456 | /specialties/neurology-emr/ | The same language list | As above |
| `prescription-print-language-orthopaedics.png` | 487 | /specialties/orthopedic-emr/ | The same language list | As above |
| `payer-price-list.png` | 292 | /features/insurance-claims/, /features/revenue-management/, /indiademo/ | Prints "Allied TPA Pricelist", a third-party name (question 5) | "Allied TPA" confirmed as invented |
| `lab-results-abnormal.png` | 298 | /, /features/lab/, /solutions/polyclinic/, /indiademo/ | Prints "Lab: Ashok Lab", a third-party name (question 5) | "Ashok Lab" confirmed as invented |
| `requisition-and-purchase-order.png` | 295 | /features/pharmacy-and-inventory/ | Keeps the supplier "Quick Service Pharmacy", and the redactions leave the order's Supplier, Requested by and Ordered by empty | The demo-tenant capture |
| `invoice-print-and-send.png` | 105 | /, /features/billing/ | Unmasked mobile 9900000000 | The demo-tenant capture |
| `pharmacy-dispense-from-prescription.png` | 296 | /, /features/pharmacy-and-inventory/, /indiademo/ | Unmasked mobile +91 9900000000 beside a patient name | The demo-tenant capture |
| `emr-visit-summary-lab-trend.png` | 36 | /solutions/solo-clinic/ | Unmasked mobile +91 8888800000 beside a patient name | The demo-tenant capture |
| `stock-batch-expiry-reorder.png` | 276 | /features/pharmacy-and-inventory/ | The "Bellevue Clinic" redactions leave a broken "QoH ()" label and an empty Locations cell, which read as bugs | The demo-tenant capture |
| `daily-collection-report.png` | 463 | /, /features/billing/, /features/revenue-management/, /solutions/solo-clinic/ | The redactions leave the Location filter and every Location cell empty while the filter shows as applied | The demo-tenant capture |
| `paediatric-face-sheet.png` | 513 | /specialties/pediatric-emr/ | The redaction leaves "Registered at" with no value | The demo-tenant capture |
| `prescription-drug-allergy-warning.png` | 353 | /specialties/cardiology-emr/ | The row is about drug interactions, and the site gives allergy checks to CuraPilot, which is on no plan. The row now uses `prescription-drug-interaction.png` | A row about an allergy check that is part of a plan |

The slots these leave empty stay empty; none of the pages needs a picture to be honest. The /indiademo/ "Reports and
dashboards" card also lost `finance-analytics-branch.png`, which rendered at about 0.15x in the 270 px card and could
not be read; the same screen stays on /features/reports-and-dashboards/.

## 6. People

### 6.1 Leadership photos (placed)

| Author | File (`src/assets/images/people/`) | Old # | Size | Used on |
| --- | --- | --- | --- | --- |
| `girish-mohata` | `girish-mohata.jpg` | 84 | 500×600 | /about-us/ `peopleGrid`, author byline, and later the home founder block |
| `mrinal-pasari` | `mrinal-pasari.jpg` | 85 | 500×600 | /about-us/ `peopleGrid`, byline |
| `vikas-malpani` | `vikas-malpani.jpg` | 86 | 499×600 | /about-us/ `peopleGrid`, byline |
| `gaurab-chatterjee` | `gaurab-chatterjee.png` | 87 | 457×546, cut-out | /about-us/ `peopleGrid`, byline |
| `subhashish-saha` | `subhashish-saha.png` | 88 | 463×539, cut-out | /about-us/ `peopleGrid`; byline on every page, since he is the default author |

Each YAML gets `photo: ../../assets/images/people/<id>.<ext>`. The company confirms the photos are current, since all
were uploaded in January 2024. #587, a 283 px "founder-ceo" headshot, is the same person as #84 at lower resolution and
is not needed. `akshay-chandel` has no photo.

### 6.2 Testimonial photos (conditional)

Spec 12 allows a photo only if the doctor supplied it. Every file below gets `photo`, with `photoConsent: null` until
the company records that the person supplied or approved it.

| Testimonial | File | Old # | Size | What to confirm |
| --- | --- | --- | --- | --- |
| `hisham-ismail` | `hisham-ismail.jpg` | 280 | 444×444 | He supplied or approved the photo. It appears on home through `testimonialRow`. |
| `foster-akaketwa` | `foster-akaketwa.jpg` | 281 | 800×800, resize to 600 | Supplied or approved. Clinic chain. |
| `premanand-raya` | `premanand-raya.jpg` | 523 | 470×538 | Supplied or approved, and which spelling is right: the old site has "Premananda", the YAML "Premanand". |
| `tl-prabhu` | `tl-prabhu.jpg` | 73 | 276×310; crop the grey frame | Supplied or approved. Solo clinic. |
| `sanjay-teotia` | `sanjay-teotia.jpg` | 110 | 224×300 | Supplied or approved. /pricing/india/. |
| `tarun-mishra` | `tarun-mishra.jpg` | 79 | 235×214 | Supplied or approved. |
| `siddhartha-ghosh` | `siddhartha-ghosh.jpg` | 111 | 251×199, small | Supplied or approved. |
| `jj-thakkar` | `jj-thakkar.jpg` | 74 | 372×372 | That it is Dr J. J. Thakkar. The old site put it on his review, but the file name looks like a LinkedIn download. |

These photos are not used: `chao-rochek-buragohain` (#78, a blurry 225 px candid), `nrp-chandra-balaji` (#109, a
casual beach photo), `srinivasa-teja` (#338 and #112, 114 px), `prantar-chakrabarti` (#71, 85 px) and `manish-bhatia`
(#77, dropped in the first pass because it carries a Practo watermark and so was taken from a competitor's profile).
Ask each of them for a photo. `robert-korom-*` and `seetha-lakshmi-kolanakuduru` have no old photo.

### 6.3 Group and event photos (excluded)

The office and outing photos (#90, #91, #93, #94), the meeting-room photo (#92), the photo with African officials (#95)
and the early trade-show stall (#96) show people who are not named in the repo and have no consent on file. #91 also
shows a whiteboard with internal strategy notes, #93 includes a child, and #96 carries an "India's No.1" banner. The
best of them for a future About page is #93 (2022), provided the staff consent and the child is cropped out.

## 7. Logos

### 7.1 Client logos to place now

All of these appeared in the old live site's "Physicians, Specialists & Clinic Chains using Easy Clinic across the
World" section, on the eight pages listed in section 2. The first five are the ones spec 5.7 names for the clinic
chain page. The last four pair with a testimonial on file.

| Client id (`src/data/clients/`) | Name | File | Old # | Country | Notes |
| --- | --- | --- | --- | --- | --- |
| `premier-hospital` | Premier Hospital | `premier-hospital.jpg` | 4 | in (confirm) | Its logo carries the hospital's own NABH seal. Crop to the wordmark or ask for a file without the seal, so a visitor cannot read the seal as EasyClinic's. |
| `ross-clinics` | Ross Clinics | `ross-clinics.jpg` | 17 | confirm | |
| `kem-hospital-mumbai` | Seth G S Medical College and K E M Hospital | `kem-hospital-mumbai.jpg` | 18 | in | A public institution. The heading must not suggest an endorsement. |
| `german-osteo-care` | German Osteo Care | `german-osteo-care.jpg` | 3 | in (confirm) | |
| `caring-minds` | Caring Minds | `caring-minds.jpg` | 2 | in (confirm) | |
| `prashanthi-super-clinic` | Prashanthi Super Clinic | `prashanthi-super-clinic.jpg` | 16 | in | Pairs with `tl-prabhu`. |
| `cimas-health` | CIMAS Health | `cimas-health.jpg` | 20 | zw | Pairs with `foster-akaketwa`. Soft upscale; ask for a vector file. #24 is the same logo. |
| `qualitas-health` | Qualitas Health | `qualitas-health.jpg` | 23 | my | Pairs with `hisham-ismail`. Soft; ask for a vector file. |
| `penda-health` | Penda Health | `penda-health.jpg` | 25 | ke | Pairs with `robert-korom-*`. The verified study says Penda has used Easy Clinic since 2017. |

Each record has `logoPermission: null` until the company confirms the client agrees. Spec 5.7 asks for the first five
because they were on the live page, but showing them still depends on that permission.

### 7.2 Where the logo strip goes

| Page | Position | Clients |
| --- | --- | --- |
| /solutions/clinic-chain/ | after the `testimonialRow` (spec 5.7, item 7) | the five spec logos, plus CIMAS, Qualitas and Penda |
| /customers/ | above the `testimonialGrid` | all nine |
| / (home) | after the `testimonialRow` | all nine |
| /indiademo/ | after the `testimonialRow` | the Indian clients (`country: in`) |
| /kenyademo/ | after the `testimonialRow` | Penda and CIMAS |

Suggested heading: "Clinics and health groups that have run on EasyClinic". Use "run on" only if the company confirms
each is a current client; otherwise use "have used". Add no count, no "trusted by" and no rating.

### 7.3 Client logos that need confirmation first (13)

In each case the company confirms the organisation is or was a client and the logo may be shown: Samonnoy Clinic (#5),
Dayanand Shikshan Sanstha, Latur (#7; an education society, so also what EasyClinic ran there), Aamod (#8), Apple
Urology Clinic (#9; low quality), Blood@Prantar.In (#10; Dr Prantar Chakrabarti's testimonial names the Institute of
Hematology and Transfusion Medicine, so also which organisation to show), Nightingale Hospital (#11; its logo prints
"ISO 9001-2015" and "NABL accredited", which would have to be cropped), Sattur Heart Care (#12), Srishti Infertility
Clinic (#13; could suit the IVF page), FLAME University (#14), Hand in Hand India (#15; could suit the NGO page), The
Dale View, Punalal (#19), North Star Alliance (#21) and AmeriCares (#26). Sri Swasthyaa Clinic (#6) is left out,
because its mark has no name in it and proves nothing to a visitor. The WHO logo in the same live strip (#22) is not a
client and was dropped in the first pass.

### 7.4 Media and award logos (none placed)

- **SiliconIndia** (#1, the masthead; #586, the magazine spread). This would be a media claim, and it needs the
  article's URL, the issue date and whether the profile was paid. The spread itself cannot be used whatever the
  answers, because its text says the results were "published in a peer-reviewed medical journal" and credits
  "Easy Clinic" with the Penda study's figures. The page-writing rules forbid both. This ties to the /siliconindia/
  redirect decision (facts-needed M11).
- **Capterra 4.9** (#123, #580). The 4.9 is a confirmed fact, and the proof blocks already render it as text with its
  source. The badge image adds nothing until the review count is approved (facts-needed item 8).
- **GetApp 4.9, Software Advice 4.9** (#120, #126, #577, #578). These ratings are not in `facts.yaml`. They need a
  source, a count and an as-of date before they can appear even as text.
- **Awards**: Capterra Best Ease of Use and Best Value (2025 and 2026), GetApp Best Functionality 2025, Software Advice
  Best Customer Support 2026, and SoftwareSuggest Leader 2024 (#122, #124, #125, #579, #582, #583, #584, #585). Each
  needs the award page as evidence and marketing approval. The 2024 and 2025 ones are stale.
- **M-Pesa and Slade360** (#370, #371). Showing a partner's logo claims an integration whose status is unknown (P5 and
  P6). Use them only on /integrations/, once the status is confirmed, from the partner's official brand assets and
  with permission.

## 8. The EasyClinic logo

- The header uses `src/assets/logo/easyclinic-logo.png`, which is byte-identical to the old live logo
  (`/uploads/2023/12/footer-logo-img-1.png`, 400×79). `easyclinic-logo-white.png` is identical to the old white logo,
  and `easyclinic-mark.png` to the old mark (`footer-logo-img.png`, 600×595). The site already uses the old brand
  files, so there is nothing to import.
- The wordmark reads "Easy Clinic" as two words, while `docs/content-guide.md` says "EasyClinic" as one word
  (`logoAlt` is already "EasyClinic"). No old file has a one-word wordmark. `easyclinic_logo_final.png` is the same
  two-word design in white. `Logo-gradient.png` and `Logo-gradient-white.png` are another company's logo ("Axpos") and
  should be deleted from any media export. `Banner-Logo-scaled…jpeg` is a stock photo. The puzzle-piece "Easy Clinic"
  logo on the trade-show photo (#96) was retired long ago.
- **Recommendation:** keep the current files and do not redraw the mark. Ask the brand owner for a one-word "EasyClinic"
  wordmark as SVG, with a white version and the mark on its own. Replace the three PNGs only when those arrive. There
  is no SVG logo anywhere, so this also gives the header a sharp logo on high-density screens.
- The product also shows "Easy Clinic": on the online booking page and the self-registration form (#137, #501), in the
  WhatsApp footer "Powered by Easy Clinic" (#500), and in the demo locations "Easy Clinic- Mumbai" and "Easy Clinic
  Clinic". Those screens are placed as they are, because they are the product. Product should fix the labels before
  the demo-tenant recapture (section 9).

## 9. Problems in the old captures, for the demo-tenant recapture (spec 12)

These are why every placed screen is interim, and they are what the recapture should avoid.

- **Location names.** "Bellevue Clinic" appears on more than 50 screens and is the name of a real Kolkata hospital that is
  not a listed client. Other names are "Burdwan Clinic", "Easy Clinic- Mumbai", "Easy Clinic Clinic", "EC Delhi
  Clinic", "Novel Clinic- Lucknow" and "Saha Clinic". Use invented names that no real clinic has.
- **The demo doctor.** He is "Dr. Alok Roy", sometimes "Mr. Alok Roy" or "Dr. Alok Ray", with "Reg no: 70472WBMC",
  a real West Bengal council format, printed under MBBS, BAMS, BPT and M.Sc. Psychology alike. A second demo doctor,
  "Dr. Swagata Chatterjee", has "BDM-0034" and a printed Kolkata landline. A real staff e-mail address and the name
  of a real staff member appear as a doctor and a purchaser. Use invented doctors with obviously
  fictitious registration numbers, one per specialty.
- **Phone numbers.** Many patients have real-format mobiles, and one tester's number repeats across the patient list,
  day visits and self-registration. Use masked numbers, or numbers that cannot be dialled.
- **Letterhead logos.** Several are stock previews with an image-ID watermark (#404, #442, #475, #478, #514), and
  others are placeholders ("ENT CLINIC lorem ipsum", "Radiology Logo YOUR SLOGAN HERE", "Pshycology").
- **Labels that conflict with the naming decision.** The toolbar says "AI Co-pilot" and the consult screen has an "AI
  Consult" button and panel. "AI Consult" is the name of the tool in the Penda Health study, which the site must never
  call Cura AI or CuraPilot. One template is named "Clinical desision template".
- **UI and template typos.** "tired" for "tried", "caugh", "chils", "Prevoius", "Dischrage", "drtness", "well-gromed",
  "Post psychiatric", "defeciency", "Spider Naive", "Fluid thril", "Total Purchuse", "Bank Receive", "will be send",
  "vai SMS". The ophthalmology history row is labelled "Environmental allergies".
- **Impossible or inconsistent data.** A child's temperature of "101.3 Celsius". A fetal age of "42 w 2 d". A year of
  blood pressure plotted on a 9:00 to 10:00 AM axis. Addresses such as "Mumbai, West Bengal". Every patient, including
  a five-year-old, has the same facesheet (diabetes, dust allergy, cataract surgery). One ID has two names (PAT-0000789
  is Rajesh Kumar on one screen and Mohan Kumar on another).
- **Client-tenant captures.** The Kenyan payer set (#426 to #436) comes from a tenant with a Zimmerman branch, real
  insurers and a real organisation's scheme. The patient app (#494 to #498) is a Malaysian client's build. The
  Power BI reports name Malaysian government clinics.
- **Pasted-in material.** BI template tiles and gauges with decimal commas and US dollars appear in the purchase-order,
  payer and invoice composites. Other captures show a browser bar with internal bookmarks and patient and visit IDs, a
  browser-extension icon, and an "Activate Windows" watermark.
- **Dates.** The captures show dates from 2023 to January 2025 and say "(Today)" on those dates. Spec 12 wants today's date.

## 10. Questions for the company (add to `docs/facts-needed.md`)

1. Does each placed screenshot match the current product? Record `uiConfirmedOn` for each (section 5.2 lists them).
2. Is "Bellevue Clinic" only a demo name? If Belle Vue Clinic, Kolkata is not a client, the redactions in section 5.2
   are mandatory.
3. Is "70472WBMC" fictitious? The plan redacts it either way.
4. Were #433, #435 and #436 captured in a test tenant? If they came from a client's tenant, leave the three insurance
   rows empty until the recapture.
5. Are "Allied TPA" (#292), "Ashok Lab" (#298) and "Quick Service Pharmacy" (#295) invented names? Each screen is held
   until this is answered (section 5.4).
6. Is the "Clinical decision" alert (#115) the CuraPilot feature? And will the product's "AI Co-pilot" and "AI
   Consult" labels be renamed to match the naming decision?
7. For each of the 8 testimonial photos in section 6.2, did the person supply or approve it?
8. For each of the 9 client logos in section 7.1, and the 13 in section 7.3, may the logo be shown? Is each a current
   or a past client, and in which country?
9. Are the five leadership photos current?
10. Will the brand owner supply a one-word "EasyClinic" wordmark as SVG?

## 11. Kept in the library, not placed (87)

These pass the checks, or would pass after the standard fixes, but no published row describes them, or a better image
was chosen for the row. They are not copied into the repo now.

**Alternates and screens without a matching row: 17**

#52 suggestion set by diagnosis (EMR shortcuts alternative; not labelled AI); #53 AI prompt templates; technical, carries "AI Co-pilot"; #54 workflow settings and activity log, legacy UI; #103 skin template dropdown (dermatology alternative); #130 allergy template (no allergy page); #134 holistic assessment with pulse diagnosis (ayurveda alternative to #150); #264 clinical analytics at "Bellevue Clinic" (#554 used); #274 approval workflow states, no matching row; #293 pharmacy collage with reorder flags (alternative to #276); #299 workflow settings, legacy UI; #347 point-and-click complaint entry (needs the phone redacted; #471 used); #348 diagnosis type picker (same); #350 medical history editor (GP alternative to #170); #365 appointment settings with a highlight box; #394 ENT visit comparison, "Activate Windows" watermark; #474 OB-GYN facesheet with pregnancy flag (alternative to #355); #510 membership settings, no matching row.

**Specialty visit, prescription and profile screens with no published slot: 70**

These are the four-screen sets (visit details, prescription, patient profile, examination template) for allergy, ayurveda, cardiology, dental, dermatology, endocrinology, ENT, family physician, gastroenterology, general practice, general surgery, anaemia, immunology, IVF, mental health, nephrology, neurology, OB-GYN, oncology, ophthalmology, pathology, physiotherapy, pulmonology, radiology, rheumatology and urology that no published row describes, or whose page is not published: #99, #100, #101, #127, #128, #131, #132, #147, #148, #313, #314, #315, #317, #318, #323, #324, #334, #390, #391, #396, #397, #398, #401, #403, #405, #407, #410, #422, #423, #424, #425, #441, #443, #444, #450, #451, #454, #455, #473, #477, #480, #483, #484, #489, #490, #492, #518, #521, #525, #529, #530, #531, #533, #534, #536, #538, #541, #600, #601, #828, #829, #830, #831, #832, #833, #834, #836, #837, #838, #839. If one is used later, it needs the fixes in section 9: redact "Bellevue Clinic" or "Burdwan Clinic", redact "Reg no: 70472WBMC" and the letterhead logo, redact any mobile number that starts with 6 to 9, and crop the "AI Co-pilot" toolbar.

## 12. Excluded

### 12.1 From the 335 candidates (150)

**Duplicates (same image in another size, crop or re-upload; the best copy is kept): 36**

#28 = #294; PO list with BI gauges and a real staff name; #35 = #288; #45 = #468, same collage as #293; #166 = #334; #167 = #335; #168 = #336; #257 = #460 = #551 (kept #551); #259 = #465, same as #27; #260 same collage as #137; #261 = #467 = #896, same as #105; #294 = #28; #358 = #339; #359 = #340; #360 = #341; #361 = #342; #458 = #267; #459 = #256; #460 = #257; #462 same daybook as #262; #464 same as #299; #465 = #259; #467 = #261; #468 = #45; #469 same as #276; #470 same as #284; #587 Girish Mohata at 283 px; #84 kept; #865 = #898, same as #292; #896 = #261; #897 same as #58; #898 = #865; #905 same as #266; #906 same as #289; #907 same as #288; #909 = #37; #910 = #39; #911 = #29.

**Real personal data or a client's own data: 35**

#46 valid-format mobiles (+91 97xxxxxx26, 89xxxxxx45); #129 mobile 95xxxxxx51; #133 mobile 94xxxxxx64; #149 mobile 91xxxxxx87; #262 patient names with mobiles 99xxxxxx00, 99xxxxxx31; #319 mobile 91xxxxxx55; #325 mobile 91xxxxxx48; #336 mobile 91xxxxxx54; #392 mobile 99xxxxxx02; #409 mobile 91xxxxxx65; #426 client tenant: real insurers and their e-mail addresses; #427 client tenant, names Jubilee; #428 client tenant, Jubilee limits, extension icon; #430 member record with +254 721xxxx85 and membership numbers; #431 client tenant patient with Jubilee membership, Zimmerman branch; #432 client tenant invoice with member name and membership number; #434 client tenant; "Clubfoot Care for Kenya" scheme; #452 mobile 95xxxxxx44; #479 mobile 94xxxxxx44; #485 mobile 94xxxxxx51; #491 mobile 91xxxxxx56; #496 full Malaysian mobile in a client app; #499 mobile 93xxxxxx91 and a personal gmail address; #502 the same real-format mobile on three patients; #503 = #502 without the overlay; #520 mobile 91xxxxxx77; #527 mobile 91xxxxxx78; #535 mobile 95xxxxxx45; #540 mobile 91xxxxxx54; #563 a Kenyan client tenant's price list; #575 mobile 96xxxxxx51; #841 printed Kolkata landline 033-6xxxxxx8 and a doctor name that may be real; #842 same landline; cardiologist header on a child's prescription; 101.3 Celsius; #845 same landline; #862 same landline.

**Claims without evidence (ratings, awards, media, integrations, outcome figures): 28**

#1 SiliconIndia masthead; the mention needs the article, date and whether it was paid (M11); #118 claim-settlement and cost gauges, USD on a rupee screen, names AIA; #120 GetApp 4.9: not a confirmed fact; #122 Capterra Best Ease of Use 2025: no award evidence; #123 Capterra 4.9 badge: the site renders the confirmed 4.9 as text; review count unapproved; #124 GetApp Best Functionality 2025: no evidence; #125 Capterra Best Value 2025: no evidence; #126 Software Advice 4.9: not a confirmed fact; #152 designed card claiming TPA submission, UPI and multilingual AI; #153 designed invoice naming Star Health, TPA claim submitted, UPI; #256 Power BI with real Malaysian government clinics; #267 Power BI with real Malaysian clinics and cities; #339 "AI consult" is the name of the tool in the Penda study; "desision" typo; #340 same; #341 same; #342 same; #370 M-Pesa logo implies an integration whose status is unknown; #371 Slade360 logo implies an integration whose status is unknown; #505 names the SMS vendor Route Mobile; "Novel Medicare Solutions Online App" footer; #577 Software Advice 4.9 (JPG); #578 GetApp 4.9; #579 GetApp 2025 award (= #124); #580 Capterra 4.9 (= #123); #582 SoftwareSuggest Leader 2024: stale, no evidence; #583 Capterra Best Value 2026: no evidence, 182 px; #584 Software Advice Best Customer Support 2026: no evidence; #585 Capterra Best Ease of Use 2026: no evidence; #586 SiliconIndia spread prints "peer-reviewed" and credits the study results to Easy Clinic.

**Quality and errors (typos in the UI, impossible clinical values, wrong labels, too small): 28**

#6 logo has no name in it; #29 BI overlays, malformed "INR 1,77440", "Easy Clinic Clinic"; #37 Hindi print mis-rendered ("दनि" for "दिन"); easyclinic@gmail.com on the letterhead; #39 charts labelled Inpatients; EasyClinic does not run inpatient wards; #58 inpatient charts plus "Total Purchuse", "Bank Receive" typos; #78 blurry 225 px candid; #109 casual beach photo; ask for a professional one; #289 "Dr. Alok Ray" typo, Fortis lab brand, the office address as a clinic address; #316 template typo "tired" for "tried"; #338 114 px; #343 BP chart over a year plotted on a 9:00 to 10:00 AM axis; #356 fetal age "42 w 2 d" because it was computed at capture date; #367 "will be send", "vai SMS"; #399 "caugh"; #402 "defeciency", "Spider Naive", "Fluid thril"; #406 "chils"; #453 "Post psychiatric diagnoses", "Anxiety of worry"; #476 "Dischrage"; #486 ocular history row labelled "Environmental allergies"; #512 "Temperature: 101.3 Celsius" for a child; #515 "Prevoius"; #519 a West Bengal medical council number on a physiotherapist; #526 logo text "Pshycology"; a council number on a psychologist; #528 "well-gromed"; #539 placeholder logo "YOUR SLOGAN HERE"; #576 "drtness"; #826 "Mr. Alok Roy" as the doctor; #843 "101.3 Celsius".

**Stock images, or not EasyClinic's product: 12**

#104 stock-model doctor in the video tile; Razorpay payment overlay; #108 same stock video tile; vendor name in SMS template; #404 letterhead logo is a watermarked stock preview; #408 stock "Surgeon" logo template; #442 watermarked stock logos; #475 stock OBGYN logo template; #478 watermarked stock logo; #494 client app with stock photos and photos of doctors who may be real; #495 client app home with stock photos and banners; #497 photo of a doctor who may be real; #498 photos of doctors who may be real; #514 watermarked stock logo.

**Unnamed or unconsented people: 9**

#90 unnamed staff (2016); #91 unnamed staff; whiteboard shows internal strategy notes; #92 unidentified external people; #93 unnamed staff and a child; #94 unnamed staff; #95 unidentified officials; implies endorsement; #96 unnamed people; "India's No.1" banner; #321 real patient's face, consent unknown; #322 real patient's face, consent unknown.

**No page, and a sensitive subject: 2**

#376 sexology: no page, sensitive; #574 sexology: no page, sensitive.

### 12.2 Dropped in the first pass (585 of the 920 distinct images)

These were not candidates. The counts below are approximate, by file name and where each file was used. **Blog
covers and post thumbnails: about 182.** These are the `cover-image-…` and `1150x769_…` files, which belong to posts
that are being pruned or rewritten. **Stock photos: about 135.** Examples are the doctors, handshakes, robots, data
centres and "green screen" mock-ups, which spec 12 rules out. **Icons, decorative graphics and other page furniture:
about 193.** This covers the 2025 icon set, section graphics, the WHO logo from the client strip, and the careers
page's photos of doctors who are not EasyClinic staff. **Unused media-library items: about 75.** Most are stock images
and earlier copies of the specialty screens. Before these 920, another 1,046 files were merged away as size variants
and re-uploads of the same images.


## 13. Order of work

1. Make the schema and component changes in section 3.2: media fields, testimonial and author photos, the
   `peopleGrid`, `clients` and `logoStrip` blocks, and the Keystatic fields.
2. Prepare the files in `migration/images/image-sources.csv`: download each old URL, apply the crop and the
   redactions, check each result by eye against section 5.2, and save the file under `src/assets/images/`. Import only
   the `planned` rows. Import a `conditional` row when its confirmation is recorded.
3. Apply the rule text in section 3.1 to `docs/briefs/page-writing-rules.md`, and add the checklist line to
   `docs/launch-checklist.md`.
4. Add the `media` and `heroMedia` objects from section 5.1 to the page YAML. Set `origin: old-site`, `capturedOn`
   (the upload month in the old URL) and `uiConfirmedOn: null` on each. Then add the author photos, the testimonial
   photos with `photoConsent: null`, the client records with `logoPermission: null`, and the logo strips.
5. Run `node scripts/lint-content.ts --all`. The lead builds.
6. Record the company's answers to section 10 as they arrive.
7. Replace each interim screen with its demo-tenant capture when spec 12's screenshot list is shot, and keep this
   plan's alt text and captions where the new screen shows the same thing.
