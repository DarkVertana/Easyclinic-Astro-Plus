import { defineBlock, md, ref } from '../fields.ts';

/**
 * `demoForm` section (Zod: src/components/blocks/DemoForm/schema.ts). The form fields are fixed (spec 7.9); the
 * content sets only the country and the promise beside the form.
 */
export const demoForm = defineBlock('demoForm', 'Demo form', {
  country: ref('Country', 'countries', {
    description: "Sets the form's default country and dial code and the local phone number beside it. Empty uses the page's country.",
  }),
  promise: md('Promise', { description: 'Shown beside the form: what happens after someone books.' }),
});
