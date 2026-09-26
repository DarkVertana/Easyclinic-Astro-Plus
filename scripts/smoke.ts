/**
 * Real-network checks against a deployed preview or production URL (the local emulator cannot prove
 * Vercel's routing). Run after every preview deploy:
 *
 *   node scripts/smoke.ts --base https://<preview>.vercel.app [--bypass <VERCEL_AUTOMATION_BYPASS_SECRET>]
 */
import { readFileSync } from 'node:fs';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg('base') ?? process.env.SMOKE_BASE_URL ?? '').replace(/\/$/, '');
if (!base) throw new Error('Pass --base https://<deployment>');
const bypass = arg('bypass') ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers: Record<string, string> = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8'));
const isWww = new URL(base).hostname === 'www.easyclinic.io';

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
