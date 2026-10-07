/**
 * Shared-fact collections in src/data (Zod schemas in src/schemas/data.ts). File names are ids that pages and
 * blocks reference: Keystatic does not update references when an entry is renamed, and a broken reference fails
 * the build, so the slug descriptions say so.
 */
import { collection } from '@keystatic/core';
import {
  AUTHOR_KINDS,
  BILLING_PERIODS,
  CURRENCIES,
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATES,
  PERSONAS,
  REGULATOR_KINDS,
  REGULATOR_STATES,
  STATUS_LABELS,
  STATUSED_ITEM_STATES,
} from '../../src/schemas/constants.ts';
import { DIGITS, SLUG_ID } from '../../src/schemas/patterns.ts';
import {
  choice,
  choices,
  email,
  flag,
  group,
  int,
  list,
  md,
  num,
  path,
  record,
  slug,
  stringList,
  text,
  unknown,
  unknownChoice,
  unknownFlag,
  unknownList,
  url,
  date,
} from '../fields.ts';

const idSlug = (label: string, what: string) =>
  slug(label, {
    slugPattern: SLUG_ID,
    slugDescription: `The file name is the ${what} id other entries reference. Renaming it breaks those references (the build then fails): search for the old id first.`,
  });

const notes = () => stringList('Editor notes', 'Note', { multiline: true, description: 'Sources and decisions. Never shown on the site.' });
const asOf = () => unknown(date('As of', { description: 'Empty means not yet known.' }));

/** Add-on ids in plans.yaml, in order: each currency lists a price (or null) for every one. */
export const ADDON_IDS = ['pharmacy', 'lab', 'claims', 'integrations'] as const;

const planPrice = (label: string) =>
  group(label, {
    annual: unknown(num('Annual (per doctor per month)', { min: 0.01 })),
    quarterly: unknown(num('Quarterly (per doctor per month)', { min: 0.01 })),
  });

