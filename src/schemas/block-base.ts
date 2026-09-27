import { z } from 'astro/zod';
import { TONES } from './constants';
import { md } from './fields';
import { SLUG_ID } from './patterns';

/** Fields every section block shares. `id` is the anchor used by in-page links and StickySubnav. */
export const blockBase = {
  id: z.string().regex(SLUG_ID).optional(),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: md.optional(),
  /** Background: sections alternate white and a light wash (section 11). */
  tone: z.enum(TONES).optional(),
  /** Editor's note about this section (sources, decisions). Never rendered or checked (UNRENDERED_KEYS). */
  editorNote: z.string().optional(),
};

/** Keystatic `fields.blocks` shape: `{ discriminant, value }`. */
export function block<N extends string, S extends z.ZodRawShape>(name: N, shape: S) {
  return z.object({
    discriminant: z.literal(name),
    value: z.object({ ...blockBase, ...shape }),
  });
}
