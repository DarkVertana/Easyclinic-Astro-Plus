import { PROSE_WIDTHS } from '../../src/schemas/constants.ts';
import { choice, cta, defineBlock, md } from '../fields.ts';

/** A few words of a Markdown string for the sections list. */
function preview(value: string): string {
  const words = value.replace(/[*_[\]()#>`]/g, '').trim().split(/\s+/).slice(0, 8).join(' ');
  return words.length > 0 ? `${words}…` : '';
}

/** `prose` section (Zod: src/components/blocks/Prose/schema.ts): Markdown text, with an optional side panel. */
export const prose = defineBlock(
  'prose',
  'Prose',
  {
    body: md('Body', { required: true }),
    aside: md('Aside', { description: 'A side panel next to the body.' }),
    width: choice('Width', PROSE_WIDTHS, { zodDefault: 'measure' }, {
      labels: { measure: 'Reading width', wide: 'Page width' },
      description: 'With an aside the section always uses the page width.',
    }),
    link: cta('Main button', { optional: true }),
    secondary: cta('Second button', { optional: true }),
  },
  (props) => `Prose: ${props.fields.heading.value || preview(props.fields.body.value) || 'empty'}`,
);
