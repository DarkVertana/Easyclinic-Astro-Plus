import { z } from 'astro/zod';
import { PERSONAS } from '../../../schemas/constants';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';

export const schema = () =>
  block('clinicTypes', {
    items: z
      .array(z.object({ persona: z.enum(PERSONAS), title: z.string(), body: md, example: md.optional(), href: internalPath }))
      .min(2)
      .max(5),
  });
