import { defineBlock, group, list, stringList, text } from '../fields.ts';

/** `specialtyGrid` section (Zod: src/components/blocks/SpecialtyGrid/schema.ts): specialities in labelled, ticked groups. */
export const specialtyGrid = defineBlock('specialtyGrid', 'Speciality grid', {
  groups: list(
    group('Group', {
      label: text('Group name', { required: true }),
      items: stringList('Specialities', 'Speciality', { min: 1, max: 12 }),
    }),
    { label: 'Groups', min: 1, max: 12, itemLabel: (props) => props.fields.label.value || 'Group' },
  ),
});
