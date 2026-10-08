import { cta, defineBlock, md, media } from '../fields.ts';

/**
 * `splitContent` section (Zod: src/components/blocks/SplitContent/schema.ts): text with up to two buttons on the
 * left and an image on the right.
 */
export const splitContent = defineBlock('splitContent', 'Split content', {
  body: md('Body', { required: true }),
  link: cta('Main button', { optional: true }),
  secondary: cta('Second button', { optional: true }),
  media: media('Media'),
});
