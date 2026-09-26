import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('stepList', {
    steps: z.array(z.object({ title: z.string(), meta: z.string().optional(), body: md })).min(2).max(10),
    note: md.optional(),
  });
