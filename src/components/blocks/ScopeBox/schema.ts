import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { SCOPE_VARIANTS } from '../../../schemas/constants';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('scopeBox', {
    variant: z.enum(SCOPE_VARIANTS).default('isNot'),
    items: z.array(md).min(1),
    note: md.optional(),
  });
