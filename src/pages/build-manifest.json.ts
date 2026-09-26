import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { getRegistry } from '../lib/content/registry';
import { INDEXING_ENABLED, STAGE } from '../lib/content/stage';
import { sitemapFamilies } from '../lib/seo/sitemap';

/**
 * Build metadata for integrations/vercel-routes.ts and the post-build checks. Moved out of the public
 * static root by the integration; never served.
 */
export const GET: APIRoute = async () => {
  const registry = await getRegistry();
  const site = (await getEntry('site', 'site'))!.data;
  // Includes the rows generated from the posts manifest (src/data/redirects-posts.yaml, gone-posts.yaml):
  // the collections load both files (src/lib/content/routing-loader.ts).
  const redirects = (await getCollection('redirects')).map((e) => e.data);
  // Each page's redirectFrom list becomes 301s to that page.
  for (const record of registry.visible) {
    for (const from of record.data.redirectFrom) redirects.push({ from, to: record.path, match: 'exact', status: 301 });
  }
  const gone = (await getCollection('gone')).map((e) => e.data);
  // Route files that redirects may target (/feed/ 301s to /rss.xml, the WordPress sitemap files to
  // /sitemap-index.xml). The per-family sitemaps are listed too, so vercel-routes fails the build if a legacy
  // sitemap redirect (/sitemap-posts.xml and the rest) would shadow one: redirect routes run before the filesystem.
  const staticPages = ['/gone/', '/rss.xml', '/sitemap-index.xml', ...sitemapFamilies(registry).map((f) => `/sitemap-${f.family}.xml`)];
  return Response.json({
    stage: STAGE,
    indexingEnabled: INDEXING_ENABLED && STAGE === 'production',
    canonicalHost: site.canonicalHost,
    pages: [
      ...registry.visible.map((r) => ({ path: r.path, collection: r.collection, id: r.id, status: r.status, indexable: r.indexable, title: r.data.title, family: r.family })),
      ...staticPages.map((path) => ({ path, collection: 'static', id: path, status: 'published', indexable: false, title: '', family: 'static' })),
    ],
    redirects,
    gone,
    // Entries this stage does not render (drafts and review pages in production), so post-build checks such
    // as scripts/check-coverage.ts can say why a legacy URL is not served yet.
    hidden: registry.pages.filter((r) => !r.visible).map((r) => ({ path: r.path, collection: r.collection, id: r.id, status: r.status })),
  });
};
