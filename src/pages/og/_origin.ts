/**
 * The origin that og:image and twitter:image point at (SEO.astro). A share card has to be fetched from a host that
 * serves this build's /og/*.png, and a preview build has cards (new pages, drafts, changed titles) that
 * www.easyclinic.io does not have. So:
 *
 * - A Vercel production deployment (www): the site's own URL from src/data/site.yaml, https://www.easyclinic.io,
 *   whatever CONTENT_STAGE says (a draft preview on www still serves its cards on www).
 * - Any other Vercel deployment (a preview): that deployment's own URL, `https://$VERCEL_URL`, which serves exactly
 *   this build's files, or `VERCEL_BRANCH_URL` if only that is set; also when CONTENT_STAGE=production builds the
 *   preview with published pages only, because www may not have this build's cards yet. Vercel sets these at build
 *   time (prerendered pages) and at run time (on-demand pages).
 * - Outside Vercel, the stage decides (src/lib/content/stage.ts): a production build uses the site URL; otherwise
 *   the origin of the page itself, which is the dev server under `astro dev` and, for a prerendered page, the `site`
 *   URL Astro derives it from (so a local preview build keeps the site URL too).
 *
 * The canonical URL and og:url stay on the site URL in every stage: only the image has to exist where it points.
 * A preview card only unfurls if a link crawler can open the preview host: with Vercel Deployment Protection on
 * previews (docs/keystatic-design.md section 3, item 5) the crawler is refused and shows no image.
 * This file lives beside the image route rather than in src/lib/seo/og.ts because SEO.astro runs in the server
 * function too, and og.ts loads the renderer (satori, resvg). The leading underscore keeps it out of routing.
 */

export type OgOriginEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
};

export type OgOriginContext = {
  /** `isProduction` from src/lib/content/stage.ts (used outside Vercel). */
  production: boolean;
  /** `url` from src/data/site.yaml. */
  siteUrl: string;
  /** Usually `process.env`. */
  env: OgOriginEnv;
  /** `Astro.url.origin` of the page being rendered. */
  pageOrigin?: string;
};

/** A Vercel host name (no scheme, no path), as VERCEL_URL and VERCEL_BRANCH_URL hold it. */
const HOST = /^[a-z0-9.-]+(?::\d+)?$/i;

export function ogOrigin({ production, siteUrl, env, pageOrigin }: OgOriginContext): string {
  const site = new URL(siteUrl).origin;
  if (env.VERCEL_ENV === 'production') return site;
  const host = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].map((value) => value?.trim()).find((value) => value && HOST.test(value));
  if (env.VERCEL_ENV && host) return `https://${host}`;
  if (production) return site;
  return pageOrigin ? new URL(pageOrigin).origin : site;
}

/** The absolute og:image / twitter:image URL for an image path (`/og/pricing.png`); an absolute URL is kept. */
export function ogImageUrl(imagePath: string, context: OgOriginContext): string {
  return new URL(imagePath, ogOrigin(context)).href;
}
