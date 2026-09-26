import { reference } from 'astro:content';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.13 block 4: local price card, payment rails, tax invoicing and payers. */
export const schema = () =>
  block('countryMoney', {
    country: reference('countries'),
    currency: reference('prices'),
    payersNote: md.optional(),
  });
