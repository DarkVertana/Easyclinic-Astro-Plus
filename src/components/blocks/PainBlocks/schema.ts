import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';

export const schema = () =>
  block('painBlocks', {
    items: z
      .array(z.object({ heading: z.string(), body: md, fix: md.optional(), href: internalPath.optional(), linkLabel: z.string().optional() }))
      .min(2)
      .max(4),
  });
