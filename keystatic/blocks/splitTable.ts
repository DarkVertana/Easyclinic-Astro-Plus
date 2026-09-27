import { defineBlock, group, md, stringList, text } from '../fields.ts';

/**
 * `splitTable` section (Zod: src/components/blocks/SplitTable/schema.ts): two sides side by side, such as what head
 * office locks against what a branch adjusts (spec 5.7), or any two-sided comparison.
 */
const side = (label: string, example: string) =>
  group(label, {
    title: text('Title', { required: true, description: `E.g. "${example}".` }),
    icon: text('Icon', { description: 'A Lucide icon name listed in src/components/ui/icons.ts, e.g. building-2.' }),
    items: stringList('Items', 'Item', { md: true, min: 2, max: 10 }),
  });

export const splitTable = defineBlock('splitTable', 'Split table', {
  left: side('Left side', 'Head office sets'),
  right: side('Right side', 'Each branch adjusts'),
  note: md('Note', { description: 'Shown under both sides.' }),
});
