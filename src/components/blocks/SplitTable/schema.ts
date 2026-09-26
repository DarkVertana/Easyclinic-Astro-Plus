import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.7: what head office locks against what a branch adjusts; any two-sided comparison. */
export const schema = () =>
  block('splitTable', {
    left: z.object({ title: z.string(), icon: z.string().optional(), items: z.array(md).min(2).max(10) }),
    right: z.object({ title: z.string(), icon: z.string().optional(), items: z.array(md).min(2).max(10) }),
    note: md.optional(),
  });
