import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath } from '../../../schemas/fields';

export const schema = () =>
  block('contentCards', {
    items: z
      .array(z.object({ href: internalPath.optional(), label: z.string().optional(), description: z.string().optional(), icon: z.string().optional() }))
      .min(1)
      .max(6),
    /** default: plain link cards. articles: a tinted icon band, reading time, three-line summary and a "Read article" footer.
        info: the same icon band over a title and text, with no link (/features/patient-engagement/). */
    variant: z.enum(['default', 'articles', 'info']).default('default'),
  })
  .refine((b) => b.value.variant === 'info' ? b.value.items.every((i) => i.label && i.description) : b.value.items.every((i) => i.href), {
    error: 'Link cards need an href on every item; info cards need a label and a description on every item',
    path: ['value', 'items'],
  });
