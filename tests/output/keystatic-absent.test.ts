import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs against the real build output: `pnpm build` or `pnpm build:prod` first. The Keystatic editor is only ever
// built into a preview deployment with KEYSTATIC_STORAGE=github (integrations/keystatic-gate.ts); every other build,
// and every production build, must contain nothing from it: no /keystatic or /api/keystatic route, no Keystatic or
// React code in the server function, and no React in the browser bundles.

const OUT = '.vercel/output';
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const config = JSON.parse(readFileSync(join(OUT, 'config.json'), 'utf8')) as { routes: Array<Record<string, unknown>> };
const manifest = JSON.parse(readFileSync(join(OUT, 'build-manifest.json'), 'utf8')) as { stage: string };
const withEditor = process.env.KEYSTATIC_STORAGE === 'github' && manifest.stage !== 'production';

describe.skipIf(withEditor)('a build without the Keystatic editor', () => {
  it('has no admin or API route', () => {
    expect(config.routes.filter((route) => /keystatic/i.test(JSON.stringify(route)))).toEqual([]);
  });

  it('bundles no Keystatic or React code into the server function', () => {
    const files = walk(join(OUT, 'functions')).filter((file) => /\.m?js$/.test(file) && !file.includes('/node_modules/'));
    const offenders = files.filter((file) => /@keystatic|keystatic-astro|react-dom\/server/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
    expect(walk(join(OUT, 'functions')).filter((file) => /\/node_modules\/(@keystatic|@keystar|react-dom)\//.test(file))).toEqual([]);
  });

  it('ships no React to the browser', () => {
    const scripts = walk(join(OUT, 'static/_astro')).filter((file) => file.endsWith('.js'));
    // React DOM's production build always carries its error-decoder URL.
    const offenders = scripts.filter((file) => /react\.dev\/errors|reactjs\.org\/docs\/error-decoder|@keystatic/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
