import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** One card per office: a click-to-load Google map, then address, phone and email (/contact-us/). */
export const schema = (ctx: SchemaContext) =>
  block('officeCards', {
    offices: z
      .array(
        z.object({
          /** ISO 3166-1 alpha-2 code for the flag, e.g. IN. */
          flag: z.string().regex(/^[A-Za-z]{2}$/),
          country: z.string().min(2),
          city: z.string().min(2),
          address: md,
          /** As shown, e.g. "+91 91477 70277"; the call link is built from its digits. */
          phone: z.string().optional(),
          whatsapp: z.url().optional(),
          email: z.email().optional(),
          /** What Google Maps searches for, e.g. the full street address. */
          mapQuery: z.string().min(5),
        }),
      )
      .min(1)
      .max(4),
    note: md.optional(),
    /** A photo behind the whole section instead of the plain background. */
    backgroundImage: ctx.image().optional(),
  });
