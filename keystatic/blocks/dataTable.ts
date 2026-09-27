import { defineBlock, list, md, stringList, text } from '../fields.ts';

/**
 * `dataTable` section (Zod: src/components/blocks/DataTable/schema.ts): a generic table that stacks into cards on
 * phones. Zod also checks that every row has one cell per column; this form cannot, so the build and the dev preview
 * toolbar report it.
 */
export const dataTable = defineBlock('dataTable', 'Data table', {
  caption: text('Caption', { description: 'Says what the table lists; read out by screen readers.' }),
  columns: stringList('Columns', 'Column heading', { min: 2, max: 6 }),
  rows: list(
    stringList('Cells', 'Cell', { md: true, description: 'One cell per column, in the same order as Columns.' }),
    {
      label: 'Rows',
      min: 1,
      itemLabel: (props) => props.elements?.[0]?.value || 'Row',
    },
  ),
  note: md('Note', { description: 'Shown under the table.' }),
});
