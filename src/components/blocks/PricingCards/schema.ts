import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { cta } from '../../../schemas/fields';

export const schema = () =>
  block('pricingCards', {
    /** Static currency for country pricing pages; the main page shows every currency with a switcher. */
    currency: reference('prices'),
    switcher: z.boolean().default(false),
    showConditions: z.boolean().default(true),
    planCta: cta,
    enterpriseCta: cta,
  });
