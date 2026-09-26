import { createHash } from 'node:crypto';
import { defineConfig, envField, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import vercelRoutes from './integrations/vercel-routes.ts';

/**
 * Content-Security-Policy (plan Phase 4). Astro hashes every script and style it emits (bundled and inlined
 * scripts, the inlined stylesheets, the @font-face CSS) into a per-page <meta http-equiv> policy; on-demand
 * pages get the same policy as a response header. Scripts run only from this origin, by hash, or from
 * Google Tag Manager: no 'unsafe-inline', no 'unsafe-eval'. JSON-LD blocks are data, which CSP does not
 * block. A <meta> policy cannot carry frame-ancestors, so the header half of the policy is sent with every
 * response by integrations/routes-core.ts (HEADER_CSP). tests/output/csp.test.ts checks every prerendered page;
 * tests/e2e/csp.spec.ts checks the on-demand confirmation page, the demo form, the 404 and 410 pages with JS on.
 */
/**
 * The "Google Analytics" section of Google's CSP guide (developers.google.com/tag-platform/security/guides/csp,
 * read 26 September 2026), which covers Signals and ads features too, since whether they are on for property
 * 347728478 is not known. CSP allows no wildcard in the top-level domain, so each google.<TLD> is listed:
 * the Google domains of the four markets in src/data/countries (India, Kenya, UAE, Nigeria). A visitor on another Google domain only
 * loses that Signals ping. gtag.js loads on the production host only (src/scripts/track.ts).
 */
const GOOGLE_TLDS = ['co.in', 'co.ke', 'ae', 'com.ng'].map((tld) => `https://*.google.${tld}`);
const GA4 = {
  script: ['https://www.googletagmanager.com'],
  img: ['https://*.google-analytics.com', 'https://*.googletagmanager.com', 'https://*.g.doubleclick.net', 'https://*.google.com', ...GOOGLE_TLDS],
  connect: [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    'https://*.g.doubleclick.net',
    'https://*.google.com',
    ...GOOGLE_TLDS,
    'https://pagead2.googlesyndication.com',
  ],
  frame: ['https://www.googletagmanager.com'],
};
/** MDX tables write column alignment as style="text-align:..." attributes: allow exactly those, by hash. */
const TABLE_ALIGN_HASHES = ['left', 'center', 'right'].map((align) => ({
  hash: `sha256-${createHash('sha256').update(`text-align:${align}`).digest('base64')}` as const,
  kind: 'attribute' as const,
}));

export default defineConfig({
  site: 'https://www.easyclinic.io',
  // The live site and the staging audit use trailing slashes on every URL (audit, overriding spec 3.2).
  trailingSlash: 'always',
  // Astro 7 defaults to 'jsx', which strips whitespace between inline elements and glues words in copy.
  compressHTML: true,
  prerenderConflictBehavior: 'error',
  // Inline the (small, purged) CSS: one fewer render-blocking request on slow mobile data, which is
  // what most visitors land on from search (spec 7.1: LCP under 2.0 s).
  build: { inlineStylesheets: 'always' },
  adapter: vercel(),
  // Redirects are not configured here: see integrations/vercel-routes.ts (withastro/astro#18073).
  integrations: [mdx(), vercelRoutes()],
  // Shiki writes inline style attributes that the CSP below blocks, and no content has code blocks.
  markdown: { syntaxHighlight: false },
  vite: { plugins: [tailwindcss()] },
  image: { layout: 'constrained', responsiveStyles: true },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      // Static weights: far smaller than the variable file, and the site only uses regular and semibold.
      weights: [400, 600],
      styles: ['normal'],
      // Latin only: loading latin-ext for ₹ and ₦ re-painted the LCP paragraph ~450 ms late on slow 4G.
      // Those glyphs render from the metric-matched fallback. Follow-up: a custom subset (fonttools)
      // with Latin + ₹ + ₦ + Latin Extended-A for names, served through fontProviders.local().
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
  ],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        `img-src 'self' ${GA4.img.join(' ')}`,
        "font-src 'self'",
        `connect-src 'self' ${GA4.connect.join(' ')}`,
        `frame-src 'self' ${GA4.frame.join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", ...GA4.script] },
      styleDirective: { resources: [{ resource: "'unsafe-hashes'", kind: 'attribute' }], hashes: TABLE_ALIGN_HASHES },
    },
  },
  env: {
    schema: {
      PUBLIC_GA4_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      CRM_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRM_WEBHOOK_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      DEMO_REF_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
