import { defineBlock, flag, refs } from '../fields.ts';

/**
 * `regulatorTable` section (Zod: src/components/blocks/RegulatorTable/schema.ts): the four-state compliance table
 * (spec 2.6), read from src/data/regulators.
 */
export const regulatorTable = defineBlock('regulatorTable', 'Regulator table', {
  countries: refs('Countries', 'countries', { description: 'Every regulator for these countries is listed, grouped by country in this order.' }),
  regulators: refs('Regulators', 'regulators', { description: 'Regulators to add one by one, on top of the countries above.' }),
  showClinicMustDo: flag('Show "What the clinic must do"', { zodDefault: true, description: 'The fourth column.' }),
  trustLink: flag('Link to the trust page', { zodDefault: true, description: 'A link to /trust/ under the table (never shown on /trust/ itself).' }),
});
