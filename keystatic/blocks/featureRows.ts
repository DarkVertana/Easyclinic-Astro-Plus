import { PLAN_IDS } from '../../src/schemas/constants.ts';
import { cta, defineBlock, group, list, md, media, optionalChoice, stringList, text } from '../fields.ts';

/**
 * `featureRows` section (Zod: src/components/blocks/FeatureRows/schema.ts): heading, body, ticked bullets and an
 * optional screenshot per row. Rows with media alternate right and left on wide screens; a section with no media
 * renders as a grid of cards instead.
 */
export const featureRows = defineBlock('featureRows', 'Feature rows', {
  items: list(
    group('Row', {
      heading: text('Heading', { required: true }),
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. receipt. Shown on the card when the section has no media.' }),
      body: md('Body', { required: true }),
      bullets: stringList('Bullets', 'Bullet', { description: 'Short ticked points under the body.' }),
      media: media('Media', { optional: true }),
      plan: optionalChoice('Plan', PLAN_IDS, { description: 'Adds an "Included in <plan> and above" tag (plan names from plans.yaml). Default: no tag.' }),
      link: cta('Link', { optional: true }),
    }),
    { label: 'Rows', min: 1, max: 8, itemLabel: (props) => props.fields.heading.value || 'Row' },
  ),
});
