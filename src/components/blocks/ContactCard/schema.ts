import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/** Local proof strip (spec 5.13 block 2): named contact, clients, cities, office, demo link. */
export const schema = () =>
  block('contactCard', {
    country: reference('countries'),
    showClients: z.boolean().default(true),
  });
