import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** A photo beside a short stack of icon cards, e.g. vision and mission (/about-us/). */
export const schema = (ctx: SchemaContext) =>
  block('purposeSplit', {
    image: ctx.image(),
    imageAlt: z.string().min(1),
    items: z
      .array(
        z.object({
          /** A Lucide icon name registered in src/components/ui/icons.ts. */
          icon: z.string().default('circle-check'),
          title: z.string().min(2),
          body: md,
        }),
      )
      .min(1)
      .max(4),
  });
