import { defineBlock, flag, ref } from '../fields.ts';

/**
 * `contactCard` section (Zod: src/components/blocks/ContactCard/schema.ts): the local proof strip (spec 5.13
 * block 2) with the named contact, clients, cities, office and demo link, all read from the country file.
 */
export const contactCard = defineBlock('contactCard', 'Contact card', {
  country: ref('Country', 'countries', {
    required: true,
    description: 'Whose contact, office, cities and clients to show (src/data/countries). With no heading the card renders on its own, as in the hero.',
  }),
  showClients: flag('Show named clients', { zodDefault: true, description: "List the country's named clients on the card." }),
});
