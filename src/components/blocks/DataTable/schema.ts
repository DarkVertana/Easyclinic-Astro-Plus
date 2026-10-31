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
    /** default: the plain table. clean: a softer table with a tinted first column on desktop, one card per row below
        1024px (the /features/patient-engagement/ consent table). figures: a worked sum, numbers right aligned, stays a
        table on phones, the last two rows (a loss, then what is won back) in red and green figures (the /features/appointment-scheduling/
        no-show table). plans: a plan matrix; a cell starting Included, Add-on or Not included shows as a status chip,
        with the rest of the cell as a note under it (the /features/lab/ plan table). tiers: each row a plan column side by
        side: the first cell its name, a column headed "price" shown large, the last cell as its description
        (the /features/multi-location/ price table). */
    variant: z.enum(['default', 'clean', 'figures', 'plans', 'tiers']).default('default'),
  }).refine((b) => b.value.rows.every((row) => row.length === b.value.columns.length), {
    error: 'Every dataTable row needs one cell per column',
    path: ['value', 'rows'],
  });
