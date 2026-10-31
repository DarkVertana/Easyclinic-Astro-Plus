import { cta, defineBlock, flag, md, media, text } from '../fields.ts';

/**
 * `splitContent` section (Zod: src/components/blocks/SplitContent/schema.ts): text with up to two buttons on the
 * left and an image on the right.
 */
export const splitContent = defineBlock('splitContent', 'Split content', {
  body: md('Body', { required: true }),
  link: cta('Main button', { optional: true }),
  secondary: cta('Second button', { optional: true }),
  media: media('Media'),
  media2: media('Second image', { optional: true }),
  centerHeading: flag('Centre the heading above both columns', { zodDefault: false }),
  headingAccent: text('Heading accent', { description: 'A word or phrase from the heading shown in teal, e.g. flexible.' }),
  stickyMedia: flag('Keep the image in view while the text scrolls', { zodDefault: false, description: 'Wide screens only.' }),
  alignTop: flag('Align the columns at the top', { zodDefault: false }),
  narrowMedia: flag('Narrow image column (45/55)', { zodDefault: false, description: 'Wide screens: the image takes 45% and the text 55%.' }),
  mediaStage: flag('Image on a tinted panel', { zodDefault: false, description: 'For wide, short screenshots: centred on a soft panel as tall as the text.' }),
  mediaTop: flag('Image on top, points in two columns', { zodDefault: false, description: 'The image runs the full width above the text.' }),
  mediaFirst: flag('Image on the left', { zodDefault: false, description: 'On wide screens; below that the image follows the text.' }),
});
