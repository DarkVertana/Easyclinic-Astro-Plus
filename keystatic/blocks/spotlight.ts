import { cta, defineBlock, group, list, md, text, url } from '../fields.ts';

/** `spotlight` section (Zod: src/components/blocks/Spotlight/schema.ts): a paper card beside labelled points. */
export const spotlight = defineBlock('spotlight', 'Research spotlight', {
  paper: group('Paper', {
    badge: text('Badge', { description: 'e.g. Preprint, not yet peer reviewed' }),
    title: text('Title', { required: true }),
    href: url('Link', { required: true }),
    meta: text('Authors, venue and date'),
    linkLabel: text('Link label'),
  }),
  stats: list(
    group('Figure', { value: text('Figure', { required: true }), label: text('Label', { required: true }) }),
    { label: 'Figures', max: 4, itemLabel: (props) => props.fields.value.value || 'Figure' },
  ),
  points: list(
    group('Point', {
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts.' }),
      title: text('Title', { required: true }),
      body: md('Body', { required: true }),
    }),
    { label: 'Points', min: 1, max: 4, itemLabel: (props) => props.fields.title.value || 'Point' },
  ),
  caveat: md('Caveat'),
  link: cta('Link', { optional: true }),
});
