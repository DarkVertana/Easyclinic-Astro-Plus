import { z } from 'astro/zod';
import { md } from './fields';

/** Fields every section block shares. `id` is the anchor used by in-page links and StickySubnav. */
export const blockBase = {
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: md.optional(),
  /** Background: sections alternate white and a light wash (section 11). */
  tone: z.enum(['plain', 'wash', 'inverse']).optional(),
};

/** Keystatic `fields.blocks` shape: `{ discriminant, value }`. */
export function block<N extends string, S extends z.ZodRawShape>(name: N, shape: S) {
  return z.object({
    discriminant: z.literal(name),
    value: z.object({ ...blockBase, ...shape }),
  });
}
