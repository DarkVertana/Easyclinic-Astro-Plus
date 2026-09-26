import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG 2.2 AA contrast for every text/background pair the components use (spec 7.6).
const css = readFileSync('src/styles/global.css', 'utf8');

function block(selector: RegExp): string {
  const start = css.search(selector);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

const vars = new Map<string, string>();
for (const source of [block(/@theme \{/), block(/:root \{/)]) {
  for (const m of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
}
function resolve(name: string): string {
  let value = vars.get(name);
  for (let i = 0; value && value.startsWith('var(') && i < 5; i++) value = vars.get(value.slice(6, -1));
  if (!value || !value.startsWith('#')) throw new Error(`Cannot resolve --${name} to a hex colour`);
  return value;
}
function luminance(hex: string): number {
  const h = hex.length === 4 ? hex.replace(/(\w)/g, '$1$1').slice(1) : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXT_PAIRS: Array<[string, string]> = [
  ['ink', 'surface'],
  ['ink-heading', 'surface'],
  ['ink-muted', 'surface'],
  ['ink-muted', 'surface-alt'],
  ['ink-muted', 'surface-muted'],
  ['link', 'surface'],
  ['link', 'surface-alt'],
  ['link-hover', 'surface'],
  ['btn-ink', 'btn-bg'],
  ['btn-ink', 'btn-bg-hover'],
  ['cta-ink', 'cta-bg'],
  ['cta-ink', 'cta-bg-hover'],
  ['success', 'success-bg'],
  ['warning', 'warning-bg'],
  ['danger', 'danger-bg'],
  ['danger', 'surface'],
  ['info', 'info-bg'],
  ['ink-inverse', 'surface-inverse'],
  ['ink-inverse-muted', 'surface-inverse'],
  ['ink-inverse-muted', 'color-navy-900'],
  ['color-blue-700', 'surface'],
  ['color-blue-700', 'color-blue-50'],
  ['color-teal-700', 'surface'],
  ['color-white', 'color-blue-700'],
];

describe('colour contrast', () => {
  it.each(TEXT_PAIRS)('%s on %s meets 4.5:1', (fg, bg) => {
    expect(ratio(resolve(fg), resolve(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it('the WhatsApp button glyph meets 3:1 for graphics', () => {
    expect(ratio(resolve('color-white'), resolve('color-whatsapp'))).toBeGreaterThanOrEqual(3);
  });
  it('documents why brand blue 500 is decoration only', () => {
    expect(ratio(resolve('color-white'), resolve('color-blue-500'))).toBeLessThan(4.5);
  });
});
