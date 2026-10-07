import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { CHIP_FLAGS } from '../../../schemas/constants';
import { internalPath, optionalCta } from '../../../schemas/fields';

export const schema = () =>
  block('chipCloud', {
    items: z
      .array(
        z.object({
          label: z.string(),
          href: internalPath.optional(),
          /** Country flag in place of the check mark. */
          flag: z.enum(CHIP_FLAGS).optional(),
        }),
      )
      .min(2)
      .max(40),
    cta: optionalCta,
  });
