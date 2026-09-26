import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('scopeBox', {
    variant: z.enum(['notFor', 'isNot', 'limits']).default('isNot'),
    items: z.array(md).min(1),
    note: md.optional(),
  });
