/**
 * Table markup for blog posts (src/components/mdx/PostTable.astro). MDX renders a Markdown table as a
 * thead with one header row and a tbody; this adds explicit table roles (kept when the cells are
 * display:block below 640px) and gives every body cell its column header as `data-label`, which the
 * stacked layout shows above the cell. GFM tables never nest, so a tag-level pass is safe.
 */
const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const attr = (s: string) => s.replace(/"/g, '&quot;');
const withRole = (open: string, role: string) => open.replace(/^<([a-z]+)\b/i, `<$1 role="${role}"`);

export function labelTableCells(html: string): string {
  const head = html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? '';
  const labels = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => plain(m[1]));
  return html
    .replace(/(<thead\b[^>]*>)([\s\S]*?)(<\/thead>)/i, (_, open: string, inner: string, close: string) =>
      [withRole(open, 'rowgroup'), inner.replace(/<tr\b/gi, '<tr role="row"').replace(/<th\b/gi, '<th scope="col" role="columnheader"'), close].join(''),
    )
    .replace(/(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/i, (_, open: string, inner: string, close: string) => {
      const rows = inner.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
        let column = 0;
        return withRole(row, 'row').replace(/<(td|th)\b/gi, (_cell, tag: string) => {
          const label = labels[column++];
          const role = tag.toLowerCase() === 'th' ? 'rowheader' : 'cell';
          return `<${tag} role="${role}"${label ? ` data-label="${attr(label)}"` : ''}`;
        });
      });
      return `${withRole(open, 'rowgroup')}${rows}${close}`;
    });
}
