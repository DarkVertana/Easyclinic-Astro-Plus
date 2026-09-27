import type { APIRoute, GetStaticPaths } from 'astro';
import { getRegistry } from '../../lib/content/registry';
import { ogImageSlug } from '../../lib/seo/og-path';
import { ogEyebrow, renderOgPng, type OgCard } from '../../lib/seo/og';

/**
 * One Open Graph image per page the registry renders in this stage (the same set as src/pages/[...path].astro),
 * at /og/<path>.png; the home page's is /og/index.png. Prerendered: satori and resvg run at build time only.
 * SEO.astro links it for every content-backed page; other pages keep public/og/default.png.
 */
export const prerender = true;

export const getStaticPaths = (async () => {
  const registry = await getRegistry();
  return registry.visible.map((record) => {
    const data = record.data as typeof record.data & { topic?: string };
    const card: OgCard = { title: data.title, eyebrow: ogEyebrow({ family: record.family, eyebrow: data.eyebrow, topic: data.topic }) };
    return { params: { path: ogImageSlug(record.path) }, props: { card } };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgPng(props.card as OgCard);
  return new Response(png, { headers: { 'content-type': 'image/png' } });
};
