import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

export const schema = () =>
  block('testimonialRow', {
    items: z.array(reference('testimonials')).min(1).max(3),
    /** single: one large quote alone (section 11); row: up to three cards. */
    layout: z.enum(['row', 'single']).default('row'),
    usePullQuote: z.boolean().default(true),
  });
