import { YAML_SCREENSHOT_PATH, choice, defineBlock, group, image, list, text } from '../fields.ts';

/** `photoGallery` section (Zod: src/components/blocks/PhotoGallery/schema.ts): a bento grid of photos with a lightbox. */
export const photoGallery = defineBlock('photoGallery', 'Photo gallery', {
  photos: list(
    group('Photo', {
      image: image('Photo', YAML_SCREENSHOT_PATH),
      alt: text('Alt text', { required: true }),
      size: choice('Tile size', ['normal', 'wide', 'large'] as const, { zodDefault: 'normal' }, {
        labels: { normal: 'Normal (1 tile)', wide: 'Wide (2 across)', large: 'Large (2 by 2)' },
      }),
    }),
    { label: 'Photos', min: 2, max: 24, itemLabel: (props) => props.fields.alt.value || 'Photo' },
  ),
});
