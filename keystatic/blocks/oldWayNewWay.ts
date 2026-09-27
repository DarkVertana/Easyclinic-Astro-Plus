import { defineBlock, group, media, stringList, text } from '../fields.ts';

/** One side of the comparison: the same fields for the old way and the new way. */
function side(label: string, description: string) {
  return group(
    label,
    {
      title: text('Title', { required: true }),
      items: stringList('Items', 'Item', { min: 2, max: 6 }),
      media: media('Media', { optional: true }),
    },
    { description },
  );
}

/**
 * `oldWayNewWay` section (Zod: src/components/blocks/OldWayNewWay/schema.ts): section 11 "old way vs new way": paper,
 * WhatsApp and Excel on the left, one system on the right. Photos are never framed.
 */
export const oldWayNewWay = defineBlock('oldWayNewWay', 'Old way, new way', {
  old: side('Old way', 'Each item shows a cross. Generated imagery may set the scene on this side only (tick "AI-generated image").'),
  next: side('New way', 'The EasyClinic way; each item shows a tick. Media here must be a product screenshot: a generated image is held back and blocks publishing.'),
});
