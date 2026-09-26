import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath } from '../../../schemas/fields';

export const schema = () =>
  block('contentCards', {
    items: z.array(z.object({ href: internalPath, label: z.string().optional(), description: z.string().optional() })).min(1).max(6),
  });
