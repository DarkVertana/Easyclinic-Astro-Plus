import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Team cards: photo, name, role, LinkedIn link and a short bio (/about-us/). */
export const schema = (ctx: SchemaContext) =>
  block('teamGrid', {
    members: z
      .array(
        z.object({
          image: ctx.image(),
          /** An illustration rather than a portrait: shown whole on a tint instead of cropped to fill. */
          illustration: z.boolean().default(false),
          name: z.string().min(2),
          role: z.string().min(2),
          linkedin: z.url().optional(),
          bio: md,
        }),
      )
      .min(1)
      .max(12),
  });
