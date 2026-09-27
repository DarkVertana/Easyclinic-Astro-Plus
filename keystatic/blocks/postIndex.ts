import { POST_TOPICS, POST_TOPIC_LABELS } from '../../src/schemas/constants.ts';
import { choice, defineBlock, group, int, list, md, text } from '../fields.ts';

/**
 * `postIndex` section (Zod: src/components/blocks/PostIndex/schema.ts): the /blog/ listing (spec 5.19). The posts
 * and start-a-clinic guides come from the registry, grouped by topic and newest first, so this block never needs
 * editing when a post is added or published; it only sets the copy around the list.
 */
export const postIndex = defineBlock('postIndex', 'Blog index', {
  topics: list(
    group('Topic', {
      topic: choice('Topic', POST_TOPICS, { required: true }, { labels: POST_TOPIC_LABELS }),
      heading: text('Heading', { description: 'Leave empty for the topic’s name.' }),
      intro: md('Intro', { description: 'One line under the topic heading.' }),
    }),
    {
      label: 'Topics',
      description:
        'Optional heading and intro per topic group. Topics listed here come first, in this order; the rest follow in the default order under their default names. Topics with nothing published are left out.',
      itemLabel: (props) => (POST_TOPIC_LABELS as Record<string, string>)[props.fields.topic.value] ?? 'Topic',
    },
  ),
  jumpLinksFrom: int('Jump links from', {
    min: 2,
    zodDefault: 3,
    description: 'Show the "Jump to a topic" links once at least this many topic groups are on the page. Empty means 3.',
  }),
});
