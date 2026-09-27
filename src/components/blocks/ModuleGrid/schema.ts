import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, optionalMedia } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('moduleGrid', {
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    items: z
      .array(
        z.object({
          title: z.string(),
          outcome: z.string(),
          href: internalPath.optional(),
          icon: z.string().optional(),
          media: optionalMedia(ctx),
          links: z.array(z.object({ label: z.string(), href: internalPath })).default([]),
        }),
      )
      .min(2)
      .max(12),
  });
