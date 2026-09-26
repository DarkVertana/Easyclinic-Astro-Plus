import type { AstroGlobal } from 'astro';
import { isProduction } from './stage.ts';
import { wrap } from './sentinel.ts';

/**
 * Renders a fact from shared data. When the value is unknown (null) it renders a visible placeholder
 * in preview and fails the build if a published page tries to render it in production.
 */
export function need(astro: AstroGlobal, label: string, value: string | number | null | undefined): string {
  if (value !== null && value !== undefined && value !== '') return String(value);
  guard(astro, label);
  return wrap(`[${label}]`);
}

/** A value that exists but is not confirmed for publication (e.g. a contact name without consent). */
export function unconfirmed(astro: AstroGlobal, label: string, value: string, confirmed: boolean): string {
  if (confirmed) return value;
  guard(astro, label);
  return wrap(value);
}

function guard(astro: AstroGlobal, label: string) {
  const page = astro.locals.page;
  if (isProduction && page?.status === 'published') {
    throw new Error(`Published page ${page.path} renders an unconfirmed fact: ${label}`);
  }
}

/**
 * A publication requirement with no visible value (e.g. consent on file for a testimonial).
 * Returns a small placeholder in preview when unmet; fails published production pages.
 */
export function requireConfirmed(astro: AstroGlobal, label: string, ok: boolean | null | undefined): string {
  if (ok === true) return '';
  guard(astro, label);
  return wrap(`[${label}]`);
}
