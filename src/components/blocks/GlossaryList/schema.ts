import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { internalPath, md } from '../../../schemas/fields';

/**
 * Glossary (spec 5.19: definitions of 60 to 100 words, each its own anchor, each linking to the page
 * that goes deeper). Rendered alphabetically; also emitted as a schema.org DefinedTermSet.
 */
export const schema = () =>
  block('glossaryList', {
    terms: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          term: z.string(),
          aka: z.string().optional(),
          definition: md,
          href: internalPath.optional(),
          hrefLabel: z.string().optional(),
          source: z.url().optional(),
        }),
      )
      .min(10),
  }).superRefine((b, ctx) => {
    const seen = new Set<string>();
    b.value.terms.forEach((t, i) => {
      if (seen.has(t.id)) ctx.addIssue({ code: 'custom', path: ['value', 'terms', i, 'id'], message: `Duplicate glossary id ${t.id}` });
      seen.add(t.id);
      const words = t.definition.split(/\s+/).filter(Boolean).length;
      if (words < 40 || words > 120) ctx.addIssue({ code: 'custom', path: ['value', 'terms', i, 'definition'], message: `"${t.term}" definition is ${words} words; aim for 60 to 100` });
    });
  });
