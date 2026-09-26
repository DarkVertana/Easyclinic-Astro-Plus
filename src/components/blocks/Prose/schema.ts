import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('prose', {
    body: md,
    aside: md.optional(),
    width: z.enum(['measure', 'wide']).default('measure'),
  });
