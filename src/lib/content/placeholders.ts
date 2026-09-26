import { PLACEHOLDER } from '../rules/text.ts';
import { CLOSE, OPEN } from './sentinel.ts';

const SENTINEL_SPLIT = new RegExp(`(${OPEN}[^${OPEN}${CLOSE}]*${CLOSE})`);
const SENTINELS = new RegExp(`[${OPEN}${CLOSE}]`, 'g');
/**
 * Raw-text elements are matched whole, up to their own closing tag: their content (inline CSS with
 * range media queries such as `(width<40rem)`, minified JS, JSON-LD) can contain "<" and must never be
 * split as markup.
 */
const RAW = /<(script|style|title|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Post-processes rendered HTML (runs at build time for prerendered pages too).
 * Preview: unconfirmed facts and [bracketed placeholders] in text become <mark data-placeholder>, and the
 * preview toolbar's rendered-placeholder count is filled in. Everywhere: sentinels are stripped from
 * tags, attributes, scripts and styles, so no placeholder markup can leak into metadata or JSON-LD.
 */
export function markPlaceholders(html: string, highlight: boolean): { html: string; count: number } {
  let count = 0;

  const markup = (chunk: string): string =>
    chunk
      .split(/(<[^>]*>)/)
      .map((part) => {
        if (part.startsWith('<') || !highlight) return part.replace(SENTINELS, '');
        // Sentinel spans become one mark each; brackets are marked only outside sentinel spans, so a
        // placeholder rendered by need() ("⟦[label]⟧") is counted and highlighted once.
        return part
          .split(SENTINEL_SPLIT)
          .map((segment) => {
            if (segment.startsWith(OPEN)) {
              count++;
              return `<mark data-placeholder title="Needs a confirmed fact before publishing">${segment.slice(1, -1)}</mark>`;
            }
            return segment.replace(PLACEHOLDER, (m) => {
              count++;
              return `<mark data-placeholder title="Placeholder: the company must supply this">${m}</mark>`;
            });
          })
          .join('');
      })
      .join('');

  let out = '';
  let last = 0;
  for (const match of html.matchAll(RAW)) {
    out += markup(html.slice(last, match.index));
    out += match[0].replace(SENTINELS, '');
    last = match.index! + match[0].length;
  }
  out += markup(html.slice(last));
  return { html: out, count };
}
