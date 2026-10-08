/**
 * The page base (Zod `pageBase` in src/schemas/base.ts) as Keystatic fields, in the key order the page files
 * already use, so a save moves as few lines as possible. Every page collection builds its schema here.
 */
import type { ComponentSchema } from '@keystatic/core';
import { STATUSES } from '../src/schemas/constants.ts';
import { FAMILY_BLOCKS, type PageFamily } from '../src/schemas/family-blocks.ts';
import {
  CLAIMS_REVIEW_PRESENT_IF,
  CLOSING_PRESENT_IF,
  SHOWCASE_PRESENT_IF,
  ORBIT_PRESENT_IF,
  PROBLEMS_PRESENT_IF,
  EDITORIAL_PASS_PRESENT_IF,
  HERO_STRIP_PRESENT_IF,
} from '../src/schemas/groups.ts';
import { LEGAL_SLUG, SLUG_ID } from '../src/schemas/patterns.ts';
import { KS_BLOCKS } from './blocks/index.ts';
import {
  MDX_SCREENSHOT_PATH,
  YAML_SCREENSHOT_PATH,
  choice,
  cta,
  date,
  flag,
  group,
  list,
  md,
  media,
  optionalGroup,
  path,
  preserved,
  ref,
  refs,
  sections,
  slug,
  stringList,
  text,
  unknown,
  url,
} from './fields.ts';

export type PageOptions = {
  /** MDX entries sit one folder deeper (`<slug>/index.mdx`), which changes the screenshot path prefix. */
  mdx?: boolean;
  /** Legal ids can be nested (`privacy/india`). */
  nestedSlugs?: boolean;
};

const SLUG_HELP =
  'The file name is the entry id and, unless the page sets a path, its URL. Renaming it changes the live URL: add the old URL to "Redirect from".';

/**
 * Base fields, the family's own fields (placed after `lastUpdated`, as in the files) and the sections the family
 * may use. An extension key that the base already has (`country` on country pages) replaces the base field in
 * place, keeping its position.
 */
