import { SCOPE_VARIANTS } from '../../src/schemas/constants.ts';
import { choice, defineBlock, md, stringList } from '../fields.ts';

/** The heading ScopeBox.astro shows when the section has none. */
const VARIANT_LABELS = {
  notFor: 'EasyClinic is not the right fit if',
  isNot: 'What EasyClinic is not',
  limits: 'What it does not do yet',
} as const;

/**
 * `scopeBox` section (Zod: src/components/blocks/ScopeBox/schema.ts): honest limits (spec 5.8 item 6, 5.10 item 6,
 * 6.1: admit what the product does not do).
 */
export const scopeBox = defineBlock(
  'scopeBox',
  'Scope box',
  {
    variant: choice('Variant', SCOPE_VARIANTS, { zodDefault: 'isNot' }, {
      labels: VARIANT_LABELS,
      description: 'Sets the icons (a cross, or an info mark for limits) and the heading used when Heading is empty.',
    }),
    items: stringList('Items', 'Item', { min: 1, md: true }),
    note: md('Note', { description: 'A closing line under the items.' }),
  },
  (props) => `Scope box: ${props.fields.heading.value || VARIANT_LABELS[props.fields.variant.value as keyof typeof VARIANT_LABELS] || 'untitled'}`,
);
