import { describe, expect, it } from 'vitest';
import { buildRoutes, injectRoutes, type VercelRoute } from '../../integrations/routes-core.ts';
import { checkRow, classifyTrace, reasonFor, renderMarkdown, requestForms, summarise, traceUrl, type ReasonContext } from '../../scripts/lib/coverage.ts';
import { LegacyInventory, parseSitemap, readLegacyCsv, toLegacyPath, writeLegacyCsv, type LegacyRow } from '../../scripts/lib/legacy.ts';
import type { ManifestRow } from '../../scripts/lib/posts-rules.ts';
import { createRouter, staticLookup, type Route } from '../../scripts/lib/vercel-router.ts';

const HOST = 'www.easyclinic.io';

/** The adapter's route table (trailing-slash 308, filesystem, on-demand routes, 404 fallback), as in a real build. */
const adapterRoutes: VercelRoute[] = [
  { src: '^/\\.well-known(?:/.*)?$' },
  { src: '^/((?:[^/]+/)*[^/\\.]+)$', headers: { Location: '/$1/' }, status: 308 },
  { src: '^/((?:[^/]+/)*[^/]+\\.\\w+)/$', headers: { Location: '/$1' }, status: 308 },
  { handle: 'filesystem' },
  { src: '^/demo/confirmation/$', dest: '_render' },
  { src: '^/.*$', dest: '/404.html', status: 404 },
];

const files = new Set(['/index.html', '/pricing/index.html', '/specialties/index.html', '/gone/index.html', '/404.html', '/robots-disallow.txt']);

function routerFor(extra: VercelRoute[] = [], redirects = [] as Parameters<typeof buildRoutes>[0]['redirects'], gone = [] as Parameters<typeof buildRoutes>[0]['gone']) {
  const ours = buildRoutes({ redirects, gone, canonicalHost: HOST, indexingEnabled: false });
  return createRouter([...extra, ...injectRoutes(adapterRoutes, ours)] as Route[], staticLookup(files));
}

const legacy = (path: string, expected: '' | '404' = '', sources = ['page-sitemap.xml']): LegacyRow => ({ path, sources, lastmod: '', expected });
const emptyCtx = (): ReasonContext => ({ skippedRedirects: [], hidden: [], pages: [], manifest: new Map(), generatedPostPaths: new Set() });
const classOf = (router: ReturnType<typeof routerFor>, path: string, expected: '' | '404' = '') => checkRow(router, HOST, legacy(path, expected), emptyCtx());

describe('vercel router emulation', () => {
  const router = routerFor([], [{ from: '/old/', to: '/pricing/' }], [{ path: '/wp-admin/', match: 'prefix' }]);
  it('serves built pages and adds the security headers', () => {
    const res = router.resolve({ pathname: '/pricing/', host: HOST });
    expect(res).toMatchObject({ kind: 'static', status: 200, file: '/pricing/index.html' });
    expect(res.headers['Content-Security-Policy']).toMatch(/frame-ancestors 'self'/);
  });
  it('redirects before the trailing-slash rule, from both forms, keeping the query', () => {
    expect(router.resolve({ pathname: '/old', host: HOST, search: '?a=1' })).toMatchObject({ kind: 'redirect', status: 301, location: '/pricing/?a=1' });
    expect(router.resolve({ pathname: '/pricing', host: HOST })).toMatchObject({ kind: 'redirect', status: 308, location: '/pricing/' });
  });
  it('serves 410s from the gone page and unknown paths from the 404 page', () => {
    expect(router.resolve({ pathname: '/wp-admin/x.php', host: HOST })).toMatchObject({ kind: 'static', status: 410, file: '/gone/index.html' });
    expect(router.resolve({ pathname: '/nope/', host: HOST })).toMatchObject({ kind: 'static', status: 404, file: '/404.html' });
  });
  it('routes on-demand pages to the function, and POSTs past static files', () => {
    expect(router.resolve({ pathname: '/demo/confirmation/', host: HOST })).toMatchObject({ kind: 'function' });
    expect(router.resolve({ pathname: '/pricing/', host: HOST, method: 'POST' })).toMatchObject({ kind: 'static', status: 404 });
  });
  it('applies host conditions (robots.txt rewrite)', () => {
    expect(router.resolve({ pathname: '/robots.txt', host: HOST })).toMatchObject({ kind: 'static', file: '/robots-disallow.txt' });
  });
  it('matches route sources case-insensitively, as Vercel does, but not static files', () => {
    // Search Console and GA4 exports carry mixed-case URLs.
    expect(router.resolve({ pathname: '/OLD/', host: HOST })).toMatchObject({ kind: 'redirect', status: 301, location: '/pricing/' });
    expect(router.resolve({ pathname: '/Old', host: HOST })).toMatchObject({ kind: 'redirect', status: 301, location: '/pricing/' });
    expect(router.resolve({ pathname: '/WP-ADMIN/', host: HOST })).toMatchObject({ kind: 'static', status: 410, file: '/gone/index.html' });
    expect(router.resolve({ pathname: '/Pricing/', host: HOST })).toMatchObject({ kind: 'static', status: 404, file: '/404.html' });
    expect(classOf(router, '/OLD/').cls).toBe('301');
  });
  it('honours caseSensitive: true on a route', () => {
    const strict = routerFor([{ src: '^/exact/?$', headers: { Location: '/pricing/' }, status: 301, caseSensitive: true }]);
    expect(strict.resolve({ pathname: '/exact/', host: HOST })).toMatchObject({ kind: 'redirect', location: '/pricing/' });
    expect(strict.resolve({ pathname: '/EXACT/', host: HOST })).toMatchObject({ kind: 'static', status: 404 });
  });
});

