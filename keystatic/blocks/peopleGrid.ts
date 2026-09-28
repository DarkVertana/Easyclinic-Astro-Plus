import { defineBlock, group, list, md, ref } from '../fields.ts';

/**
 * `peopleGrid` section (Zod: src/components/blocks/PeopleGrid/schema.ts): the people who run the company, with the
 * photo, name and role from src/data/authors and a background written for the page (spec 5.19 /about-us/).
 */
export const peopleGrid = defineBlock('peopleGrid', 'People', {
  items: list(
    group('Person', {
      author: ref('Person', 'authors', { required: true, description: 'Photo, name and role come from this author file (src/data/authors).' }),
      background: md('Background', { required: true, description: 'One or two plain, sourced sentences: no unverified exits, awards or superlatives.' }),
    }),
    { label: 'People', min: 1, max: 12, itemLabel: (props) => props.fields.author.value || 'Person' },
  ),
});
