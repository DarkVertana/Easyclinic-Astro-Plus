import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

/**
 * Client logos from src/data/clients (docs/image-plan.md 7.2; spec 5.7 item 7). No links, no count, no rating and no
 * "trusted by": a logo only says the organisation has used EasyClinic. Production shows a client only when its
 * `logoPermission` is true and its logo file exists; with none left, the whole section is left out.
 */
export const schema = () =>
  block('logoStrip', {
    /** In the order shown. Leave empty to show every client, by name. */
    clients: z.array(reference('clients')).default([]),
    /** Only clients whose `country` is this country's code (e.g. `in` on /indiademo/). */
    country: reference('countries').optional(),
  });
