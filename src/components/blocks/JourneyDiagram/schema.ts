import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, media } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('journeyDiagram', {
    steps: z
      .array(z.object({ label: z.string(), body: z.string(), href: internalPath.optional(), media: media(ctx).optional() }))
      .min(4)
      .max(12),
  });
