import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.6: roles by permission. Cells: yes, no, or a short qualifier ("own patients only"). */
export const schema = () =>
  block('rolesMatrix', {
    roles: z.array(z.string()).min(2).max(7),
    rows: z
      .array(z.object({ permission: z.string(), cells: z.array(z.union([z.boolean(), z.string()])) }))
      .min(2),
    note: md.optional(),
  }).refine((b) => b.value.rows.every((r) => r.cells.length === b.value.roles.length), {
    error: 'Every rolesMatrix row needs one cell per role',
    path: ['value', 'rows'],
  });
