import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** A heading beside a short paragraph, over a row of large figures with labels (/about-us/). */
export const schema = () =>
  block('statBand', {
    body: md.optional(),
    stats: z
      .array(
        z.object({
          /** The figure as shown; a {fact:...} token keeps it in step with src/data/facts.yaml. */
          value: z.string().min(1),
          label: z.string().min(2),
        }),
      )
      .min(2)
      .max(4),
    /** Small print under the figures, e.g. how they were measured. */
    note: md.optional(),
  });
