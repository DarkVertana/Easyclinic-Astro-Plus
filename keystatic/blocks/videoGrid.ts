import { YAML_SCREENSHOT_PATH, cta, defineBlock, group, image, list, text } from '../fields.ts';

/**
 * `videoGrid` section (Zod: src/components/blocks/VideoGrid/schema.ts): YouTube videos as thumbnails with a play
 * button; the player loads on click.
 */
export const videoGrid = defineBlock('videoGrid', 'Video grid', {
  videos: list(
    group('Video', {
      title: text('Title', { required: true, description: 'Who is speaking, as the video is titled on YouTube.' }),
      youtubeId: text('YouTube video id', {
        required: true,
        pattern: /^[A-Za-z0-9_-]{11}$/,
        patternMessage: 'The 11 characters after youtu.be/ in the video link',
        description: 'e.g. EhGn45zbOoU from https://youtu.be/EhGn45zbOoU',
      }),
      thumbnail: image('Thumbnail', YAML_SCREENSHOT_PATH),
      duration: text('Duration', { description: 'Running time as shown on YouTube, e.g. 1:14.' }),
    }),
    { label: 'Videos', min: 1, max: 12, itemLabel: (props) => props.fields.title.value || 'Video' },
  ),
  link: cta('Link under the grid', { optional: true }),
});
