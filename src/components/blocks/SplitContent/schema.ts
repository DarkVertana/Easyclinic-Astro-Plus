import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md, media, optionalCta } from '../../../schemas/fields';

/** Text with up to two buttons on the left, an image on the right (below lg, the image follows the text). */
export const schema = (ctx: SchemaContext) =>
  block('splitContent', {
    body: md,
    link: optionalCta,
    secondary: optionalCta,
    media: media(ctx),
    /** The heading centred above both columns instead of at the top of the text column. */
    centerHeading: z.boolean().default(false),
    /** The image in the left column on wide screens (below lg it still follows the text). */
    mediaFirst: z.boolean().default(false),
  });
