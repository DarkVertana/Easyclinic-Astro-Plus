import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { labelTableCells } from '../../src/lib/content/post-table.ts';

/**
 * Markdown tables in posts, guides and legal pages go through PostTable (GuidePage maps `table` to it for every
 * family), which stacks them into cards below 640px and shows each cell's column header as its label
 * (docs/components.md rule 3). The label comes from the header row, so every table needs one.
 */

// A table as MDX hands it to the component: one tag per line, and a right-aligned column (`---:`) carried as an
// inline style, as in the money columns of the cost guides.
const guideTable = [
  '<thead>',
  '<tr>',
  '<th>Item</th>',
  '<th style="text-align:right">Cost (₹)</th>',
  '<th>Basis</th>',
  '</tr>',
  '</thead>',
  '<tbody>',
  '<tr>',
  '<td>Rent deposit</td>',
  '<td style="text-align:right">1,00,000</td>',
  '<td>Between <a href="/x/">Thane</a> and Bandra</td>',
  '</tr>',
  '</tbody>',
].join('\n');

describe('table cell labels', () => {
  it('labels every body cell of a guide table and keeps the column alignment for wide screens', () => {
    const html = labelTableCells(guideTable);
    expect(html).toContain('<th scope="col" role="columnheader" style="text-align:right">Cost (₹)</th>');
    expect(html).toContain('<td role="cell" data-label="Item">Rent deposit</td>');
    expect(html).toContain('<td role="cell" data-label="Cost (₹)" style="text-align:right">1,00,000</td>');
    expect(html).toContain('<td role="cell" data-label="Basis">Between <a href="/x/">Thane</a> and Bandra</td>');
    expect(html.match(/<tr role="row">/g)).toHaveLength(2);
  });
  it('leaves a cell under an empty header without a label rather than an empty one', () => {
    const html = labelTableCells('<thead><tr><th></th><th>2026</th></tr></thead><tbody><tr><td>Fee</td><td>KES 1,000</td></tr></tbody>');
    expect(html).toContain('<td role="cell">Fee</td>');
    expect(html).toContain('<td role="cell" data-label="2026">KES 1,000</td>');
  });
  it('handles a table that has a header row and no body rows', () => {
    expect(labelTableCells('<thead><tr><th>Item</th></tr></thead>')).toBe(
      '<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Item</th></tr></thead>',
    );
  });
});

// Every Markdown table in long-form content has a header row with a label in each column.
const root = 'src/content';
const mdxFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => join(dir, f));
const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

function headerRows(source: string): { line: number; cells: string[]; columns: number }[] {
  const lines = source.split('\n');
  const found: { line: number; cells: string[]; columns: number }[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fenced = !fenced;
    if (fenced || !lines[i].includes('|') || !DELIMITER.test(lines[i + 1]) || !lines[i + 1].includes('-')) continue;
    if (i > 0 && lines[i - 1].trim().startsWith('|')) continue;
    found.push({ line: i + 1, cells: cells(lines[i]), columns: cells(lines[i + 1]).length });
  }
  return found;
}

describe('Markdown tables in long-form content', () => {
  const files = ['guides', 'legal', 'posts'].flatMap(mdxFiles);
  it('finds the guide tables', () => {
    const guideTables = files.filter((f) => f.startsWith('guides')).flatMap((f) => headerRows(readFileSync(join(root, f), 'utf8')));
    expect(guideTables.length).toBeGreaterThan(0);
  });
  it('have a label in every header cell, so each stacked cell shows its column', () => {
    const problems = files.flatMap((file) =>
      headerRows(readFileSync(join(root, file), 'utf8'))
        .filter((t) => t.cells.length !== t.columns || t.cells.some((c) => c === ''))
        .map((t) => `${file}:${t.line} ${JSON.stringify(t.cells)}`),
    );
    expect(problems).toEqual([]);
  });
});
