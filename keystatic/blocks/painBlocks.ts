import { defineBlock, group, list, md, path, text } from '../fields.ts';

/**
 * `painBlocks` section (Zod: src/components/blocks/PainBlocks/schema.ts): two to four pain points, each with an
 * optional "What changes" answer and a link.
 */
export const painBlocks = defineBlock('painBlocks', 'Pain points', {
  items: list(
    group('Pain point', {
      heading: text('Heading', { required: true }),
      body: md('Body', { required: true }),
      fix: md('What changes', { description: 'Shown under the pain point with a tick.' }),
      href: path('Link', { description: 'A page that solves it, e.g. /features/billing/.' }),
      linkLabel: text('Link label', { description: 'Empty: the target page’s link label. Never a generic "Learn more".' }),
    }),
    { label: 'Pain points', min: 2, max: 4, itemLabel: (props) => props.fields.heading.value || 'Pain point' },
  ),
});
