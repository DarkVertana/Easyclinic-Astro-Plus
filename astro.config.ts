import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import vercelRoutes from './integrations/vercel-routes.ts';

export default defineConfig({
  site: 'https://www.easyclinic.io',
  trailingSlash: 'always',
  compressHTML: true,
  prerenderConflictBehavior: 'error',
  adapter: vercel(),
  integrations: [vercelRoutes()],
});
