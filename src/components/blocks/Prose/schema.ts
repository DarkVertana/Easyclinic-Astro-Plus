import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { PROSE_WIDTHS } from '../../../schemas/constants';
import { md, optionalCta, optionalMedia } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('prose', {
    body: md,
    aside: md.optional(),
    width: z.enum(PROSE_WIDTHS).default('measure'),
    /** Buttons under the body, left aligned: `link` is the main one, `secondary` the outlined one. */
    link: optionalCta,
    secondary: optionalCta,
    /** An image on the right on wide screens, with the aside as a summary card under the text. */
    media: optionalMedia(ctx),
  });
