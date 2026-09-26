import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs against the real build output: `pnpm build` first. Checks that the Content-Security-Policy Astro
// writes into each page (security.csp in astro.config.ts) allows everything the page actually uses, so
// no visitor's browser blocks a script, a stylesheet or a style attribute.

const STATIC = '.vercel/output/static';
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const pages = walk(STATIC)
  .filter((f) => f.endsWith('.html'))
  .map((file) => ({ file: file.slice(STATIC.length), html: readFileSync(file, 'utf8') }));

const hash = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const decode = (v: string) => v.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const EXECUTABLE = /^(|module|text\/javascript|application\/javascript)$/i;

interface Policy {
  index: number;
  directives: Map<string, string[]>;
}

function policyOf(html: string): Policy[] {
  return [...html.matchAll(/<meta\b[^>]*http-equiv="content-security-policy"[^>]*>/gi)].map((m) => {
    const content = decode(m[0].match(/\bcontent="([^"]*)"/)?.[1] ?? '');
    const directives = new Map<string, string[]>();
    for (const part of content.split(';')) {
      const [name, ...sources] = part.trim().split(/\s+/);
      if (name) directives.set(name.toLowerCase(), sources);
    }
    return { index: m.index!, directives };
  });
}

/** The sources that govern an element type, with CSP's fallback order. */
const sourcesFor = (p: Policy, ...names: string[]) => names.map((n) => p.directives.get(n)).find(Boolean) ?? [];
const blocks = (html: string, tag: 'script' | 'style') =>
  [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => ({ index: m.index!, attrs: m[1], body: m[2] }));
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1];
/** Markup outside script and style bodies, where attributes live. */
const markupOf = (html: string) => html.replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/gi, '<$1$2></$1>');

describe('Content-Security-Policy in the built pages', () => {
  it('found pages to check', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('every page has exactly one CSP <meta>, ahead of any executable script', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const policies = policyOf(html);
      if (policies.length !== 1) {
        problems.push(`${file}: ${policies.length} CSP meta elements`);
        continue;
      }
      const first = blocks(html, 'script').find((s) => EXECUTABLE.test(attr(s.attrs, 'type') ?? ''));
      if (first && first.index < policies[0].index) problems.push(`${file}: a script runs before the CSP meta`);
    }
    expect(problems).toEqual([]);
  });

  it('the policy forbids inline and eval script, plugins and base or form hijacking', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const [p] = policyOf(html);
      if (!p) continue;
      const script = sourcesFor(p, 'script-src', 'default-src');
      if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) problems.push(`${file}: script-src allows unsafe-inline or unsafe-eval`);
      if (sourcesFor(p, 'default-src').join(' ') !== "'self'") problems.push(`${file}: default-src is not 'self'`);
      if (sourcesFor(p, 'object-src').join(' ') !== "'none'") problems.push(`${file}: object-src is not 'none'`);
      if (sourcesFor(p, 'base-uri').join(' ') !== "'self'") problems.push(`${file}: base-uri is not 'self'`);
      if (sourcesFor(p, 'form-action').join(' ') !== "'self'") problems.push(`${file}: form-action is not 'self'`);
      // Ignored in a <meta> (with a console error); it is sent as a header instead.
      if (p.directives.has('frame-ancestors')) problems.push(`${file}: frame-ancestors in a <meta> policy`);
    }
    expect(problems).toEqual([]);
  });

  it('allows every inline script by hash and loads external scripts from this origin only', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const [p] = policyOf(html);
      if (!p) continue;
      const allowed = new Set(sourcesFor(p, 'script-src-elem', 'script-src', 'default-src'));
      for (const s of blocks(html, 'script')) {
        if (s.index < p.index || !EXECUTABLE.test(attr(s.attrs, 'type') ?? '')) continue;
        const src = attr(s.attrs, 'src');
        if (src) {
          if (!src.startsWith('/') || src.startsWith('//')) problems.push(`${file}: external script ${src}`);
        } else if (!allowed.has(hash(s.body))) {
          problems.push(`${file}: inline script not in the policy (${s.body.slice(0, 60)})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('allows every inline stylesheet by hash, and inline CSS loads nothing from elsewhere', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const [p] = policyOf(html);
      if (!p) continue;
      const allowed = new Set(sourcesFor(p, 'style-src-elem', 'style-src', 'default-src'));
      for (const s of blocks(html, 'style')) {
        for (const url of s.body.matchAll(/url\(\s*["']?([^"')]+)/g)) {
          const ref = url[1].trim();
          if (!ref.startsWith('#') && (!ref.startsWith('/') || ref.startsWith('//'))) problems.push(`${file}: CSS loads ${ref.slice(0, 60)}`);
        }
        if (s.index > p.index && !allowed.has(hash(s.body))) problems.push(`${file}: <style> not in the policy (${s.body.slice(0, 60)})`);
      }
      for (const link of markupOf(html).matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)) {
        const href = attr(link[0], 'href') ?? '';
        if (!href.startsWith('/') || href.startsWith('//')) problems.push(`${file}: external stylesheet ${href}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('allows every style attribute by hash, and has no inline event handlers or javascript: URLs', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const [p] = policyOf(html);
      if (!p) continue;
      const attrSources = p.directives.get('style-src-attr');
      const markup = markupOf(html);
      for (const m of markup.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\sstyle="([^"]*)"/gi)) {
        const value = decode(m[1]);
        if (!attrSources || !attrSources.includes("'unsafe-hashes'") || !attrSources.includes(hash(value))) {
          problems.push(`${file}: style="${value}" is not allowed by style-src-attr`);
        }
      }
      for (const m of markup.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\s(on[a-z]+)=/gi)) problems.push(`${file}: inline ${m[1]} handler`);
      for (const m of markup.matchAll(/\s(?:href|src|action)="\s*javascript:/gi)) problems.push(`${file}: javascript: URL (${m[0].trim()})`);
    }
    expect([...new Set(problems)]).toEqual([]);
  });

  it('loads images, media and frames from this origin only, and posts forms to this origin', () => {
    const problems: string[] = [];
    for (const { file, html } of pages) {
      const markup = markupOf(html);
      for (const m of markup.matchAll(/<(img|source|video|audio|iframe|embed|object)\b[^>]*>/gi)) {
        for (const name of ['src', 'srcset', 'data']) {
          const value = attr(m[0], name);
          if (!value) continue;
          for (const url of value.split(',').map((v) => v.trim().split(/\s+/)[0])) {
            if (!url.startsWith('/') || url.startsWith('//')) problems.push(`${file}: <${m[1]} ${name}> loads ${url.slice(0, 60)}`);
          }
        }
      }
      for (const m of markup.matchAll(/<form\b[^>]*>/gi)) {
        const action = attr(m[0], 'action') ?? '';
        if (action && (!action.startsWith('/') || action.startsWith('//'))) problems.push(`${file}: form posts to ${action}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('CSP header route', () => {
  it('sends frame-ancestors (which a <meta> cannot carry) with every response', () => {
    const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8')) as { routes: Array<Record<string, any>> };
    const route = config.routes.find((r) => r.headers?.['Content-Security-Policy']);
    expect(route?.src).toBe('^/(.*)$');
    expect(route?.continue).toBe(true);
    expect(route?.headers['Content-Security-Policy']).toMatch(/frame-ancestors 'self'/);
  });
});
