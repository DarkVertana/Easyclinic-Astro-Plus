import { choice, defineBlock, flag, list, md, stringList, text } from '../fields.ts';

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
  wideIntro: flag('Full-width heading and intro', { zodDefault: false }),
  variant: choice('Style', ['default', 'clean', 'figures', 'plans', 'tiers'] as const, { zodDefault: 'default' }, { description: 'Clean: softer table on desktop, one card per row below 1024px. Figures: a worked sum with numbers right aligned; the last two rows are highlighted as a loss and a gain. Plans: a plan matrix with Included / Add-on / Not included chips. Tiers: each row a plan side by side, its price large.' }),
});