describe('coverage classes', () => {
  it('200 for a built page; the no-slash form takes one 308 hop and still passes', () => {
    const row = classOf(routerFor(), '/pricing/');
    expect(row.cls).toBe('200');
    expect(row.forms.map((f) => f.cls)).toEqual(['200', '301']);
    expect(row.forms[1].detail).toBe('308 /pricing/');
  });
  it('301 for a one-hop redirect from both forms', () => {
    const row = classOf(routerFor([], [{ from: '/clinic-chain-software/', to: '/pricing/' }]), '/clinic-chain-software/');
    expect(row.cls).toBe('301');
    expect(row.forms.map((f) => f.detail)).toEqual(['301 /pricing/', '301 /pricing/']);
  });
  it('301 for an external target, noted as unchecked', () => {
    const row = classOf(routerFor([], [{ from: '/knowledgebase/', to: 'https://help.easyclinic.io/' }]), '/knowledgebase/');
    expect(row.cls).toBe('301');
    expect(row.forms[0].detail).toMatch(/external target/);
  });
  it('410 for gone paths, and file-like paths are checked only as written', () => {
    const router = routerFor([], [], [{ path: '/xmlrpc.php' }, { path: '/devlabs/', match: 'prefix' }]);
    expect(requestForms('/xmlrpc.php')).toEqual(['/xmlrpc.php']);
    expect(classOf(router, '/xmlrpc.php').cls).toBe('410');
    expect(classOf(router, '/devlabs/').forms.map((f) => f.cls)).toEqual(['410', '410']);
  });
  it('404 for an unknown URL, and expected-404 where the owner decided so', () => {
    const router = routerFor();
    expect(classOf(router, '/emr-software-in-kenya/').cls).toBe('404');
    const doctors = classOf(router, '/doctors/', '404');
    expect(doctors.cls).toBe('expected-404');
    expect(doctors.forms.map((f) => f.cls)).toEqual(['expected-404', 'expected-404']);
  });
  it('chain when a redirect lands on another redirect', () => {
    // Routes injected by hand: routes-core would collapse this chain, so it can only come from elsewhere.
    const router = routerFor([
      { src: '^/a/?$', headers: { Location: '/b/' }, status: 301 },
      { src: '^/b/?$', headers: { Location: '/pricing/' }, status: 301 },
    ]);
    const row = classOf(router, '/a/');
    expect(row.cls).toBe('chain');
    expect(row.forms[0].detail).toBe('2 hops: 301 /b/ -> 301 /pricing/');
  });
  it('temporary when the one hop is a 302 or 307, while the adapter 308 still passes', () => {
    const router = routerFor([], [
      { from: '/promo/', to: '/pricing/', status: 302 },
      { from: '/offer/', to: '/pricing/', status: 307 },
      { from: '/moved/', to: '/pricing/', status: 308 },
    ]);
    const promo = classOf(router, '/promo/');
    expect(promo.cls).toBe('temporary');
    expect(promo.forms.map((f) => f.detail)).toEqual(['302 /pricing/', '302 /pricing/']);
    expect(promo.reason?.key).toMatch(/temporary redirect/);
    expect(classOf(router, '/offer/').cls).toBe('temporary');
    expect(classOf(router, '/moved/').cls).toBe('301');
    // A hand-injected temporary route (not from routes-core) is caught too.
    const injected = routerFor([{ src: '^/t/?$', headers: { Location: '/pricing/' }, status: 302 }]);
    expect(classOf(injected, '/t/').cls).toBe('temporary');
  });
  it('redirect-to-missing when the target does not return 200', () => {
    const router = routerFor([{ src: '^/c/?$', headers: { Location: '/not-built/' }, status: 301 }]);
    const row = classOf(router, '/c/');
    expect(row.cls).toBe('redirect-to-missing');
    expect(row.forms[0].detail).toMatch(/returns 404/);
  });
  it('loop when redirects cycle', () => {
    const router = routerFor([
      { src: '^/rheumatology-emr/?$', headers: { Location: '/rheumatology/' }, status: 301 },
      { src: '^/rheumatology/?$', headers: { Location: '/rheumatology-emr/' }, status: 301 },
    ]);
    const trace = traceUrl(router, HOST, '/rheumatology-emr/');
    expect(trace.loop).toBe(true);
    expect(classifyTrace(trace, '').cls).toBe('loop');
    expect(classOf(router, '/rheumatology-emr/').cls).toBe('loop');
  });
  it('the worst form decides a failing row', () => {
    // Only the no-slash form is redirected into a chain.
    const router = routerFor([
      { src: '^/d$', headers: { Location: '/e/' }, status: 301 },
      { src: '^/e/?$', headers: { Location: '/pricing/' }, status: 301 },
      { src: '^/d/$', headers: { Location: '/pricing/' }, status: 301 },
    ]);
    const row = classOf(router, '/d/');
    expect(row.forms.map((f) => f.cls)).toEqual(['301', 'chain']);
    expect(row.cls).toBe('chain');
  });
});

