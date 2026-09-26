import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath } from '../../../schemas/fields';

/**
 * Hub listings (spec 2.9: every hub links down to all its leaves). Lists pages from the registry under a
 * path prefix, grouped; items not built yet render in preview only.
 */
export const schema = () =>
  block('hubGrid', {
    groups: z
      .array(
        z.object({
          title: z.string().optional(),
          items: z.array(z.object({ href: internalPath, label: z.string().optional(), description: z.string().optional(), icon: z.string().optional() })).min(1),
        }),
      )
      .min(1),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  });
