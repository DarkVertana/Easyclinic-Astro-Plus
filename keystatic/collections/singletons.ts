/**
 * Single-file data in src/data: site facts, measured numbers, the study, plans and navigation (Zod schemas in
 * src/schemas/data.ts). A singleton path without a trailing slash is stored as `<path>.yaml`.
 *
 * Not in Keystatic: redirects.yaml, gone.yaml and their generated *-posts.yaml files. They are routing data with a
 * comment grammar, and the *-posts files are written by scripts/posts-redirects.ts.
 */
import { singleton } from '@keystatic/core';
import { PLAN_IDS } from '../../src/schemas/constants.ts';
import { NAV_LINK_PRESENT_IF } from '../../src/schemas/groups.ts';
import { DIGITS } from '../../src/schemas/patterns.ts';
import {
  boolOrText,
  choice,
  choices,
  date,
  email,
  flag,
  group,
  int,
  link,
  list,
  md,
  optionalGroup,
  path,
  preserved,
  record,
  stringList,
  text,
  unknown,
  url,
} from '../fields.ts';

const notes = () => stringList('Editor notes', 'Note', { multiline: true, description: 'Sources and decisions. Never shown on the site.' });

/**
 * Fact ids in facts.yaml, in file order. Each id is a token name ({fact:doctors}), so adding one is a code change:
 * add it here and in the file (the parity test compares the two).
 */
export const FACT_KEYS = [
  'doctors',
  'cities',
  'countries',
  'founded',
  'prescriptionsDaily',
  'retention',
  'supportSatisfaction',
  'largestChain',
  'goLiveDays',
  'trainingDays',
  'noShowReduction',
  'minutesPerNote',
  'capterraRating',
  'capterraReviews',
  'googleRating',
  'googleReviews',
] as const;

/** Social profiles in site.yaml. The footer shows the icons in this order. */
export const SOCIAL_KEYS = ['linkedin', 'youtube', 'facebook', 'instagram', 'x'] as const;

const navLinkFields = (required: boolean) => ({
  label: text('Label', { required }),
  href: link('Link', { required }),
  description: text('Description'),
  icon: text('Icon', { description: 'Lucide icon name, e.g. calendar-clock.' }),
});
const navLink = () => group('Link', navLinkFields(true));
const navLinks = (label: string, min?: number) =>
  list(navLink(), { label, min, itemLabel: (props) => props.fields.label.value || 'Link' });

