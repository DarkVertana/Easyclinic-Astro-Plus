import { date, defineBlock, group, list, text, url } from '../fields.ts';

/**
 * `sourceList` section (Zod: src/components/blocks/SourceList/schema.ts): the sources at the foot of a listicle or
 * comparison (spec 5.14 item 8, 5.16 item 7).
 */
export const sourceList = defineBlock('sourceList', 'Sources', {
  items: list(
    group('Source', {
      label: text('Label', { required: true, description: 'Who published it and what it is, e.g. "Practo pricing page".' }),
      url: url('URL', { required: true }),
      accessed: date('Accessed', { required: true, description: 'The day the page was last read.' }),
    }),
    { label: 'Sources', min: 1, itemLabel: (props) => props.fields.label.value || 'Source' },
  ),
});
