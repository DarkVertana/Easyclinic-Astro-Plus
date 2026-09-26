import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.8 and 5.11: a process drawn as connected steps (claim journey, registration to submission). */
export const schema = () =>
  block('flowDiagram', {
    steps: z.array(z.object({ label: z.string(), body: md.optional(), check: z.string().optional() })).min(3).max(10),
    /** Optional per-country examples under the flow, e.g. the payers each market uses. */
    examples: z.array(z.object({ country: z.string(), body: md })).default([]),
  });