export const singletons = {
  site: singleton({
    label: 'Site',
    path: 'src/data/site',
    format: { data: 'yaml' },
    schema: {
      name: choice('Name', ['EasyClinic'], { initial: 'EasyClinic' }, { labels: { EasyClinic: 'EasyClinic' } }),
      legalName: text('Legal name', { required: true }),
      url: url('URL', { required: true }),
      canonicalHost: text('Canonical host', { required: true }),
      foundingYear: int('Founding year', { required: true }),
      email: email('Email', { required: true }),
      phone: text('Phone', { required: true }),
      whatsapp: text('WhatsApp number', { required: true, pattern: DIGITS, patternMessage: 'Digits only' }),
      address: group('Address', {
        street: text('Street', { required: true }),
        city: text('City', { required: true }),
        region: text('Region', { required: true }),
        postalCode: text('Postal code', { required: true }),
        countryCode: text('Country code', { required: true, min: 2, max: 2 }),
      }),
      appLoginUrl: url('App login URL', { required: true }),
      helpUrl: url('Help URL', { required: true }),
      twitterHandle: text('Twitter handle', { required: true, pattern: /^@/, patternMessage: 'Starts with @' }),
      social: record('Social profiles', SOCIAL_KEYS, (key) => url(key === 'x' ? 'X' : key.charAt(0).toUpperCase() + key.slice(1))),
      logoAlt: text('Logo alt text', { required: true }),
    },
  }),

  facts: singleton({
    label: 'Facts',
    path: 'src/data/facts',
    format: { data: 'yaml' },
    schema: {
      facts: record(
        'Facts',
        FACT_KEYS,
        (key) =>
          group(key, {
            label: text('Label', { required: true }),
            value: unknown(text('Value')),
            source: unknown(text('Source')),
            asOf: unknown(date('As of', { description: 'Empty: not confirmed for publication; pages show it in preview only.' })),
            note: text('Note', { multiline: true }),
          }),
        { description: 'Numbers the site states. Use them in copy as {fact:<id>}.' },
      ),
      notes: notes(),
    },
  }),

  study: singleton({
    label: 'Study',
    path: 'src/data/study',
    format: { data: 'yaml' },
    schema: {
      publications: list(
        group('Publication', {
          id: text('Id', { required: true, description: 'Figures (source) and study cards (publication) refer to it, e.g. korom-2025.' }),
          title: text('Title', { required: true }),
          authors: text('Authors', { required: true }),
          venue: text('Venue', { required: true }),
          identifier: text('Identifier', { required: true }),
          url: url('URL', { required: true }),
          published: date('Published', { required: true }),
          peerReviewed: flag('Peer reviewed', { initial: false }),
          scope: text('Scope', { required: true, multiline: true }),
          easyclinicRole: unknown(text('EasyClinic’s role', { multiline: true })),
          verifiedOn: unknown(date('Verified on', { description: 'Re-verify before publishing any page that cites it.' })),
        }),
        { label: 'Publications', itemLabel: (props) => props.fields.id.value || 'Publication' },
      ),
      figures: list(
        group('Figure', {
          id: text('Id', { required: true, description: 'Used in copy as {fig:<id>}.' }),
          value: text('Value', { required: true }),
          label: text('Label', { required: true }),
          source: unknown(text('Source publication id')),
          internalSource: preserved({ nullable: true }),
          context: text('Context', { required: true, multiline: true }),
        }),
        { label: 'Figures', itemLabel: (props) => props.fields.id.value || 'Figure' },
      ),
      approvedWording: group('Approved wording', {
        short: text('Short', { required: true, multiline: true }),
        approvedBy: unknown(text('Approved by')),
      }),
      notes: notes(),
    },
  }),

  plans: singleton({
    label: 'Plans',
    path: 'src/data/plans',
    format: { data: 'yaml' },
    schema: {
      plans: list(
        group('Plan', {
          id: choice('Id', PLAN_IDS, { required: true }),
          name: text('Name', { required: true }),
          bestFor: text('Best for', { required: true }),
          highlight: text('Highlight'),
          includesLabel: text('Includes label', { required: true }),
          includes: stringList('Includes', 'Item', { min: 1 }),
          custom: flag('Custom pricing', { zodDefault: false }),
        }),
        { label: 'Plans', itemLabel: (props) => props.fields.name.value || 'Plan' },
      ),
      // File order: conditions sit after plans in plans.yaml.
      conditions: stringList('Conditions', 'Condition', { min: 1, multiline: true }),
      matrix: list(
        group('Group', {
          group: text('Group', { required: true }),
          rows: list(
            group('Row', {
              feature: text('Feature', { required: true }),
              href: path('Link'),
              professional: boolOrText('Professional'),
              premium: boolOrText('Premium'),
              enterprise: boolOrText('Enterprise'),
            }),
            { label: 'Rows', itemLabel: (props) => props.fields.feature.value || 'Row' },
          ),
        }),
        { label: 'Comparison matrix', itemLabel: (props) => props.fields.group.value || 'Group' },
      ),
      addons: list(
        group('Add-on', {
          id: text('Id', { required: true }),
          name: text('Name', { required: true }),
          body: md('Body', { required: true }),
          availableOn: choices('Available on', PLAN_IDS),
        }),
        { label: 'Add-ons', itemLabel: (props) => props.fields.name.value || 'Add-on' },
      ),
      notes: notes(),
    },
  }),

  nav: singleton({
    label: 'Navigation',
    path: 'src/data/nav',
    format: { data: 'yaml' },
    schema: {
      primary: list(
        group('Menu', {
          label: text('Label', { required: true }),
          href: path('Link'),
          groups: list(
            group('Group', { title: text('Title', { required: true }), links: navLinks('Links', 1) }),
            { label: 'Groups', itemLabel: (props) => props.fields.title.value || 'Group' },
          ),
          footerLink: optionalGroup('Footer link', navLinkFields(false), [...NAV_LINK_PRESENT_IF]),
        }),
        { label: 'Header menus', itemLabel: (props) => props.fields.label.value || 'Menu' },
      ),
      footer: list(
        group('Column', {
          title: text('Title', { required: true }),
          continued: flag('Continues the column before it', {
            zodDefault: false,
            description: 'The title is hidden on screen and read only by screen readers.',
          }),
          links: navLinks('Links'),
          sections: list(group('Section', { title: text('Title', { required: true }), links: navLinks('Links', 1) }), {
            label: 'Sections',
            itemLabel: (props) => props.fields.title.value || 'Section',
          }),
        }),
        {
        label: 'Footer columns',
        itemLabel: (props) => props.fields.title.value || 'Column',
      }),
      legal: navLinks('Legal links'),
      notes: notes(),
    },
  }),
};
