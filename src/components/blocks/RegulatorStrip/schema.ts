import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath } from '../../../schemas/fields';

export const schema = () =>
  block('regulatorStrip', {
    regulators: z.array(reference('regulators')).min(2).max(8),
    link: internalPath.default('/trust/'),
  });
