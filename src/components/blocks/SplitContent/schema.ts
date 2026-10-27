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
    /** Columns line up at the top on wide screens instead of being centred against each other. */
    alignTop: z.boolean().default(false),
    /** On wide screens the image stays in view (below the sticky header) while the text column scrolls. */
    stickyMedia: z.boolean().default(false),
    /** Short extras shown as check chips under the text, after a lead pill such as "And more...". */
    chips: z.array(z.string().min(2)).max(12).default([]),
    chipsLabel: z.string().optional(),
    /** A dense feature list: wider text column, smaller point headings and tighter spacing (as /solutions/solo-clinic/). */
    compact: z.boolean().default(false),
    /** A wider bordered screenshot beside a tight list of point headings (as /solutions/solo-clinic/ video consults);
        on phones the screenshot comes first. */
    featureList: z.boolean().default(false),
  });
