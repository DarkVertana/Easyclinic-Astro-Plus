import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** A bento grid of photos that open in a lightbox (/about-us/ team gallery). */
export const schema = (ctx: SchemaContext) =>
  block('photoGallery', {
    photos: z
      .array(
        z.object({
          image: ctx.image(),
          alt: z.string().min(3),
          /** Tile size on wide screens: large is 2 by 2, wide is 2 across, normal is 1 tile. */
          size: z.enum(['normal', 'wide', 'large']).default('normal'),
        }),
      )
      .min(2)
      .max(24),
  });
