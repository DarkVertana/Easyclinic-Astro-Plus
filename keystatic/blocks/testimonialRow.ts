import { TESTIMONIAL_LAYOUTS } from '../../src/schemas/constants.ts';
import { choice, defineBlock, flag, refs } from '../fields.ts';

/** `testimonialRow` section (Zod: src/components/blocks/TestimonialRow/schema.ts): one to nine testimonials (three to a row). */
export const testimonialRow = defineBlock('testimonialRow', 'Testimonials', {
  items: refs('Testimonials', 'testimonials', { min: 1, max: 9, description: 'From src/data/testimonials, in the order shown.' }),
  layout: choice('Layout', TESTIMONIAL_LAYOUTS, { zodDefault: 'row' }, {
    labels: { row: 'Row: cards three to a row', single: 'Single: one large quote on its own', carousel: 'Carousel: heading on a teal band, one quote at a time' },
  }),
  usePullQuote: flag('Use pull quotes', { zodDefault: true, description: "Show a testimonial's short pull quote where it has one, instead of the full quote." }),
  underlines: flag('Underline key phrases', { zodDefault: true, description: "Carousel only: the red dashed underline under each testimonial's underline phrases." }),
  tagSpecialty: flag('Highlight the specialty', { zodDefault: false, description: "Single quote only: the doctor's specialty as a yellow tag with a red dashed outline." }),
});
