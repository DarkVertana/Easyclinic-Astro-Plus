import { defineBlock, group, int, list, path, text } from '../fields.ts';

/**
 * `hubGrid` section (Zod: src/components/blocks/HubGrid/schema.ts): hub listings (spec 2.9: every hub links down to
 * all its leaves), in groups. Labels and descriptions default to the target page's own, so the hub stays in step with
 * its pages; a page not live in this stage drops out, and in preview a page with no entry yet shows as "Not built yet".
 */
export const hubGrid = defineBlock('hubGrid', 'Hub grid', {
  groups: list(
    group('Group', {
      title: text('Title', { description: 'Group heading. Empty: the cards sit straight under the section heading.' }),
      items: list(
        group('Card', {
          href: path('Link', { required: true, description: 'A page under this hub, e.g. /features/emr/.' }),
          label: text('Label', { description: 'Empty: the target page’s link label.' }),
          description: text('Description', { multiline: true, description: 'Empty: the target page’s summary.' }),
          icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. calendar-clock.' }),
        }),
        { label: 'Cards', min: 1, itemLabel: (props) => props.fields.label.value || props.fields.href.value || 'Card' },
      ),
    }),
    { label: 'Groups', min: 1, itemLabel: (props) => props.fields.title.value || 'Group' },
  ),
  columns: int('Columns', { min: 2, max: 4, zodDefault: 3, description: 'Cards per row on wide screens (2 to 4). Empty: 3.' }),
});
