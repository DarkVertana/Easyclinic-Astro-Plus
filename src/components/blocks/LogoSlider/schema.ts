import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** A centred heading over a row of organisation logos that slides, with arrows (/about-us/). */
export const schema = (ctx: SchemaContext) =>
  block('logoSlider', {
    logos: z
      .array(z.object({ image: ctx.image(), name: z.string().min(2) }))
      .min(2)
      .max(30),
  });
