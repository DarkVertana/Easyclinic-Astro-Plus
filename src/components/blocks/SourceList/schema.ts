import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { isoDate } from '../../../schemas/fields';

/** Sources section for listicles and comparisons (spec 5.14 item 8, 5.16 item 7). */
export const schema = () =>
  block('sourceList', {
    items: z.array(z.object({ label: z.string(), url: z.url(), accessed: isoDate })).min(1),
  });
