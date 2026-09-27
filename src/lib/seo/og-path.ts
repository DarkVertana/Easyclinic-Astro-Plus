/**
 * Where a page's generated Open Graph card lives. Kept apart from og.ts (satori and resvg) so that SEO.astro,
 * which on-demand pages render too, never pulls the renderer into the server function.
 */

/** The static card for pages without a generated image (404, gone, demo pages). */
export const OG_FALLBACK = '/og/default.png';

/** `/` → `index`, `/pricing/india/` → `pricing/india`: the `path` param of src/pages/og/[...path].png.ts. */
export function ogImageSlug(pagePath: string): string {
  const slug = pagePath.replace(/^\/+|\/+$/g, '') || 'index';
  // public/og/default.png would shadow (or be shadowed by) the image of a page at /default/.
  if (slug === 'default') throw new Error(`OG image for ${pagePath} would overwrite ${OG_FALLBACK}`);
  return slug;
}

/** The image URL path for a page path: `/pricing/` → `/og/pricing.png`, `/` → `/og/index.png`. */
export function ogImagePath(pagePath: string): string {
  return `/og/${ogImageSlug(pagePath)}.png`;
}
