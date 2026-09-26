import { defineConfig, envField, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import vercelRoutes from './integrations/vercel-routes.ts';

export default defineConfig({
  site: 'https://www.easyclinic.io',
  // The live site and the staging audit use trailing slashes on every URL (audit, overriding spec 3.2).
  trailingSlash: 'always',
  // Astro 7 defaults to 'jsx', which strips whitespace between inline elements and glues words in copy.
  compressHTML: true,
  prerenderConflictBehavior: 'error',
  // Inline the (small, purged) CSS: one fewer render-blocking request on slow mobile data, which is
  // what most visitors land on from search (spec 7.1: LCP under 2.0 s).
  build: { inlineStylesheets: 'always' },
  adapter: vercel(),
  // Redirects are not configured here: see integrations/vercel-routes.ts (withastro/astro#18073).
  integrations: [mdx(), vercelRoutes()],
  vite: { plugins: [tailwindcss()] },
  image: { layout: 'constrained', responsiveStyles: true },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      // Static weights: far smaller than the variable file, and the site only uses regular and semibold.
      weights: [400, 600],
      styles: ['normal'],
      // Latin only: loading latin-ext for ₹ and ₦ re-painted the LCP paragraph ~450 ms late on slow 4G.
      // Those glyphs render from the metric-matched fallback. Follow-up: a custom subset (fonttools)
      // with Latin + ₹ + ₦ + Latin Extended-A for names, served through fontProviders.local().
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
  ],
  env: {
    schema: {
      PUBLIC_GA4_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      CRM_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRM_WEBHOOK_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      DEMO_REF_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
