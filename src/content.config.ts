import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';

/** Parses a YAML list and gives every row an id taken from `key`, as the file() loader requires. */
const listById = (key: string) => (text: string) =>
  (parseYaml(text) as Array<Record<string, unknown>>).map((row) => ({
    id: `${String(row.match ?? 'exact')}:${String(row[key])}`,
    ...row,
  }));

const matchMode = z.enum(['exact', 'prefix', 'children']);

const redirects = defineCollection({
  loader: file('src/data/redirects.yaml', { parser: listById('from') }),
  schema: z.object({
    from: z.string().startsWith('/'),
    to: z.string().refine((v) => v.startsWith('/') || /^https:\/\//.test(v), { error: 'must be a path or https URL' }),
    match: matchMode.default('exact'),
    status: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
    fallback: z.string().startsWith('/').optional(),
    note: z.string().optional(),
  }),
});

const gone = defineCollection({
  loader: file('src/data/gone.yaml', { parser: listById('path') }),
  schema: z.object({
    path: z.string().startsWith('/'),
    match: matchMode.default('exact'),
    note: z.string().optional(),
  }),
});

export const collections = { redirects, gone };
