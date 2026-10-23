import { choice, defineBlock, group, list, md, optionalGroup, ref, text } from '../fields.ts';

/**
 * `demoForm` section (Zod: src/components/blocks/DemoForm/schema.ts). The form fields are fixed (spec 7.9); the
 * content sets the country, the promise beside the form and, for the short contact layout, its title and help panel.
 */
export const demoForm = defineBlock('demoForm', 'Demo form', {
  country: ref('Country', 'countries', {
    description: "Sets the form's default country and dial code and the local phone number beside it. Empty uses the page's country.",
  }),
  promise: md('Promise', { description: 'Shown beside the form: what happens after someone books.' }),
  variant: choice('Layout', ['full', 'contact'] as const, { zodDefault: 'full' }, {
    labels: { full: 'Full demo form', contact: 'Short contact form with help panel' },
  }),
  formTitle: text('Form title', { description: 'Short contact layout only: the title inside the form card.' }),
  help: optionalGroup('Help panel', {
    heading: text('Heading'),
    body: md('Body'),
    rows: list(
      group('Contact row', {
        icon: text('Icon', { description: 'Lucide icon name, e.g. mail, phone, map-pin.' }),
        title: text('Title', { required: true }),
        body: md('Body', { required: true }),
      }),
      { label: 'Contact rows', max: 5, itemLabel: (props) => props.fields.title.value || 'Row' },
    ),
  }, ['heading', 'body', 'rows'], { description: 'Short contact layout only: the panel beside the form.' }),
});
