/**
 * Renders a post body for the admin preview and review screens. Bodies can originate from the web through the AI
 * engine, so nothing in them is trusted: raw HTML is shown as text, links are limited to safe schemes, and images
 * are named rather than loaded (a remote image would call a third party from an editor's browser).
 * This is a reading aid, not the published page: MDX components other than InlineCta appear as text.
 */
import { Marked } from 'marked';

const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The href if its scheme is safe (entities and control characters cannot hide a scheme), otherwise null. */
export function safeHref(href: string): string | null {
  const decoded = href
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16) % 0x110000))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10) % 0x110000))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000- \u007f-\u009f]/g, '');
  const scheme = decoded.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && !SAFE_SCHEMES.has(scheme)) return null;
  return href;
}

function attribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`))?.slice(1).find((v) => v !== undefined) ?? null;
}

/** An InlineCta block as a labelled note, so a reviewer can read what it says and where it goes. */
function inlineCta(raw: string): string | null {
  // Quoted attribute values may contain ">".
  const open = raw.match(/^\s*<InlineCta\b(?:"[^"]*"|'[^']*'|[^>"'])*>/);
  if (!open) return null;
  const heading = attribute(open[0], 'heading') ?? '';
  const label = attribute(open[0], 'label') ?? '';
  const href = attribute(open[0], 'href') ?? '';
  const text = raw
    .slice(open[0].length)
    .replace(/<\/InlineCta>\s*$/, '')
    .trim();
  return (
    `<aside class="not-prose rounded-card border border-line bg-surface-muted p-4">` +
    `<p class="text-sm font-semibold text-ink-muted">Call to action</p>` +
    `<p class="font-semibold text-ink-heading">${escapeHtml(heading)}</p>` +
    (text ? `<p>${escapeHtml(text)}</p>` : '') +
    `<p class="text-sm">${escapeHtml(label)}: <code>${escapeHtml(href)}</code></p>` +
    `</aside>\n`
  );
}

let previewSlug: string | null = null;

const marked = new Marked({
  gfm: true,
  async: false,
  renderer: {
    html({ text }) {
      // Written on one line, the closing tag arrives as its own token after the text.
      if (/^\s*<\/InlineCta>\s*$/.test(text)) return '';
      return inlineCta(text) ?? escapeHtml(text);
    },
    // After an html tag marked's lexer flags later text as already escaped, which would emit it raw. It never is.
    text(token) {
      const nested = 'tokens' in token ? token.tokens : undefined;
      return nested ? this.parser.parseInline(nested) : escapeHtml(token.text);
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const safe = safeHref(href);
      if (safe === null) return inner;
      const external = /^https?:/i.test(safe) || safe.startsWith('//');
      const titled = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safe)}"${titled} rel="noopener noreferrer"${external ? ' target="_blank"' : ''}>${inner}</a>`;
    },
    image({ href, text }) {
      // Images from the post's own folder load through the admin; anything else is named, never fetched.
      const name = /^\.\/([a-z0-9][a-z0-9._-]{0,80}\.(?:jpe?g|png|webp|gif))$/i.exec(href ?? '')?.[1];
      if (name && previewSlug) {
        const src = `/admin/api/media/?slug=${encodeURIComponent(previewSlug)}&name=${encodeURIComponent(name)}`;
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}" loading="lazy">`;
      }
      return `<span class="text-sm text-ink-muted">[Image: ${escapeHtml(text || 'no description')}]</span>`;
    },
  },
});

/** MDX import and export lines are code, not content. Lines inside fenced code blocks stay. */
function stripMdxStatements(body: string): string {
  let fenced = false;
  return body
    .split('\n')
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      return fenced || !/^(?:import|export)\s/.test(line);
    })
    .join('\n');
}

/** With `slug`, images in the post's folder (`./name.webp`) are shown. Synchronous, so the slug cannot leak between calls. */
export function renderPreview(body: string, slug: string | null = null): string {
  previewSlug = slug && /^[a-z0-9-]{1,120}$/.test(slug) ? slug : null;
  try {
    return marked.parse(stripMdxStatements(body), { async: false });
  } finally {
    previewSlug = null;
  }
}
