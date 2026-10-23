import { YAML_SCREENSHOT_PATH, defineBlock, group, image, list, md, text, url } from '../fields.ts';

/** `officeCards` section (Zod: src/components/blocks/OfficeCards/schema.ts): office cards with a click-to-load map. */
export const officeCards = defineBlock('officeCards', 'Office cards with map', {
  offices: list(
    group('Office', {
      flag: text('Flag code', { required: true, description: 'Two-letter country code, e.g. IN or KE.' }),
      country: text('Country', { required: true }),
      city: text('City', { required: true }),
      address: md('Address', { required: true }),
      phone: text('Phone', { description: 'As shown, e.g. +91 91477 70277.' }),
      whatsapp: url('WhatsApp link'),
      email: text('Email'),
      mapQuery: text('Map search', { required: true, description: 'What Google Maps searches for: usually the full address.' }),
    }),
    { label: 'Offices', min: 1, max: 4, itemLabel: (props) => props.fields.country.value || 'Office' },
  ),
  note: md('Note under the cards'),
  backgroundImage: image('Background image', YAML_SCREENSHOT_PATH),
});
