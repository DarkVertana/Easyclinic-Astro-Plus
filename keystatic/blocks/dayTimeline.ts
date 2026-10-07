import { TIME_24H } from '../../src/schemas/patterns.ts';
import { defineBlock, group, list, md, path, text } from '../fields.ts';

/**
 * `dayTimeline` section (Zod: src/components/blocks/DayTimeline/schema.ts): "A Tuesday with and without Easy Clinic",
 * a timed vertical timeline (spec 5.5). The two column labels have Zod defaults, so an empty field means the default.
 */
export const dayTimeline = defineBlock('dayTimeline', 'Day timeline', {
  beforeLabel: text('Before label', { description: 'Label for the day without Easy Clinic. Leave empty for "Without Easy Clinic".' }),
  afterLabel: text('After label', { description: 'Label for the day with Easy Clinic. Leave empty for "With Easy Clinic".' }),
  entries: list(
    group('Entry', {
      time: text('Time', { required: true, pattern: TIME_24H, patternMessage: 'Use 24-hour time, e.g. 09:12', description: '24-hour time, e.g. 09:12.' }),
      title: text('Title', { required: true }),
      before: md('Before', { description: 'How this moment goes without Easy Clinic.' }),
      after: md('After', { required: true, description: 'How this moment goes with Easy Clinic.' }),
      href: path('Link', { description: 'A page that explains the feature behind this moment, e.g. /features/emr/.' }),
    }),
    {
      label: 'Entries',
      min: 3,
      max: 10,
      itemLabel: (props) => [props.fields.time.value, props.fields.title.value].filter(Boolean).join(' ') || 'Entry',
    },
  ),
});
