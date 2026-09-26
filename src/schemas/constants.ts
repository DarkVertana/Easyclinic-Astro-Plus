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
  'kitchenSink',
] as const;
export type Family = (typeof FAMILIES)[number];

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
