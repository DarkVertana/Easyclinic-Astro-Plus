import { boolOrText, defineBlock, group, list, md, stringList, text } from '../fields.ts';

/**
 * `rolesMatrix` section (Zod: src/components/blocks/RolesMatrix/schema.ts): roles by permission (spec 5.6). Zod also
 * checks that every row has one cell per role; this form cannot, so the build and the dev preview toolbar report it.
 */
export const rolesMatrix = defineBlock('rolesMatrix', 'Roles matrix', {
  roles: stringList('Roles', 'Role', { min: 2, max: 7, description: 'The column headings, e.g. Doctor, Nurse, Reception.' }),
  rows: list(
    group('Permission', {
      permission: text('Permission', { required: true, description: 'What the row allows, e.g. "Issues prescriptions".' }),
      cells: list(boolOrText('Cell'), {
        label: 'Cells',
        description: 'One cell per role, in the same order as Roles: yes (tick), no (cross) or a short qualifier ("own patients only").',
        itemLabel: (props) => props.value || 'Cell',
      }),
    }),
    { label: 'Rows', min: 2, itemLabel: (props) => props.fields.permission.value || 'Permission' },
  ),
  note: md('Note', { description: 'Shown under the table.' }),
});
