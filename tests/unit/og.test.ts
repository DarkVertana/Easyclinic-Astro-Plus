import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  FAMILY_LABELS,
  HEADLINE_SIZES,
  MAX_LINES,
  OG_COLORS,
  OG_HEIGHT,
  OG_WIDTH,
  fitHeadline,
  ogEyebrow,
  ogHeadline,
  ogImagePath,
  ogImageSlug,
  renderOgPng,
  renderOgSvg,
} from '../../src/lib/seo/og.ts';
import { FAMILIES } from '../../src/schemas/constants.ts';

// Per-page Open Graph images (src/lib/seo/og.ts, src/pages/og/[...path].png.ts).
// Set OG_PREVIEW_DIR to write the rendered cards to that folder for a visual check.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const SHORT = 'Pricing, per doctor per month';
const SIXTY = 'Clinic Software Cost in India: EasyClinic Pricing in INR now';
const LONG = 'Clinic software cost in India and Kenya: what ₹1,499 and KES 2,500 per doctor per month buy, and what a second branch adds';

describe('OG image paths', () => {
  it('maps page paths to /og/<path>.png, home to index', () => {
    expect(ogImagePath('/')).toBe('/og/index.png');
    expect(ogImagePath('/pricing/')).toBe('/og/pricing.png');
    expect(ogImagePath('/pricing/india/')).toBe('/og/pricing/india.png');
    expect(ogImageSlug('/compare/practo-alternatives/')).toBe('compare/practo-alternatives');
  });

  it('refuses a page whose image would overwrite the static fallback', () => {
    expect(() => ogImageSlug('/default/')).toThrow(/default\.png/);
  });
});

describe('OG card text', () => {
  it('drops the brand suffix and placeholder marks from the title', () => {
    expect(ogHeadline('Telemedicine Software for Doctors: EasyClinic')).toBe('Telemedicine Software for Doctors');
    expect(ogHeadline('Clinic Software | EasyClinic')).toBe('Clinic Software');
    expect(ogHeadline('EasyClinic Pricing: Per Doctor, Per Month')).toBe('EasyClinic Pricing: Per Doctor, Per Month');
    expect(ogHeadline('EasyClinic')).toBe('EasyClinic');
    expect(ogHeadline('Plans from ⟦[price]⟧ a month: EasyClinic')).toBe('Plans from [price] a month');
  });

  it('uses the page eyebrow, then the post topic, then the family', () => {
    expect(ogEyebrow({ family: 'pricing', eyebrow: 'Pricing in India' })).toBe('Pricing in India');
    expect(ogEyebrow({ family: 'post', topic: 'running-a-chain' })).toBe('Running a chain');
    expect(ogEyebrow({ family: 'post', eyebrow: '  ', topic: 'cura-ai' })).toBe('Cura AI');
    expect(ogEyebrow({ family: 'feature' })).toBe('Features');
  });

  it('has a label for every family', () => {
    for (const family of FAMILIES) expect(FAMILY_LABELS[family], family).toBeTruthy();
  });
});