export function pageFields<E extends Record<string, ComponentSchema>>(family: PageFamily, extension: E, options: PageOptions = {}) {
  const screenshots = options.mdx ? MDX_SCREENSHOT_PATH : YAML_SCREENSHOT_PATH;
  return {
    status: choice('Status', STATUSES, { initial: 'draft' }, { description: 'Draft and review pages appear on preview deployments only. A published page that breaks a rule stops the build.' }),
    path: path('Path', { description: 'Only for pages whose URL is not the file name (home, hubs, main pricing).' }),
    headKeyword: text('Head keyword', { required: true, min: 2 }),
    secondaryKeywords: stringList('Secondary keywords', 'Keyword'),
    title: text('Title', { required: true, min: 10, description: '60 characters or fewer.' }),
    metaDescription: text('Meta description', { required: true, min: 40, multiline: true, description: '155 characters or fewer.' }),
    h1: text('H1', { required: true, min: 5 }),
    linkLabel: slug('Link label', {
      min: 2,
      max: 48,
      slugPattern: options.nestedSlugs ? LEGAL_SLUG : SLUG_ID,
      slugDescription: SLUG_HELP,
    }),
    eyebrow: text('Eyebrow'),
    openingAnswer: md('Opening answer', { required: true, description: 'Two sentences that answer the page’s query, with a number where one exists.' }),
    summary: text('Summary', { max: 220, multiline: true, description: 'Card and related-link description.' }),
    author: unknown(ref('Author', 'authors', { description: 'A named person, never "Easy Clinic Team". Empty means not yet known.' })),
    reviewedBy: ref('Reviewed by', 'authors'),
    country: ref('Country', 'countries'),
    lastUpdated: unknown(date('Last updated', { description: 'Empty means not yet known.' })),
    ...extension,
    heroStrip: optionalGroup(
      'Hero strip',
      {
        regulators: refs('Regulators', 'regulators'),
        ratings: flag('Ratings', { zodDefault: false }),
        study: flag('Study', { zodDefault: false }),
      },
      [...HERO_STRIP_PRESENT_IF],
      { description: 'Compliance and rating strip under the hero buttons.' },
    ),
    heroMedia: media('Hero media', { optional: true, publicPath: screenshots }),
    ctas: group('Calls to action', {
      primary: cta('Primary'),
      secondary: cta('Secondary', { optional: true }),
      whatsapp: text('WhatsApp message', { multiline: true, description: 'Prefilled message naming this page.' }),
    }),
    faqHeading: text('FAQ heading', { description: 'Empty: "Questions clinic owners ask".' }),
    sections: sections(KS_BLOCKS, FAMILY_BLOCKS[family]),
    faq: list(
      group('Question', {
        question: text('Question', { required: true }),
        answer: md('Answer', { required: true }),
        lastVerified: date('Last verified'),
      }),
      { label: 'FAQ', itemLabel: (props) => props.fields.question.value || 'Question' },
    ),
    links: group('Links', {
      hub: path('Hub', { description: 'Parent hub; drives the breadcrumbs.' }),
      related: list(
        group('Link', {
          href: path('Path', { required: true }),
          label: text('Label'),
          description: text('Description'),
        }),
        { label: 'Related', max: 9, itemLabel: (props) => props.fields.label.value || props.fields.href.value || 'Link' },
      ),
      relatedHeading: text('Related heading', { description: 'Empty: "Where to go next".' }),
    }),
    problems: optionalGroup(
      'Problem list',
      {
        eyebrow: text('Eyebrow'),
        heading: text('Heading'),
        headingAccent: text('Heading accent', { description: 'Words after the heading, set in blue italic.' }),
        intro: md('Intro'),
        items: list(
          group('Problem', {
            title: text('Title', { required: true }),
            body: md('Body', { required: true }),
            icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. receipt.' }),
            stat: text('Figure', { description: 'A sourced figure only, e.g. {fig:diagnostic-errors}. Leave empty when none is sourced.' }),
            statLabel: text('Figure label'),
          }),
          { label: 'Problems', max: 5, itemLabel: (props) => props.fields.title.value || 'Problem' },
        ),
      },
      [...PROBLEMS_PRESENT_IF],
      { description: 'A numbered list shown under the related links: heading on the left, items on the right.' },
    ),
    showcase: optionalGroup(
      'Showcase',
      {
        eyebrow: text('Eyebrow'),
        heading: text('Heading'),
        headingAccent: text('Heading accent', { description: 'Words after the heading, set in blue italic.' }),
        intro: md('Intro'),
        body: md('Body'),
        points: list(group('Point', { heading: text('Heading', { required: true }), body: md('Body', { required: true }) }), {
          label: 'Points',
          max: 3,
          description: 'Up to three short cards under the intro.',
          itemLabel: (props) => props.fields.heading.value || 'Point',
        }),
        tags: stringList('Tags', 'Tag', { description: 'Small pills under the cards.' }),
        media: media('Media', { optional: true, publicPath: screenshots }),
        orbit: optionalGroup(
          'Orbit diagram',
          {
            center: text('Centre label'),
            centerNote: text('Centre note'),
            nodes: stringList('Tiles', 'Tile', { max: 10, description: '3 to 10 short labels placed around the centre; fewer than 3 shows the media instead.' }),
          },
          [...ORBIT_PRESENT_IF],
          { description: 'Shown in place of the media when filled in.' },
        ),
      },
      [...SHOWCASE_PRESENT_IF],
      { description: 'A screenshot or video shown under the related links, above the FAQ.' },
    ),
    closing: optionalGroup(
      'Closing band',
      {
        eyebrow: text('Eyebrow', { description: 'Small pill above the heading.' }),
        heading: text('Heading'),
        headingAccent: text('Heading accent', { description: 'Words on their own line under the heading, in teal italic.' }),
        body: md('Body'),
        primary: cta('Primary', { required: false }),
        secondary: cta('Secondary', { optional: true }),
        stages: list(group('Stage', { title: text('Title', { required: true }), note: text('Note') }), {
          label: 'Stages',
          max: 5,
          description: 'A row under a rule, e.g. "Stage 1" with "Understand (weeks 1-3)".',
          itemLabel: (props) => props.fields.title.value || 'Stage',
        }),
      },
      [...CLOSING_PRESENT_IF],
    ),
    noindex: flag('Noindex', { zodDefault: false }),
    canonical: url('Canonical URL'),
    redirectFrom: list(path('Old URL', { required: true }), {
      label: 'Redirect from',
      description: 'Old URLs this page replaces; each becomes a 301 to this page.',
      itemLabel: (props) => props.value || 'Old URL',
    }),
    editorialPass: optionalGroup(
      'Editorial pass',
      {
        by: text('By'),
        on: date('On'),
        onlyUsCouldWrite: text('What only we could write', { min: 10, multiline: true }),
        readsMachineWritten: text('Where it reads machine-written', { min: 2, multiline: true }),
      },
      [...EDITORIAL_PASS_PRESENT_IF],
      { description: 'The editor’s two written answers (spec 6.5). Required to publish.' },
    ),
    claimsReview: optionalGroup('Claims review', { by: text('By'), on: date('On') }, [...CLAIMS_REVIEW_PRESENT_IF], {
      description: 'Sign-off for research or outcome claims written as text rather than study.yaml tokens.',
    }),
    schemaExtras: preserved(),
    notes: stringList('Editor notes', 'Note', { multiline: true, description: 'Sources and decisions. Never shown on the site.' }),
  };
}
