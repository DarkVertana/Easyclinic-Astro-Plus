import { defineConfig, envField, fontProviders } from 'astro/config';
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
  adapter: vercel(),
  // Redirects are not configured here: see integrations/vercel-routes.ts (withastro/astro#18073).
  integrations: [vercelRoutes()],
  vite: { plugins: [tailwindcss()] },
  image: { layout: 'constrained', responsiveStyles: true },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['400 700'],
      styles: ['normal'],
      // latin-ext carries ₹ and ₦; names in the markets served (spec 7.5).
      subsets: ['latin', 'latin-ext'],
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
