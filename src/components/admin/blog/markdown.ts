/**
 * The bridge between the post's saved Markdown (MDX) and the visual editor's HTML. Posts stay Markdown on disk, so the
 * site and its build checks are unchanged; the editor only ever sees HTML.
 *
 * Two site-specific pieces survive the round trip: the <InlineCta> box (a div with data attributes in the editor) and
 * images from the post's folder (`./name.webp` on disk, loaded through the admin in the editor).
 */
import { Marked } from 'marked';
import TurndownService from 'turndown';
// @ts-expect-error The plugin ships no types.
import { gfm } from 'turndown-plugin-gfm';

const marked = new Marked({ gfm: true, async: false });

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '';
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Saved Markdown to the editor's HTML. */
export function markdownToHtml(markdown: string): string {
  const withCtas = markdown.replace(/<InlineCta\b([^>]*)>([\s\S]*?)<\/InlineCta>/g, (_m, attrs: string, inner: string) => {
    const text = inner.trim();
    return `\n\n<div data-inline-cta="" data-heading="${escapeHtml(attr(attrs, 'heading'))}" data-label="${escapeHtml(attr(attrs, 'label'))}" data-href="${escapeHtml(attr(attrs, 'href'))}" data-text="${escapeHtml(text)}">${escapeHtml(text) || 'Call to action'}</div>\n\n`;
  });
  // MDX escapes (\{ \} \<) are plain characters to a reader.
  return marked.parse(withCtas.replace(/\\([{}])/g, '$1').replace(/\\</g, '&lt;'), { async: false });
}

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '_', strongDelimiter: '**', codeBlockStyle: 'fenced', hr: '---' });
turndown.use(gfm);

// MDX runs { } as code and < as JSX, so they are always escaped in text.
const baseEscape = turndown.escape.bind(turndown);
turndown.escape = (text: string) => baseEscape(text).replace(/([{}<])/g, '\\$1');

turndown.addRule('inlineCta', {
  filter: (node) => node.nodeName === 'DIV' && (node as HTMLElement).hasAttribute('data-inline-cta'),
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const clean = (v: string | null) => (v ?? '').replace(/"/g, '”').replace(/[{}<>]/g, '').trim();
    const text = (el.getAttribute('data-text') ?? '').replace(/([{}<])/g, '\\$1').trim();
    return `\n\n<InlineCta heading="${clean(el.getAttribute('data-heading'))}" label="${clean(el.getAttribute('data-label'))}" href="${clean(el.getAttribute('data-href'))}">\n${text}\n</InlineCta>\n\n`;
  },
});

turndown.addRule('postImage', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
    const alt = (el.getAttribute('alt') ?? '').replace(/[[\]]/g, '');
    return src ? `![${alt}](${src})` : '';
  },
});

// Table cells hold paragraphs in the editor; a Markdown cell is one line.
turndown.addRule('cellParagraph', {
  filter: (node) => node.nodeName === 'P' && /^(TD|TH)$/.test(node.parentNode?.nodeName ?? ''),
  replacement: (content, node) => (node.previousSibling ? ` ${content}` : content),
});

// A Markdown row is one line: line breaks, paragraphs and lists inside a cell flatten to spaces.
// Added after the gfm plugin, so it takes precedence over the plugin's own cell rule.
turndown.addRule('flatCell', {
  filter: ['th', 'td'],
  replacement: (content, node) => {
    const first = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node) === 0;
    const flat = content.replace(/\s*\n+\s*/g, ' ').trim();
    return `${first ? '| ' : ' '}${flat} |`;
  },
});

/** gfm keeps a table without a header row as raw HTML, which a post refuses: promote each table's first row to headers. */
const promoteHeaderRows = (html: string) =>
  html.replace(/<table\b[\s\S]*?<\/table>/g, (table) =>
    /<th\b/.test(table) ? table : table.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/, (row) => row.replace(/<td\b/g, '<th').replace(/<\/td>/g, '</th>')),
  );

// Tight lists with a single space after the marker, matching how the posts are written.
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node) => {
    const parent = node.parentNode as HTMLElement | null;
    let prefix = '- ';
    if (parent?.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? 1);
      prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
    }
    const body = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n{3,}/g, '\n\n').replace(/\n/g, `\n${' '.repeat(prefix.length)}`);
    return `${prefix}${body}${node.nextSibling ? '\n' : ''}`;
  },
});

/** The editor's HTML back to Markdown for saving. */
export function htmlToMarkdown(html: string): string {
  // The table plugin writes a Markdown table only when the header row comes first, so the editor's column sizing goes.
  const clean = promoteHeaderRows(html).replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '').replace(/ style="[^"]*"/g, '');
  return `${turndown.turndown(clean).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
