import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createRef } from '../../src/lib/crm/ref';
import { builtPages } from './pages';

// The Content-Security-Policy with JavaScript on, where the per-page sweep in templates.spec.ts does not reach:
// the on-demand confirmation page (its policy is Astro's response header, not a <meta>), the demo form's fetch
// to /demo/submit/, the 404 page and the 410 (gone) page. Any CSP violation or console error fails the test.

const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8')) as {
  stage: string;
  gone: Array<{ path: string; match?: string }>;
};
// The confirmation page verifies the reference with DEMO_REF_SECRET, or a development secret outside production
// (src/pages/demo/confirmation.astro). Without either, it shows the page but fires no key event.
const refSecret = process.env.DEMO_REF_SECRET ?? (manifest.stage === 'production' ? undefined : 'development-only-secret');

/** Collects CSP violations, console errors and uncaught errors across every navigation of `page`. */
async function watch(page: Page, documentStatusPaths: string[] = []) {
  const problems: string[] = [];
  await page.exposeFunction('__reportCspViolation', (message: string) => problems.push(`CSP: ${message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (window as unknown as { __reportCspViolation: (m: string) => void }).__reportCspViolation;
      report(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} at ${e.sourceFile || location.pathname}:${e.lineNumber}`);
    });
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Chrome logs the document's own 404 or 410 status; for these pages that status is the point.
    // (templates.spec.ts ignores favicon misses too.)
    const url = m.location().url;
    const path = url ? new URL(url).pathname : '';
    const statusMessage = /^Failed to load resource: the server responded with a status of (404|410)\b/.test(m.text());
    if (statusMessage && (documentStatusPaths.includes(path) || path.includes('favicon'))) return;
    problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test('the demo form submits with JavaScript under the CSP', async ({ page }) => {
  test.skip(!builtPages().some((p) => p.path === '/contact-us/'), 'contact page not built');
  const problems = await watch(page);
  await page.goto('/contact-us/');
  const form = page.locator('form[data-demo-form]');
  await form.getByLabel('Your name').fill('Test Doctor');
  await form.getByLabel('Phone number without the country code').fill('91477 70277');
  await form.getByLabel('Email').fill('test@example.com');
  await form.getByLabel('Clinic name').fill('Test Clinic');
  await form.getByText('Solo practice', { exact: true }).click();
  await form.getByText('1', { exact: true }).click();
  await form.getByLabel('Country', { exact: true }).selectOption('India');
  // The enhanced form posts with fetch (connect-src) and then navigates to the confirmation page.
  const submitted = page.waitForResponse((r) => r.url().includes('/demo/submit/') && r.request().method() === 'POST');
  // Implicit submission (Enter in a text field): the preview toolbar can cover the button in preview builds.
  await form.getByLabel('Clinic name').press('Enter');
  expect((await submitted).status()).toBe(200);
  await expect(page).toHaveURL(/\/demo\/confirmation\//);
  await expect(page.locator('h1')).toHaveText(/We have your demo request/);
  expect(problems).toEqual([]);
});

test('the confirmation page sends its CSP as a header and runs the key-event script under it', async ({ page }) => {
  const problems = await watch(page);
  const ref = refSecret ? createRef('in', refSecret) : '';
  const response = await page.goto(`/demo/confirmation/?c=in&pt=solo&l=1&from=%2Fcontact-us%2F${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`);
  expect(response?.status()).toBe(200);
  const policies = (await response?.headerValues('content-security-policy')) ?? [];
  expect(policies.some((p) => /script-src[^;]*'sha256-/.test(p)), `Astro's hashed script-src in: ${policies.join(' | ')}`).toBe(true);
  expect(policies.some((p) => /'unsafe-inline'|'unsafe-eval'/.test(p.match(/script-src[^;]*/)?.[0] ?? ''))).toBe(false);
  expect(await response?.headerValue('x-frame-options')).toBe('SAMEORIGIN');
  await expect(page.locator('h1')).toHaveText(/We have your demo request/);
  if (ref) {
    // demo_form_submitted (spec 7.8 key event) reaches the dataLayer, so the page's script ran under the policy.
    await expect
      .poll(() =>
        page.evaluate(() =>
          ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).some((entry) => entry[0] === 'event' && entry[1] === 'demo_form_submitted'),
        ),
      )
      .toBe(true);
  }
  expect(problems).toEqual([]);
});

test('the 404 page runs without CSP violations or console errors', async ({ page }) => {
  const path = '/csp-check-no-such-page/';
  const problems = await watch(page, [path]);
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
  expect(problems).toEqual([]);
});

test('the gone page (410) runs without CSP violations or console errors', async ({ page }) => {
  const rule = manifest.gone.find((g) => (g.match ?? 'exact') === 'exact' && g.path.endsWith('/')) ?? manifest.gone.find((g) => g.match === 'prefix');
  test.skip(!rule, 'no gone rule in this build');
  const path = (rule!.match ?? 'exact') === 'exact' ? rule!.path : `${rule!.path}sample-page/`;
  const problems = await watch(page, [path]);
  const response = await page.goto(path);
  expect(response?.status()).toBe(410);
  await expect(page.locator('h1')).toHaveCount(1);
  expect(problems).toEqual([]);
});
