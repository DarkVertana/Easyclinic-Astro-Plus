/**
 * Lighthouse mobile budgets per template (spec 7.1, 7.10): LCP < 2.0 s, CLS < 0.05, TBT < 200 ms
 * (standing in for INP in the lab), on a throttled mid-range phone profile.
 * Runs against the local emulator (pnpm serve:output) or --base <url>.
 *
 *   node scripts/lighthouse.ts [--base http://localhost:4322] [paths...]
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:4322';
const explicit = process.argv.slice(2).filter((a, idx, all) => !a.startsWith('--') && all[idx - 1] !== '--base');
const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8'));
const paths: string[] = explicit.length ? explicit : manifest.pages.filter((p: { collection: string }) => p.collection !== 'static').map((p: { path: string }) => p.path);

const BUDGET = { lcp: 2000, cls: 0.05, tbt: 200 };
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
let failed = 0;
for (const path of paths) {
  const result = await lighthouse(base + path, { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'], formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }, throttlingMethod: 'simulate' });
  const lhr = result!.lhr;
  const lcp = lhr.audits['largest-contentful-paint'].numericValue ?? 0;
  const cls = lhr.audits['cumulative-layout-shift'].numericValue ?? 0;
  const tbt = lhr.audits['total-blocking-time'].numericValue ?? 0;
  const ok = lcp < BUDGET.lcp && cls < BUDGET.cls && tbt < BUDGET.tbt;
  if (!ok) failed++;
  const score = (k: string) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
  console.log(`${ok ? '✓' : '✗'} ${path}  LCP ${(lcp / 1000).toFixed(2)}s  CLS ${cls.toFixed(3)}  TBT ${Math.round(tbt)}ms  | perf ${score('performance')} a11y ${score('accessibility')} seo ${score('seo')} bp ${score('best-practices')}`);
}
chrome.kill();
process.exit(failed ? 1 : 0);
