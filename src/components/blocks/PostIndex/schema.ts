import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { POST_TOPICS } from '../../../schemas/constants';
import { md } from '../../../schemas/fields';

/**
 * The /blog/ listing (spec 5.19): every visible post, plus every start-a-clinic guide, grouped by topic
 * and newest first within a topic. The list itself comes from the registry, so it never needs editing
 * when a post is added or published; the entry only sets the copy around it.
 */
export const schema = () =>
  block('postIndex', {
    /**
     * Optional heading and one-line intro per topic group. Topics listed here come first, in this order;
     * the rest follow in the default order (src/schemas/constants.ts) under their default labels.
     */
    topics: z
      .array(
        z.object({
          topic: z.enum(POST_TOPICS),
          heading: z.string().optional(),
          intro: md.optional(),
        }),
      )
      .default([]),
    /** Show the "Jump to a topic" links once at least this many topic groups are on the page. */
    jumpLinksFrom: z.number().int().min(2).default(3),
  });
