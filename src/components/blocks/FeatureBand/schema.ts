import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** A dark band: a pill badge, a large heading, an optional intro, then two to six short features in a bordered grid. */
export const schema = () =>
  block('featureBand', {
    badge: z.string().optional(),
    items: z
      .array(z.object({ title: z.string().min(2), body: z.string().min(10) }))
      .min(2)
      .max(6),
  });
