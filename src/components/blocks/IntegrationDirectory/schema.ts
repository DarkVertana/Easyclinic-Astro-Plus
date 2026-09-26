import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { INTEGRATION_CATEGORIES } from '../../../schemas/constants';

/**
 * The integrations directory (spec 5.17 /integrations): every entry in src/data/integrations, grouped by
 * category, each with its status and as-of date, filterable by country with CSS only. Statuses live in the
 * data, so country pages and this directory can never disagree.
 */
export const schema = () =>
  block('integrationDirectory', {
    /** Categories to show, in order. Leave empty for every category that has an entry. */
    categories: z.array(z.enum(INTEGRATION_CATEGORIES)).default([]),
    /** Limit to integrations used in these countries (codes such as `ke`); entries for every country always show. */
    countries: z.array(z.string()).default([]),
    filters: z.boolean().default(true),
  });
