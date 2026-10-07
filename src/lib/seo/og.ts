/**
 * Per-page Open Graph images (plan Phase 1, "satori OG images"). src/pages/og/[...path].png.ts renders one
 * 1200x630 PNG for every page the registry renders in the stage, at /og/<path>.png (home: /og/index.png);
 * SEO.astro points og:image and twitter:image at it, absolute on the origin that serves this build (the site URL in
 * production, the deployment's own URL on a Vercel preview: src/pages/og/_origin.ts). Pages outside the registry
 * (404, gone, demo) keep the static /og/default.png.
 *
 * Layout: navy card, the Easy Clinic wordmark as text, the eyebrow (the page's own, else the post topic, else
 * the family), the page title without the ": Easy Clinic" suffix in Fraunces, and the teal journey line.
 * No photos. Satori lays the card out and turns the text into paths; resvg rasterises the SVG. Both run at
 * build time only (the route is prerendered), so none of this reaches the browser or the server function.
 *
 * Fonts (SIL OFL 1.1, licence files beside them in src/assets/fonts/og/). Satori cannot read woff2, so
 * these are the TTFs from the official releases:
 * - Inter-SemiBold.ttf: Inter 4.1, github.com/rsms/inter/releases/tag/v4.1 (extras/ttf). Also supplies ₹,
 *   ₦ and other currency signs Fraunces lacks: satori falls back to the next font for a missing glyph.
 * - Fraunces72pt-SemiBold.ttf: Fraunces 1.000, github.com/undercasetype/Fraunces/releases/tag/1.000
 *   (Fonts - Desktop/static/ttf; the 72pt optical size suits a 44 to 72 px headline).
 * They are read from `<cwd>/src/assets/fonts/og/`: Astro builds and Vitest run from the project root, and a
 * path relative to this module would break once Vite bundles it.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { POST_TOPIC_LABELS, type Family, type PostTopic } from '../../schemas/constants';
import { stripSentinels } from '../content/sentinel';

export { OG_FALLBACK, ogImagePath, ogImageSlug } from './og-path';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Brand tokens from src/styles/global.css (tests/unit/og.test.ts checks each value against the token and
 * checks WCAG AA contrast on the background).
 */
export const OG_COLORS = {
  /** --color-navy-900 */
  background: '#0a2540',
  /** --color-white: 15.9:1 on navy */
  headline: '#ffffff',
  /** --color-teal-500: 6.5:1 on navy, so it may carry the eyebrow text here (on white it is decoration only) */
  eyebrow: '#04bdaf',
  /** --ink-inverse-muted */
  muted: '#c9cfdb',
  /** --color-teal-500, the journey line (--journey) */
  journey: '#04bdaf',
} as const;

/** Shown above the headline when the page has no eyebrow of its own (posts use their /blog/ topic). */
export const FAMILY_LABELS: Record<Family, string> = {
  home: 'Clinic management software',
  hub: 'Easy Clinic',
  feature: 'Features',
  solution: 'Solutions',
  selector: 'Find your fit',
  ai: 'Cura AI',
  curapilot: 'CuraPilot',
  trust: 'Trust and security',
  integrations: 'Integrations',
  switch: 'Switching to Easy Clinic',
  customers: 'Customers',
  specialty: 'Specialties',
  country: 'Easy Clinic by country',
  countryDemo: 'Book a demo',
  pricing: 'Pricing',
  listicle: 'Guides',
  comparison: 'Compare',
  company: 'Company',
  legal: 'Legal',
  guide: 'Guide',
  post: 'Blog',
  glossary: 'Glossary',
  kitchenSink: 'Kitchen sink',
};

// Layout. The headline box is the card width less the side padding; the body stops above the journey line.
const PAD_X = 80;
const PAD_TOP = 60;
const JOURNEY_HEIGHT = 150;
const HEADLINE_WIDTH = OG_WIDTH - 2 * PAD_X;
const LINE_HEIGHT = 1.12;
/** Headline sizes tried in order: the largest that fits in MAX_LINES wins. */
export const HEADLINE_SIZES = [72, 66, 60, 54, 48, 44] as const;
export const MAX_LINES = 3;