export const dataCollections = {
  prices: collection({
    label: 'Prices',
    path: 'src/data/prices/*',
    format: { data: 'yaml' },
    slugField: 'label',
    columns: ['label', 'currency'],
    schema: {
      currency: choice('Currency', CURRENCIES, { required: true }),
      label: idSlug('Label', 'currency'),
      country: text('Country id', { description: 'Country record this currency belongs to (e.g. ke); USD has none.' }),
      locale: text('Locale', { required: true, description: 'e.g. en-KE' }),
      plans: group('Plan prices', { professional: planPrice('Professional'), premium: planPrice('Premium') }),
      addons: record('Add-on prices', ADDON_IDS, (id) => unknown(text(id.charAt(0).toUpperCase() + id.slice(1)))),
      taxNote: unknown(text('Tax note', { multiline: true })),
      paymentMethods: unknownList('Payment methods'),
      source: text('Source', { required: true }),
      asOf: asOf(),
      note: text('Note', { multiline: true }),
      defaultPeriod: choice('Default period', BILLING_PERIODS, { zodDefault: 'annual' }),
      notes: notes(),
    },
  }),

  countries: collection({
    label: 'Countries',
    path: 'src/data/countries/*',
    format: { data: 'yaml' },
    slugField: 'name',
    columns: ['name', 'code'],
    schema: {
      name: idSlug('Name', 'country'),
      code: text('Code', { required: true, min: 2, max: 2 }),
      currency: choice('Currency', CURRENCIES, { required: true }),
      dialCode: text('Dial code', { required: true, pattern: /^\+/, patternMessage: 'Starts with +' }),
      timezone: text('Time zone', { required: true, description: 'e.g. Africa/Nairobi' }),
      flagship: flag('Flagship', { zodDefault: false }),
      contact: group('Contact', {
        name: unknown(text('Name')),
        publishName: unknownFlag('Publish the name', { description: 'Whether the named contact has agreed to appear on the site.' }),
        role: unknown(text('Role')),
        phone: unknown(text('Phone')),
        whatsapp: unknown(text('WhatsApp number', { pattern: DIGITS, patternMessage: 'Digits only, e.g. 254750184357' })),
        email: unknown(email('Email')),
        hours: unknown(text('Hours')),
        callbackWindow: unknown(text('Callback window')),
      }),
      office: unknown(text('Office', { multiline: true })),
      pages: group('Pages', {
        country: path('Country page'),
        demo: path('Demo page'),
        pricing: path('Pricing page'),
        listicle: path('Listicle'),
        comparison: path('Comparison'),
        privacy: path('Privacy page'),
        startAClinic: path('Start-a-clinic guide'),
      }),
      cities: stringList('Cities', 'City'),
      clients: stringList('Clients', 'Client'),
      payments: list(
        group('Payment rail', {
          name: text('Name', { required: true }),
          state: unknownChoice('State', STATUSED_ITEM_STATES, { labels: STATUS_LABELS }),
          asOf: asOf(),
          note: text('Note'),
        }),
        { label: 'Payments', itemLabel: (props) => props.fields.name.value || 'Payment rail' },
      ),
      insurers: stringList('Insurers', 'Insurer'),
      languages: stringList('Languages', 'Language'),
      taxInvoicing: unknown(text('Tax invoicing', { multiline: true })),
      notes: notes(),
    },
  }),

  regulators: collection({
    label: 'Regulators',
    path: 'src/data/regulators/*',
    format: { data: 'yaml' },
    slugField: 'name',
    columns: ['name', 'state', 'asOf'],
    schema: {
      country: text('Country code', { required: true, description: 'e.g. ke' }),
      name: idSlug('Name', 'regulator'),
      body: text('Body', { required: true }),
      kind: choice('Kind', REGULATOR_KINDS, { required: true }),
      state: unknownChoice('State', REGULATOR_STATES, { labels: STATUS_LABELS }),
      asOf: asOf(),
      expected: text('Expected', { description: 'Quarter for Planned and In certification, e.g. "2027 Q1".' }),
      whatItDoes: md('What it does', { required: true }),
      clinicMustDo: md('What the clinic must do'),
      link: url('Link'),
      order: num('Order', { zodDefault: 0 }),
      notes: notes(),
    },
  }),

  testimonials: collection({
    label: 'Testimonials',
    path: 'src/data/testimonials/*',
    format: { data: 'yaml' },
    slugField: 'name',
    columns: ['name', 'clinic'],
    schema: {
      name: idSlug('Name', 'testimonial'),
      role: text('Role', { required: true }),
      specialty: text('Specialty'),
      clinic: text('Clinic'),
      city: unknown(text('City')),
      country: text('Country code', { required: true }),
      customerSince: int('Customer since'),
      quote: text('Quote', { required: true, multiline: true, description: 'Verbatim.' }),
      pullQuote: text('Pull quote', { multiline: true, description: 'A verbatim excerpt for large single-quote layouts.' }),
      cardQuote: text('Card quote', { multiline: true, description: 'Shorter version for fixed-height cards: verbatim pieces of the quote joined by " … ".' }),
      outcome: unknown(text('Outcome', { multiline: true })),
      personas: choices('Personas', PERSONAS),
      source: text('Source', { required: true }),
      consentOnFile: unknownFlag('Consent on file'),
      photo: text('Photo'),
      notes: notes(),
    },
  }),

  authors: collection({
    label: 'Authors',
    path: 'src/data/authors/*',
    format: { data: 'yaml' },
    slugField: 'name',
    columns: ['name', 'role'],
    schema: {
      name: idSlug('Name', 'author'),
      role: text('Role', { required: true }),
      kind: choice('Kind', AUTHOR_KINDS, { required: true }),
      bio: unknown(text('Bio', { multiline: true })),
      linkedin: unknown(url('LinkedIn')),
      photo: text('Photo'),
      notes: notes(),
    },
  }),

  integrations: collection({
    label: 'Integrations',
    path: 'src/data/integrations/*',
    format: { data: 'yaml' },
    slugField: 'name',
    columns: ['name', 'state', 'asOf'],
    schema: {
      name: idSlug('Name', 'integration'),
      category: choice('Category', INTEGRATION_CATEGORIES, { required: true }),
      countries: stringList('Countries', 'Country code'),
      state: unknownChoice('State', INTEGRATION_STATES, { labels: STATUS_LABELS }),
      asOf: asOf(),
      // Nullable with a default of null in Zod: "no expected date", not a fact the company owes. Empty is left out.
      expected: text('Expected', { description: 'When a planned or beta connection is expected, as the company states it (e.g. "Q1 2027").' }),
      description: md('Description', { required: true }),
      notes: notes(),
    },
  }),
};
