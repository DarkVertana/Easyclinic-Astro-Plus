import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';

/**
 * Markdown string. Supports inline markdown, links, and tokens such as {price:inr.professional.annual}.
 * Unknown facts are written as [bracketed placeholders]; see src/lib/rules.
 */
export const md = z.string().min(1);

/** Site-internal path in canonical form: leading and trailing slash, optional #anchor. */
export const internalPath = z
  .string()
  .regex(/^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9-]+)?$|^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:xml|txt|pdf)$/, {
    error: 'Internal paths are lowercase with a trailing slash, e.g. /features/emr/',
  });

/** Internal path or absolute https URL (external links, tel:, mailto:, WhatsApp). */
export const href = z.union([internalPath, z.string().regex(/^(https:\/\/|tel:|mailto:)/)]);

export const cta = z.object({
  label: z.string().min(1),
  href,
  /** Analytics label; defaults to the CTA label. */
  event: z.string().optional(),
});

/** A value the company must supply. `null` renders as a placeholder in preview and blocks publishing. */
export const unknown = <T extends z.ZodType>(schema: T) => schema.nullable();

export const isoDate = z.coerce.date();

/**
 * Hero and section media. Screenshots come from the seeded demo tenant (spec 12); until one exists,
 * `src` is empty and `needed` describes the screen from the screenshot brief. A media item with
 * no src is treated as a placeholder and cannot be published.
 */
export const media = ({ image }: SchemaContext) =>
  z.object({
    kind: z.enum(['screenshot', 'photo', 'video']).default('screenshot'),
    src: image().optional(),
    /** The screen or image needed, from the spec 12 brief. */
    needed: z.string().optional(),
    alt: z.string().min(1),
    caption: z.string().optional(),
    frame: z.enum(['browser', 'phone', 'none']).default('browser'),
    /** Generated environmental imagery must never be presented as a customer (spec 12). */
    aiGenerated: z.boolean().default(false),
    videoUrl: z.url().optional(),
  });

export const faqItem = z.object({
  question: z.string().min(1),
  answer: md,
  lastVerified: isoDate.optional(),
});
