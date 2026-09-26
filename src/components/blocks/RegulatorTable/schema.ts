import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** The four-state compliance table (spec 2.6). Lists every regulator for the countries given. */
export const schema = () =>
  block('regulatorTable', {
    countries: z.array(reference('countries')).default([]),
    regulators: z.array(reference('regulators')).default([]),
    showClinicMustDo: z.boolean().default(true),
    trustLink: z.boolean().default(true),
  });