describe('coverage reasons', () => {
  const post = (path: string, decision: string, target: string, confirmed = ''): ManifestRow => ({
    path,
    research_class: 'X',
    proposed_decision: decision,
    target,
    owner_page: decision === 'keep' ? '/features/billing/' : '',
    reason: '',
    confirmed,
  });
  const ctx: ReasonContext = {
    skippedRedirects: [{ rule: { from: '/category/', match: 'prefix', to: '/blog/' }, reason: 'target /blog/ is not built in this stage' }],
    hidden: [{ path: '/emr-software-in-kenya/', status: 'draft', collection: 'countryPages' }],
    pages: [{ path: '/trust/', status: 'review' }],
    manifest: new Map([
      ['/ai-in-ivf/', post('/ai-in-ivf/', 'merge', '/ai/')],
      ['/humanoid-robots/', post('/humanoid-robots/', 'drop', '410', 'yes')],
      ['/clinic-cash-flow/', post('/clinic-cash-flow/', 'keep', '/clinic-cash-flow/')],
    ]),
    generatedPostPaths: new Set(),
  };
  it('names skipped redirects, drafts and manifest decisions', () => {
    expect(reasonFor(legacy('/category/ai/'), '404', ctx)).toEqual({ key: 'redirect waiting for unpublished target (reports/redirects-skipped.json)', detail: '-> /blog/' });
    expect(reasonFor(legacy('/emr-software-in-kenya/'), '404', ctx)?.key).toBe('page is a draft (not rendered in this stage)');
    expect(reasonFor(legacy('/ai-in-ivf/'), '404', ctx)).toEqual({ key: 'post awaiting marketing decision: manifest says merge', detail: 'to /ai/' });
    expect(reasonFor(legacy('/clinic-cash-flow/'), '404', ctx)?.key).toBe('post to keep: not imported or not published yet');
    expect(reasonFor(legacy('/humanoid-robots/'), '404', ctx)?.key).toMatch(/confirmed in the posts manifest but not generated/);
  });
  it('falls back to where the URL came from', () => {
    expect(reasonFor(legacy('/sitemap_index.xml', '', ['known:sitemap-file']), '404', ctx)?.key).toBe('legacy sitemap file: no redirect or 410 decided');
    expect(reasonFor(legacy('/terms/', '', ['staging-sitemap']), '404', ctx)?.key).toBe('staging-only URL: no page, redirect or 410');
    expect(reasonFor(legacy('/x/'), '404', ctx)?.key).toBe('no page, redirect or 410 for this URL');
  });
  it('flags pages that pass only because a preview build renders drafts', () => {
    expect(reasonFor(legacy('/trust/'), '200', ctx)?.key).toBe('renders in preview only (status: review)');
    expect(reasonFor(legacy('/pricing/'), '200', ctx)).toBeUndefined();
  });
  it('renders a summary table and failures grouped by reason', () => {
    const router = routerFor();
    const rows = ['/pricing/', '/ai-in-ivf/', '/emr-software-in-kenya/'].map((p) => checkRow(router, HOST, legacy(p), ctx));
    const summary = summarise(rows);
    expect(summary['200']).toBe(1);
    expect(summary['404']).toBe(2);
    const md = renderMarkdown({ generatedAt: 'now', stage: 'production', host: HOST, total: 3, failures: 2, summary, rows });
    expect(md).toMatch(/\*\*2 of 3 legacy URLs fail\*\*/);
    expect(md).toMatch(/### 404: post awaiting marketing decision: manifest says merge \(1\)/);
    expect(md).toMatch(/### 404: page is a draft \(not rendered in this stage\) \(1\)/);
  });
});

describe('legacy URL inventory', () => {
  it('parses sitemap indexes and URL sets', () => {
    const index = parseSitemap('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://www.easyclinic.io/sitemap-pages.xml</loc><lastmod>2026-08-07T20:18:26+00:00</lastmod></sitemap></sitemapindex>');
    expect(index).toEqual({ kind: 'index', entries: [{ loc: 'https://www.easyclinic.io/sitemap-pages.xml', lastmod: '2026-08-07T20:18:26+00:00' }] });
    const set = parseSitemap('<urlset><url><loc><![CDATA[https://www.easyclinic.io/a?b=1&amp;c=2]]></loc></url><url><loc>https://www.easyclinic.io/pricing/</loc></url></urlset>');
    expect(set.entries.map((e) => e.loc)).toEqual(['https://www.easyclinic.io/a?b=1&c=2', 'https://www.easyclinic.io/pricing/']);
  });
  it('keeps only live-host URLs, as paths with a trailing slash', () => {
    expect(toLegacyPath('https://www.easyclinic.io/about-us')).toBe('/about-us/');
    expect(toLegacyPath('https://easyclinic.io/xmlrpc.php')).toBe('/xmlrpc.php');
    expect(toLegacyPath('https://staging-easyclinic.vercel.app/x/')).toBeNull();
  });
  it('merges sources, keeps the newest lastmod, marks the directory hubs and sorts deterministically', () => {
    const inv = new LegacyInventory();
    inv.add('/b', 'sitemap-pages.xml', '2026-05-01T00:00:00+00:00');
    inv.add('/b/', 'page-sitemap.xml', '2026-09-25T10:00:00+00:00');
    inv.add('/a/', 'staging-sitemap');
    inv.add('/doctors/', 'known:directory');
    const rows = inv.sorted();
    expect(rows).toEqual([
      { path: '/a/', sources: ['staging-sitemap'], lastmod: '', expected: '' },
      { path: '/b/', sources: ['page-sitemap.xml', 'sitemap-pages.xml'], lastmod: '2026-09-25', expected: '' },
      { path: '/doctors/', sources: ['known:directory'], lastmod: '', expected: '404' },
    ]);
    expect(readLegacyCsv(writeLegacyCsv(rows))).toEqual(rows);
  });
});
