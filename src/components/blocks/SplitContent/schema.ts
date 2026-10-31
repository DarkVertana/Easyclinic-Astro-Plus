import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md, media, optionalCta, optionalMedia } from '../../../schemas/fields';

/** Text with up to two buttons on the left, an image on the right (below lg, the image follows the text). */
export const schema = (ctx: SchemaContext) =>
  block('splitContent', {
    body: md,
    link: optionalCta,
    secondary: optionalCta,
    media: media(ctx),
    /** A second image stacked under the first, in the same column (the /features/ logistics and lab sections). */
    media2: optionalMedia(ctx),
    /** The heading centred above both columns instead of at the top of the text column. */
    centerHeading: z.boolean().default(false),
    /** A word or phrase in the heading shown in the accent colour (as "flexible" on /features/). */
    headingAccent: z.string().optional(),
    /** The image in the left column on wide screens (below lg it still follows the text). */
    mediaFirst: z.boolean().default(false),
    /** Columns line up at the top on wide screens instead of being centred against each other. */
    alignTop: z.boolean().default(false),
    /** On wide screens the image stays in view (below the sticky header) while the text column scrolls. */
    stickyMedia: z.boolean().default(false),
    /** Short extras shown as check chips under the text, after a lead pill such as "And more...". */
    chips: z.array(z.string().min(2)).max(16).default([]),
    chipsLabel: z.string().optional(),
    /** A dense feature list: wider text column, smaller point headings and tighter spacing (as /solutions/solo-clinic/). */
    compact: z.boolean().default(false),
    /** A wider bordered screenshot beside a tight list of point headings (as /solutions/solo-clinic/ video consults);
        on phones the screenshot comes first. */
    featureList: z.boolean().default(false),
    /** On wide screens the image column takes 45% and the text 55% (as the /features/ EMR section). */
    narrowMedia: z.boolean().default(false),
    /** The image runs the full width above the text, and the points sit in two columns (the /features/ inventory section). */
    mediaTop: z.boolean().default(false),
    /** A wide, short screenshot sits centred on a soft tinted panel that matches the text's height on wide screens
        (the /features/insurance-claims/ payor setup and invoice sections). */
    mediaStage: z.boolean().default(false),
  });
