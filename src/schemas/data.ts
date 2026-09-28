import { reference, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import {
  AUTHOR_KINDS,
  BILLING_PERIODS,
  CURRENCIES,
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATES,
  PERSONAS,
  PLAN_IDS,
  REGULATOR_KINDS,
  REGULATOR_STATES,
  STATUSED_ITEM_STATES,
} from './constants';
import { href, internalPath, isoDate, md, optionalGroup, unknown } from './fields';
import { NAV_LINK_PRESENT_IF } from './groups';
import { DIGITS, SLUG_ID } from './patterns';

/** Editor notes (provenance, decisions); never rendered. Keystatic keeps them where it would drop YAML comments. */
const notes = z.array(z.string()).default([]);

/* Shared facts. Every `null` is a fact the company must supply; `pnpm facts:report` lists them. */

export const siteSchema = z.object({
  name: z.literal('EasyClinic'),
  legalName: z.string(),
  url: z.url(),
  canonicalHost: z.string(),
  foundingYear: z.number().int(),
  email: z.email(),
  phone: z.string(),
  whatsapp: z.string().regex(DIGITS),
  address: z.object({
    street: z.string(),
    city: z.string(),
    region: z.string(),
    postalCode: z.string(),
    countryCode: z.string().length(2),
  }),
  appLoginUrl: z.url(),
  helpUrl: z.url(),
  twitterHandle: z.string().startsWith('@'),
  social: z.record(z.string(), z.url()),
  logoAlt: z.string(),
});

/** A number the site states. `asOf` and `source` make it citable; null means not yet confirmed. */
export const factSchema = z.object({
  label: z.string(),
  value: unknown(z.string()),
  source: unknown(z.string()),
  asOf: unknown(isoDate),
  note: z.string().optional(),
});
export const factsSchema = z.object({ facts: z.record(z.string(), factSchema), notes });

export const studySchema = z.object({
  publications: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      authors: z.string(),
      venue: z.string(),
      identifier: z.string(),
      url: z.url(),
      published: isoDate,
      peerReviewed: z.boolean(),
      scope: z.string(),
      easyclinicRole: unknown(z.string()),
      verifiedOn: unknown(isoDate),
    }),
  ),
  figures: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
      label: z.string(),
      /** Publication id, or null when the figure has no public source. */
      source: unknown(z.string()),
      /** Required when `source` is null: internal measurement the company stands behind. */
      internalSource: unknown(
        z.object({ description: z.string(), period: z.string(), approvedBy: z.string() }),
      ),
      context: z.string(),
    }),
  ),
  approvedWording: z.object({
    short: z.string(),
    approvedBy: unknown(z.string()),
  }),
  notes: z.array(z.string()).default([]),
});

export const planSchema = z.object({
  plans: z.array(
    z.object({
      id: z.enum(PLAN_IDS),
      name: z.string(),
      /** Ladder vocabulary (spec 2.8). */
      bestFor: z.string(),
      highlight: z.string().optional(),
      includesLabel: z.string(),
      includes: z.array(z.string()).min(1),
      custom: z.boolean().default(false),
    }),
  ),
  matrix: z.array(
    z.object({
      group: z.string(),
      rows: z.array(
        z.strictObject({
          feature: z.string(),
          href: internalPath.optional(),
          professional: z.union([z.boolean(), z.string()]),
          premium: z.union([z.boolean(), z.string()]),
          enterprise: z.union([z.boolean(), z.string()]),
        }),
      ),
    }),
  ),
  addons: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      body: md,
      availableOn: z.array(z.enum(PLAN_IDS)),
    }),
  ),
  conditions: z.array(z.string()).min(1),
  notes,
});

const planPrice = z.object({
  annual: unknown(z.number().positive()),
  quarterly: unknown(z.number().positive()),
});

export const priceSchema = z.object({
  currency: z.enum(CURRENCIES),
  label: z.string(),
  /** Country record this currency belongs to; USD has none. */
  country: z.string().optional(),
  locale: z.string(),
  plans: z.object({ professional: planPrice, premium: planPrice }),
  addons: z.record(z.string(), unknown(z.string())).default({}),
  taxNote: unknown(z.string()),
  /** At least one method when known: an empty list and an unknown one would look the same in the editor. */
  paymentMethods: unknown(z.array(z.string()).min(1)),
  source: z.string(),
  asOf: unknown(isoDate),
  note: z.string().optional(),
  defaultPeriod: z.enum(BILLING_PERIODS).default('annual'),
  notes,
});

// Strict: an unquoted comma in a YAML flow mapping silently truncates a value and adds a stray key.
const statusedItem = z.strictObject({
  name: z.string(),
  state: unknown(z.enum(STATUSED_ITEM_STATES)),
  asOf: unknown(isoDate),
  note: z.string().optional(),
});

