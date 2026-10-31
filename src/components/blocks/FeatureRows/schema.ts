import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { PLAN_IDS } from '../../../schemas/constants';
import { block } from '../../../schemas/block-base';
import { md, optionalCta, optionalMedia } from '../../../schemas/fields';

export const schema = (ctx: SchemaContext) =>
  block('featureRows', {
    items: z
      .array(
        z.object({
          heading: z.string(),
          icon: z.string().optional(),
          body: md,
          bullets: z.array(z.string()).default([]),
          media: optionalMedia(ctx),
          plan: z.enum(PLAN_IDS).optional(),
          link: optionalCta,
        }),
      )
      .min(1)
      .max(8),
    /** auto: rows with media, or a card grid without; list: ruled rows, heading | text and link; bento: icon cards, three across then wider cards filling the last row; grid: two across, split by rules, no boxes (/features/patient-engagement/). */
    layout: z.enum(['auto', 'list', 'bento', 'grid']).default('auto'),
    /** The heading and intro run the full container width instead of the reading measure. */
    wideIntro: z.boolean().default(false),
  });
