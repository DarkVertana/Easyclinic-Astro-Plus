import { reference } from 'astro:content';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

export const schema = () =>
  block('demoForm', {
    country: reference('countries').optional(),
    promise: md.optional(),
  });
