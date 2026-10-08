/**
 * Optional objects ("groups") and when they count as filled in.
 *
 * Keystatic always writes an object field, so an optional group the writer never touched is saved as `{}` or with
 * only its defaulted keys (`heroMedia: { kind: screenshot, frame: browser, aiGenerated: false }`). A group counts as
 * present only when one of its `presentIf` keys holds a value. The Zod side (`optionalGroup` in fields.ts) and the
 * Keystatic side (`optionalGroup` in keystatic/fields.ts) use these same lists; scripts that audit raw YAML
 * (lint-content, report-facts) apply `blankGroupsToUndefined` first, so they agree with the build.
 *
 * A pure module: no Astro, Zod or Node imports.
 */

export const MEDIA_PRESENT_IF = ['alt', 'src', 'needed', 'caption', 'videoUrl'] as const;
export const CTA_PRESENT_IF = ['label', 'href', 'event'] as const;
export const NAV_LINK_PRESENT_IF = ['label', 'href', 'description', 'icon'] as const;
export const HERO_STRIP_PRESENT_IF = ['regulators', 'ratings', 'study'] as const;
export const CLOSING_PRESENT_IF = ['heading', 'body', 'primary'] as const;
export const SHOWCASE_PRESENT_IF = ['heading', 'intro'] as const;
export const ORBIT_PRESENT_IF = ['center'] as const;
export const PROBLEMS_PRESENT_IF = ['heading', 'intro'] as const;
export const EDITORIAL_PASS_PRESENT_IF = ['by', 'on', 'onlyUsCouldWrite', 'readsMachineWritten'] as const;
export const CLAIMS_REVIEW_PRESENT_IF = ['by', 'on'] as const;

/**
 * Optional groups by the key they sit under. Every place these keys hold an object, the object is optional:
 * `heroMedia` and `media` (media), `secondary` and `link` (call to action; `regulatorStrip.link` is a string and
 * is left alone), `footerLink` (nav link) and the page-level groups.
 */
export const OPTIONAL_GROUP_KEYS: Readonly<Record<string, readonly string[]>> = {
  heroMedia: MEDIA_PRESENT_IF,
  media: MEDIA_PRESENT_IF,
  secondary: CTA_PRESENT_IF,
  link: CTA_PRESENT_IF,
  footerLink: NAV_LINK_PRESENT_IF,
  heroStrip: HERO_STRIP_PRESENT_IF,
  closing: CLOSING_PRESENT_IF,
  showcase: SHOWCASE_PRESENT_IF,
  orbit: ORBIT_PRESENT_IF,
  problems: PROBLEMS_PRESENT_IF,
  editorialPass: EDITORIAL_PASS_PRESENT_IF,
  claimsReview: CLAIMS_REVIEW_PRESENT_IF,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** Whether a value says anything: not '', null, undefined, [] or false; an object only if one of its values does. */
export function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.values(value).some(hasValue);
  return true;
}

/** True when `value` is an object and none of its `presentIf` keys holds a value. */
export function isBlankGroup(value: unknown, presentIf: readonly string[]): boolean {
  return isPlainObject(value) && !presentIf.some((key) => hasValue(value[key]));
}

/** Preprocess step for a Zod optional group: a blank object becomes `undefined`; anything else passes through. */
export function blankToUndefined(presentIf: readonly string[]) {
  return (value: unknown): unknown => (isBlankGroup(value, presentIf) ? undefined : value);
}

/**
 * Returns a copy of raw entry data with every blank optional group removed, as the Zod schemas see it. Scripts
 * that audit the raw YAML (lint-content, report-facts) call this first; otherwise a saved `editorialPass: {}`
 * would count as present and lint would pass a page the build rejects.
 */
export function blankGroupsToUndefined<T>(data: T): T {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const presentIf = OPTIONAL_GROUP_KEYS[key];
      if (presentIf && isBlankGroup(item, presentIf)) continue;
      out[key] = visit(item);
    }
    return out;
  };
  return visit(data) as T;
}
