/**
 * Stand-in for `astro:content` when the schemas run under plain node (scripts/lint-content.ts). A reference
 * becomes `{ collection, id }` as it does in Astro; whether the id exists is left to the build.
 */
import { z } from 'astro/zod';

export const reference = (collection: string) => z.string().transform((id) => ({ collection, id }));
export type SchemaContext = { image: () => z.ZodType };
