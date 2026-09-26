import type { APIRoute } from 'astro';
import { INDEXING_ENABLED, isProduction } from '../lib/content/stage';

// Production robots.txt once indexing is switched on. Every other host and stage is served
// robots-disallow.txt by the routes in integrations/vercel-routes.ts (spec 7.7).
export const GET: APIRoute = () => {
  const open = isProduction && INDEXING_ENABLED;
  const body = open
    ? ['User-agent: *', 'Allow: /', 'Disallow: /demo/', 'Disallow: /keystatic/', 'Disallow: /api/', '', 'Sitemap: https://www.easyclinic.io/sitemap-index.xml', ''].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
