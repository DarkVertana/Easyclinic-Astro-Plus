import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Generic responsive table: stacks into cards below 640px (spec 7.5). */
export const schema = () =>
  block('dataTable', {
    caption: z.string().optional(),
    columns: z.array(z.string()).min(2).max(6),
    rows: z.array(z.array(md)).min(1),
    note: md.optional(),
    /** The heading and intro run the full width instead of a reading measure. */
    wideIntro: z.boolean().default(false),
  }).refine((b) => b.value.rows.every((row) => row.length === b.value.columns.length), {
    error: 'Every dataTable row needs one cell per column',
    path: ['value', 'rows'],
  });
