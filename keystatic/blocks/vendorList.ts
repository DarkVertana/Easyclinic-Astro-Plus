import { SLUG_ID } from '../../src/schemas/patterns.ts';
import { date, defineBlock, flag, group, int, list, md, stringList, text, url } from '../fields.ts';

/**
 * `vendorList` section (Zod: src/components/blocks/VendorList/schema.ts): one section per vendor for listicles
 * (spec 5.14), Easy Clinic with the same structure as everyone else. Rules Zod checks and this form cannot (the build
 * and the dev preview toolbar report them): no fact reads "Check", and every competitor fact has a source and a
 * checked-on date unless it reads "Not published".
 */
export const vendorList = defineBlock('vendorList', 'Vendor list', {
  vendors: list(
    group('Vendor', {
      id: text('Anchor id', {
        required: true,
        pattern: SLUG_ID,
        patternMessage: 'Lowercase letters, digits and hyphens',
        description: 'The vendor’s anchor on the page (#id), e.g. practo.',
      }),
      name: text('Name', { required: true }),
      rank: int('Rank', { min: 1, description: 'Shown before the name ("1. Practo"). Leave empty for an unranked list.' }),
      us: flag('This vendor is Easy Clinic', { zodDefault: false, description: 'Marks the section as ours. Easy Clinic’s own facts need no source.' }),
      bestFor: text('Best for', { required: true, description: 'Shown as "Best for: …".' }),
      url: url('Website'),
      body: md('Body', { required: true, description: '120 to 180 words (spec 5.14).' }),
      pros: stringList('Strengths', 'Strength', { md: true, min: 1, max: 5 }),
      cons: stringList('Limits', 'Limit', { md: true, min: 1, max: 5 }),
      facts: list(
        group('Fact', {
          label: text('Label', { required: true, description: 'E.g. "Pricing".' }),
          value: md('Value', { required: true, description: 'The fact. When the vendor does not say, write "Not published". Never write "Check".' }),
          source: url('Source', { description: 'Where a competitor fact comes from. Required for competitors, unless the value reads "Not published".' }),
          checkedOn: date('Checked on', { description: 'The day the source was checked. Required with the source for competitors.' }),
        }),
        { label: 'Key facts', itemLabel: (props) => props.fields.label.value || 'Fact' },
      ),
    }),
    {
      label: 'Vendors',
      min: 2,
      max: 10,
      itemLabel: (props) => {
        const { rank, name } = props.fields;
        return (rank.value ? `${rank.value}. ` : '') + (name.value || 'Vendor');
      },
    },
  ),
});
