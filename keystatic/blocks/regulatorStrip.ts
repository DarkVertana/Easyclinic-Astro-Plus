import { defineBlock, path, refs } from '../fields.ts';

/**
 * `regulatorStrip` section (Zod: src/components/blocks/RegulatorStrip/schema.ts): spec 5.1 item 6, each
 * regulator's name and four-state status from src/data/regulators, linking to its row on the compliance page.
 */
export const regulatorStrip = defineBlock('regulatorStrip', 'Regulator strip', {
  regulators: refs('Regulators', 'regulators', { min: 2, max: 8, description: 'In the order shown.' }),
  link: path('Compliance page', { description: 'Where the chips link, each to its own #row. Empty means /trust/.' }),
});
