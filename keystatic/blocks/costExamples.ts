import { BILLING_PERIODS, PLAN_IDS } from '../../src/schemas/constants.ts';
import { choice, defineBlock, group, int, list, md, ref, text } from '../fields.ts';

/**
 * `costExamples` section (Zod: src/components/blocks/CostExamples/schema.ts): worked total-cost examples (spec
 * 5.12 item 6). Totals are computed from the price data, so an example gives only the clinic's shape.
 */
export const costExamples = defineBlock('costExamples', 'Cost examples', {
  currency: ref('Currency', 'prices', { required: true, description: 'The price file (src/data/prices) the totals are computed from.' }),
  period: choice('Billing period', BILLING_PERIODS, { zodDefault: 'annual' }, { description: 'Which per-doctor price the totals use.' }),
  examples: list(
    group('Example', {
      title: text('Title', { required: true, description: 'The clinic this example describes, e.g. "A two-doctor clinic".' }),
      doctors: int('Doctors', { required: true, min: 1, description: 'The total is doctors × the plan price per doctor per month.' }),
      locations: int('Locations', { min: 1, zodDefault: 1, description: 'Empty means 1.' }),
      plan: choice('Plan', PLAN_IDS, { required: true }, { description: 'Enterprise is quoted, so it shows "On quote" instead of a total.' }),
      note: md('Note'),
    }),
    { label: 'Examples', min: 1, max: 4, itemLabel: (props) => props.fields.title.value || 'Example' },
  ),
});
