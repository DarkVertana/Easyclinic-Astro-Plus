import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  EVENT_CTA,
  EVENT_DEMO,
  EVENT_WHATSAPP,
  changePercent,
  createInsightsClient,
  isConfigured,
  mergeInsights,
  missingSettings,
  normalizePagePath,
  signJwt,
  windowsEndingOn,
  type GaPeriod,
} from '../../src/lib/admin/insights';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const KEY = JSON.stringify({ client_email: 'sa@example.iam.gserviceaccount.com', private_key: pem });
const CONFIG = { serviceAccountJson: KEY, ga4PropertyId: '123', searchConsoleSite: 'sc-domain:easyclinic.io' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const emptyGa: GaPeriod = { views: [], events: [], demos: [] };
const post = { slug: 'a', path: '/a/', title: 'A' };

/** Routes by URL; `search` and `ga` receive the parsed body. */
function fake(handlers: { token?: () => Response; ga?: (b: any) => Response; search?: (b: any, auth: string) => Response }) {
  const calls: Array<{ url: string; body: any }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    const text = String(init.body);
    if (url.includes('oauth2.googleapis.com')) {
      calls.push({ url, body: text });
      return handlers.token ? handlers.token() : json({ access_token: `t${calls.filter((c) => c.url.includes('oauth2')).length}`, expires_in: 3600 });
    }
    const body = JSON.parse(text);
    calls.push({ url, body });
    const auth = (init.headers as Record<string, string>).authorization;
    if (url.includes('analyticsdata')) return handlers.ga ? handlers.ga(body) : json({ rows: [], rowCount: 0 });
    return handlers.search ? handlers.search(body, auth) : json({});
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const client = (f: { fn: typeof fetch }, config = CONFIG, now = () => NOW) => createInsightsClient(config, { fetch: f.fn, now, sleep: async () => {} });

describe('normalizePagePath', () => {
  it.each([
    ['/a', '/a/'],
    ['/a/', '/a/'],
    ['/A/?x=1#y', '/a/'],
    ['https://www.easyclinic.io/a', '/a/'],
    ['http://easyclinic.io/a/#top', '/a/'],
    ['//a//', '/a/'],
    ['/x//y', '/x/y/'],
  ])('%s', (input, expected) => {
    expect(normalizePagePath(input)).toBe(expected);
  });
  it('drops other hosts and (not set)', () => {
    expect(normalizePagePath('https://app.easyclinic.io/a/')).toBeNull();
    expect(normalizePagePath('(not set)')).toBeNull();
    expect(normalizePagePath('')).toBeNull();
  });
});

describe('changePercent', () => {
  it('never divides by zero', () => {
    expect(changePercent(5, 0)).toBeNull();
    expect(changePercent(0, 0)).toBeNull();
    expect(changePercent(5, null)).toBeNull();
    expect(changePercent(null, 5)).toBeNull();
  });
  it('rounds to a whole percent, including a full loss', () => {
    expect(changePercent(7, 10)).toBe(-30);
    expect(changePercent(0, 10)).toBe(-100);
    expect(changePercent(15, 10)).toBe(50);
  });
});

describe('mergeInsights', () => {
  const ga = (current: Partial<GaPeriod>, previous: Partial<GaPeriod> = {}) => ({ current: { ...emptyGa, ...current }, previous: { ...emptyGa, ...previous } });

  it('sums URL variants and weights position by impressions', () => {
    const [row] = mergeInsights({
      posts: [post],
      ga: ga({ views: [{ path: '/a', count: 3 }, { path: '/a/', count: 4 }, { path: '/a/?utm=x', count: 1 }] }),
      search: {
        current: [
          { page: 'https://www.easyclinic.io/a/', clicks: 10, impressions: 100, position: 2 },
          { page: 'https://easyclinic.io/a', clicks: 2, impressions: 300, position: 6 },
          { page: 'https://app.easyclinic.io/a/', clicks: 99, impressions: 99, position: 1 },
        ],
        previous: [],
      },
    });
    expect(row.views).toBe(8);
    expect(row.clicks).toBe(12);
    expect(row.position).toBe(5);
  });

  it('shows a new post with no data as zeros, no position and no change', () => {
    const [row] = mergeInsights({ posts: [post], ga: ga({}), search: { current: [], previous: [] } });
    expect(row).toMatchObject({ views: 0, clicks: 0, position: null, viewsChange: null, clicksChange: null, demoRequests: 0 });
  });

  it('keeps a failed source apart from a real zero', () => {
    const [row] = mergeInsights({ posts: [post], ga: null, search: null });
    expect(row).toMatchObject({ views: null, clicks: null, ctaClicks: null, demoRequests: null });
    const [noDemos] = mergeInsights({ posts: [post], ga: ga({ demos: null }, { demos: null }), search: null });
    expect(noDemos.demoRequests).toBeNull();
    expect(noDemos.views).toBe(0);
  });

  it('counts each event separately and sorts by demo requests', () => {
    const rows = mergeInsights({
      posts: [post, { slug: 'b', path: '/b/', title: 'B' }],
      ga: ga({
        events: [
          { path: '/a/', event: EVENT_CTA, count: 9 },
          { path: '/a/', event: EVENT_WHATSAPP, count: 2 },
          { path: '/a/', event: 'other', count: 50 },
        ],
        demos: [{ path: '/b/', count: 1 }],
      }),
      search: null,
    });
    expect(rows.map((r) => r.slug)).toEqual(['b', 'a']);
    expect(rows[1]).toMatchObject({ ctaClicks: 9, whatsappClicks: 2 });
  });
});

describe('windowsEndingOn', () => {
  it('gives two adjacent inclusive 28-day windows', () => {
    expect(windowsEndingOn('2026-11-03')).toEqual({
      current: { startDate: '2026-10-07', endDate: '2026-11-03' },
      previous: { startDate: '2026-09-09', endDate: '2026-10-06' },
    });
  });
});

describe('configuration', () => {
  it('names exactly what is missing', () => {
    expect(isConfigured({})).toBe(false);
    expect(missingSettings({})).toEqual(['GOOGLE_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID', 'SEARCH_CONSOLE_SITE']);
    expect(isConfigured({ serviceAccountJson: 'x' })).toBe(false);
    expect(isConfigured({ serviceAccountJson: 'x', ga4PropertyId: '1' })).toBe(true);
  });
});

describe('the token', () => {
  it('signs a JWT with Google’s documented claims and a valid RS256 signature', () => {
    const [h, c, s] = signJwt('sa@x', pem, 1000).split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'sa@x', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 });
    expect(claims.scope.split(' ')).toHaveLength(2);
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('reuses a token, then gets a new one once it has expired', async () => {
    const f = fake({});
    let now = NOW;
    const c = client(f, CONFIG, () => now);
    await c.load();
    expect(f.calls.filter((x) => x.url.includes('oauth2'))).toHaveLength(1);
    now += 3601_000;
    await c.load();
    expect(f.calls.filter((x) => x.url.includes('oauth2'))).toHaveLength(2);
  });

  it('on a 401 gets a new token and retries once', async () => {
    let first = true;
    const f = fake({
      search: () => {
        if (first) {
          first = false;
          return json({}, 401);
        }
        return json({ rows: [] });
      },
    });
    const data = await client(f, { ...CONFIG, ga4PropertyId: '' }).load();
    expect(data.search).not.toBeNull();
    expect(f.calls.filter((x) => x.url.includes('oauth2'))).toHaveLength(2);
  });

  it('a revoked key gives a plain message with no Google text', async () => {
    const f = fake({ token: () => json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature. secret-detail' }, 400) });
    const data = await client(f).load();
    expect(data.ga).toBeNull();
    expect(data.search).toBeNull();
    expect(data.warnings.join(' ')).toContain('refused the service account');
    expect(data.warnings.join(' ')).not.toMatch(/secret-detail|invalid_grant/);
  });

  it('malformed key JSON gives a config message', async () => {
    const data = await client(fake({}), { ...CONFIG, serviceAccountJson: '{not json' }).load();
    expect(data.warnings.join(' ')).toContain('could not be read');
  });

  it('accepts a private key stored with escaped newlines', async () => {
    const escaped = JSON.stringify({ client_email: 'sa@x', private_key: pem.replace(/\n/g, '\\n') });
    const data = await client(fake({}), { ...CONFIG, serviceAccountJson: escaped }).load();
    expect(data.warnings.join(' ')).not.toContain('could not be read');
  });
});

describe('failures from the APIs', () => {
  it('quota on analytics is not retried; Search Console still shows', async () => {
    const f = fake({ ga: () => json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429) });
    const data = await client(f).load();
    expect(data.ga).toBeNull();
    expect(data.search).not.toBeNull();
    expect(data.warnings.join(' ')).toContain('usage limit');
  });

  it('a 403 with no quota wording is a permission message; with it, quota', async () => {
    const denied = await client(fake({ search: () => json({ error: { message: 'User does not have sufficient permission' } }, 403) })).load();
    expect(denied.search).toBeNull();
    expect(denied.ga).not.toBeNull();
    expect(denied.warnings.join(' ')).toContain('no access');
    const quota = await client(fake({ search: () => json({ error: { message: 'Quota exceeded' } }, 403) })).load();
    expect(quota.warnings.join(' ')).toContain('usage limit');
  });

  it('retries a 503 once only', async () => {
    let n = 0;
    const f = fake({
      search: () => {
        n++;
        return json({}, 503);
      },
    });
    const data = await client(f, { ...CONFIG, ga4PropertyId: '' }).load();
    expect(n).toBe(2);
    expect(data.warnings.join(' ')).toContain('did not respond');
  });

  it('a network failure never throws', async () => {
    const fn = (async () => {
      throw new Error('socket hang up at 10.0.0.1');
    }) as unknown as typeof fetch;
    const data = await createInsightsClient(CONFIG, { fetch: fn, now: () => NOW }).load();
    expect(data.warnings.join(' ')).not.toContain('socket');
    expect(data.ga).toBeNull();
  });

  it('a refused landing-page query loses only the demo column', async () => {
    const f = fake({ ga: (b) => (b.dimensions[0].name === 'landingPage' ? json({ error: {} }, 400) : json({ rows: [], rowCount: 0 })) });
    const data = await client(f).load();
    expect(data.ga?.current.demos).toBeNull();
    expect(data.ga?.current.views).toEqual([]);
    expect(data.warnings.join(' ')).toContain('Demo requests are not available');
  });
});

describe('requests and paging', () => {
  it('pages GA4 by offset until rowCount', async () => {
    const offsets: number[] = [];
    const f = fake({
      ga: (b) => {
        if (b.metrics[0].name !== 'screenPageViews') return json({ rows: [], rowCount: 0 });
        offsets.push(b.offset);
        const rows = Array.from({ length: b.offset === 0 ? 10_000 : 5 }, () => ({ dimensionValues: [{ value: '/a/' }], metricValues: [{ value: '1' }] }));
        return json({ rows, rowCount: 10_005 });
      },
    });
    const data = await client(f, { ...CONFIG, searchConsoleSite: '' }).load();
    expect(offsets.filter((o) => o === 10_000)).toHaveLength(2); // once per period
    expect(data.ga?.current.views).toHaveLength(10_005);
  });

  it('pages Search Console by startRow and warns at its limit', async () => {
    const f = fake({
      search: (b) =>
        b.dimensions[0] === 'date'
          ? json({ rows: [{ keys: ['2026-11-03'] }] })
          : json({ rows: Array.from({ length: 25_000 }, () => ({ keys: ['/a/'], clicks: 1, impressions: 1, position: 1 })) }),
    });
    const data = await client(f, { ...CONFIG, ga4PropertyId: '' }).load();
    expect(data.search?.current).toHaveLength(50_000);
    expect(data.warnings.join(' ')).toContain('row limit');
  });

  it('ends the search window on the newest date Google has, not today', async () => {
    const f = fake({ search: (b) => (b.dimensions[0] === 'date' ? json({ rows: [{ keys: ['2026-11-02'] }, { keys: ['2026-11-03'] }] }) : json({})) });
    const data = await client(f, { ...CONFIG, ga4PropertyId: '' }).load();
    expect(data.searchWindows?.current.endDate).toBe('2026-11-03');
    expect(data.searchWindows?.previous.endDate).toBe('2026-10-06');
  });

  it('falls back to three days ago with a warning when no recent data exists', async () => {
    const data = await client(fake({}), { ...CONFIG, ga4PropertyId: '' }).load();
    expect(data.searchWindows?.current.endDate).toBe('2026-11-03');
    expect(data.warnings.join(' ')).toContain('no data');
  });

  it('warns when Search Console data is unusually old', async () => {
    const f = fake({ search: (b) => (b.dimensions[0] === 'date' ? json({ rows: [{ keys: ['2026-10-27'] }] }) : json({})) });
    const data = await client(f, { ...CONFIG, ga4PropertyId: '' }).load();
    expect(data.warnings.join(' ')).toContain('older than usual');
  });

  it('excludes today from GA4, encodes the site, counts demos by landing page', async () => {
    const f = fake({});
    const data = await client(f).load();
    expect(data.gaWindows?.current.endDate).toBe('2026-11-05');
    expect(f.calls.some((c) => c.url.includes('/sites/sc-domain%3Aeasyclinic.io/searchAnalytics/query'))).toBe(true);
    const demo = f.calls.find((c) => c.body.dimensions?.[0]?.name === 'landingPage');
    expect(demo?.body.dimensionFilter.filter.inListFilter.values).toEqual([EVENT_DEMO]);
    expect(demo?.body.metrics[0].name).toBe('eventCount');
  });

  it('passes on sampling, thresholding and (other) as warnings', async () => {
    const f = fake({ ga: () => json({ rows: [], rowCount: 0, metadata: { dataLossFromOtherRow: true, samplingMetadatas: [{}], subjectToThresholding: true } }) });
    const data = await client(f, { ...CONFIG, searchConsoleSite: '' }).load();
    expect(data.warnings).toHaveLength(3);
  });
});
