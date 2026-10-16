import { defineBlock, group, list, text } from '../fields.ts';

/**
 * `featureBand` section (Zod: src/components/blocks/FeatureBand/schema.ts): a dark band with a pill badge, a large
 * heading and two to four short features in a bordered row.
 */
export const featureBand = defineBlock('featureBand', 'Feature band', {
  badge: text('Badge', { description: 'Small pill above the heading, e.g. "Built for Kenya".' }),
  items: list(
    group('Feature', {
      title: text('Title', { required: true }),
      body: text('Text', { required: true, multiline: true }),
    }),
    { label: 'Features', min: 2, max: 6, itemLabel: (props) => props.fields.title.value || 'Feature' },
  ),
});
