import { defineBlock, group, list, media, path, text } from '../fields.ts';

/**
 * `journeyDiagram` section (Zod: src/components/blocks/JourneyDiagram/schema.ts): the patient journey (spec 5.4,
 * section 11), numbered steps joined by the teal line. Up to six steps sit in one row on wide screens; seven or more
 * wrap into two.
 */
export const journeyDiagram = defineBlock('journeyDiagram', 'Journey diagram', {
  steps: list(
    group('Step', {
      label: text('Label', { required: true, description: 'One or two words: Book, Arrive, Consult, Prescribe.' }),
      body: text('Body', { required: true, description: 'One short line of plain text (no Markdown).' }),
      href: path('Link', { description: 'Links the step label to a page, e.g. /features/emr/.' }),
      media: media('Media', { optional: true }),
    }),
    { label: 'Steps', min: 4, max: 12, itemLabel: (props) => props.fields.label.value || 'Step' },
  ),
});
