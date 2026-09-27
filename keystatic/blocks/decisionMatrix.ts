import { defineBlock, flag, group, list, stringList, text } from '../fields.ts';

/**
 * `decisionMatrix` section (Zod: src/components/blocks/DecisionMatrix/schema.ts): "Choose X if" and "Choose Y if"
 * lists (spec 7.3 DecisionMatrix, 5.16).
 */
export const decisionMatrix = defineBlock('decisionMatrix', 'Decision matrix', {
  options: list(
    group('Option', {
      title: text('Title', { required: true, description: 'E.g. "Choose EasyClinic if".' }),
      items: stringList('Reasons', 'Reason', { md: true, min: 2, max: 8 }),
      us: flag('This option is EasyClinic', { zodDefault: false, description: 'Highlights the card.' }),
    }),
    { label: 'Options', min: 2, max: 4, itemLabel: (props) => props.fields.title.value || 'Option' },
  ),
});
