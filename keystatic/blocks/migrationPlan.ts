import { defineBlock, group, list, md, text } from '../fields.ts';

/**
 * `migrationPlan` section (Zod: src/components/blocks/MigrationPlan/schema.ts): numbered move steps, a strip of
 * timings, what comes across from each old system, and a closing note.
 */
export const migrationPlan = defineBlock('migrationPlan', 'Migration plan', {
  steps: list(group('Step', { title: text('Title', { required: true }), body: text('Text', { required: true, multiline: true }) }), {
    label: 'Steps',
    min: 2,
    max: 5,
    itemLabel: (props) => props.fields.title.value || 'Step',
  }),
  stats: list(group('Stat', { value: text('Value', { required: true }), label: text('Label', { required: true }) }), {
    label: 'Timings',
    max: 4,
    itemLabel: (props) => props.fields.value.value || 'Stat',
  }),
  systems: list(
    group('System', {
      name: text('Current system', { required: true }),
      comesAcross: text('What comes across', { required: true, multiline: true }),
      lookAt: text('What we look at closely', { required: true, multiline: true }),
    }),
    { label: 'Systems', max: 10, itemLabel: (props) => props.fields.name.value || 'System' },
  ),
  note: md('Note', { description: 'A closing line under the table.' }),
});
