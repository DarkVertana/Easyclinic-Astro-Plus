import { defineBlock, md, ref } from '../fields.ts';

/**
 * `countryMoney` section (Zod: src/components/blocks/CountryMoney/schema.ts): spec 5.13 block 4, the local price
 * card, payment rails, tax invoicing and payers. Everything but the payers note comes from the data files.
 */
export const countryMoney = defineBlock('countryMoney', 'Country prices and payments', {
  country: ref('Country', 'countries', { required: true, description: 'Payment rails, tax invoicing and insurers come from this country file (src/data/countries).' }),
  currency: ref('Currency', 'prices', { required: true, description: 'Plan prices and the tax note come from this price file (src/data/prices).' }),
  payersNote: md('Payers note', { description: "Shown under the country's insurers: how payers and claims work there." }),
});
