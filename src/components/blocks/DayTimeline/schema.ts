import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';
import { TIME_24H } from '../../../schemas/patterns';

/** Spec 5.5: "A Tuesday with and without Easy Clinic", a timed vertical timeline. */
export const schema = () =>
  block('dayTimeline', {
    beforeLabel: z.string().default('Without Easy Clinic'),
    afterLabel: z.string().default('With Easy Clinic'),
    entries: z
      .array(
        z.object({
          time: z.string().regex(TIME_24H, { error: 'Use 24-hour time, e.g. 09:12' }),
          title: z.string(),
          before: md.optional(),
          after: md,
          href: internalPath.optional(),
        }),
      )
      .min(3)
      .max(10),
  });
