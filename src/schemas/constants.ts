/**
 * Enumerations shared by the Zod content schemas, the rules engine, components and (later)
 * keystatic.config.ts, so the two schema systems cannot drift on allowed values.
 */

export const STATUSES = ['draft', 'review', 'published'] as const;
export type Status = (typeof STATUSES)[number];

export const REGULATOR_STATES = ['live', 'in-certification', 'planned', 'not-applicable'] as const;
export type RegulatorState = (typeof REGULATOR_STATES)[number];

export const INTEGRATION_STATES = ['live', 'beta', 'planned'] as const;
export type IntegrationState = (typeof INTEGRATION_STATES)[number];

/** Country payment rails and other status-carrying list items: the union of the two lists above, without repeats. */
export const STATUSED_ITEM_STATES = ['live', 'in-certification', 'planned', 'not-applicable', 'beta'] as const;

export const REGULATOR_KINDS = ['integration', 'law', 'guideline', 'certification', 'tax', 'payer'] as const;
export const AUTHOR_KINDS = ['clinician', 'product', 'country-lead', 'founder', 'editor'] as const;

/** Section background: sections alternate white and a light wash (section 11). */
export const TONES = ['plain', 'wash', 'inverse'] as const;
export const MEDIA_KINDS = ['screenshot', 'photo', 'video'] as const;
export const MEDIA_FRAMES = ['browser', 'phone', 'none'] as const;
export const PROOF_VARIANTS = ['study', 'customer', 'badges', 'screenshot'] as const;
export const PROSE_WIDTHS = ['measure', 'wide'] as const;
export const SCOPE_VARIANTS = ['notFor', 'isNot', 'limits'] as const;
/** single: one large quote alone (section 11); row: up to three cards. */
export const TESTIMONIAL_LAYOUTS = ['row', 'single'] as const;

/**
 * Editor-only keys: never rendered, so the rules engine (src/lib/rules/walk.ts), the token resolver
 * (src/lib/content/tokens.ts) and the facts report skip them. `notes` sits on pages and data files,
 * `editorNote` on a section.
 */
export const UNRENDERED_KEYS = ['notes', 'editorNote'] as const;

/** Spec 5.17 /integrations directory categories, in the order the page shows them. */
export const INTEGRATION_CATEGORIES = ['payments', 'insurance', 'national-health', 'labs', 'accounting', 'bi', 'messaging', 'emr'] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const CURRENCIES = ['USD', 'INR', 'KES', 'AED', 'NGN'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Spec 7.9: demo form options, in this order. */
export const PRACTICE_TYPES = ['Solo practice', 'Specialist clinic', 'Clinic group', 'Hospital or specialist centre', 'Health NGO'] as const;
export const LOCATION_BANDS = ['1', '2 to 5', '6 to 15', '15+'] as const;

export const PLAN_IDS = ['professional', 'premium', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_PERIODS = ['annual', 'quarterly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Page families: each maps to one template (spec 7.4) and one set of rules. */
export const FAMILIES = [
  'home',
  'hub',
  'feature',
  'solution',
  'selector',
  'ai',
  'curapilot',
  'trust',
  'integrations',
  'switch',
  'customers',
  'specialty',
  'country',
  'countryDemo',
  'pricing',
  'listicle',
  'comparison',
  'company',
  'legal',
  'guide',
  'post',
  'glossary',
  'kitchenSink',
] as const;
export type Family = (typeof FAMILIES)[number];

/**
 * Spec 5.19 /blog/ topics, in the order the hub lists them, plus `running-a-clinic` for general operations
 * posts (pharmacy, lab, reports, day-to-day running) that fit none of the spec's seven.
 */
export const POST_TOPICS = [
  'switching-to-emr',
  'running-a-chain',
  'compliance-by-country',
  'cura-ai',
  'billing-and-claims',
  'patient-engagement',
  'start-a-clinic',
  'running-a-clinic',
] as const;
export type PostTopic = (typeof POST_TOPICS)[number];

export const POST_TOPIC_LABELS: Record<PostTopic, string> = {
  'switching-to-emr': 'Switching to EMR',
  'running-a-chain': 'Running a chain',
  'compliance-by-country': 'Compliance by country',
  'cura-ai': 'Cura AI',
  'billing-and-claims': 'Billing and claims',
  'patient-engagement': 'Patient engagement',
  'start-a-clinic': 'Start a clinic',
  'running-a-clinic': 'Running a clinic',
};

/** Spec 2.8 persona ladder, used to tag testimonials, proof and routing cards. */
export const PERSONAS = ['solo', 'polyclinic', 'chain', 'hospital-opd', 'ngo'] as const;
export type Persona = (typeof PERSONAS)[number];

export const STATUS_LABELS: Record<RegulatorState | IntegrationState, string> = {
  live: 'Live',
  'in-certification': 'In certification',
  planned: 'Planned',
  'not-applicable': 'Not applicable',
  beta: 'Beta',
};

/** Country flags shipped in src/assets/flags (country-flag-icons, MIT, 1x1) for the chipCloud block. Add the SVG first. */
export const CHIP_FLAGS = ['ae', 'et', 'fj', 'gh', 'in', 'ke', 'mu', 'mv', 'my', 'ng', 'qa', 'rw', 'sc', 'so', 'sr', 'tt', 'tz', 'ug', 'za'] as const;
