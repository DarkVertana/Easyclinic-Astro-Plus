/**
 * A pure emulation of Vercel's Build Output API (v3) routing over `.vercel/output/config.json`, shared by
 * the local server (scripts/serve-output.ts) and the legacy URL coverage check (scripts/check-coverage.ts).
 *
 * Emulated: routes before `handle: filesystem` (src, has/missing host, headers, status, dest, continue,
 * $n substitution), static file lookup (`/x/` -> `/x/index.html`), then the routes after
 * `handle: filesystem`: `dest: "_render"` (the on-demand function) or a static `dest` such as the
 * adapter's `/404.html` fallback. Route `src` patterns match case-insensitively unless the route sets
 * `caseSensitive: true`, as on Vercel (`vercel dev` compiles each `src` with the `i` flag); the static file
 * lookup stays case-sensitive. Not emulated: edge caching, `check`, `methods`, locale routes.
 * A real deploy is the final word: `pnpm smoke --base <deployment>`.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface HostCondition {
  type: string;
  value: string;
}

export interface Route {
  src?: string;
  dest?: string;
  headers?: Record<string, string>;
  status?: number;
  continue?: boolean;
  handle?: string;
  has?: HostCondition[];
  missing?: HostCondition[];
  caseSensitive?: boolean;
}

export interface RouteRequest {
  pathname: string;
  host: string;
  /** Query string including `?`, carried over to redirect locations without one. */
  search?: string;
  method?: string;
}

export type Resolution =
  | { kind: 'redirect'; status: number; location: string; headers: Record<string, string> }
  | { kind: 'static'; status: number; pathname: string; file: string; headers: Record<string, string> }
  | { kind: 'function'; status: number | undefined; pathname: string; headers: Record<string, string> }
  | { kind: 'not-found'; status: 404; pathname: string; headers: Record<string, string> };

/** Returns the static file that serves `pathname` (relative to the static root), or null. */
export type StaticLookup = (pathname: string) => string | null;

export interface Router {
  resolve(request: RouteRequest): Resolution;
}

function hostMatches(route: Route, host: string): boolean {
  // Host names are case-insensitive.
  const bare = host.replace(/:\d+$/, '').toLowerCase();
  for (const cond of route.has ?? []) if (cond.type === 'host' && cond.value.toLowerCase() !== bare) return false;
  for (const cond of route.missing ?? []) if (cond.type === 'host' && cond.value.toLowerCase() === bare) return false;
  return true;
}

/** Vercel matches a route's `src` case-insensitively unless the route opts in to `caseSensitive`. */
const compile = (route: Route) => ({ route, re: route.src ? new RegExp(route.src, route.caseSensitive ? '' : 'i') : null });

function substitute(value: string, match: RegExpMatchArray): string {
  return value.replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? '');
}

function locationOf(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === 'location') return value;
  return undefined;
}

export function createRouter(routes: Route[], lookup: StaticLookup): Router {
  const filesystemIndex = routes.findIndex((r) => r.handle === 'filesystem');
  const beforeFs = (filesystemIndex >= 0 ? routes.slice(0, filesystemIndex) : routes).map(compile);
  const afterFs = (filesystemIndex >= 0 ? routes.slice(filesystemIndex + 1) : []).filter((r) => !r.handle).map(compile);

  return {
    resolve({ pathname: requested, host, search = '', method = 'GET' }) {
      let pathname = requested;
      let statusOverride: number | undefined;
      const headers: Record<string, string> = {};

      for (const { route, re } of beforeFs) {
        if (!re || !hostMatches(route, host)) continue;
        const match = pathname.match(re);
        if (!match) continue;
        for (const [key, value] of Object.entries(route.headers ?? {})) headers[key] = substitute(value, match);
        const location = locationOf(route.headers);
        if (route.status && location !== undefined && !route.dest) {
          const target = substitute(location, match);
          return {
            kind: 'redirect',
            status: route.status,
            location: target + (search && !target.includes('?') ? search : ''),
            headers: { ...headers, Location: target },
          };
        }
        if (route.dest) pathname = substitute(route.dest, match).split('?')[0];
        if (route.status) statusOverride = route.status;
        if (!route.continue) break;
      }

      if (method === 'GET' || method === 'HEAD') {
        const file = lookup(pathname);
        if (file) return { kind: 'static', status: statusOverride ?? 200, pathname, file, headers };
      }

      for (const { route, re } of afterFs) {
        if (!re || !hostMatches(route, host)) continue;
        const match = pathname.match(re);
        if (!match) continue;
        if (route.dest === '_render') return { kind: 'function', status: route.status ?? statusOverride, pathname, headers };
        if (route.dest) {
          const dest = substitute(route.dest, match).split('?')[0];
          const file = lookup(dest);
          if (file) return { kind: 'static', status: route.status ?? statusOverride ?? 200, pathname: dest, file, headers };
        }
      }

      return { kind: 'not-found', status: 404, pathname, headers };
    },
  };
}

/** Every file under `staticRoot`, as URL paths (`/pricing/index.html`). */
export function listStaticFiles(staticRoot: string): Set<string> {
  const files = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else files.add(`${prefix}${entry.name}`);
    }
  };
  walk(staticRoot, '/');
  return files;
}

/** Vercel's static lookup: `/x/` is served by `/x/index.html`, anything else by the file itself. */
export function staticLookup(files: Set<string>): StaticLookup {
  return (pathname) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.split('/').includes('..')) return null;
    const candidate = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
    return files.has(candidate) ? candidate : null;
  };
}
