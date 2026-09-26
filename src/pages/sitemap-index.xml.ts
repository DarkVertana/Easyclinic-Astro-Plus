import type { APIRoute } from 'astro';
import { getRegistry } from '../lib/content/registry';
import { sitemapFamilies } from '../lib/seo/sitemap';

// Sitemaps are built from the registry, so they list exactly the indexable pages, split by family,
// with lastmod from lastUpdated (spec 7.7). @astrojs/sitemap cannot see noindex, so it is not used.
export const GET: APIRoute = async () => {
  const registry = await getRegistry();
  const families = sitemapFamilies(registry);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${families.map((f) => `  <sitemap><loc>https://www.easyclinic.io/sitemap-${f.family}.xml</loc>${f.lastmod ? `<lastmod>${f.lastmod}</lastmod>` : ''}</sitemap>`).join('\n')}
</sitemapindex>
`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
