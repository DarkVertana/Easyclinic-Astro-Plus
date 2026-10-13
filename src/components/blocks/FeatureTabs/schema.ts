import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md, optionalCta, optionalMedia } from '../../../schemas/fields';

/** Product areas as tabs: one panel each with a body, a list of key capabilities and a screenshot. */
export const schema = (ctx: SchemaContext) =>
  block('featureTabs', {
    tabs: z
      .array(
        z.object({
          label: z.string(),
          /** Lucide icon name from src/components/ui/icons.ts. */
          icon: z.string().optional(),
          body: md,
          capabilitiesLabel: z.string().default('Key capabilities'),
          capabilities: z
            .array(
              z.object({
                label: z.string(),
                /** Lucide icon name from src/components/ui/icons.ts. Default: a tick. */
                icon: z.string().optional(),
              }),
            )
            .min(1)
            .max(8),
          media: optionalMedia(ctx),
          link: optionalCta,
        }),
      )
      .min(2)
      .max(6),
  });
