/**
 * Section types: every block name, and the blocks each page family may use (spec 7.4 templates).
 *
 * A pure module (no Astro or Zod imports) so keystatic.config.ts, which is bundled into the browser, reads the
 * same lists as the Zod schemas in families.ts. sections.ts asserts at type level that BLOCK_NAMES matches its
 * BLOCK_SCHEMAS registry, so a block cannot be added to one and not the other.
 */
import type { Family } from './constants.ts';

/** Every section type, in the order of BLOCK_SCHEMAS in sections.ts. */
export const BLOCK_NAMES = [
  'addOns',
  'glossaryList',
  'postIndex',
  'comparisonTable',
  'decisionMatrix',
  'sourceList',
  'testimonialGrid',
  'integrationDirectory',
  'vendorList',
  'dayTimeline',
  'flowDiagram',
  'hubGrid',
  'inlineCta',
  'rolesMatrix',
  'splitTable',
  'studyCard',
  'clinicTypes',
  'contactCard',
  'contentCards',
  'costExamples',
  'countryMoney',
  'dataTable',
  'demoForm',
  'featureRows',
  'journeyDiagram',
  'moduleGrid',
  'oldWayNewWay',
  'painBlocks',
  'personaRouter',
  'planMatrix',
  'pricingCards',
  'proofBlock',
  'prose',
  'regulatorStrip',
  'regulatorTable',
  'scopeBox',
  'stepList',
  'testimonialRow',
] as const;
export type BlockName = (typeof BLOCK_NAMES)[number];

type Blocks = readonly BlockName[];

const HOME: Blocks = ['personaRouter', 'oldWayNewWay', 'journeyDiagram', 'moduleGrid', 'proofBlock', 'regulatorStrip', 'testimonialRow', 'stepList', 'pricingCards', 'prose', 'contentCards', 'dataTable', 'featureRows', 'scopeBox'];
const PRICING: Blocks = ['pricingCards', 'planMatrix', 'addOns', 'costExamples', 'stepList', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'scopeBox', 'regulatorStrip'];
const COUNTRY: Blocks = ['contactCard', 'regulatorTable', 'regulatorStrip', 'countryMoney', 'clinicTypes', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'featureRows', 'painBlocks', 'stepList', 'moduleGrid', 'scopeBox'];
const COUNTRY_DEMO: Blocks = ['demoForm', 'contactCard', 'painBlocks', 'moduleGrid', 'dataTable', 'regulatorTable', 'regulatorStrip', 'testimonialRow', 'stepList', 'proofBlock', 'prose', 'featureRows'];
const COMPANY: Blocks = ['prose', 'demoForm', 'contactCard', 'dataTable', 'stepList', 'testimonialRow', 'proofBlock', 'moduleGrid', 'featureRows', 'contentCards'];

const CORE: Blocks = ['prose', 'featureRows', 'painBlocks', 'moduleGrid', 'proofBlock', 'testimonialRow', 'stepList', 'dataTable', 'scopeBox', 'contentCards', 'flowDiagram', 'splitTable', 'inlineCta'];
const FEATURE: Blocks = [...CORE, 'regulatorStrip', 'regulatorTable', 'rolesMatrix'];
const SOLUTION: Blocks = [...CORE, 'dayTimeline', 'rolesMatrix', 'regulatorStrip', 'pricingCards', 'clinicTypes'];
const HUB: Blocks = ['hubGrid', 'demoForm', 'journeyDiagram', 'moduleGrid', 'prose', 'proofBlock', 'testimonialRow', 'planMatrix', 'dataTable', 'personaRouter', 'featureRows', 'inlineCta', 'postIndex'];
const AI: Blocks = [...CORE, 'studyCard', 'regulatorStrip'];
const TRUST: Blocks = [...CORE, 'regulatorTable', 'regulatorStrip', 'studyCard', 'integrationDirectory', 'demoForm'];
const SPECIALTY: Blocks = [...CORE, 'dayTimeline'];
const COMPARISON: Blocks = ['comparisonTable', 'decisionMatrix', 'vendorList', 'sourceList', 'prose', 'painBlocks', 'stepList', 'dataTable', 'scopeBox', 'proofBlock', 'testimonialRow', 'inlineCta', 'featureRows'];
const CUSTOMERS: Blocks = ['testimonialGrid', 'proofBlock', 'prose', 'dataTable', 'featureRows', 'contentCards'];
/** MDX families: no block with media, because a relative image path would differ from the YAML pages'. */
const GUIDE: Blocks = ['inlineCta', 'dataTable', 'stepList', 'prose'];

/** Allowed section types per page family. The kitchen sink uses every block, so the tests cover them all. */
export const FAMILY_BLOCKS = {
  home: HOME,
  pricing: PRICING,
  country: COUNTRY,
  countryDemo: COUNTRY_DEMO,
  company: COMPANY,
  hub: HUB,
  feature: FEATURE,
  solution: SOLUTION,
  ai: AI,
  curapilot: AI,
  trust: TRUST,
  specialty: SPECIALTY,
  guide: GUIDE,
  post: GUIDE,
  comparison: COMPARISON,
  listicle: COMPARISON,
  customers: CUSTOMERS,
  legal: ['prose', 'dataTable'],
  glossary: ['glossaryList', 'prose'],
  kitchenSink: BLOCK_NAMES,
} as const satisfies Partial<Record<Family, Blocks>>;

/** Families that have a page schema (and so a content collection). */
export type PageFamily = keyof typeof FAMILY_BLOCKS;
