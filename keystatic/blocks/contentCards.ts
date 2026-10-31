import { choice, defineBlock, group, list, path, text } from '../fields.ts';

/**
 * `contentCards` section (Zod: src/components/blocks/ContentCards/schema.ts): link cards to other pages, each showing
 * the target's label, summary and last-updated date. A card whose page is not live in this stage is left out.
 */
export const contentCards = defineBlock('contentCards', 'Content cards', {
  items: list(
    group('Card', {
      href: path('Link', { description: 'The page the card links to, e.g. /start-a-clinic/kenya/. Required except in the Info style.' }),
      label: text('Label', { description: 'Empty: the target page’s link label.' }),
      description: text('Description', { multiline: true, description: 'Empty: the target page’s summary.' }),
      icon: text('Icon', { description: 'Articles style only: a Lucide icon name from src/components/ui/icons.ts, e.g. smartphone.' }),
    }),
    { label: 'Cards', min: 1, max: 6, itemLabel: (props) => props.fields.label.value || props.fields.href.value || 'Card' },
  ),
  variant: choice('Style', ['default', 'articles', 'info'] as const, { zodDefault: 'default' }, { description: 'Articles: icon band, reading time and a Read article footer. Info: icon band, label and description, no link.' }),
});
