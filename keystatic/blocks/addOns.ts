import { defineBlock, ref } from '../fields.ts';

/**
 * `addOns` section (Zod: src/components/blocks/AddOns/schema.ts). The add-ons and the plans they come with are
 * listed in src/data/plans.yaml; the prices come from the chosen currency's price file.
 */
export const addOns = defineBlock('addOns', 'Add-ons', {
  currency: ref('Currency', 'prices', {
    required: true,
    description: 'The price file (src/data/prices) the add-on prices come from. The add-ons themselves are listed in plans.yaml.',
  }),
});
