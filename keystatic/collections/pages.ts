/**
 * The 21 page collections: one Keystatic collection per Astro collection in src/content.config.ts, with the same
 * key, folder and format, so Keystatic ids equal Astro ids and `fields.relationship` stores what `reference()`
 * reads. YAML pages are one file per entry (`<dir>/<slug>.yaml`); guides and posts are folders
 * (`<dir>/<slug>/index.mdx`); legal pages are MDX files at any depth (`privacy/india.mdx`).
 */
import { collection } from '@keystatic/core';
import { POST_TOPICS, POST_TOPIC_LABELS } from '../../src/schemas/constants.ts';
import { choice, date, mdxBody, path, ref } from '../fields.ts';
import { pageFields } from '../page-base.ts';

/** The page schema without a family extension; country pages' required `country` still fits it. */
type PageSchema = ReturnType<typeof pageFields<{}>>;

const yamlPages = (label: string, dir: string, schema: PageSchema) =>
  collection({
    label,
    path: `src/content/${dir}/*`,
    format: { data: 'yaml' },
    slugField: 'linkLabel',
    columns: ['linkLabel', 'status', 'lastUpdated'],
    schema,
  });

const countryField = { country: ref('Country', 'countries', { required: true }) };

export const pageCollections = {
  home: yamlPages('Home', 'home', pageFields('home', {})),
  features: yamlPages('Features', 'features', pageFields('feature', {})),
  solutions: yamlPages('Solutions', 'solutions', pageFields('solution', {})),
  specialties: yamlPages('Specialties', 'specialties', pageFields('specialty', {})),
  countryPages: yamlPages('Country pages', 'country-pages', pageFields('country', countryField)),
  countryDemos: yamlPages('Country demo pages', 'country-demos', pageFields('countryDemo', countryField)),
  pricing: yamlPages('Pricing', 'pricing', pageFields('pricing', {})),
  hubs: yamlPages('Hubs', 'hubs', pageFields('hub', {})),
  ai: yamlPages('Cura AI', 'ai', pageFields('ai', {})),
  curapilot: yamlPages('CuraPilot', 'curapilot', pageFields('curapilot', {})),
  trust: yamlPages('Trust', 'trust', pageFields('trust', {})),
  customers: yamlPages('Customers', 'customers', pageFields('customers', {})),
  comparisons: yamlPages('Comparisons', 'comparisons', pageFields('comparison', {})),
  listicles: yamlPages('Listicles', 'listicles', pageFields('listicle', {})),
  alternatives: yamlPages('Alternatives', 'alternatives', pageFields('listicle', {})),
  company: yamlPages('Company', 'company', pageFields('company', {})),
  glossary: yamlPages('Glossary', 'glossary', pageFields('glossary', {})),
  /** Every block, for the tests. Left out of the sidebar. */
  kitchenSink: yamlPages('Kitchen sink', 'kitchen-sink', pageFields('kitchenSink', {})),

  guides: collection({
    label: 'Guides',
    path: 'src/content/guides/*/',
    format: { contentField: 'body' },
    entryLayout: 'content',
    slugField: 'linkLabel',
    columns: ['linkLabel', 'status', 'lastUpdated'],
    schema: pageFields('guide', { body: mdxBody() }, { mdx: true }),
  }),
  posts: collection({
    label: 'Blog posts',
    path: 'src/content/posts/*/',
    format: { contentField: 'body' },
    entryLayout: 'content',
    slugField: 'linkLabel',
    columns: ['linkLabel', 'status', 'lastUpdated'],
    schema: pageFields(
      'post',
      {
        originallyPublished: date('Originally published', { description: 'When the post first went live on WordPress (imported posts only).' }),
        topic: choice('Topic', POST_TOPICS, { required: true }, { labels: POST_TOPIC_LABELS, description: 'Where /blog/ lists the post.' }),
        owner: path('Owner page', { required: true, description: 'The landing page this post feeds, e.g. /features/billing/. Not /blog/.' }),
        body: mdxBody(),
      },
      { mdx: true },
    ),
  }),
  legal: collection({
    label: 'Legal',
    path: 'src/content/legal/**',
    format: { contentField: 'body' },
    entryLayout: 'content',
    slugField: 'linkLabel',
    columns: ['linkLabel', 'status', 'lastUpdated'],
    schema: pageFields('legal', { body: mdxBody() }, { mdx: true, nestedSlugs: true }),
  }),
};
