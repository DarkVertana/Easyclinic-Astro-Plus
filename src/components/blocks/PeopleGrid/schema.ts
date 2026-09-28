import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/**
 * The people who run the company (spec 5.19 /about-us/): photo, name and role from src/data/authors, and a short
 * background written for this page (docs/image-plan.md 3.2 item 4).
 */
export const schema = () =>
  block('peopleGrid', {
    items: z
      .array(
        z.object({
          author: reference('authors'),
          /** Plain, sourced statements only (page-writing rules): no unverified exits, awards or superlatives. */
          background: md,
        }),
      )
      .min(1)
      .max(12),
  });
