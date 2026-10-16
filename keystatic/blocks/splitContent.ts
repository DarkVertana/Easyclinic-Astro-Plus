import { cta, defineBlock, flag, md, media } from '../fields.ts';

/**
 * `splitContent` section (Zod: src/components/blocks/SplitContent/schema.ts): text with up to two buttons on the
 * left and an image on the right.
 */
export const splitContent = defineBlock('splitContent', 'Split content', {
  body: md('Body', { required: true }),
  link: cta('Main button', { optional: true }),
  secondary: cta('Second button', { optional: true }),
  media: media('Media'),
  centerHeading: flag('Centre the heading above both columns', { zodDefault: false }),
  stickyMedia: flag('Keep the image in view while the text scrolls', { zodDefault: false, description: 'Wide screens only.' }),
  alignTop: flag('Align the columns at the top', { zodDefault: false }),
  mediaFirst: flag('Image on the left', { zodDefault: false, description: 'On wide screens; below that the image follows the text.' }),
});
