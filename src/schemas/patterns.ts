/**
 * Regular expressions shared by the Zod content schemas and the Keystatic field definitions (keystatic/), so the
 * two schema systems accept the same strings. A pure module: no Astro, Zod or Node imports, because
 * keystatic.config.ts is bundled into the browser.
 */

/** Site-internal path in canonical form: leading and trailing slash, optional #anchor, or a /file.xml|txt|pdf. */
export const INTERNAL_PATH = /^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9-]+)?$|^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:xml|txt|pdf)$/;

/** The non-internal half of `href`: absolute https URL, tel: or mailto: (a prefix check, as the Zod schema has always done). */
export const EXTERNAL_HREF = /^(https:\/\/|tel:|mailto:)/;

/** Internal path, https URL, tel: or mailto: as one regex (the Zod side keeps the two-branch union). */
export const HREF = new RegExp(`${INTERNAL_PATH.source}|${EXTERNAL_HREF.source}`);

/** Anchor ids, entry file names and list ids: lowercase letters, digits and hyphens. */
export const SLUG_ID = /^[a-z0-9-]+$/;

/** Legal entry ids may sit one or more folders deep (`privacy/india`). */
export const LEGAL_SLUG = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

/** 24-hour clock time, e.g. 09:12. */
export const TIME_24H = /^\d{1,2}:\d{2}$/;

/** Digits only (WhatsApp numbers in wa.me form). */
export const DIGITS = /^\d+$/;

/** A calendar date without a time: YYYY-MM-DD. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A plain email check; Zod's `z.email()` stays authoritative. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
