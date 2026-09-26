import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Temporary page list until the content registry lands (checkpoint C).
const pages = [
  { path: '/', collection: 'core', id: 'home', status: 'draft', indexable: false, title: 'hello' },
  { path: '/doctors/', collection: 'core', id: 'doctors', status: 'draft', indexable: false, title: 'doctors' },
];

export const GET: APIRoute = async () => {
  const stage = process.env.CONTENT_STAGE === 'production' || process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  const redirects = (await getCollection('redirects')).map((e) => e.data);
  const gone = (await getCollection('gone')).map((e) => e.data);
  return new Response(
    JSON.stringify({
      stage,
      indexingEnabled: process.env.INDEXING_ENABLED === 'true',
      canonicalHost: 'www.easyclinic.io',
      pages,
      redirects,
      gone,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
