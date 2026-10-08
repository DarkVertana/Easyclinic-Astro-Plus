import type { SchemaContext } from 'astro:content';
import { block } from '../../../schemas/block-base';
import { md, media, optionalCta } from '../../../schemas/fields';

/** Text with up to two buttons on the left, an image on the right (below lg, the image follows the text). */
export const schema = (ctx: SchemaContext) =>
  block('splitContent', {
    body: md,
    link: optionalCta,
    secondary: optionalCta,
    media: media(ctx),
  });
