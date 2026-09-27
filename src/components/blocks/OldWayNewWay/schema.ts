import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { optionalMedia } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) => {
  const side = z.object({ title: z.string(), items: z.array(z.string()).min(2).max(6), media: optionalMedia(ctx) });
  return block('oldWayNewWay', { old: side, next: side });
};
