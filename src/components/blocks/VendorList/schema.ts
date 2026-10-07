import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { isoDate, md } from '../../../schemas/fields';
import { SLUG_ID } from '../../../schemas/patterns';

/**
 * Per-vendor sections for listicles (spec 5.14: 120 to 180 words each, pros and cons, Easy Clinic treated
 * with the same structure). Competitor facts carry a source and a checked-on date, as ComparisonTable cells do;
 * unknowns say "Not published" rather than "Check".
 */
export const schema = () =>
  block('vendorList', {
    vendors: z
      .array(
        z.object({
          id: z.string().regex(SLUG_ID),
          name: z.string(),
          rank: z.number().int().positive().optional(),
          us: z.boolean().default(false),
          bestFor: z.string(),
          url: z.url().optional(),
          body: md,
          pros: z.array(md).min(1).max(5),
          cons: z.array(md).min(1).max(5),
          facts: z.array(z.object({ label: z.string(), value: md, source: z.url().optional(), checkedOn: isoDate.optional() })).default([]),
        }),
      )
      .min(2)
      .max(10),
  }).superRefine((b, ctx) => {
    b.value.vendors.forEach((v, n) => {
      v.facts.forEach((f, i) => {
        const path = ['value', 'vendors', n, 'facts', i];
        if (/^\s*check\b/i.test(f.value)) ctx.addIssue({ code: 'custom', path, message: '"Check" is not allowed; write the fact or "Not published" (spec 5.14)' });
        if (!v.us && (!f.source || !f.checkedOn) && !/^not published/i.test(f.value)) {
          ctx.addIssue({ code: 'custom', path, message: `${v.name}: "${f.label}" needs a source URL and checkedOn date` });
        }
      });
    });
  });
