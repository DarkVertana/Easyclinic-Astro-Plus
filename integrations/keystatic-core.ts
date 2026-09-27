/**
 * Pure helpers for the Keystatic gate (integrations/keystatic-gate.ts) and its admin middleware
 * (integrations/keystatic-middleware.ts): when Keystatic is on, how admin URLs are rewritten in dev, and the admin
 * page's Content-Security-Policy. Plain erasable TypeScript, unit-tested in tests/unit/keystatic-gate.test.ts.
 * Design: docs/keystatic-design.md sections 3 and 4.
 */

export type KeystaticStorage = 'local' | 'github';
export type AstroCommand = 'dev' | 'build' | 'preview' | 'sync';

export interface KeystaticDecision {
  enabled: boolean;
  storage: KeystaticStorage;
  /** `owner/name`, in github mode. */
  repo?: string;
  reason: string;
}

/**
 * Whether this Astro run includes Keystatic. Never in production: not when the content stage is production (the
 * same rule as src/lib/content/stage.ts), and not on a Vercel production deployment whatever CONTENT_STAGE says.
 * Never under Vitest, whose config loader runs integrations as `dev`. Otherwise always in `astro dev`, and in a
 * build only with github storage: a local-storage admin on a serverless preview could not save.
 */
export function keystaticDecision(env: Record<string, string | undefined>, command: AstroCommand): KeystaticDecision {
  const storage: KeystaticStorage = env.KEYSTATIC_STORAGE === 'github' ? 'github' : 'local';
  const off = (reason: string): KeystaticDecision => ({ enabled: false, storage, reason });
  if (env.VITEST) return off('running under Vitest');
  if (env.VERCEL_ENV === 'production') return off('Vercel production deployment');
  if (env.CONTENT_STAGE === 'production' || (!env.CONTENT_STAGE && env.VERCEL_ENV === 'production')) return off('production content stage');
  if (command !== 'dev' && !(command === 'build' && storage === 'github')) {
    return off(command === 'build' ? 'build without KEYSTATIC_STORAGE=github' : `astro ${command}`);
  }
  if (storage === 'github') {
    const repo = env.KEYSTATIC_GITHUB_REPO ?? '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new Error(`keystatic-gate: KEYSTATIC_STORAGE=github needs KEYSTATIC_GITHUB_REPO=owner/name (got "${repo}")`);
    }
    return { enabled: true, storage, repo, reason: `github storage (${repo})` };
  }
  return { enabled: true, storage, reason: 'local storage in astro dev' };
}

/**
 * Dev-server URL rewrite (runs ahead of Astro's own trailing-slash check). The admin is one client-only page whose
 * router reads the browser URL and shows "Not found" for a trailing slash on a deep URL, so every /keystatic URL is
 * served by /keystatic/ without a redirect. Keystatic calls its API without a trailing slash, which Astro's dev
 * server answers with a 404, so the slash is added (the API handler ignores empty segments). Query strings are kept.
 *
 * A /keystatic path whose last segment has a file extension is left alone: in dev, Vite serves the modules in the
 * repo's keystatic/ folder at /keystatic/fields.ts and so on, and the admin must be able to load them. Admin URLs
 * never end in an extension (entry slugs are lowercase letters, digits and hyphens).
 */
export function rewriteKeystaticDevUrl(url: string): string {
  const q = url.indexOf('?');
  const pathname = q < 0 ? url : url.slice(0, q);
  const search = q < 0 ? '' : url.slice(q);
  if (/^\/keystatic(?:\/|$)/.test(pathname)) return /\.[a-z0-9]+$/i.test(pathname) ? url : `/keystatic/${search}`;
  if (/^\/api\/keystatic(?:\/|$)/.test(pathname) && !pathname.endsWith('/')) return `${pathname}/${search}`;
  return url;
}

/**
 * The admin page's policy. Keystatic's UI inserts <style> elements at runtime (Emotion, no nonce), loads Inter from
 * Google Fonts and, in github mode, calls the GitHub API and shows avatars, so Astro's page policy cannot work
 * there. Astro's script-src (self plus the hashes of the scripts it emitted) is kept verbatim; every other
 * directive is replaced. Public pages never get this policy: the middleware exists only in builds that contain
 * Keystatic, and only touches /keystatic/.
 */
export const ADMIN_CSP_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const;

export function adminCsp(astroPolicy: string): string {
  const scriptSrc =
    astroPolicy
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => /^script-src\s/i.test(directive)) ?? "script-src 'self'";
  const [defaultSrc, ...rest] = ADMIN_CSP_DIRECTIVES;
  return [defaultSrc, scriptSrc, ...rest].join('; ');
}

/** True for the admin page (not the API, which returns JSON and redirects). */
export function isAdminPath(pathname: string): boolean {
  return pathname === '/keystatic' || pathname.startsWith('/keystatic/');
}
