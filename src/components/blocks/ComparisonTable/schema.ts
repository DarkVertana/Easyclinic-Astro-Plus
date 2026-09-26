import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { isoDate, md } from '../../../schemas/fields';

const cell = z.object({
  value: md,
  /** Where a competitor fact comes from (spec 5.14, 5.16: every competitor cell is sourced and dated). */
  source: z.url().optional(),
  checkedOn: isoDate.optional(),
});

/**
 * Us-versus-them or ranked comparison table (spec 7.3 ComparisonTable). Competitor cells need a source and
 * a checked-on date; unknowns say "Not published" rather than "Check".
 */
export const schema = () =>
  block('comparisonTable', {
    columns: z.array(z.object({ name: z.string(), us: z.boolean().default(false) })).min(2).max(8),
    rows: z.array(z.object({ label: z.string(), cells: z.array(cell) })).min(2),
    note: md.optional(),
  }).superRefine((b, ctx) => {
    const { columns, rows } = b.value;
    rows.forEach((row, r) => {
      if (row.cells.length !== columns.length) {
        ctx.addIssue({ code: 'custom', path: ['value', 'rows', r], message: `Row "${row.label}" needs one cell per column` });
      }
      row.cells.forEach((c, i) => {
        if (/^\s*check\b/i.test(c.value)) {
          ctx.addIssue({ code: 'custom', path: ['value', 'rows', r, 'cells', i], message: '"Check" is not allowed; write the fact or "Not published" (spec 5.14)' });
        }
        if (!columns[i]?.us && (!c.source || !c.checkedOn) && !/^not published/i.test(c.value)) {
          ctx.addIssue({ code: 'custom', path: ['value', 'rows', r, 'cells', i], message: `Competitor cell for ${columns[i]?.name} needs a source URL and checkedOn date` });
        }
      });
    });
  });
