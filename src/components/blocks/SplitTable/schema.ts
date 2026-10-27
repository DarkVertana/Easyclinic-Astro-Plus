import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.7: what head office locks against what a branch adjusts; any two-sided comparison. */
const side = z.object({ title: z.string(), icon: z.string().optional(), items: z.array(md).min(2).max(10) });

export const schema = () =>
  block('splitTable', {
    left: side,
    right: side,
    /** Up to two more cards after left and right; with four, the cards sit two by two. */
    more: z.array(side).max(2).default([]),
    note: md.optional(),
  });
