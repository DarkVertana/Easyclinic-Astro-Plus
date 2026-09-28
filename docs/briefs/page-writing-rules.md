# Page writing rules for agents and writers (publish with public facts)

Owner decision, 26 September 2026: pages are written to be published now, using only confirmed facts.
A page that cannot be honest without a missing fact stays `status: draft` with `[placeholders]`.

## Confirmed facts you may use (nothing else)
- Price tokens: `{price:usd.professional.annual}` $79, `{price:usd.professional.quarterly}` $99,
  `{price:usd.premium.annual}` $99, `{price:usd.premium.quarterly}` $129, `{price:inr.professional.annual}` ₹1,499,
  `{price:inr.professional.quarterly}` ₹1,899, `{price:inr.premium.annual}` ₹1,999, `{price:inr.premium.quarterly}` ₹2,499.
  KES, AED and NGN prices are unknown.
- Fact tokens: `{fact:doctors}` 5,000+, `{fact:cities}` 200, `{fact:countries}` 18, `{fact:founded}` 2003,
  `{fact:prescriptionsDaily}` 200,000, `{fact:largestChain}` 100+, `{fact:goLiveDays}` 3 ("in as little as 3 days"),
  `{fact:trainingDays}` 4, `{fact:capterraRating}` 4.9, `{fact:googleRating}` 4.8, `{fact:retention}` 92%,
  `{fact:supportSatisfaction}` 98%. Unknown: no-show reduction, minutes per note, review counts.
- Study figures (arXiv preprint 2507.16947, Korom et al. 2025, Penda Health and OpenAI, verified): `{fig:visits}` 39,849,
  `{fig:diagnostic-errors}` 16%, `{fig:treatment-errors}` 13%, `{fig:history-errors}` 32%. Also verified from the
  paper: 15 clinics in Nairobi, rated by 108 independent physicians, 10% fewer investigation errors, the tool was
  "AI Consult", and Penda's EMR has been Easy Clinic since 2017. Never "peer reviewed", "Nature", "proven"; never call
  the studied tool Cura AI or CuraPilot. denied-claims, stockouts, stockout-lead and uptime figures have no public
  source: do not use them.
- Contacts: `{contact:in.phone}`, `{contact:in.email}`, `{contact:ke.phone}`, `{contact:ke.email}`. No names, roles or
  hours. Office: 30 Circus Avenue, Kolkata 700017. Legal entity: Novel Medicare Solutions Pvt Ltd.
- `src/data/plans.yaml` (plans, inclusions, conditions, add-ons, matrix); the four-day training path; testimonials in
  `src/data/testimonials/` (verbatim, consent on file); facts stated as fact in the spec; plain statements in
  `migration/research/facts.md` (e.g. no binding contracts; reception licence rule; support by phone, email and chat;
  customisation without charges; the live site says it does not run fully offline today; Kenya integrations named on
  /kenyademo/: M-Pesa, eTIMS, SLADE, SMART, WhatsApp, SHA; insurers via SLADE: Jubilee, AAR, CIC, Britam, Resolution;
  bilingual English and Swahili prescriptions; MOH 705 and DHIS2 reports).
- Compliance and integration STATUS is unknown everywhere. Describing a regulation or an integration and what it
  does is fine; stating or implying EasyClinic's status, readiness or certification is not. On pages meant to
  publish, do not use regulatorStrip, regulatorTable or heroStrip.regulators.
- Product screenshots: on pages meant to publish, `heroMedia` and `media` may use only the files in
  `src/assets/images/screens/` that `docs/image-plan.md` places on that slot, with the alt text and caption given
  there. They are real product screens showing demo data only, with no real patient name, phone number, e-mail,
  registration or membership number, client or third-party name, rating, award, compliance word or outcome figure.
  The caption says only what the screen shows; it never says more than the row's text, and it never calls a screen
  the tool from the Penda Health study. Screens taken from the old site carry `origin: old-site` and the month they
  were captured. The company must confirm that each one matches the current product, and the confirmation is
  recorded as `uiConfirmedOn`. Until then preview labels the image "Interim capture", and the launch checklist
  lists every old-site screen without a confirmation. Conditional images (marked in the plan) stay out until their
  confirmation is recorded. A media object without `src` is still a placeholder and blocks publishing. Generated
  images (`aiGenerated: true`) are never used as proof.

## Writing (spec section 6)
Clinic administrator's voice; names, numbers, days; admit limits; no exclamation marks; sentence case headings;
no em dashes; no groups of three; no "not just" or "it's not X, it's Y"; none of the banned words; no
"confirm in demo", "we'll confirm", "discuss on the call", "coming soon", "in progress"; CTA labels say what happens.
Opening answer: two sentences answering the owning query, with a number. FAQs: 5 to 8 real prospect questions
(8 to 10 on country pages), answered in the first sentence, including uncomfortable ones that CAN be answered.
Title <= 60 and meta <= 155 characters after token expansion.

## Page fields
`status: published` (or draft if it cannot be honest without missing facts), `author: subhashish-saha`,
`lastUpdated: 2026-09-26`, and `editorialPass: { by: 'Claude (AI review; human read-aloud pass pending)',
on: 2026-09-26, onlyUsCouldWrite: '...', readsMachineWritten: '...' }` with honest one-sentence answers.
Sections use the Keystatic shape (`- discriminant: <block>` / `value: {...}`), only block types allowed for the family
in `src/schemas/families.ts`. References by id. Internal links lowercase with trailing slash, spec URLs (never
/doctors/ or /clinics/). Each testimonial id only on the page it is assigned to.

## Validate
`node scripts/lint-content.ts --all` must show no ✗ lines for your file if it is published.
