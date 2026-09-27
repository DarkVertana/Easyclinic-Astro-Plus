import { PROOF_VARIANTS } from '../../src/schemas/constants.ts';
import { choice, cta, defineBlock, group, list, md, media, ref, stringList, text, url } from '../fields.ts';

const VARIANT_LABELS = {
  study: 'Study figures',
  customer: 'Named customer',
  badges: 'Review badges',
  screenshot: 'Captioned screenshot',
} as const;

/**
 * `proofBlock` section (Zod: src/components/blocks/ProofBlock/schema.ts): one page-specific proof block (spec 2.4):
 * study figures (from study.yaml), one named customer, review badges with counts, or a captioned screenshot that
 * repeats the claim. Fill in the fields for the chosen variant; the others are ignored.
 */
export const proofBlock = defineBlock('proofBlock', 'Proof block', {
  variant: choice('Variant', PROOF_VARIANTS, { required: true }, { labels: VARIANT_LABELS, description: 'The kind of proof. Each variant uses its own fields below.' }),
  figures: stringList('Study figures', 'Figure id', {
    description: 'Study variant: figure ids from study.yaml (visits, diagnostic-errors, …). Each renders with its citation; a figure without a verified source cannot be published.',
  }),
  testimonial: ref('Testimonial', 'testimonials', { description: 'Customer variant: the named customer’s quote.' }),
  badges: list(
    group('Badge', {
      label: text('Review site', { required: true, description: 'e.g. Capterra, Google.' }),
      rating: text('Rating', { required: true, description: 'A facts.yaml token, e.g. {fact:capterraRating}.' }),
      count: text('Review count', { description: 'A facts.yaml token, e.g. {fact:capterraReviews}. Empty: a placeholder in preview, left out on the live site.' }),
      href: url('Reviews link', { description: 'The public reviews page (https://).' }),
    }),
    { label: 'Review badges', description: 'Badges variant.', itemLabel: (props) => props.fields.label.value || 'Badge' },
  ),
  media: media('Media', { optional: true }),
  body: md('Body', { description: 'Shown with the figures, beside the quote or beside the screenshot.' }),
  link: cta('Link', { optional: true }),
});