export const countrySchema = z.object({
  name: z.string(),
  code: z.string().length(2),
  currency: z.enum(CURRENCIES),
  dialCode: z.string().startsWith('+'),
  timezone: z.string(),
  flagship: z.boolean().default(false),
  contact: z.object({
    name: unknown(z.string()),
    /** Whether the named contact has agreed to appear on the site. */
    publishName: unknown(z.boolean()),
    role: unknown(z.string()),
    phone: unknown(z.string()),
    whatsapp: unknown(z.string().regex(DIGITS)),
    email: unknown(z.email()),
    hours: unknown(z.string()),
    callbackWindow: unknown(z.string()),
  }),
  office: unknown(z.string()),
  pages: z.object({
    country: internalPath.optional(),
    demo: internalPath.optional(),
    pricing: internalPath.optional(),
    listicle: internalPath.optional(),
    comparison: internalPath.optional(),
    privacy: internalPath.optional(),
    startAClinic: internalPath.optional(),
  }),
  cities: z.array(z.string()).default([]),
  clients: z.array(z.string()).default([]),
  payments: z.array(statusedItem).default([]),
  insurers: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  taxInvoicing: unknown(z.string()),
  notes,
});

export const regulatorSchema = z.object({
  country: z.string(),
  name: z.string(),
  body: z.string(),
  kind: z.enum(REGULATOR_KINDS),
  state: unknown(z.enum(REGULATOR_STATES)),
  asOf: unknown(isoDate),
  /** Quarter for Planned and In certification, e.g. "2027 Q1". */
  expected: z.string().optional(),
  whatItDoes: md,
  clinicMustDo: md.optional(),
  link: z.url().optional(),
  order: z.number().default(0),
  notes,
});

/**
 * A function of the schema context because `photo` is an `astro:assets` image. Photos sit in Keystatic's layout,
 * `src/assets/images/people/<entry id>/photo.<ext>`, written `../../assets/images/people/<entry id>/photo.<ext>`.
 */
export const testimonialSchema = ({ image }: SchemaContext) =>
  z.object({
    name: z.string(),
    role: z.string(),
    specialty: z.string().optional(),
    clinic: z.string().optional(),
    city: unknown(z.string()),
    country: z.string(),
    customerSince: z.number().int().optional(),
    /** Verbatim. The banned-words rule does not apply to quotes. */
    quote: z.string(),
    /** A one-line version for large single-quote layouts (section 11). Must be a verbatim excerpt. */
    pullQuote: z.string().optional(),
    outcome: unknown(z.string()),
    personas: z.array(z.enum(PERSONAS)).default([]),
    source: z.string(),
    consentOnFile: unknown(z.boolean()),
    /** A headshot the person supplied or approved (spec 12). Shown only once `photoConsent` is true. */
    photo: image().optional(),
    /** Whether the person supplied or approved `photo`. null until the company records it (docs/image-plan.md 6.2). */
    photoConsent: unknown(z.boolean()),
    notes,
  });

/** `photo`: a headshot in `src/assets/images/people/<entry id>/photo.<ext>`, shown in the byline and on /about-us/. */
export const authorSchema = ({ image }: SchemaContext) =>
  z.object({
    name: z.string(),
    role: z.string(),
    kind: z.enum(AUTHOR_KINDS),
    bio: unknown(z.string()),
    linkedin: unknown(z.url()),
    photo: image().optional(),
    notes,
  });

/**
 * A client organisation whose logo a `logoStrip` may show (docs/image-plan.md section 7). The logo file sits in
 * Keystatic's layout, `src/assets/images/clients/<entry id>/logo.<ext>`. Production shows a logo only when
 * `logoPermission` is true; preview shows the rest as placeholders.
 */
export const clientSchema = ({ image }: SchemaContext) =>
  z.object({
    name: z.string(),
    /** Empty until the file is imported; the strip then shows a placeholder in preview and leaves the client out in production. */
    logo: image().optional(),
    /** Country code (in, ke, my, zw); null until the company confirms where the client is. */
    country: unknown(z.string().regex(SLUG_ID)),
    /** The old live page where the logo appeared, or where the company confirmed the client. */
    sourcePage: z.url().optional(),
    /** The heading of the section the logo appeared under. */
    sourceHeading: z.string().optional(),
    /** A testimonial from the same organisation, when there is one. */
    testimonial: reference('testimonials').optional(),
    /** Whether the client agrees to its logo appearing on the site. null until the company confirms it. */
    logoPermission: unknown(z.boolean()),
    notes,
  });

const navLink = z.strictObject({
  label: z.string(),
  href,
  description: z.string().optional(),
  icon: z.string().optional(),
});

export const navSchema = z.object({
  primary: z.array(
    z.object({
      label: z.string(),
      href: internalPath.optional(),
      groups: z
        .array(z.object({ title: z.string(), links: z.array(navLink).min(1) }))
        .optional(),
      footerLink: optionalGroup(navLink, NAV_LINK_PRESENT_IF),
    }),
  ),
  footer: z.array(z.object({ title: z.string(), links: z.array(navLink) })),
  legal: z.array(navLink),
  notes,
});

export const integrationSchema = z.object({
  name: z.string(),
  category: z.enum(INTEGRATION_CATEGORIES),
  countries: z.array(z.string()).default([]),
  state: unknown(z.enum(INTEGRATION_STATES)),
  asOf: unknown(isoDate),
  /** When a planned or beta connection is expected to go live, as the company states it (e.g. "Q1 2027"). */
  expected: z.string().nullable().default(null),
  description: md,
  notes,
});

export const testimonialRef = reference('testimonials');
export const regulatorRef = reference('regulators');
export const countryRef = reference('countries');
export const priceRef = reference('prices');
export const authorRef = reference('authors');
export const clientRef = reference('clients');
export { href };
