import { reference } from 'astro:content';
import { definePage } from './base';
import { BLOCK_NAMES, type BlockName } from './sections';

/** Section types each page family may use (spec 7.4 templates). */
const HOME: BlockName[] = ['personaRouter', 'oldWayNewWay', 'journeyDiagram', 'moduleGrid', 'proofBlock', 'regulatorStrip', 'testimonialRow', 'stepList', 'pricingCards', 'prose', 'contentCards', 'dataTable', 'featureRows', 'scopeBox'];
const PRICING: BlockName[] = ['pricingCards', 'planMatrix', 'addOns', 'costExamples', 'stepList', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'scopeBox', 'regulatorStrip'];
const COUNTRY: BlockName[] = ['contactCard', 'regulatorTable', 'regulatorStrip', 'countryMoney', 'clinicTypes', 'testimonialRow', 'proofBlock', 'prose', 'dataTable', 'featureRows', 'painBlocks', 'stepList', 'moduleGrid', 'scopeBox'];
const COUNTRY_DEMO: BlockName[] = ['demoForm', 'contactCard', 'painBlocks', 'moduleGrid', 'dataTable', 'regulatorTable', 'regulatorStrip', 'testimonialRow', 'stepList', 'proofBlock', 'prose', 'featureRows'];
const COMPANY: BlockName[] = ['prose', 'demoForm', 'contactCard', 'dataTable', 'stepList', 'testimonialRow', 'proofBlock', 'moduleGrid', 'featureRows', 'contentCards'];

export const homeSchema = definePage('home', HOME);
export const pricingSchema = definePage('pricing', PRICING);
export const countrySchema = definePage('country', COUNTRY, () => ({ country: reference('countries') }));
export const countryDemoSchema = definePage('countryDemo', COUNTRY_DEMO, () => ({ country: reference('countries') }));
export const companySchema = definePage('company', COMPANY);
export const kitchenSinkSchema = definePage('kitchenSink', BLOCK_NAMES);
