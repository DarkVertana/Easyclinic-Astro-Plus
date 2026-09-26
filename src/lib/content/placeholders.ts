import { PLACEHOLDER } from '../rules/text.ts';
import { CLOSE, OPEN } from './sentinel.ts';

const SENTINEL_SPLIT = new RegExp(`(${OPEN}[^${OPEN}${CLOSE}]*${CLOSE})`);
const SENTINELS = new RegExp(`[${OPEN}${CLOSE}]`, 'g');

/**
 * Post-processes rendered HTML (runs at build time for prerendered pages too).
 * Preview: unconfirmed facts and [bracketed placeholders] in text become <mark data-placeholder>, and the
 * preview toolbar's rendered-placeholder count is filled in. Everywhere: sentinels are stripped from
 * tags, attributes, scripts and styles, so no placeholder markup can leak into metadata or JSON-LD.
 */
export function markPlaceholders(html: string, highlight: boolean): { html: string; count: number } {
  let count = 0;
  let inRaw: string | null = null;
  const parts = html.split(/(<[^>]*>)/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      const tag = part.match(/^<\/?([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
      if (inRaw) {
        if (part.toLowerCase().startsWith(`</${inRaw}`)) inRaw = null;
      } else if (tag && (tag === 'script' || tag === 'style' || tag === 'title' || tag === 'textarea') && !part.startsWith('</')) {
        inRaw = tag;
      }
      parts[i] = part.replace(SENTINELS, '');
      continue;
    }
    if (inRaw || !highlight) {
      parts[i] = part.replace(SENTINELS, '');
      continue;
    }
    // Sentinel spans become one mark each; brackets are marked only outside sentinel spans, so a
    // placeholder rendered by need() ("⟦[label]⟧") is counted and highlighted once.
    parts[i] = part
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
  }
  return { html: parts.join(''), count };
}

