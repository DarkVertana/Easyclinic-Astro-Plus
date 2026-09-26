import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { cta, md } from '../../../schemas/fields';

/** Spec 5.18: mid-article CTA card ("Setting up? Get the software sorted before the first patient."). */
export const schema = () =>
  block('inlineCta', {
    body: md,
    primary: cta,
    secondary: cta.optional(),
  });
