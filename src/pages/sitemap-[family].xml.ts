import type { APIRoute, GetStaticPaths } from 'astro';
import { getRegistry } from '../lib/content/registry';
import { sitemapFamilies } from '../lib/seo/sitemap';

export const getStaticPaths = (async () => {
  const registry = await getRegistry();
  return sitemapFamilies(registry).map((f) => ({ params: { family: f.family }, props: { urls: f.urls } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const urls = props.urls as Array<{ loc: string; lastmod?: string }>;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
