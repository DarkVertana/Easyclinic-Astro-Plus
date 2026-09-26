import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';

/** Spec 5.5: "A Tuesday with and without EasyClinic", a timed vertical timeline. */
export const schema = () =>
  block('dayTimeline', {
    beforeLabel: z.string().default('Without EasyClinic'),
    afterLabel: z.string().default('With EasyClinic'),
    entries: z
      .array(
        z.object({
          time: z.string().regex(/^\d{1,2}:\d{2}$/, { error: 'Use 24-hour time, e.g. 09:12' }),
          title: z.string(),
          before: md.optional(),
          after: md,
          href: internalPath.optional(),
        }),
      )
      .min(3)
      .max(10),
  });
