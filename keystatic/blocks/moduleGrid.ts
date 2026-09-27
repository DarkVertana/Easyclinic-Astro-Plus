import { defineBlock, group, int, list, media, path, text } from '../fields.ts';

/**
 * `moduleGrid` section (Zod: src/components/blocks/ModuleGrid/schema.ts): module cards with the same parts in the
 * same order (spec 5.1 item 4, four pillars; 5.4, twelve modules). A card with no sub-links is one link; a card with
 * sub-links links only its title.
 */
export const moduleGrid = defineBlock('moduleGrid', 'Module grid', {
  columns: int('Columns', { min: 2, max: 4, zodDefault: 3, description: 'Cards per row on wide screens (2 to 4). Empty: 3.' }),
  items: list(
    group('Module', {
      title: text('Title', { required: true }),
      outcome: text('Outcome', { required: true, description: 'One line of plain text: what the module does for the clinic.' }),
      href: path('Link', { description: 'The module’s page, e.g. /features/billing/.' }),
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. receipt.' }),
      media: media('Media', { optional: true }),
      links: list(
        group('Sub-link', {
          label: text('Label', { required: true }),
          href: path('Link', { required: true }),
        }),
        { label: 'Sub-links', description: 'Links listed under the outcome.', itemLabel: (props) => props.fields.label.value || 'Sub-link' },
      ),
    }),
    { label: 'Modules', min: 2, max: 12, itemLabel: (props) => props.fields.title.value || 'Module' },
  ),
});
