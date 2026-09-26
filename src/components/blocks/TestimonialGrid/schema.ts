import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** Every testimonial, filterable by clinic type and country (spec 5.19 /customers). CSS-only filters. */
export const schema = () =>
  block('testimonialGrid', {
    filters: z.boolean().default(true),
    /** Leave empty to show every testimonial in src/data/testimonials. */
    only: z.array(z.string()).default([]),
  });
