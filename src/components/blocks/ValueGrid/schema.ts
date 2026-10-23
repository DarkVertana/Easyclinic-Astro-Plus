import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** A centred heading over numbered value cards, each with an icon (/about-us/). */
export const schema = () =>
  block('valueGrid', {
    items: z
      .array(
        z.object({
          /** A Lucide icon name registered in src/components/ui/icons.ts. */
          icon: z.string().default('circle-check'),
          title: z.string().min(2),
          body: md,
        }),
      )
      .min(2)
      .max(9),
  });
