import { cta, defineBlock, group, list, md, media, text } from '../fields.ts';

/**
 * `featureTabs` section (Zod: src/components/blocks/FeatureTabs/schema.ts): product areas as tabs, each panel with a
 * body, a list of key capabilities, an optional link and a screenshot.
 */
export const featureTabs = defineBlock('featureTabs', 'Feature tabs', {
  tabs: list(
    group('Tab', {
      label: text('Label', { required: true }),
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. pill.' }),
      body: md('Body', { required: true }),
      capabilitiesLabel: text('Capabilities label', { description: 'Default: Key capabilities.' }),
      capabilities: list(
        group('Capability', {
          label: text('Label', { required: true }),
          icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts. Empty: a tick.' }),
        }),
        { label: 'Capabilities', min: 1, max: 8, itemLabel: (props) => props.fields.label.value || 'Capability' },
      ),
      media: media('Media', { optional: true }),
      link: cta('Link', { optional: true }),
    }),
    { label: 'Tabs', min: 2, max: 6, itemLabel: (props) => props.fields.label.value || 'Tab' },
  ),
});
