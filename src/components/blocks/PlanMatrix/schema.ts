import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';

export const schema = () => block('planMatrix', { open: z.boolean().default(false) });
