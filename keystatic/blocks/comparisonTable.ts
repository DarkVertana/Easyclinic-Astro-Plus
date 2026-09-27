import { date, defineBlock, flag, group, list, md, text, url } from '../fields.ts';

/**
 * `comparisonTable` section (Zod: src/components/blocks/ComparisonTable/schema.ts): an us-versus-them or ranked
 * comparison table. Rules Zod checks and this form cannot (the build and the dev preview toolbar report them): every
 * row has one cell per column; no cell reads "Check"; every competitor cell has a source and a checked-on date
 * unless it reads "Not published".
 */
export const comparisonTable = defineBlock('comparisonTable', 'Comparison table', {
  columns: list(
    group('Column', {
      name: text('Name', { required: true, description: 'The product in this column, as the header shows it.' }),
      us: flag('This column is EasyClinic', {
        zodDefault: false,
        description: 'Highlights the column. Cells in the EasyClinic column need no source; every other column’s cells do.',
      }),
    }),
    { label: 'Columns', min: 2, max: 8, itemLabel: (props) => props.fields.name.value || 'Column' },
  ),
  rows: list(
    group('Row', {
      label: text('Label', { required: true, description: 'What the row compares, e.g. "Price for one doctor".' }),
      cells: list(
        group('Cell', {
          value: md('Value', {
            required: true,
            description: 'The fact. When a vendor does not say, write "Not published". Never write "Check".',
          }),
          source: url('Source', { description: 'Where a competitor fact comes from. Required for competitor cells, unless the value reads "Not published".' }),
          checkedOn: date('Checked on', { description: 'The day the source was checked. Required with the source for competitor cells.' }),
        }),
        {
          label: 'Cells',
          description: 'One cell per column, in the same order as Columns.',
          itemLabel: (props) => props.fields.value.value || 'Cell',
        },
      ),
    }),
    { label: 'Rows', min: 2, itemLabel: (props) => props.fields.label.value || 'Row' },
  ),
  note: md('Note', { description: 'Shown under the table.' }),
});
