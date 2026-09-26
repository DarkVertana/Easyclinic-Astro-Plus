import { reference } from 'astro:content';
import { definePage } from './base';
import { BLOCK_NAMES, type BlockName } from './sections';

/** Section types each page family may use (spec 7.4 templates). */
const HOME: BlockName[] = ['personaRouter', 'oldWayNewWay', 'journeyDiagram', 'moduleGrid', 'proofBlock', 'regulatorStrip', 'testimonialRow', 'stepList', 'pricingCards', 'prose', 'contentCards', 'dataTable', 'featureRows', 'scopeBox'];
const PRICING: BlockName[] = ['pricingCards', 'planMatrix', 'addOns', 'costExamples', 'stepList', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'scopeBox', 'regulatorStrip'];
const COUNTRY: BlockName[] = ['contactCard', 'regulatorTable', 'regulatorStrip', 'countryMoney', 'clinicTypes', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'featureRows', 'painBlocks', 'stepList', 'moduleGrid', 'scopeBox'];
const COUNTRY_DEMO: BlockName[] = ['demoForm', 'contactCard', 'painBlocks', 'moduleGrid', 'dataTable', 'regulatorTable', 'regulatorStrip', 'testimonialRow', 'stepList', 'proofBlock', 'prose', 'featureRows'];
const COMPANY: BlockName[] = ['prose', 'demoForm', 'contactCard', 'dataTable', 'stepList', 'testimonialRow', 'proofBlock', 'moduleGrid', 'featureRows', 'contentCards'];

const CORE: BlockName[] = ['prose', 'featureRows', 'painBlocks', 'moduleGrid', 'proofBlock', 'testimonialRow', 'stepList', 'dataTable', 'scopeBox', 'contentCards', 'flowDiagram', 'splitTable', 'inlineCta'];
const FEATURE: BlockName[] = [...CORE, 'regulatorStrip', 'regulatorTable', 'rolesMatrix'];
const SOLUTION: BlockName[] = [...CORE, 'dayTimeline', 'rolesMatrix', 'regulatorStrip', 'pricingCards', 'clinicTypes'];
const HUB: BlockName[] = ['hubGrid', 'demoForm', 'journeyDiagram', 'moduleGrid', 'prose', 'proofBlock', 'testimonialRow', 'planMatrix', 'dataTable', 'personaRouter', 'featureRows', 'inlineCta'];
const AI: BlockName[] = [...CORE, 'studyCard', 'regulatorStrip'];
const TRUST: BlockName[] = [...CORE, 'regulatorTable', 'regulatorStrip', 'studyCard'];
const SPECIALTY: BlockName[] = [...CORE, 'dayTimeline'];
const COMPARISON: BlockName[] = ['comparisonTable', 'decisionMatrix', 'vendorList', 'sourceList', 'prose', 'painBlocks', 'stepList', 'dataTable', 'scopeBox', 'proofBlock', 'testimonialRow', 'inlineCta', 'featureRows'];
const CUSTOMERS: BlockName[] = ['testimonialGrid', 'proofBlock', 'prose', 'dataTable', 'featureRows', 'contentCards'];

export const homeSchema = definePage('home', HOME);
export const pricingSchema = definePage('pricing', PRICING);
export const countrySchema = definePage('country', COUNTRY, () => ({ country: reference('countries') }));
export const countryDemoSchema = definePage('countryDemo', COUNTRY_DEMO, () => ({ country: reference('countries') }));
export const companySchema = definePage('company', COMPANY);
export const hubSchema = definePage('hub', HUB);
export const featureSchema = definePage('feature', FEATURE);
export const solutionSchema = definePage('solution', SOLUTION);
export const aiSchema = definePage('ai', AI);
export const curapilotSchema = definePage('curapilot', AI);
export const trustSchema = definePage('trust', TRUST);
export const specialtySchema = definePage('specialty', SPECIALTY);
export const guideSchema = definePage('guide', ['inlineCta', 'dataTable', 'stepList', 'prose']);
export const comparisonSchema = definePage('comparison', COMPARISON);
export const listicleSchema = definePage('listicle', COMPARISON);
export const customersSchema = definePage('customers', CUSTOMERS);
export const legalSchema = definePage('legal', ['prose', 'dataTable']);
export const glossarySchema = definePage('glossary', ['glossaryList', 'prose']);
export const kitchenSinkSchema = definePage('kitchenSink', BLOCK_NAMES);
