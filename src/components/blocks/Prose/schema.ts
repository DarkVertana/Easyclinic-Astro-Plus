import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { PROSE_WIDTHS } from '../../../schemas/constants';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('prose', {
    body: md,
    aside: md.optional(),
    width: z.enum(PROSE_WIDTHS).default('measure'),
  });