describe('OG colours', () => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1]?.toLowerCase();
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('are the brand tokens from global.css', () => {
    expect(OG_COLORS.background).toBe(token('color-navy-900'));
    expect(OG_COLORS.headline).toBe(token('color-white'));
    expect(OG_COLORS.eyebrow).toBe(token('color-teal-500'));
    expect(OG_COLORS.journey).toBe(token('color-teal-500'));
    expect(OG_COLORS.muted).toBe(token('ink-inverse-muted'));
  });

  it('meet WCAG AA (4.5:1) for all text on the background', () => {
    for (const ink of [OG_COLORS.headline, OG_COLORS.eyebrow, OG_COLORS.muted]) {
      expect(ratio(ink, OG_COLORS.background), ink).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('OG renderer', () => {
  const previewDir = process.env.OG_PREVIEW_DIR;
  if (previewDir) mkdirSync(previewDir, { recursive: true });

  async function expectValidPng(png: Uint8Array, name: string) {
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    const view = new DataView(png.buffer, png.byteOffset);
    // IHDR is the first chunk: width and height at bytes 16 and 20.
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([OG_WIDTH, OG_HEIGHT]);
    // A full decode catches a truncated or corrupt file.
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
    const stats = await sharp(png).stats();
    expect(stats.isOpaque).toBe(true);
    if (previewDir) writeFileSync(join(previewDir, `${name}.png`), png);
  }

  it('renders a short title at the largest size', async () => {
    const card = { title: `${SHORT}: EasyClinic`, eyebrow: 'Pricing' };
    const { fit, missing } = await renderOgSvg(card);
    expect(fit).toEqual({ text: SHORT, size: HEADLINE_SIZES[0], lines: 1, clamped: false });
    expect(missing).toEqual([]);
    await expectValidPng(await renderOgPng(card), 'short');
  });

  it('renders a 60-character title within the line limit', async () => {
    expect(SIXTY).toHaveLength(60);
    const card = { title: SIXTY, eyebrow: 'Pricing in India' };
    const { fit, missing } = await renderOgSvg(card);
    expect(fit.lines).toBeLessThanOrEqual(MAX_LINES);
    expect(fit.clamped).toBe(false);
    expect(missing).toEqual([]);
    await expectValidPng(await renderOgPng(card), 'sixty');
  });

  it('shrinks a long title with ₹ and KES and draws every glyph', async () => {
    const card = { title: LONG, eyebrow: 'Compliance by country' };
    const { fit, missing } = await renderOgSvg(card);
    expect(fit.size).toBeLessThan(HEADLINE_SIZES[0]);
    expect(fit.lines).toBeLessThanOrEqual(MAX_LINES);
    expect(fit.clamped).toBe(false);
    // Fraunces has no ₹; Inter supplies it, so satori never has to ask for another font.
    expect(missing).toEqual([]);
    await expectValidPng(await renderOgPng(card), 'long');
  });

  it('clamps a title too long for the smallest size at a word, with an ellipsis', async () => {
    const title = 'Clinic software for every speciality and every city, '.repeat(6).trim();
    const fit = await fitHeadline(title);
    expect(fit).toMatchObject({ size: HEADLINE_SIZES.at(-1), lines: MAX_LINES, clamped: true });
    expect(fit.text).toMatch(/\w…$/);
    expect(title.startsWith(fit.text.slice(0, -1))).toBe(true);
    // The cut is the longest that fits: one more word would not.
    const words = fit.text.slice(0, -1).split(' ').length;
    const next = title.split(' ').slice(0, words + 1).join(' ');
    expect(await fitHeadline(`${next}…`)).toMatchObject({ clamped: true });
    await expectValidPng(await renderOgPng({ title, eyebrow: 'A very long eyebrow that would run past the edge of the card if it were not cut short' }), 'clamped');
  });

  it('reports text neither font can draw', async () => {
    const { missing } = await renderOgSvg({ title: 'क्लिनिक software for Lagos (₦) and Nairobi (KES)', eyebrow: 'Test' });
    expect(missing).toEqual(['क्लिनिक']);
  });

  it('breaks a word wider than the card instead of overflowing', async () => {
    const word = `See ${'Ab'.repeat(30)} now`;
    expect(await fitHeadline(word)).toMatchObject({ text: word, clamped: false });
    await expectValidPng(await renderOgPng({ title: word, eyebrow: 'Glossary' }), 'long-word');
    // A single word longer than three lines at the smallest size: satori's line clamp cuts it.
    const giant = 'Ab'.repeat(200);
    expect(await fitHeadline(giant)).toMatchObject({ text: giant, clamped: true });
    await expectValidPng(await renderOgPng({ title: giant, eyebrow: 'Glossary' }), 'giant-word');
  });
});
