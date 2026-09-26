import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** "Choose X if" and "Choose Y if" lists (spec 7.3 DecisionMatrix, 5.16). */
export const schema = () =>
  block('decisionMatrix', {
    options: z.array(z.object({ title: z.string(), items: z.array(md).min(2).max(8), us: z.boolean().default(false) })).min(2).max(4),
  });
