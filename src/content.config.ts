import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import {
  authorSchema,
  countrySchema as countryDataSchema,
  factsSchema,
  integrationSchema,
  navSchema,
  planSchema,
  priceSchema,
  regulatorSchema,
  siteSchema,
  studySchema,
  testimonialSchema,
} from './schemas/data';
import { companySchema, countryDemoSchema, countrySchema, homeSchema, kitchenSinkSchema, pricingSchema } from './schemas/families';

/* ---------- Page collections: one per family; one YAML file per page. ---------- */

const pages = (dir: string) => glob({ base: `./src/content/${dir}`, pattern: '**/*.yaml' });

const home = defineCollection({ loader: pages('home'), schema: homeSchema });
const pricing = defineCollection({ loader: pages('pricing'), schema: pricingSchema });
const countryPages = defineCollection({ loader: pages('country-pages'), schema: countrySchema });
const countryDemos = defineCollection({ loader: pages('country-demos'), schema: countryDemoSchema });
const company = defineCollection({ loader: pages('company'), schema: companySchema });
const kitchenSink = defineCollection({ loader: pages('kitchen-sink'), schema: kitchenSinkSchema });

/* ---------- Shared facts (src/data). ---------- */

/** Entry ids come from the path relative to `base`, so each directory is its own base (ids: `in`, not `countries/in`). */
const data = (pattern: string, dir = '') => glob({ base: `./src/data${dir ? `/${dir}` : ''}`, pattern });

const site = defineCollection({ loader: data('site.yaml'), schema: siteSchema });
const facts = defineCollection({ loader: data('facts.yaml'), schema: factsSchema });
const study = defineCollection({ loader: data('study.yaml'), schema: studySchema });
const plans = defineCollection({ loader: data('plans.yaml'), schema: planSchema });
const nav = defineCollection({ loader: data('nav.yaml'), schema: navSchema });
const prices = defineCollection({ loader: data('*.yaml', 'prices'), schema: priceSchema });
const countries = defineCollection({ loader: data('*.yaml', 'countries'), schema: countryDataSchema });
const regulators = defineCollection({ loader: data('*.yaml', 'regulators'), schema: regulatorSchema });
const testimonials = defineCollection({ loader: data('*.yaml', 'testimonials'), schema: testimonialSchema });
const authors = defineCollection({ loader: data('*.yaml', 'authors'), schema: authorSchema });
const integrations = defineCollection({ loader: data('*.yaml', 'integrations'), schema: integrationSchema });

/* ---------- Routing data. ---------- */

/** Parses a YAML list and gives every row an id, as the file() loader requires. */
const listById = (key: string) => (text: string) =>
  (parseYaml(text) as Array<Record<string, unknown>>).map((row) => ({
    id: `${String(row.match ?? 'exact')}:${String(row[key])}`,
    ...row,
  }));

const matchMode = z.enum(['exact', 'prefix', 'children']);

const redirects = defineCollection({
  loader: file('src/data/redirects.yaml', { parser: listById('from') }),
  schema: z.strictObject({
    id: z.string().optional(),
    from: z.string().startsWith('/'),
    to: z.string().refine((v) => v.startsWith('/') || /^https:\/\//.test(v), { error: 'must be a path or https URL' }),
    match: matchMode.default('exact'),
    status: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
    fallback: z.string().startsWith('/').optional(),
    note: z.string().optional(),
  }),
});

const gone = defineCollection({
  loader: file('src/data/gone.yaml', { parser: listById('path') }),
  schema: z.strictObject({
    id: z.string().optional(),
    path: z.string().startsWith('/'),
    match: matchMode.default('exact'),
    note: z.string().optional(),
  }),
});

// Order matters: references are validated while loading, so data collections come before the pages
// that reference them.
export const collections = {
  site,
  facts,
  study,
  plans,
  nav,
  prices,
  countries,
  regulators,
  testimonials,
  authors,
  integrations,
  redirects,
  gone,
  home,
  pricing,
  countryPages,
  countryDemos,
  company,
  kitchenSink,
};
