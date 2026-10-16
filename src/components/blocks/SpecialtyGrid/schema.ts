import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** Specialities in labelled groups: a heading over a rule, then a ticked list. */
export const schema = () =>
  block('specialtyGrid', {
    groups: z
      .array(z.object({ label: z.string().min(2), items: z.array(z.string().min(2)).min(1).max(12) }))
      .min(1)
      .max(12),
  });
