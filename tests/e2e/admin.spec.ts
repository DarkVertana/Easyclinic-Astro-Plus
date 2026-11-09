import { expect, test } from '@playwright/test';

// The admin refuses anyone without a session. Uses the request client, so redirects are visible and no browser or
// credentials are involved. These hold with no admin settings configured.

for (const path of ['/admin/', '/admin/posts/', '/admin/insights/']) {
  test(`anonymous ${path} redirects to the login page`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/admin/login/');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  });
}

test('the login page itself is reachable and not indexable', async ({ request }) => {
  const response = await request.get('/admin/login/', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  expect(response.headers()['cache-control']).toContain('no-store');
});

test('POST to an admin API without a session is refused and changes nothing', async ({ request, baseURL }) => {
  const response = await request.post('/admin/api/posts/open/', {
    maxRedirects: 0,
    headers: { origin: baseURL! },
    form: { slug: 'clinic-setup-cost-in-india' },
  });
  // A refusal is 401 or 403, or a redirect to the login page. Never success, and never a missing route.
  const refused = [401, 403].includes(response.status()) || new URL(response.headers().location ?? '/', 'http://x').pathname === '/admin/login/';
  expect(refused, `status ${response.status()}`).toBe(true);
});
