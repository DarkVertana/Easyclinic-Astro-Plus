import { defineBlock, group, list, md, text } from '../fields.ts';

/** `stepList` section (Zod: src/components/blocks/StepList/schema.ts): numbered steps, such as the onboarding plan. */
export const stepList = defineBlock('stepList', 'Steps', {
  steps: list(
    group('Step', {
      title: text('Title', { required: true }),
      meta: text('Meta', { description: 'A short line under the title, e.g. "Day 1, 40 minutes".' }),
      body: md('Body', { required: true }),
    }),
    { label: 'Steps', min: 2, max: 10, itemLabel: (props) => props.fields.title.value || 'Step' },
  ),
  note: md('Note', { description: 'Shown under the steps.' }),
});
