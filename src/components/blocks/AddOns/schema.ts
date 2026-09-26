import { reference } from 'astro:content';
import { block } from '../../../schemas/block-base';

export const schema = () => block('addOns', { currency: reference('prices') });
