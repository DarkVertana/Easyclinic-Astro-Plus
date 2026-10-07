import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { TESTIMONIAL_LAYOUTS } from '../../../schemas/constants';

export const schema = () =>
  block('testimonialRow', {
    items: z.array(reference('testimonials')).min(1).max(9),
    /** single: one large quote alone (section 11); row: cards three to a row, up to three rows. */
    layout: z.enum(TESTIMONIAL_LAYOUTS).default('row'),
    usePullQuote: z.boolean().default(true),
  });
