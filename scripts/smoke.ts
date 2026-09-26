/**
 * Real-network checks against a deployed preview or production URL (the local emulator cannot prove
 * Vercel's routing). Reads .vercel/output/build-manifest.json, so build the deployed commit at the
 * deployed stage first (the Smoke workflow does this on every successful Vercel deployment):
 *
 *   git checkout <deployed sha> && pnpm build:prod && pnpm smoke --base https://www.easyclinic.io
 *   git checkout <deployed sha> && pnpm build && pnpm smoke --base https://<preview>.vercel.app --bypass <secret>
 *
 * The bypass secret (--bypass or VERCEL_AUTOMATION_BYPASS_SECRET) is sent only to *.vercel.app and
 * easyclinic.io hosts; any other non-local host is refused rather than handed the secret.
 */
import { readFileSync } from 'node:fs';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg('base') ?? process.env.SMOKE_BASE_URL ?? '').replace(/\/$/, '');
if (!base) throw new Error('Pass --base https://<deployment>');
const hostname = new URL(base).hostname;
const isWww = hostname === 'www.easyclinic.io';
const isVercelHost = hostname.endsWith('.vercel.app') || hostname === 'easyclinic.io' || hostname.endsWith('.easyclinic.io');
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
const bypass = arg('bypass') ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (bypass && !isVercelHost && !isLocal) {
  throw new Error(`Refusing to send the Vercel bypass secret to ${hostname}: only *.vercel.app and easyclinic.io hosts get it`);
}
const headers: Record<string, string> = bypass && isVercelHost ? { 'x-vercel-protection-bypass': bypass } : {};
const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8'));
// A preview-stage manifest lists drafts and redirects to drafts, which www does not serve: false failures.
if (isWww && manifest.stage !== 'production') {
  throw new Error(`.vercel/output is a ${manifest.stage}-stage build. For www: git checkout <deployed sha> && pnpm build:prod, then run this again`);
}
console.log(`Smoke checks on ${base} against a ${manifest.stage}-stage build manifest`);

let failures = 0;
const check = (ok: boolean, message: string) => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${message}`);
};
const get = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: 'manual', ...init, headers: { ...headers, ...(init.headers as object) } });

// Every active redirect: one hop, from both slash forms, to the right place.
for (const r of manifest.activeRedirects as Array<{ from: string; to: string; match?: string; status?: number }>) {
  if ((r.match ?? 'exact') !== 'exact') continue;
  for (const path of [r.from, r.from.replace(/\/$/, '')]) {
    const res = await get(path);
    const location = res.headers.get('location') ?? '';
    check(res.status === (r.status ?? 301) && (location === r.to || location.endsWith(r.to)), `${path} -> ${res.status} ${location}`);
  }
}

// Gone patterns return 410 with a body.
for (const g of manifest.gone as Array<{ path: string; match?: string }>) {
  const sample = (g.match ?? 'exact') === 'exact' ? g.path : `${g.path}sample-page/`;
  const res = await get(sample);
  check(res.status === 410 && (await res.text()).length > 100, `${sample} -> 410 with body (got ${res.status})`);
}

// Pages, noindex outside production www, robots.
for (const page of manifest.pages.slice(0, 50) as Array<{ path: string }>) {
  const res = await get(page.path);
  check(res.status === 200, `${page.path} -> ${res.status}`);
  if (!isWww) check((res.headers.get('x-robots-tag') ?? '').includes('noindex'), `${page.path} carries X-Robots-Tag noindex off www`);
}
// Content-Security-Policy: the header half (frame-ancestors) on every response, the per-page half in a <meta>.
const home = await get('/');
check(/frame-ancestors 'self'/.test(home.headers.get('content-security-policy') ?? ''), `/ sends a Content-Security-Policy header with frame-ancestors`);
check(/<meta[^>]+http-equiv="content-security-policy"[^>]+script-src/i.test(await home.text()), `/ carries the per-page CSP <meta> with script-src`);
// The on-demand confirmation page gets Astro's policy as a response header of the same name as the route-level
// one above. Whichever Vercel keeps (or both), Astro's hashed script-src must survive, and the page must still
// refuse framing by another site (frame-ancestors, or X-Frame-Options if Astro's policy replaced ours).
const confirmation = await get('/demo/confirmation/?c=in');
const confirmationCsp = confirmation.headers.get('content-security-policy') ?? '';
const hasScriptSrc = /script-src[^;,]*'sha256-/.test(confirmationCsp);
const hasFrameAncestors = /frame-ancestors 'self'/.test(confirmationCsp);
check(confirmation.status === 200, `/demo/confirmation/ -> ${confirmation.status}`);
check(hasScriptSrc, `/demo/confirmation/ keeps Astro's CSP header with hashed script-src (script-src: ${hasScriptSrc ? 'yes' : 'no'}, frame-ancestors: ${hasFrameAncestors ? 'yes' : 'no'})`);
check(
  hasFrameAncestors || (confirmation.headers.get('x-frame-options') ?? '').toUpperCase() === 'SAMEORIGIN',
  `/demo/confirmation/ refuses framing by other sites (frame-ancestors or X-Frame-Options)`,
);

const robots = await (await get('/robots.txt')).text();
check(isWww ? true : robots.includes('Disallow: /'), `robots.txt disallows crawling on ${new URL(base).hostname}`);

// Trailing slash normalisation and the demo endpoint.
const slash = await get('/contact-us');
check(slash.status === 308 && (slash.headers.get('location') ?? '').endsWith('/contact-us/'), `/contact-us -> ${slash.status} ${slash.headers.get('location')}`);
const form = new URLSearchParams({ name: '', email: 'bad' });
const demo = await get('/demo/submit/', { method: 'POST', body: form, headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', origin: base } });
check(demo.status === 400, `POST /demo/submit/ with invalid data -> 400 (got ${demo.status}); the endpoint is reachable`);

console.log(`\n${failures ? `${failures} checks failed` : 'All smoke checks passed'} on ${base}`);
process.exit(failures ? 1 : 0);
