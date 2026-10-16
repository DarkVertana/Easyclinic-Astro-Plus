import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** A move to Easy Clinic: numbered steps, a strip of timings, what comes across from each old system, and a note. */
export const schema = () =>
  block('migrationPlan', {
    steps: z.array(z.object({ title: z.string().min(2), body: z.string().min(10) })).min(2).max(5),
    stats: z.array(z.object({ value: z.string().min(1), label: z.string().min(2) })).max(4).default([]),
    systems: z
      .array(z.object({ name: z.string().min(2), comesAcross: z.string().min(5), lookAt: z.string().min(5) }))
      .max(10)
      .default([]),
    note: md.optional(),
  });
