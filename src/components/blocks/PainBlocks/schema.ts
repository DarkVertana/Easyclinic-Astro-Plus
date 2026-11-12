import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';

export const schema = () =>
  block('painBlocks', {
    items: z
      .array(
        z.object({
          heading: z.string(),
          body: md,
          fix: md.optional(),
          href: internalPath.optional(),
          linkLabel: z.string().optional(),
        }),
      )
      .min(2)
      .max(4),
    /** default: the plain panels. checklist: each panel has a larger heading over a rule, and every bullet a
        white tick on a green (#00c554) disc in body-size text (the /emr-software-in-ghana/ problems section). */
    variant: z.enum(['default', 'checklist']).default('default'),
  });
