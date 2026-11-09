import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { optionalCta } from '../../../schemas/fields';

/**
 * A grid of YouTube videos (/customers/ "Watch clinics talk about Easy Clinic"). Each card shows a thumbnail served
 * from this site with a play button; the player (youtube-nocookie.com, allowed by frame-src) loads only on click, so
 * the page ships no third-party frame or image in its HTML. Without JavaScript the card links to the video on YouTube.
 */
export const schema = (ctx: SchemaContext) =>
  block('videoGrid', {
    videos: z
      .array(
        z.object({
          /** Who is speaking, as the video is titled on YouTube. */
          title: z.string().min(1),
          /** The 11-character YouTube video id, e.g. EhGn45zbOoU from https://youtu.be/EhGn45zbOoU. */
          youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'A YouTube video id is 11 letters, digits, - or _'),
          /** A frame from the video, saved to this site. */
          thumbnail: ctx.image(),
          /** Running time as shown on YouTube, e.g. 1:14. */
          duration: z.string().optional(),
        }),
      )
      .min(1)
      .max(12),
    /** A link under the grid, e.g. to the YouTube channel. */
    link: optionalCta,
  });
