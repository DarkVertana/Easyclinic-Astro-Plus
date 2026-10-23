import { YAML_SCREENSHOT_PATH, defineBlock, group, image, list, md, text } from '../fields.ts';

/** `purposeSplit` section (Zod: src/components/blocks/PurposeSplit/schema.ts): a photo beside icon cards. */
export const purposeSplit = defineBlock('purposeSplit', 'Photo with icon cards', {
  image: image('Image', YAML_SCREENSHOT_PATH),
  imageAlt: text('Image alt text', { required: true }),
  items: list(
    group('Card', {
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. eye.' }),
      title: text('Title', { required: true }),
      body: md('Body', { required: true }),
    }),
    { label: 'Cards', min: 1, max: 4, itemLabel: (props) => props.fields.title.value || 'Card' },
  ),
});
