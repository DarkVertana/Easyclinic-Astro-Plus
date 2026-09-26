import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { BILLING_PERIODS, PLAN_IDS } from '../../../schemas/constants';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Worked total-cost examples (spec 5.12 item 6); totals are computed from the price data. */
export const schema = () =>
  block('costExamples', {
    currency: reference('prices'),
    period: z.enum(BILLING_PERIODS).default('annual'),
    examples: z
      .array(
        z.object({
          title: z.string(),
          doctors: z.number().int().positive(),
          locations: z.number().int().positive().default(1),
          plan: z.enum(PLAN_IDS),
          note: md.optional(),
        }),
      )
      .min(1)
      .max(4),
  });
