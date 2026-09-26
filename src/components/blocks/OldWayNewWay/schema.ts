import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { media } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) => {
  const side = z.object({ title: z.string(), items: z.array(z.string()).min(2).max(6), media: media(ctx).optional() });
  return block('oldWayNewWay', { old: side, next: side });
};