export interface OgCard {
  /** The page title, as written (tokens resolved); the ": Easy Clinic" suffix and placeholder marks are removed. */
  title: string;
  eyebrow: string;
}

export interface HeadlineFit {
  /** The text drawn: the headline, or the words of it that fit, followed by an ellipsis. */
  text: string;
  size: number;
  lines: number;
  /** True when the headline needs more than MAX_LINES even at the smallest size, so it is cut at a word. */
  clamped: boolean;
}

/** The page title without the brand suffix (": Easy Clinic", " | Easy Clinic", " - Easy Clinic"). */
export function ogHeadline(title: string): string {
  const clean = stripSentinels(title).replace(/\s+/g, ' ').trim();
  return clean.replace(/\s*(?::|\||-|–|—)\s*Easy ?Clinic$/i, '').trim() || clean;
}

/** The page's eyebrow, else its /blog/ topic, else the family label. */
export function ogEyebrow(page: { family: Family; eyebrow?: string | null; topic?: string | null }): string {
  const own = page.eyebrow ? stripSentinels(page.eyebrow).trim() : '';
  if (own) return own;
  if (page.topic && page.topic in POST_TOPIC_LABELS) return POST_TOPIC_LABELS[page.topic as PostTopic];
  return FAMILY_LABELS[page.family];
}

// ---- rendering ----

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown; [key: string]: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

type Fonts = Parameters<typeof satori>[1]['fonts'];
let fontsPromise: Promise<Fonts> | null = null;

function loadFonts(): Promise<Fonts> {
  fontsPromise ??= (async () => {
    const dir = join(process.cwd(), 'src/assets/fonts/og');
    const [fraunces, inter] = await Promise.all([readFile(join(dir, 'Fraunces72pt-SemiBold.ttf')), readFile(join(dir, 'Inter-SemiBold.ttf'))]);
    return [
      { name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' },
      { name: 'Inter', data: inter, weight: 600, style: 'normal' },
    ] satisfies Fonts;
  })();
  return fontsPromise;
}

/**
 * The headline. `measure` leaves the height free (for measureLines). Otherwise the box is capped at MAX_LINES
 * with overflow hidden, and `clamp` (the last resort, for a single word longer than three lines) also cuts the
 * text there with an ellipsis.
 */
function headlineNode(text: string, size: number, mode: 'measure' | 'fit' | 'clamp'): Node {
  return h(
    'div',
    {
      display: 'block',
      width: HEADLINE_WIDTH,
      ...(mode === 'measure' ? {} : { maxHeight: Math.ceil(size * LINE_HEIGHT * MAX_LINES), overflow: 'hidden' }),
      fontFamily: 'Fraunces',
      fontWeight: 600,
      fontSize: size,
      lineHeight: LINE_HEIGHT,
      letterSpacing: -0.01 * size,
      color: OG_COLORS.headline,
      // Even line lengths (no one-word last line). A single long word (a URL, a code) breaks instead of running
      // off the card.
      textWrap: 'balance',
      wordBreak: 'break-word',
      ...(mode === 'clamp' ? { lineClamp: MAX_LINES, textOverflow: 'ellipsis' } : {}),
    },
    text,
  );
}

/**
 * Lines the headline takes at a size, measured by satori itself: the headline is laid out alone at the card's
 * text width with no height, and the height satori reports gives the line count.
 */
async function measureLines(text: string, size: number): Promise<number> {
  const svg = await satori(headlineNode(text, size, 'measure') as never, { width: HEADLINE_WIDTH, fonts: await loadFonts(), embedFont: false });
  const height = Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(svg)?.[1] ?? Infinity);
  return Math.round(height / (size * LINE_HEIGHT));
}

/**
 * Shrink, then clamp: the largest of HEADLINE_SIZES at which the headline fits in MAX_LINES. If it fits at
 * none, the smallest size and the longest run of whole words that fits with an ellipsis (binary search).
 */
