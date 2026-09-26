import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { PLAN_IDS } from '../../../schemas/constants';
import { block } from '../../../schemas/block-base';
import { cta, md, media } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('featureRows', {
    items: z
      .array(
        z.object({
          heading: z.string(),
          body: md,
          bullets: z.array(z.string()).default([]),
          media: media(ctx).optional(),
          plan: z.enum(PLAN_IDS).optional(),
          link: cta.optional(),
        }),
      )
      .min(1)
      .max(8),
  });
