import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** A dark band: a pill badge, a large heading, then two to four short features in a bordered row. */
export const schema = () =>
  block('featureBand', {
    badge: z.string().optional(),
    items: z
      .array(z.object({ title: z.string().min(2), body: z.string().min(10) }))
      .min(2)
      .max(4),
  });
