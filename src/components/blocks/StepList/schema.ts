import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('stepList', {
    steps: z.array(z.object({ title: z.string(), meta: z.string().optional(), body: md })).min(2).max(10),
    note: md.optional(),
    /** cards: one bordered card per step. timeline: no cards; numbered steps joined by a line, three across on
        wide screens and a single vertical line on phones, under a heading that runs the full width
        (the /emr-software-in-ghana/ daily-practice section). */
    layout: z.enum(['cards', 'timeline']).default('cards'),
  });
