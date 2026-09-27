import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_FALLBACK, ogImagePath } from '../../src/lib/seo/og-path.ts';

// Runs against the real build output: `pnpm build` or `pnpm build:prod` first. Every content-backed page links its
// generated 1200x630 card (src/pages/og/[...path].png.ts), every other page the static fallback, every linked
// image exists, and the renderer (satori, resvg) stays out of the server function.

const OUT = '.vercel/output';
const STATIC = join(OUT, 'static');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const manifest = JSON.parse(readFileSync(join(OUT, 'build-manifest.json'), 'utf8')) as { pages: Array<{ path: string; family: string }> };
const contentPaths = new Set(manifest.pages.filter((p) => p.family !== 'static').map((p) => p.path));

function metaContent(html: string, key: string): string | undefined {
  return new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];
}

function pngSize(file: string): [number, number] {
  const png = readFileSync(file);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

const pages = walk(STATIC)
  .filter((file) => file.endsWith('.html'))
  .map((file) => {
    const rel = file.slice(STATIC.length).replace(/\\/g, '/');
    const path = rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
    return { path, html: readFileSync(file, 'utf8') };
  });

describe('Open Graph images', () => {
  it('found the pages', () => {
    expect(contentPaths.size).toBeGreaterThan(0);
    expect(pages.filter((p) => contentPaths.has(p.path))).toHaveLength(contentPaths.size);
  });

  it('link the generated card on content pages and the fallback elsewhere, in og:image and twitter:image', () => {
    const wrong: string[] = [];
    for (const page of pages) {
      const expected = contentPaths.has(page.path) ? ogImagePath(page.path) : OG_FALLBACK;
      for (const key of ['og:image', 'twitter:image']) {
        const url = metaContent(page.html, key);
        if (url === undefined) continue; // pages without an SEO head (none today)
        if (new URL(url).pathname !== expected) wrong.push(`${page.path} ${key}: ${url} (expected ${expected})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('every linked image exists as a 1200x630 PNG', () => {
    const images = new Set(pages.map((p) => metaContent(p.html, 'og:image')).filter((u): u is string => !!u).map((u) => new URL(u).pathname));
    const bad: string[] = [];
    for (const image of images) {
      const file = join(STATIC, image);
      if (!existsSync(file)) bad.push(`${image}: missing`);
      else if (pngSize(file).join('x') !== '1200x630') bad.push(`${image}: ${pngSize(file).join('x')}`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps satori and resvg out of the server function', () => {
    const files = walk(join(OUT, 'functions'));
    expect(files.filter((file) => /\/node_modules\/(satori|@resvg)\//.test(file))).toEqual([]);
    const code = files.filter((file) => /\.m?js$/.test(file) && !file.includes('/node_modules/'));
    expect(code.filter((file) => /from\s*["'](satori|@resvg\/resvg-js)["']|require\(["'](satori|@resvg\/resvg-js)["']\)/.test(readFileSync(file, 'utf8')))).toEqual([]);
  });
});
