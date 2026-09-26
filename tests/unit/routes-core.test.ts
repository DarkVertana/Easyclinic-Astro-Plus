import { describe, expect, it } from 'vitest';
import {
  HEADER_CSP,
  buildRoutes,
  collapseRedirects,
  injectRoutes,
  matchesRule,
  normalizePath,
  resolveRules,
  sourcePattern,
  type VercelRoute,
} from '../../integrations/routes-core.ts';

describe('normalizePath', () => {
  it('adds leading and trailing slashes', () => {
    expect(normalizePath('pricing')).toBe('/pricing/');
    expect(normalizePath('/pricing')).toBe('/pricing/');
    expect(normalizePath('//a//b')).toBe('/a/b/');
  });
  it('leaves file paths and external URLs alone', () => {
    expect(normalizePath('/wp-login.php')).toBe('/wp-login.php');
    expect(normalizePath('/rss.xml')).toBe('/rss.xml');
    expect(normalizePath('https://help.easyclinic.io/')).toBe('https://help.easyclinic.io/');
  });
  it('keeps hash fragments after the slash', () => {
    expect(normalizePath('/trust#abdm')).toBe('/trust/#abdm');
  });
});

describe('sourcePattern', () => {
  it('matches both slash forms for exact rules, and nothing else', () => {
    const re = new RegExp(sourcePattern('/clinic-chain-software/'));
    expect(re.test('/clinic-chain-software')).toBe(true);
    expect(re.test('/clinic-chain-software/')).toBe(true);
    expect(re.test('/clinic-chain-software/x/')).toBe(false);
    expect(re.test('/clinic-chain-software-2/')).toBe(false);
  });
  it('escapes regex characters', () => {
    const re = new RegExp(sourcePattern('/wp-login.php'));
    expect(re.test('/wp-login.php')).toBe(true);
    expect(re.test('/wp-loginXphp')).toBe(false);
  });
  it('children mode never matches the parent path', () => {
    expect(matchesRule('/archive/', '/archive/', 'children')).toBe(false);
    expect(matchesRule('/archive', '/archive/', 'children')).toBe(false);
    expect(matchesRule('/archive/item/', '/archive/', 'children')).toBe(true);
    expect(matchesRule('/archive/item', '/archive/', 'children')).toBe(true);
    expect(matchesRule('/archivex/', '/archive/', 'children')).toBe(false);
  });
  it('prefix mode matches the path and below', () => {
    expect(matchesRule('/category/', '/category/', 'prefix')).toBe(true);
    expect(matchesRule('/category', '/category/', 'prefix')).toBe(true);
    expect(matchesRule('/category/ai/', '/category/', 'prefix')).toBe(true);
    expect(matchesRule('/categoryx/', '/category/', 'prefix')).toBe(false);
  });
});

describe('collapseRedirects', () => {
  it('collapses chains to one hop', () => {
    const out = collapseRedirects([
      { from: '/diabetology-emr-software/', to: '/endocrinology-emr-software/' },
      { from: '/endocrinology-emr-software/', to: '/specialties/' },
    ]);
    expect(out[0].to).toBe('/specialties/');
    expect(out[1].to).toBe('/specialties/');
  });
  it('throws on loops like the live rheumatology pages', () => {
    expect(() =>
      collapseRedirects([
        { from: '/rheumatology-emr/', to: '/rheumatology/' },
        { from: '/rheumatology/', to: '/rheumatology-emr/' },
      ]),
    ).toThrow(/loop/);
  });
});

