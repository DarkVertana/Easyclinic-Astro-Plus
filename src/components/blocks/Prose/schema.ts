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
    /** With an image: the body and aside stay as running text beside it, every bullet a green tick
        (the /emr-software-in-ghana/ why-adopt section), instead of the labelled rows and key-fact cells. */
    checklist: z.boolean().default(false),
    /** Text only (no image): the section has no bottom padding, so the next section's top padding is the only gap
        (the /emr-software-in-uae/ "how to reach the team" section). */
    flush: z.boolean().default(false),
  });
