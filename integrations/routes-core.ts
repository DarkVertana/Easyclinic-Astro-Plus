/**
 * Pure helpers that turn redirect and gone rules into Vercel Build Output API routes.
 *
 * Astro's own `redirects` config is not used: with `trailingSlash: 'always'` the Vercel adapter
 * emits redirects that can never match (withastro/astro#18073). These routes are prepended to
 * `.vercel/output/config.json` ahead of the adapter's trailing-slash 308, so a legacy URL
 * resolves in one hop from both its slash and no-slash forms.
 *
 * Plain erasable TypeScript: imported by the Astro integration, the vitest suite and Node scripts.
 */

export type MatchMode = 'exact' | 'prefix' | 'children';

export interface RedirectRule {
  from: string;
  to: string;
  /** exact: the path only. prefix: the path and everything below it. children: only paths below it. */
  match?: MatchMode;
  status?: 301 | 302 | 307 | 308;
  /** Used when `to` is not a built page in this build. */
  fallback?: string;
  note?: string;
}

export interface GoneRule {
  path: string;
  match?: MatchMode;
  note?: string;
}

export interface HostCondition {
  type: 'host';
  value: string;
}

export interface VercelRoute {
  src?: string;
  dest?: string;
  headers?: Record<string, string>;
  status?: number;
  continue?: boolean;
  missing?: HostCondition[];
  has?: HostCondition[];
  handle?: string;
  [key: string]: unknown;
}

export interface BuildRoutesInput {
  redirects: RedirectRule[];
  gone: GoneRule[];
  canonicalHost: string;
  indexingEnabled: boolean;
  goneDest?: string;
}

export const GONE_DEST = '/gone/index.html';

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-Frame-Options': 'SAMEORIGIN',
};

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isExternal(target: string): boolean {
  return /^https?:\/\//.test(target);
}

/** Paths that look like files (`/feed.xml`, `/wp-login.php`) keep no trailing slash. */
export function hasExtension(path: string): boolean {
  return /\.[a-z0-9]+$/i.test(path);
}

/** Lowercase-insensitive normalisation to the site's canonical form: leading slash, trailing slash. */
export function normalizePath(path: string): string {
  let p = path.trim();
  if (isExternal(p)) return p;
  const hashIndex = p.indexOf('#');
  const hash = hashIndex >= 0 ? p.slice(hashIndex) : '';
  if (hashIndex >= 0) p = p.slice(0, hashIndex);
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (!hasExtension(p) && !p.endsWith('/')) p = `${p}/`;
  return p + hash;
}

/** The path without its trailing slash, used as the regex base. `/` stays `/`. */
function stem(path: string): string {
  const p = normalizePath(path);
  return p === '/' ? '/' : p.replace(/\/$/, '');
}

export function sourcePattern(path: string, match: MatchMode = 'exact'): string {
  const base = stem(path);
  if (base === '/') {
    if (match === 'exact') return '^/$';
    if (match === 'children') return '^/.+$';
    return '^/.*$';
  }
  const escaped = escapeRegex(base);
  if (hasExtension(base)) return `^${escaped}$`;
  switch (match) {
    case 'exact':
      return `^${escaped}/?$`;
    case 'prefix':
      return `^${escaped}(?:/.*)?$`;
    case 'children':
      return `^${escaped}/.+$`;
  }
}

export function matchesRule(pathname: string, path: string, match: MatchMode = 'exact'): boolean {
  return new RegExp(sourcePattern(path, match)).test(pathname);
}

/**
 * Follows chains (a -> b -> c becomes a -> c) so every legacy URL resolves in one hop.
 * Throws on loops, which the live WordPress site has today for three specialty URLs.
 */
export function collapseRedirects(rules: RedirectRule[]): RedirectRule[] {
  const exact = new Map<string, RedirectRule>();
  for (const rule of rules) {
    if ((rule.match ?? 'exact') === 'exact') exact.set(normalizePath(rule.from), rule);
  }
  return rules.map((rule) => {
    const seen = [normalizePath(rule.from)];
    let target = rule.to;
    while (!isExternal(target)) {
      const next = exact.get(normalizePath(target));
      if (!next) break;
      const key = normalizePath(next.from);
      if (seen.includes(key)) {
        throw new Error(`Redirect loop: ${[...seen, key].join(' -> ')}`);
      }
      seen.push(key);
      target = next.to;
    }
    return { ...rule, to: isExternal(target) ? target : normalizePath(target) };
  });
}

export interface ResolveResult {
  active: RedirectRule[];
  skipped: Array<{ rule: RedirectRule; reason: string }>;
  errors: string[];
}

