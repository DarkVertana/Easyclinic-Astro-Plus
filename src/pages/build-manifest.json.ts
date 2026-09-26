import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { getRegistry } from '../lib/content/registry';
import { INDEXING_ENABLED, STAGE } from '../lib/content/stage';

/**
 * Build metadata for integrations/vercel-routes.ts and the post-build checks. Moved out of the public
 * static root by the integration; never served.
 */
export const GET: APIRoute = async () => {
  const registry = await getRegistry();
  const site = (await getEntry('site', 'site'))!.data;
  const redirects = (await getCollection('redirects')).map((e) => e.data);
  // Each page's redirectFrom list becomes 301s to that page.
  for (const record of registry.visible) {
    for (const from of record.data.redirectFrom) redirects.push({ from, to: record.path, match: 'exact', status: 301 });
  }
  const gone = (await getCollection('gone')).map((e) => e.data);
  const staticPages = ['/gone/'];
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
  });
};
