import { defineBlock, group, list, md, text } from '../fields.ts';

/**
 * `flowDiagram` section (Zod: src/components/blocks/FlowDiagram/schema.ts): a process drawn as connected steps, such
 * as a claim's journey or registration to submission (spec 5.8, 5.11).
 */
export const flowDiagram = defineBlock('flowDiagram', 'Flow diagram', {
  steps: list(
    group('Step', {
      label: text('Label', { required: true, description: 'The step, in a few words.' }),
      body: md('Body'),
      check: text('Check', { description: 'A safeguard at this step, shown as a badge with a shield, e.g. "Guards against a swapped tube".' }),
    }),
    { label: 'Steps', min: 3, max: 10, itemLabel: (props) => props.fields.label.value || 'Step' },
  ),
  examples: list(
    group('Example', {
      country: text('Country', { required: true, description: 'Shown as the example’s heading.' }),
      body: md('Body', { required: true }),
    }),
    {
      label: 'Examples by country',
      description: 'Optional per-country examples under the flow, e.g. the payers each market uses.',
      itemLabel: (props) => props.fields.country.value || 'Example',
    },
  ),
});
