import { z } from 'astro/zod';
import { PERSONAS } from '../../../schemas/constants';
import { block } from '../../../schemas/block-base';
import { internalPath } from '../../../schemas/fields';

export const schema = () =>
  block('personaRouter', {
    items: z
      .array(
        z.object({
          persona: z.enum(PERSONAS),
          title: z.string(),
          body: z.string(),
          href: internalPath,
          icon: z.string().optional(),
        }),
      )
      .min(2)
      .max(6),
  });
