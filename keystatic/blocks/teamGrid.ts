import { YAML_SCREENSHOT_PATH, defineBlock, flag, group, image, list, md, text, url } from '../fields.ts';

/** `teamGrid` section (Zod: src/components/blocks/TeamGrid/schema.ts): team cards with photo, role and LinkedIn. */
export const teamGrid = defineBlock('teamGrid', 'Team cards', {
  members: list(
    group('Person', {
      image: image('Photo', YAML_SCREENSHOT_PATH),
      illustration: flag('Illustration, not a portrait', { zodDefault: false, description: 'Shown whole on a tint instead of cropped to fill.' }),
      name: text('Name', { required: true }),
      role: text('Role', { required: true }),
      linkedin: url('LinkedIn profile'),
      bio: md('Bio', { required: true }),
    }),
    { label: 'People', min: 1, max: 12, itemLabel: (props) => props.fields.name.value || 'Person' },
  ),
});
