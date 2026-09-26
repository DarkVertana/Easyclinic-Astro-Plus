import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Runs against the real build output: `pnpm build` first.
const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8')) as { routes: Array<Record<string, any>> };
const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8'));
const routes = config.routes;
const slashIndex = routes.findIndex((r) => r.status === 308);
const fsIndex = routes.findIndex((r) => r.handle === 'filesystem');

describe('.vercel/output/config.json', () => {
  it('has every redirect and 410 route ahead of the trailing-slash 308 and the filesystem', () => {
    routes.forEach((route, index) => {
      if (route.status === 301 || route.status === 410) {
        expect(index).toBeLessThan(slashIndex);
        expect(index).toBeLessThan(fsIndex);
      }
    });
  });
  it('points every internal redirect at a file in the static output', () => {
    for (const route of routes.filter((r) => r.status === 301)) {
      const location: string = route.headers.Location;
      if (/^https?:/.test(location)) continue;
      const file = location.endsWith('/') ? `${location}index.html` : location;
      expect(() => readFileSync(`.vercel/output/static${file}`), location).not.toThrow();
    }
  });
  it('serves 410s from the gone page', () => {
    for (const route of routes.filter((r) => r.status === 410)) {
      expect(route.dest).toBe('/gone/index.html');
    }
    expect(() => readFileSync('.vercel/output/static/gone/index.html')).not.toThrow();
  });
  it('does not ship the build manifest publicly', () => {
    expect(() => readFileSync('.vercel/output/static/build-manifest.json')).toThrow();
    expect(manifest.pages.length).toBeGreaterThan(0);
  });
  it('carries a noindex header route', () => {
    expect(routes.some((r) => r.headers?.['X-Robots-Tag']?.includes('noindex'))).toBe(true);
  });
});
