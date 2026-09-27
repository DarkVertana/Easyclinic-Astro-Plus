import { defineBlock, flag, stringList } from '../fields.ts';

/**
 * `testimonialGrid` section (Zod: src/components/blocks/TestimonialGrid/schema.ts): every testimonial, filterable
 * by clinic type and country with CSS only (spec 5.19 /customers).
 */
export const testimonialGrid = defineBlock('testimonialGrid', 'Testimonial grid', {
  filters: flag('Filters', { zodDefault: true, description: 'Clinic-type and country filters, shown when they would narrow the list.' }),
  only: stringList('Only these testimonials', 'Testimonial id', {
    description:
      'File names in src/data/testimonials, e.g. jj-thakkar. Leave empty to show every testimonial (in production, only those with consent on file).',
  }),
});
