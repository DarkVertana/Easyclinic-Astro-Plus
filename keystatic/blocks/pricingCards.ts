import { cta, defineBlock, flag, ref } from '../fields.ts';

/**
 * `pricingCards` section (Zod: src/components/blocks/PricingCards/schema.ts): one card per plan in
 * src/data/plans.yaml, priced from the price files.
 */
export const pricingCards = defineBlock('pricingCards', 'Pricing cards', {
  currency: ref('Currency', 'prices', {
    required: true,
    description: 'The price file shown (src/data/prices). With the currency switcher on, this is the currency selected first.',
  }),
  switcher: flag('Currency switcher', {
    zodDefault: false,
    description: 'Offer every currency (the main pricing page). Country pricing pages show one static currency.',
  }),
  showConditions: flag('Show plan conditions', { zodDefault: true, description: 'The conditions list from plans.yaml, shown above the cards.' }),
  planCta: Object.assign(cta('Plan button'), {
    description: 'The button on each priced plan (Professional, Premium). {plan} in the label becomes the plan name: "Start with {plan}" reads "Start with Premium".',
  }),
  enterpriseCta: Object.assign(cta('Enterprise button'), { description: 'The button on plans quoted rather than priced (Enterprise).' }),
});
