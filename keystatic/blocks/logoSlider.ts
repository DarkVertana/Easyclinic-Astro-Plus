import { YAML_SCREENSHOT_PATH, defineBlock, group, image, list, text } from '../fields.ts';

/** `logoSlider` section (Zod: src/components/blocks/LogoSlider/schema.ts): a sliding row of organisation logos. */
export const logoSlider = defineBlock('logoSlider', 'Logo slider', {
  logos: list(
    group('Logo', {
      image: image('Logo', YAML_SCREENSHOT_PATH),
      name: text('Organisation name', { required: true, description: 'Read out by screen readers as the alt text.' }),
    }),
    { label: 'Logos', min: 2, max: 30, itemLabel: (props) => props.fields.name.value || 'Logo' },
  ),
});