/**
 * Checks rules against the set of pages this build actually produced.
 * - A redirect source that is also a built page is an error (the page would be unreachable).
 * - A gone pattern that matches a built page is an error.
 * - A redirect whose target is not built uses its fallback, or is skipped with a reason.
 *   Skipped rows activate automatically in the build where their target is published.
 */
export function resolveRules(
  redirects: RedirectRule[],
  gone: GoneRule[],
  builtPages: Set<string>,
): ResolveResult {
  const errors: string[] = [];
  const skipped: ResolveResult['skipped'] = [];
  const active: RedirectRule[] = [];

  const seenSources = new Map<string, RedirectRule>();
  for (const rule of redirects) {
    const key = `${rule.match ?? 'exact'}:${normalizePath(rule.from)}`;
    if (seenSources.has(key)) errors.push(`Duplicate redirect source ${rule.from}`);
    seenSources.set(key, rule);
  }

  let collapsed: RedirectRule[] = [];
  try {
    collapsed = collapseRedirects(redirects);
  } catch (error) {
    errors.push((error as Error).message);
    return { active, skipped, errors };
  }

  for (const page of builtPages) {
    for (const rule of collapsed) {
      if (matchesRule(page, rule.from, rule.match)) {
        errors.push(`Redirect source ${rule.from} (${rule.match ?? 'exact'}) matches built page ${page}`);
      }
    }
    for (const rule of gone) {
      if (matchesRule(page, rule.path, rule.match)) {
        errors.push(`Gone pattern ${rule.path} (${rule.match ?? 'exact'}) matches built page ${page}`);
      }
    }
  }

  for (const rule of collapsed) {
    if (isExternal(rule.to) || builtPages.has(stripHash(rule.to))) {
      active.push(rule);
      continue;
    }
    if (rule.fallback && builtPages.has(normalizePath(rule.fallback))) {
      active.push({ ...rule, to: normalizePath(rule.fallback) });
      continue;
    }
    skipped.push({ rule, reason: `target ${rule.to} is not built in this stage` });
  }

  return { active, skipped, errors };
}

function stripHash(path: string): string {
  const i = path.indexOf('#');
  return i >= 0 ? path.slice(0, i) : path;
}

export function buildRoutes(input: BuildRoutesInput): VercelRoute[] {
  const { canonicalHost, indexingEnabled } = input;
  const goneDest = input.goneDest ?? GONE_DEST;
  const notCanonical: HostCondition[] = [{ type: 'host', value: canonicalHost }];
  const routes: VercelRoute[] = [];

  routes.push({ src: '^/(.*)$', headers: { ...SECURITY_HEADERS }, continue: true });

  if (indexingEnabled) {
    routes.push({
      src: '^/(.*)$',
      missing: notCanonical,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      continue: true,
    });
    routes.push({ src: '^/robots\\.txt$', missing: notCanonical, dest: '/robots-disallow.txt' });
  } else {
    routes.push({ src: '^/(.*)$', headers: { 'X-Robots-Tag': 'noindex, nofollow' }, continue: true });
    routes.push({ src: '^/robots\\.txt$', dest: '/robots-disallow.txt' });
  }

  for (const rule of collapseRedirects(input.redirects)) {
    routes.push({
      src: sourcePattern(rule.from, rule.match),
      headers: { Location: rule.to },
      status: rule.status ?? 301,
    });
  }

  for (const rule of input.gone) {
    routes.push({
      src: sourcePattern(rule.path, rule.match),
      dest: goneDest,
      status: 410,
      headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  return routes;
}

const TRAILING_SLASH_SRC = '^/((?:[^/]+/)*[^/\\.]+)$';

/**
 * Prepends our routes to the adapter's route table. Throws if the adapter's layout is not what
 * this integration was written against, so an adapter upgrade cannot silently reorder routing.
 */
export function injectRoutes(existing: VercelRoute[], ours: VercelRoute[]): VercelRoute[] {
  const slashIndex = existing.findIndex((r) => r.src === TRAILING_SLASH_SRC && r.status === 308);
  const filesystemIndex = existing.findIndex((r) => r.handle === 'filesystem');
  if (slashIndex < 0) {
    throw new Error('vercel-routes: adapter trailing-slash 308 route not found; adapter output changed');
  }
  if (filesystemIndex < 0 || filesystemIndex < slashIndex) {
    throw new Error('vercel-routes: `handle: filesystem` not found after the trailing-slash route');
  }
  if (existing.some((r) => r.headers?.['Strict-Transport-Security'])) {
    throw new Error('vercel-routes: routes already injected');
  }
  return [...ours, ...existing];
}
