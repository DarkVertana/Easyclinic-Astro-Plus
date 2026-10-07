import { CHIP_FLAGS } from '../../src/schemas/constants.ts';
import { cta, defineBlock, group, list, optionalChoice, path, text } from '../fields.ts';

/**
 * `chipCloud` section (Zod: src/components/blocks/ChipCloud/schema.ts): a centred cloud of pill links, each with a
 * check mark or a round country flag, and an optional button under it.
 */
export const chipCloud = defineBlock('chipCloud', 'Chip cloud', {
  items: list(
    group('Chip', {
      label: text('Label', { required: true }),
      href: path('Link', { description: 'Empty: the chip is plain text.' }),
      flag: optionalChoice('Flag', CHIP_FLAGS, { description: 'Country flag in place of the check mark.' }),
    }),
    { label: 'Chips', min: 2, max: 40, itemLabel: (props) => props.fields.label.value || 'Chip' },
  ),
  cta: cta('Button', { optional: true }),
});
