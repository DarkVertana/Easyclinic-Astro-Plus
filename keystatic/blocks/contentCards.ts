import { defineBlock, group, list, path, text } from '../fields.ts';

/**
 * `contentCards` section (Zod: src/components/blocks/ContentCards/schema.ts): link cards to other pages, each showing
 * the target's label, summary and last-updated date. A card whose page is not live in this stage is left out.
 */
export const contentCards = defineBlock('contentCards', 'Content cards', {
  items: list(
    group('Card', {
      href: path('Link', { required: true, description: 'The page the card links to, e.g. /start-a-clinic/kenya/.' }),
      label: text('Label', { description: 'Empty: the target page’s link label.' }),
      description: text('Description', { multiline: true, description: 'Empty: the target page’s summary.' }),
    }),
    { label: 'Cards', min: 1, max: 6, itemLabel: (props) => props.fields.label.value || props.fields.href.value || 'Card' },
  ),
});
