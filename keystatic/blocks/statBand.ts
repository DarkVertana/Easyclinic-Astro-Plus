import { defineBlock, group, list, md, text } from '../fields.ts';

/** `statBand` section (Zod: src/components/blocks/StatBand/schema.ts): heading and paragraph over large figures. */
export const statBand = defineBlock('statBand', 'Figures band', {
  body: md('Paragraph', { description: 'Shown beside the heading on wide screens.' }),
  stats: list(
    group('Figure', {
      value: text('Figure', { required: true, description: 'e.g. 20+, or a {fact:retention} token.' }),
      label: text('Label', { required: true }),
    }),
    { label: 'Figures', min: 2, max: 4, itemLabel: (props) => props.fields.value.value || 'Figure' },
  ),
  note: md('Small print'),
});
