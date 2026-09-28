import { defineBlock, ref, refs } from '../fields.ts';

/**
 * `logoStrip` section (Zod: src/components/blocks/LogoStrip/schema.ts): client logos from src/data/clients, with no
 * links, count or rating (docs/image-plan.md 7.2). Production shows only clients whose logo permission is Yes.
 */
export const logoStrip = defineBlock('logoStrip', 'Client logos', {
  clients: refs('Clients', 'clients', {
    description: 'From src/data/clients, in the order shown. Leave empty to show every client, by name.',
  }),
  country: ref('Country', 'countries', {
    description: 'Only clients from this country (e.g. India on /indiademo/). Leave empty for every country.',
  }),
});
