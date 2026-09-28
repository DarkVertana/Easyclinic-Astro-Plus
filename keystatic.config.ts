/**
 * Keystatic: an editing screen over the same content files the site builds from (docs/keystatic-design.md). The
 * Zod schemas in src/schemas stay the only authority on what is valid; these collections are a form over the same
 * files, in the same shape.
 *
 * Loaded only outside production, by integrations/keystatic-gate.ts: `pnpm dev` then /keystatic/ (local storage),
 * or a preview deployment with KEYSTATIC_STORAGE=github. This file is bundled into the browser, so it and
 * everything under keystatic/ import only pure modules (no astro:content, no astro/zod, no rules engine).
 */
import { config } from '@keystatic/core';
import { dataCollections } from './keystatic/collections/data.ts';
import { pageCollections } from './keystatic/collections/pages.ts';
import { singletons } from './keystatic/collections/singletons.ts';

// Replaced at build time by the gate's Vite `define` (the browser has no process.env). Unset means local. The
// typeof guard lets plain Node scripts (no import.meta.env) import this file too.
const hasEnv = typeof import.meta.env === 'object';
const storageKind: string | undefined = hasEnv ? import.meta.env.KEYSTATIC_STORAGE : undefined;
const githubRepo: string | undefined = hasEnv ? import.meta.env.KEYSTATIC_GITHUB_REPO : undefined;

const storage =
  storageKind === 'github' && githubRepo
    ? ({ kind: 'github', repo: githubRepo as `${string}/${string}`, branchPrefix: 'content/' } as const)
    : ({ kind: 'local' } as const);

export default config({
  storage,
  ui: {
    brand: { name: 'EasyClinic' },
    navigation: {
      Pages: [
        'home',
        'features',
        'solutions',
        'specialties',
        'countryPages',
        'countryDemos',
        'pricing',
        'hubs',
        'ai',
        'curapilot',
        'trust',
        'customers',
        'comparisons',
        'listicles',
        'alternatives',
        'company',
        'glossary',
      ],
      Articles: ['guides', 'posts', 'legal'],
      'Shared facts': ['facts', 'prices', 'countries', 'regulators', 'integrations', 'testimonials', 'authors', 'clients', 'study', 'plans'],
      Site: ['site', 'nav'],
    },
  },
  // kitchenSink stays a collection (the tests read it) but is not in the sidebar.
  collections: { ...pageCollections, ...dataCollections },
  singletons,
});
