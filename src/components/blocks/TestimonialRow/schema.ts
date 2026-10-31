import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { TESTIMONIAL_LAYOUTS } from '../../../schemas/constants';

export const schema = () =>
  block('testimonialRow', {
    items: z.array(reference('testimonials')).min(1).max(9),
    /** single: one large quote alone (section 11); row: cards three to a row, up to three rows; carousel: the
        heading on a teal band beside one quote at a time. */
    layout: z.enum(TESTIMONIAL_LAYOUTS).default('row'),
    usePullQuote: z.boolean().default(true),
    /** Carousel: draw the red dashed underline under each testimonial's `underline` phrases. Off on /features/ and /pricing/. */
    underlines: z.boolean().default(true),
    /** Single quote: show the doctor's specialty as the yellow tag with a red dashed outline. */
    tagSpecialty: z.boolean().default(false),
  });
