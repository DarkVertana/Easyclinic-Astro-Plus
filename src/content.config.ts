// Schema revision 2026-10-08g (problems, showcase and closing fields, 9 related links). Astro rebuilds its content cache only when this
// file changes, not when src/schemas/* does: bump this line after a schema change so new fields reach the pages.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { routingLists } from './lib/content/routing-loader';
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
import {
  aiSchema,
  comparisonSchema,
  customersSchema,
  legalSchema,
  listicleSchema,
  companySchema,
  countryDemoSchema,
  countrySchema,
  curapilotSchema,
  featureSchema,
  glossarySchema,
  guideSchema,
  postSchema,
  homeSchema,
  hubSchema,
  kitchenSinkSchema,
  pricingSchema,
  solutionSchema,
  specialtySchema,
  trustSchema,
} from './schemas/families';

/* ---------- Page collections: one per family; one YAML file per page. ---------- */

const pages = (dir: string) => glob({ base: `./src/content/${dir}`, pattern: '**/*.yaml' });

const home = defineCollection({ loader: pages('home'), schema: homeSchema });
const pricing = defineCollection({ loader: pages('pricing'), schema: pricingSchema });
const countryPages = defineCollection({ loader: pages('country-pages'), schema: countrySchema });
const countryDemos = defineCollection({ loader: pages('country-demos'), schema: countryDemoSchema });
const company = defineCollection({ loader: pages('company'), schema: companySchema });
const kitchenSink = defineCollection({ loader: pages('kitchen-sink'), schema: kitchenSinkSchema });
const hubs = defineCollection({ loader: pages('hubs'), schema: hubSchema });
const features = defineCollection({ loader: pages('features'), schema: featureSchema });
const solutions = defineCollection({ loader: pages('solutions'), schema: solutionSchema });
const ai = defineCollection({ loader: pages('ai'), schema: aiSchema });
const curapilot = defineCollection({ loader: pages('curapilot'), schema: curapilotSchema });
const trust = defineCollection({ loader: pages('trust'), schema: trustSchema });
const specialties = defineCollection({ loader: pages('specialties'), schema: specialtySchema });
// Guides are MDX, one folder per guide (images sit beside it); the folder name is the URL slug.
const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '*/index.mdx', generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, '') }),
  schema: guideSchema,
});
// Blog posts: MDX like guides, one folder per post at a root slug (the live WordPress URLs are kept).
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '*/index.mdx', generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, '') }),
  schema: postSchema,
});

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

// Hand-written rows plus the rows scripts/posts-redirects.ts generates from the posts manifest (only for
// rows marketing has confirmed). One collection each, so every consumer sees both files.
const matchMode = z.enum(['exact', 'prefix', 'children']);

const redirects = defineCollection({
  loader: routingLists('from', ['src/data/redirects.yaml', 'src/data/redirects-posts.yaml']),
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
  loader: routingLists('path', ['src/data/gone.yaml', 'src/data/gone-posts.yaml']),
  schema: z.strictObject({
    id: z.string().optional(),
    path: z.string().startsWith('/'),
    match: matchMode.default('exact'),
    note: z.string().optional(),
  }),
});

// Order matters: references are validated while loading, so data collections come before the pages
// that reference them.
const comparisons = defineCollection({ loader: pages('comparisons'), schema: comparisonSchema });
const listicles = defineCollection({ loader: pages('listicles'), schema: listicleSchema });
const alternatives = defineCollection({ loader: pages('alternatives'), schema: listicleSchema });
const glossary = defineCollection({ loader: pages('glossary'), schema: glossarySchema });
const customers = defineCollection({ loader: pages('customers'), schema: customersSchema });
// Legal pages are MDX with an explicit `path` (/privacy/, /privacy/india/, /terms/).
const legal = defineCollection({ loader: glob({ base: './src/content/legal', pattern: '**/*.mdx' }), schema: legalSchema });

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
  hubs,
  features,
  solutions,
  ai,
  curapilot,
  trust,
  specialties,
  guides,
  posts,
  comparisons,
  listicles,
  alternatives,
  customers,
  legal,
  glossary,
};
