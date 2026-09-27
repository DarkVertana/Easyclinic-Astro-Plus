/**
 * Table markup for Markdown tables in posts, guides and legal pages (src/components/mdx/PostTable.astro).
 * MDX renders a Markdown table as a thead with one header row and a tbody; this adds explicit table roles
 * (kept when the cells are display:block below 640px) and gives every body cell its column header as
 * `data-label`, which the stacked layout shows above the cell. A cell under an empty header gets no label.
 * Every cell of a numeric column (numericColumns) gets `data-numeric`, which PostTable right-aligns.
 * GFM tables never nest, so a tag-level pass is safe.
 */
const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const attr = (s: string) => s.replace(/"/g, '&quot;');
const withRole = (open: string, role: string) => open.replace(/^<([a-z]+)\b/i, `<$1 role="${role}"`);

/**
 * A cell that reads as an amount: an optional "about", an optional currency, a number (Indian or Western
 * thousands separators, decimals) and an optional unit. `1,00,000`, `₹45,000`, `KES 26,000`, `18.9%`,
 * `About 3.2 million`.
 */
const AMOUNT =
  /^(?:(?:about|around|approximately|approx\.|up to|under|over)\s+)?(?:[₹$€£₦]\s?|(?:KES|KSh|INR|Rs\.?|NGN|AED|USD|RM|MYR|ETB|RWF|UGX|TZS)\s?)?[-−]?\d[\d,]*(?:\.\d+)?\s?(?:%|k|lakh|crore|million|billion|bn)?$/i;

export const isAmount = (text: string): boolean => AMOUNT.test(text.replace(/\s+/g, ' ').trim());

/**
 * Which columns are numeric: every non-empty body cell reads as an amount, and there is at least one. PostTable
 * right-aligns them on wide screens, so a money column lines up without Markdown alignment (`---:`), which the
 * Keystatic editor drops when it saves a body (docs/keystatic-design.md 2.8). `rows` are the body cells' text.
 */
export function numericColumns(rows: readonly (readonly string[])[]): boolean[] {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => {
    const values = rows.map((row) => (row[column] ?? '').trim()).filter(Boolean);
    return values.length > 0 && values.every(isAmount);
  });
}

const CELL = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;

export function labelTableCells(html: string): string {
  const head = html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? '';
  const labels = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => plain(m[1]));
  const body = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const numeric = numericColumns([...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(CELL)].map((cell) => plain(cell[2]))));
  const mark = (column: number) => (numeric[column] ? ' data-numeric' : '');
  return html
    .replace(/(<thead\b[^>]*>)([\s\S]*?)(<\/thead>)/i, (_, open: string, inner: string, close: string) => {
      let column = 0;
      const cells = inner.replace(/<tr\b/gi, '<tr role="row"').replace(/<th\b/gi, () => `<th scope="col" role="columnheader"${mark(column++)}`);
      return [withRole(open, 'rowgroup'), cells, close].join('');
    })
    .replace(/(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/i, (_, open: string, inner: string, close: string) => {
      const rows = inner.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
        let column = 0;
        return withRole(row, 'row').replace(/<(td|th)\b/gi, (_cell, tag: string) => {
          const label = labels[column];
          const role = tag.toLowerCase() === 'th' ? 'rowheader' : 'cell';
          return `<${tag} role="${role}"${label ? ` data-label="${attr(label)}"` : ''}${mark(column++)}`;
        });
      });
      return `${withRole(open, 'rowgroup')}${rows}${close}`;
    });
}
