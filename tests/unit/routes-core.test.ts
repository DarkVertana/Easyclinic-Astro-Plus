import { describe, expect, it } from 'vitest';
import {
  HEADER_CSP,
  buildRoutes,
  collapseRedirects,
  injectRoutes,
  isYieldingPage,
  matchesRule,
  normalizePath,
  pageYieldsTo,
  resolveRules,
  sourcePattern,
  yieldingPaths,
  type GoneRule,
  type RedirectRule,
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

describe('a confirmed merge or drop on a post whose draft is still in the repo', () => {
  type Page = { path: string; collection: string; status: string };
  const pages: Page[] = [
    { path: '/', collection: 'home', status: 'published' },
    { path: '/specialties/', collection: 'hubs', status: 'published' },
    { path: '/ai-allergy-clinic-software/', collection: 'posts', status: 'draft' },
    { path: '/old-robot-post/', collection: 'posts', status: 'draft' },
    { path: '/abdm-compliance/', collection: 'posts', status: 'published' },
  ];
  const merge: RedirectRule = { from: '/ai-allergy-clinic-software/', to: '/specialties/', note: 'posts manifest: merge (confirmed)' };
  const drop: GoneRule = { path: '/old-robot-post/', note: 'posts manifest: drop (confirmed)' };
  /** What vercel-routes does with a stage's manifest: production builds published pages only, preview builds all. */
  const build = (stage: 'production' | 'preview', redirects: RedirectRule[], gone: GoneRule[] = [], all: Page[] = pages) => {
    const built = all.filter((p) => stage === 'preview' || p.status === 'published');
    return resolveRules(redirects, gone, new Set(built.map((p) => p.path)), yieldingPaths(built));
  };

  it('lets only a draft post sit on an exact rule (the registry check, every stage)', () => {
    expect(isYieldingPage({ collection: 'posts', status: 'draft' })).toBe(true);
    expect(pageYieldsTo({ collection: 'posts', status: 'draft' })).toBe(true);
    expect(pageYieldsTo({ collection: 'posts', status: 'draft' }, 'prefix')).toBe(false);
    expect(pageYieldsTo({ collection: 'posts', status: 'draft' }, 'children')).toBe(false);
    expect(pageYieldsTo({ collection: 'posts', status: 'review' })).toBe(false);
    expect(pageYieldsTo({ collection: 'posts', status: 'published' })).toBe(false);
    expect(pageYieldsTo({ collection: 'countryPages', status: 'draft' })).toBe(false);
    expect(pageYieldsTo({ collection: 'guides', status: 'draft' })).toBe(false);
  });

  it('production: the draft is not built, and the 301 and 410 apply', () => {
    const { active, skipped, activeGone, skippedGone, errors } = build('production', [merge], [drop]);
    expect(errors).toEqual([]);
    expect(active).toEqual([merge]);
    expect(skipped).toEqual([]);
    expect(activeGone).toEqual([drop]);
    expect(skippedGone).toEqual([]);
    const routes = buildRoutes({ redirects: active, gone: activeGone, canonicalHost: 'www.easyclinic.io', indexingEnabled: true });
    expect(routes.find((r) => r.headers?.Location === '/specialties/')?.src).toBe(sourcePattern('/ai-allergy-clinic-software/'));
    expect(routes.find((r) => r.status === 410)?.src).toBe(sourcePattern('/old-robot-post/'));
  });

  it('preview: the draft is rendered, and its rule is skipped with a note instead of failing the build', () => {
    const { active, skipped, activeGone, skippedGone, errors } = build('preview', [merge, { from: '/emr-landing-page/', to: '/' }], [drop, { path: '/wp-login.php' }]);
    expect(errors).toEqual([]);
    // Only the draft's own rules give way; the others are served as usual.
    expect(active.map((r) => r.from)).toEqual(['/emr-landing-page/']);
    expect(activeGone.map((g) => g.path)).toEqual(['/wp-login.php']);
    expect(skipped).toEqual([{ rule: merge, draft: '/ai-allergy-clinic-software/', reason: expect.stringMatching(/draft post.*301 to \/specialties\/ applies in production/) }]);
    expect(skippedGone).toEqual([{ rule: drop, draft: '/old-robot-post/', reason: expect.stringMatching(/draft post.*410 applies in production/) }]);
    const routes = buildRoutes({ redirects: active, gone: activeGone, canonicalHost: 'www.easyclinic.io', indexingEnabled: false });
    expect(routes.some((r) => r.headers?.Location === '/specialties/')).toBe(false);
    expect(routes.filter((r) => r.status === 410).map((r) => r.src)).toEqual([sourcePattern('/wp-login.php')]);
  });

  it('a published page on a redirect or gone path stays a build error, in both stages', () => {
    const onPublished: RedirectRule = { from: '/abdm-compliance/', to: '/specialties/' };
    for (const stage of ['production', 'preview'] as const) {
      const { errors, skipped, skippedGone } = build(stage, [onPublished], [{ path: '/abdm-compliance/' }]);
      expect(errors.filter((e) => /Redirect source \/abdm-compliance\/.*matches built page/.test(e))).toHaveLength(1);
      expect(errors.filter((e) => /Gone pattern \/abdm-compliance\/.*matches built page/.test(e))).toHaveLength(1);
      // Not skipped as a draft: vercel-routes throws on the errors, failing the build.
      expect(skipped).toEqual([]);
      expect(skippedGone).toEqual([]);
    }
    expect(pageYieldsTo({ collection: 'posts', status: 'published' })).toBe(false);
  });

  it('a review post, a draft of another collection, or a prefix rule over a draft still fails in preview', () => {
    const others: Page[] = [
      ...pages,
      { path: '/staff-scheduling/', collection: 'posts', status: 'review' },
      { path: '/emr-software-in-kenya/', collection: 'countryPages', status: 'draft' },
    ];
    const { errors } = build(
      'preview',
      [
        { from: '/staff-scheduling/', to: '/' },
        { from: '/emr-software-in-kenya/', to: '/' },
        { from: '/old-robot-post/', to: '/', match: 'prefix' },
      ],
      [],
      others,
    );
    expect(errors.map((e) => e.split(' matches built page ')[1]).sort()).toEqual(['/emr-software-in-kenya/', '/old-robot-post/', '/staff-scheduling/']);
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