export async function fitHeadline(text: string): Promise<HeadlineFit> {
  for (const size of HEADLINE_SIZES) {
    const lines = await measureLines(text, size);
    if (lines <= MAX_LINES) return { text, size, lines, clamped: false };
  }
  const size = HEADLINE_SIZES[HEADLINE_SIZES.length - 1];
  const words = text.split(' ');
  const cut = (n: number) => `${words.slice(0, n).join(' ').replace(/[\s,;:.–—-]+$/, '')}…`;
  let [lo, hi] = [0, words.length - 1];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((await measureLines(cut(mid), size)) <= MAX_LINES) lo = mid;
    else hi = mid - 1;
  }
  // lo = 0: even the first word is longer than MAX_LINES; headlineNode's `clamp` mode cuts it.
  return { text: lo ? cut(lo) : text, size, lines: MAX_LINES, clamped: true };
}

/** The journey line (the site's signature device): a teal path across the foot of the card, one stop marked. */
const JOURNEY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${JOURNEY_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${JOURNEY_HEIGHT}"><path d="M-10 118 C 180 92, 380 132, 600 108 S 960 38, 1210 64" fill="none" stroke="${OG_COLORS.journey}" stroke-width="5" stroke-linecap="round"/><circle cx="600" cy="108" r="11" fill="${OG_COLORS.journey}"/></svg>`;
const JOURNEY_SRC = `data:image/svg+xml;base64,${Buffer.from(JOURNEY_SVG).toString('base64')}`;

function cardNode(card: OgCard, fit: HeadlineFit): Node {
  return h(
    'div',
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      backgroundColor: OG_COLORS.background,
      padding: `${PAD_TOP}px ${PAD_X}px 0`,
      fontFamily: 'Inter',
      fontWeight: 600,
    },
    [
      h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        h('div', { fontSize: 36, letterSpacing: -0.5, color: OG_COLORS.headline }, 'Easy Clinic'),
        h('div', { fontSize: 22, color: OG_COLORS.muted }, 'easyclinic.io'),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, paddingBottom: JOURNEY_HEIGHT - 30 }, [
        h(
          'div',
          {
            display: 'block',
            width: HEADLINE_WIDTH,
            marginBottom: 22,
            fontSize: 24,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: OG_COLORS.eyebrow,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          card.eyebrow,
        ),
        headlineNode(fit.text, fit.size, fit.text === card.title && fit.clamped ? 'clamp' : 'fit'),
      ]),
      h('img', { position: 'absolute', left: 0, bottom: 0, width: OG_WIDTH, height: JOURNEY_HEIGHT }, undefined, {
        src: JOURNEY_SRC,
        width: OG_WIDTH,
        height: JOURNEY_HEIGHT,
      }),
    ],
  );
}

/**
 * The card as SVG (text as paths), the headline fit used, and any text neither font can draw (satori asks
 * `loadAdditionalAsset` for it; nothing is loaded, so those characters are left out of the image).
 */
export async function renderOgSvg(input: OgCard): Promise<{ svg: string; fit: HeadlineFit; missing: string[] }> {
  const card = { title: ogHeadline(input.title), eyebrow: stripSentinels(input.eyebrow).trim() };
  const fit = await fitHeadline(card.title);
  const missing: string[] = [];
  const svg = await satori(cardNode(card, fit) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
    loadAdditionalAsset: async (_code, segment) => {
      missing.push(segment);
      return [];
    },
  });
  return { svg, fit, missing };
}

/** The 1200x630 PNG for a page. */
export async function renderOgPng(input: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const { svg, missing } = await renderOgSvg(input);
  if (missing.length) console.warn(`[og] "${input.title}": no glyphs for ${JSON.stringify(missing.join(''))}; they are left out of the image`);
  // Text is already paths, so resvg needs no fonts: skipping the system font scan saves ~230 ms per image.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH }, font: { loadSystemFonts: false } }).render().asPng();
  return new Uint8Array(png);
}
