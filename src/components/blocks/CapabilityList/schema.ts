import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Numbered capabilities in labelled groups (e.g. Clinical, Operations), numbered straight through. */
export const schema = () =>
  block('capabilityList', {
    groups: z
      .array(
        z.object({
          label: z.string(),
          items: z.array(z.object({ title: z.string(), body: md })).min(1).max(8),
        }),
      )
      .min(1)
      .max(6),
  });
