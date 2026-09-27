import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, optionalMedia } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('journeyDiagram', {
    steps: z
      .array(z.object({ label: z.string(), body: z.string(), href: internalPath.optional(), media: optionalMedia(ctx) }))
      .min(4)
      .max(12),
  });
