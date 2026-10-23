import { defineBlock, group, list, md, text } from '../fields.ts';

/** `valueGrid` section (Zod: src/components/blocks/ValueGrid/schema.ts): numbered value cards with icons. */
export const valueGrid = defineBlock('valueGrid', 'Value cards', {
  items: list(
    group('Value', {
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. lightbulb.' }),
      title: text('Title', { required: true }),
      body: md('Body', { required: true }),
    }),
    { label: 'Values', min: 2, max: 9, itemLabel: (props) => props.fields.title.value || 'Value' },
  ),
});
