import { PERSONAS } from '../../src/schemas/constants.ts';
import { choice, defineBlock, group, list, md, path, text } from '../fields.ts';
import { PERSONA_LABELS } from './personaRouter.ts';

/**
 * `clinicTypes` section (Zod: src/components/blocks/ClinicTypes/schema.ts): who the product is for locally, one card
 * per clinic type in the persona ladder (spec 5.13 block 6, 2.8).
 */
export const clinicTypes = defineBlock('clinicTypes', 'Clinic types', {
  items: list(
    group('Clinic type', {
      persona: choice('Persona', PERSONAS, { required: true }, { labels: PERSONA_LABELS, description: 'Which rung of the clinic ladder this card is for. Sets the card icon.' }),
      title: text('Title', { required: true, description: 'Also the link text: "<title>: how Easy Clinic works for you".' }),
      body: md('Body', { required: true }),
      example: md('Local example', { description: 'Shown in a "Local example" box under the body.' }),
      href: path('Link', { required: true, description: 'The page for this clinic type, e.g. /solutions/solo-clinic/.' }),
    }),
    { label: 'Clinic types', min: 2, max: 5, itemLabel: (props) => props.fields.title.value || 'Clinic type' },
  ),
});
