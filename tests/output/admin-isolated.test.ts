import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs against the real build output: `pnpm build` or `pnpm build:prod` first. The blog admin (/admin/) exists only as
// on-demand routes in the server function: nothing about it may reach a sitemap, the page list or a public page's
// browser code, and the Claude SDK must never reach a browser.

const OUT = '.vercel/output';
const STATIC = join(OUT, 'static');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = walk(STATIC).map((file) => file.replaceAll('\\', '/'));
const manifest = JSON.parse(readFileSync(join(OUT, 'build-manifest.json'), 'utf8')) as {
  pages: Array<{ path: string }>;
  hidden?: Array<{ path: string }>;
};
const isAdmin = (path: string) => /^\/admin(\/|$)/.test(path);
const ADMIN_URL = /easyclinic\.io\/admin\b|["'`(=]\/admin\//;

describe('the blog admin in the build output', () => {
  it('is in no sitemap', () => {
    const sitemaps = files.filter((f) => /\/sitemap[^/]*\.xml$/.test(f));
    expect(sitemaps.length).toBeGreaterThan(0);
    expect(sitemaps.filter((f) => /\/admin\b/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('is not in the build manifest pages', () => {
    expect([...manifest.pages, ...(manifest.hidden ?? [])].map((p) => p.path).filter(isAdmin)).toEqual([]);
  });

  it('has no static output: its pages are on-demand only', () => {
    expect(existsSync(join(STATIC, 'admin'))).toBe(false);
    expect(files.filter((f) => f.includes('/static/admin/'))).toEqual([]);
  });

  it('leaves public HTML with no admin links or references', () => {
    const pages = files.filter((f) => f.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((f) => ADMIN_URL.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('ships no Claude SDK or provider key name in any public asset', () => {
    const text = files.filter((f) => /\.(m?js|css|html|json|txt|xml)$/.test(f));
    const offenders = text.filter((f) => /@anthropic-ai\/sdk|api\.anthropic\.com|ANTHROPIC_API_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|ADMIN_SESSION_SECRET/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('ships no admin code in the scripts public pages load', () => {
    const publicScripts = new Set<string>();
    for (const page of files.filter((f) => f.endsWith('.html'))) {
      for (const m of readFileSync(page, 'utf8').matchAll(/<script\b[^>]*\bsrc="(\/_astro\/[^"]+)"/g)) publicScripts.add(m[1]);
    }
    const offenders = [...publicScripts].filter((src) => {
      const file = join(STATIC, src);
      return existsSync(file) && ADMIN_URL.test(readFileSync(file, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });

  it('is reached through the function: the routes send unmatched paths to _render', () => {
    const config = JSON.parse(readFileSync(join(OUT, 'config.json'), 'utf8')) as { routes: Array<{ dest?: string; src?: string }> };
    expect(config.routes.some((r) => r.dest === '_render')).toBe(true);
    // A legacy redirect or 410 runs ahead of the function and would silently take the admin's URL.
    const shadowing = config.routes.filter((r) => r.dest !== '_render' && r.src && !/\(\.\*\)|\.\*/.test(r.src) && new RegExp(r.src, 'i').test('/admin/'));
    expect(shadowing).toEqual([]);
  });
});
