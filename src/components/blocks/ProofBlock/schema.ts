import { reference, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { PROOF_VARIANTS } from '../../../schemas/constants';
import { md, optionalCta, optionalMedia } from '../../../schemas/fields';

/**
 * One page-specific proof block (spec 2.4): study figures (from study.yaml), one named customer,
 * review badges with counts, or a captioned screenshot that repeats the claim.
 */
export const schema = (ctx: SchemaContext) =>
  block('proofBlock', {
    variant: z.enum(PROOF_VARIANTS),
    /** Figure ids from study.yaml, for the study variant. */
    figures: z.array(z.string()).default([]),
    testimonial: reference('testimonials').optional(),
    /** Fact ids from facts.yaml for rating badges, e.g. capterraRating with capterraReviews. */
    badges: z.array(z.object({ label: z.string(), rating: z.string(), count: z.string().optional(), href: z.url().optional() })).default([]),
    media: optionalMedia(ctx),
    body: md.optional(),
    link: optionalCta,
  });
