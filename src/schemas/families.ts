import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { definePage } from './base';
import { POST_TOPICS } from './constants';
import { internalPath, isoDate } from './fields';
import { FAMILY_BLOCKS as B } from './family-blocks';

/* Section types each page family may use (spec 7.4 templates): the lists live in family-blocks.ts, a pure
   module that keystatic.config.ts reads too. */

export const homeSchema = definePage('home', B.home);
export const pricingSchema = definePage('pricing', B.pricing);
export const countrySchema = definePage('country', B.country, () => ({ country: reference('countries') }));
export const countryDemoSchema = definePage('countryDemo', B.countryDemo, () => ({ country: reference('countries') }));
export const companySchema = definePage('company', B.company);
export const hubSchema = definePage('hub', B.hub);
export const featureSchema = definePage('feature', B.feature);
export const solutionSchema = definePage('solution', B.solution);
export const aiSchema = definePage('ai', B.ai);
export const curapilotSchema = definePage('curapilot', B.curapilot);
export const trustSchema = definePage('trust', B.trust);
export const specialtySchema = definePage('specialty', B.specialty);
export const guideSchema = definePage('guide', B.guide);
/** Blog posts (spec 3.6, 5.19): guide blocks, plus the /blog/ topic and the landing page that owns the post. */
export const postSchema = definePage('post', B.post, () => ({
  topic: z.enum(POST_TOPICS),
  owner: internalPath,
  originallyPublished: isoDate.optional(),
}));
export const comparisonSchema = definePage('comparison', B.comparison);
export const listicleSchema = definePage('listicle', B.listicle);
export const customersSchema = definePage('customers', B.customers);
export const legalSchema = definePage('legal', B.legal);
export const glossarySchema = definePage('glossary', B.glossary);
export const kitchenSinkSchema = definePage('kitchenSink', B.kitchenSink);
