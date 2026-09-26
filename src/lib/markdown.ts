import { Marked, type Tokens } from 'marked';

export interface MarkdownOptions {
  inline?: boolean;
  /** Resolves internal links; returning null renders the link text without a link (unpublished target). */
  urlFor?: (path: string) => string | null;
  /** Lowest heading level allowed in the body; section headings are h2, so bodies start at h3. */
  minHeading?: number;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function renderMarkdown(text: string, options: MarkdownOptions = {}): string {
  const { inline = false, urlFor = (p) => p, minHeading = 3 } = options;
  const marked = new Marked({ gfm: true, breaks: false, async: false });
  marked.use({
    renderer: {
      link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
        const label = this.parser.parseInline(token.tokens);
        const href = token.href;
        if (href.startsWith('/')) {
          const resolved = urlFor(href);
          return resolved ? `<a href="${escapeAttr(resolved)}">${label}</a>` : label;
        }
        const external = /^https?:\/\//.test(href);
        return `<a href="${escapeAttr(href)}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
      },
      heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading) {
        const level = Math.min(6, Math.max(minHeading, token.depth));
        return `<h${level}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
      },
    },
  });
  return inline ? (marked.parseInline(text) as string) : (marked.parse(text) as string);
}