describe('resolveRules', () => {
  const built = new Set(['/', '/archive/', '/solutions/clinic-chain/', '/countries/']);
  it('activates redirects with built targets and skips the rest', () => {
    const { active, skipped, errors } = resolveRules(
      [
        { from: '/clinic-chain-software/', to: '/solutions/clinic-chain/' },
        { from: '/emr-software-in-ghana/', to: '/clinic-management-software-ghana/', fallback: '/countries/' },
        { from: '/payor-management/', to: '/features/insurance-claims/' },
        { from: '/knowledgebase/', to: 'https://help.easyclinic.io/' },
      ],
      [],
      built,
    );
    expect(errors).toEqual([]);
    expect(active.map((r) => r.to)).toEqual(['/solutions/clinic-chain/', '/countries/', 'https://help.easyclinic.io/']);
    expect(skipped).toHaveLength(1);
  });
  it('rejects redirect sources and gone patterns that shadow built pages', () => {
    const { errors } = resolveRules(
      [{ from: '/archive/', to: '/' }],
      [{ path: '/archive/', match: 'prefix' }],
      built,
    );
    expect(errors.filter((e) => /matches built page/.test(e))).toHaveLength(2);
    // The same path is also both redirected and gone.
    expect(errors.filter((e) => /also gone/.test(e))).toHaveLength(1);
  });
  it('accepts a children gone rule alongside its parent page', () => {
    expect(resolveRules([], [{ path: '/archive/', match: 'children' }], built).errors).toEqual([]);
  });
  it('rejects a path that is both redirected and gone', () => {
    const { errors } = resolveRules([{ from: '/robotic-surgery/', to: '/' }], [{ path: '/robotic-surgery/' }], built);
    expect(errors.join()).toMatch(/also gone/);
    expect(resolveRules([{ from: '/wp-admin-guide/', to: '/' }], [{ path: '/wp-admin/', match: 'prefix' }], built).errors).toEqual([]);
  });
  it('flags duplicate sources', () => {
    const { errors } = resolveRules([{ from: '/a/', to: '/' }, { from: '/a', to: '/' }], [], built);
    expect(errors.join()).toMatch(/Duplicate/);
  });
});

describe('buildRoutes and injectRoutes', () => {
  const adapterRoutes: VercelRoute[] = [
    { src: '^/\\.well-known(?:/.*)?$' },
    { src: '^/((?:[^/]+/)*[^/\\.]+)$', headers: { Location: '/$1/' }, status: 308 },
    { handle: 'filesystem' },
    { src: '^/.*$', dest: '_render', status: 404 },
  ];

  it('puts noindex on every host until indexing is enabled', () => {
    const routes = buildRoutes({ redirects: [], gone: [], canonicalHost: 'www.easyclinic.io', indexingEnabled: false });
    const noindex = routes.find((r) => r.headers?.['X-Robots-Tag']);
    expect(noindex?.missing).toBeUndefined();
  });
  it('limits noindex to non-canonical hosts once indexing is enabled', () => {
    const routes = buildRoutes({ redirects: [], gone: [], canonicalHost: 'www.easyclinic.io', indexingEnabled: true });
    const noindex = routes.find((r) => r.headers?.['X-Robots-Tag']);
    expect(noindex?.missing).toEqual([{ type: 'host', value: 'www.easyclinic.io' }]);
  });
  it('prepends our routes before the trailing-slash rule and the filesystem', () => {
    const ours = buildRoutes({
      redirects: [{ from: '/a/', to: '/b/' }],
      gone: [{ path: '/archive/', match: 'children' }],
      canonicalHost: 'www.easyclinic.io',
      indexingEnabled: false,
    });
    const merged = injectRoutes(adapterRoutes, ours);
    const redirectIndex = merged.findIndex((r) => r.headers?.Location === '/b/');
    const goneIndex = merged.findIndex((r) => r.status === 410);
    const slashIndex = merged.findIndex((r) => r.status === 308);
    expect(redirectIndex).toBeLessThan(slashIndex);
    expect(goneIndex).toBeLessThan(slashIndex);
    expect(() => injectRoutes(merged, ours)).toThrow(/already injected/);
  });
  it('sends the header half of the CSP on every path, without restricting scripts or styles', () => {
    const routes = buildRoutes({ redirects: [], gone: [], canonicalHost: 'www.easyclinic.io', indexingEnabled: false });
    expect(routes[0].headers?.['Content-Security-Policy']).toBe(HEADER_CSP);
    expect(HEADER_CSP).toMatch(/frame-ancestors 'self'/);
    expect(HEADER_CSP).toMatch(/object-src 'none'/);
    expect(HEADER_CSP).toMatch(/base-uri 'self'/);
    expect(HEADER_CSP).toMatch(/form-action 'self'/);
    // A second policy with these would block the inline code the per-page <meta> policy allows by hash.
    expect(HEADER_CSP).not.toMatch(/default-src|script-src|style-src/);
  });
  it('fails loudly if the adapter output changes shape', () => {
    expect(() => injectRoutes([{ handle: 'filesystem' }], [])).toThrow(/trailing-slash/);
  });
});
