import { INTEGRATION_CATEGORIES, type IntegrationCategory } from '../../src/schemas/constants.ts';
import { choices, defineBlock, flag, stringList } from '../fields.ts';

/** The headings IntegrationDirectory.astro gives each category. */
const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payments: 'Payments',
  insurance: 'Insurance and claims',
  'national-health': 'National health systems',
  labs: 'Labs and devices',
  accounting: 'Accounting and tax',
  bi: 'Reports and BI',
  messaging: 'Messaging',
  emr: 'Hospital systems and other EMRs',
};

/**
 * `integrationDirectory` section (Zod: src/components/blocks/IntegrationDirectory/schema.ts): every entry in
 * src/data/integrations, grouped by category, each with its status and as-of date. Statuses live in the data, so
 * country pages and this directory can never disagree.
 */
export const integrationDirectory = defineBlock('integrationDirectory', 'Integration directory', {
  categories: choices('Categories', INTEGRATION_CATEGORIES, {
    labels: CATEGORY_LABELS,
    description:
      'Categories to show, in the order ticked (untick and tick again to move one to the end). Leave all unticked for every category that has an entry.',
  }),
  countries: stringList('Countries', 'Country code', {
    description: 'Limit to integrations used in these countries (codes such as ke). Integrations for every country always show. Leave empty for all.',
  }),
  filters: flag('Country filter', { zodDefault: true, description: 'Offer a country filter when the directory covers more than one country.' }),
});
