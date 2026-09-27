import { SLUG_ID } from '../../src/schemas/patterns.ts';
import { defineBlock, group, list, md, path, text, url } from '../fields.ts';

/**
 * `glossaryList` section (Zod: src/components/blocks/GlossaryList/schema.ts): the glossary (spec 5.19). Each term is
 * its own anchor and links to the page that goes deeper; the list renders alphabetically and is also emitted as a
 * schema.org DefinedTermSet. Zod also checks that ids are unique and that each definition is 40 to 120 words; this
 * form cannot, so the build and the dev preview toolbar report them.
 */
export const glossaryList = defineBlock('glossaryList', 'Glossary', {
  terms: list(
    group('Term', {
      id: text('Anchor id', {
        required: true,
        pattern: SLUG_ID,
        patternMessage: 'Lowercase letters, digits and hyphens',
        description: 'The term’s anchor (/glossary/#id). Unique in the list; changing it breaks links to the term.',
      }),
      term: text('Term', { required: true }),
      aka: text('Also known as', { description: 'Shown in brackets after the term, e.g. an abbreviation.' }),
      definition: md('Definition', { required: true, description: 'Aim for 60 to 100 words; the build rejects fewer than 40 or more than 120.' }),
      href: path('Read more link', { description: 'The page that goes deeper, e.g. /features/emr/.' }),
      hrefLabel: text('Read more label', { description: 'Defaults to the linked page’s name, or "Read more".' }),
      source: url('Official source', { description: 'A regulator’s or standard body’s page for the term.' }),
    }),
    { label: 'Terms', min: 10, itemLabel: (props) => props.fields.term.value || 'Term' },
  ),
});
