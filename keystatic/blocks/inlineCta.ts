import { cta, defineBlock, md } from '../fields.ts';

/**
 * `inlineCta` section (Zod: src/components/blocks/InlineCTA/schema.ts): a mid-article CTA card (spec 5.18, "Setting
 * up? Get the software sorted before the first patient."). A button whose page is not live in this stage is left
 * out, and with no button left the card is not shown.
 */
export const inlineCta = defineBlock(
  'inlineCta',
  'Inline CTA',
  {
    body: md('Body', { required: true, description: 'One or two sentences.' }),
    primary: cta('Primary button'),
    secondary: cta('Secondary button', { optional: true }),
  },
  (props) => `Inline CTA: ${props.fields.heading.value || props.fields.primary.fields.label.value || 'untitled'}`,
);
