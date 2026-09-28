import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';
import { MEDIA_FRAMES, MEDIA_KINDS, MEDIA_ORIGINS } from './constants.ts';
import { CTA_PRESENT_IF, MEDIA_PRESENT_IF, blankToUndefined } from './groups.ts';
import { EXTERNAL_HREF, INTERNAL_PATH, ISO_DATE, YEAR_MONTH } from './patterns.ts';

export { blankGroupsToUndefined } from './groups.ts';

/**
 * Markdown string. Supports inline markdown, links, and tokens such as {price:inr.professional.annual}.
 * Unknown facts are written as [bracketed placeholders]; see src/lib/rules.
 */
export const md = z.string().min(1);

/** Site-internal path in canonical form: leading and trailing slash, optional #anchor. */
export const internalPath = z.string().regex(INTERNAL_PATH, {
  error: 'Internal paths are lowercase with a trailing slash, e.g. /features/emr/',
});

/** Internal path or absolute https URL (external links, tel:, mailto:, WhatsApp). */
export const href = z.union([internalPath, z.string().regex(EXTERNAL_HREF)]);

export const cta = z.object({
  label: z.string().min(1),
  href,
  /** Analytics label; defaults to the CTA label. */
  event: z.string().optional(),
});

/**
 * An optional object. Keystatic always writes an object field, so a group the writer left empty arrives as `{}`
 * or with only its defaulted keys; it counts as absent unless one of its `presentIf` keys holds a value
 * (src/schemas/groups.ts). Once present, the group must be complete.
 */
export const optionalGroup = <T extends z.ZodType>(schema: T, presentIf: readonly string[]) =>
  z.preprocess(blankToUndefined(presentIf), schema.optional()).optional();

/** An optional call to action (a blank one is absent). */
export const optionalCta = optionalGroup(cta, CTA_PRESENT_IF);

/**
 * A value the company must supply. `null` renders as a placeholder in preview and blocks publishing. The key is
 * required: an unknown value is written as an explicit `null`, never left out and never written as ''.
 */
export const unknown = <T extends z.ZodType>(schema: T) =>
  schema.nullable().refine((value: unknown) => value !== '', { error: 'Write null for an unknown value, not an empty string' });

/**
 * A calendar date without a time. YAML gives an unquoted date as a Date at UTC midnight (Astro, Keystatic) or as
 * a string (the `yaml` package in scripts); a quoted value must be YYYY-MM-DD. A time would be lost when Keystatic
 * saves the entry, so it is rejected.
 */
export const isoDate = z
  .union([
    z.date().refine((d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0, {
      error: 'Use a date without a time, YYYY-MM-DD',
    }),
    z.string().regex(ISO_DATE, { error: 'Use a date without a time, YYYY-MM-DD' }),
  ])
  .transform((value) => new Date(value))
  .pipe(z.date());

/**
 * Hero and section media. Screenshots come from the seeded demo tenant (spec 12); until one exists,
 * `src` is empty and `needed` describes the screen from the screenshot brief. A media item with
 * no src is treated as a placeholder and cannot be published. Files live in the shared library
 * `src/assets/images/screens/` (docs/image-plan.md 4), so one screen can serve several pages.
 */
export const media = ({ image }: SchemaContext) =>
  z.object({
    kind: z.enum(MEDIA_KINDS).default('screenshot'),
    src: image().optional(),
    /** The screen or image needed, from the spec 12 brief. */
    needed: z.string().optional(),
    alt: z.string().min(1),
    caption: z.string().optional(),
    frame: z.enum(MEDIA_FRAMES).default('browser'),
    /** Generated environmental imagery must never be presented as a customer (spec 12). */
    aiGenerated: z.boolean().default(false),
    videoUrl: z.url().optional(),
    /** `old-site`: an interim capture from easyclinic.io, to be replaced by the demo-tenant capture (docs/image-plan.md 3.1). */
    origin: z.enum(MEDIA_ORIGINS).default('demo-tenant'),
    /** The month the screen was captured, YYYY-MM (for an old-site screen, the upload month in its old URL). */
    capturedOn: z.string().regex(YEAR_MONTH, { error: 'Use a month, YYYY-MM' }).optional(),
    /**
     * When the company confirmed an old-site screen still matches the current product. Left out until then: preview
     * labels the image "Interim capture" and lint-content warns, but the page can publish.
     */
    uiConfirmedOn: isoDate.optional(),
  });

/** Optional media (a blank one, as Keystatic saves an untouched media group, is absent). */
export const optionalMedia = (ctx: SchemaContext) => optionalGroup(media(ctx), MEDIA_PRESENT_IF);

export const faqItem = z.object({
  question: z.string().min(1),
  answer: md,
  lastVerified: isoDate.optional(),
});
