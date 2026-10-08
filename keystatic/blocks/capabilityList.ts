import { defineBlock, group, list, md, text } from '../fields.ts';

/**
 * `capabilityList` section (Zod: src/components/blocks/CapabilityList/schema.ts): numbered capabilities in labelled
 * groups, shown as an index with the group name on the left and its items in two columns.
 */
export const capabilityList = defineBlock('capabilityList', 'Capability list', {
  groups: list(
    group('Group', {
      label: text('Label', { required: true }),
      items: list(
        group('Capability', {
          title: text('Title', { required: true }),
          body: md('Body', { required: true }),
        }),
        { label: 'Capabilities', min: 1, max: 8, itemLabel: (props) => props.fields.title.value || 'Capability' },
      ),
    }),
    { label: 'Groups', min: 1, max: 6, itemLabel: (props) => props.fields.label.value || 'Group' },
  ),
});
