import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md, optionalGroup } from '../../../schemas/fields';

export const schema = () =>
  block('demoForm', {
    country: reference('countries').optional(),
    promise: md.optional(),
    /**
     * full: the spec 7.9 demo form. contact: the short form on /contact-us/ (name, email, phone, speciality, note;
     * owner decision 2026-10-23) in a card, beside a help panel with contact rows.
     */
    variant: z.enum(['full', 'contact']).default('full'),
    /** Contact layout: the title inside the form card. */
    formTitle: z.string().optional(),
    /** Contact layout: the panel beside the form. */
    help: optionalGroup(
      z.object({
        heading: z.string().min(3),
        body: md.optional(),
        rows: z
          .array(
            z.object({
              /** A Lucide icon name registered in src/components/ui/icons.ts. */
              icon: z.string().default('info'),
              title: z.string().min(2),
              body: md,
            }),
          )
          .max(5)
          .default([]),
      }),
      ['heading', 'body', 'rows'],
    ),
  });
