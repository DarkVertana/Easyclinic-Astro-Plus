import { describe, expect, it } from 'vitest';
import { ADMIN_CSP_DIRECTIVES, adminCsp, isAdminPath, keystaticDecision, rewriteKeystaticDevUrl } from '../../integrations/keystatic-core.ts';
import { KEYSTATIC_ROUTES, buildRoutes } from '../../integrations/routes-core.ts';

describe('keystaticDecision', () => {
  it('turns Keystatic on in astro dev with local storage', () => {
    expect(keystaticDecision({}, 'dev')).toMatchObject({ enabled: true, storage: 'local' });
  });

  it('keeps it out of every production run', () => {
    expect(keystaticDecision({ CONTENT_STAGE: 'production' }, 'dev').enabled).toBe(false);
    expect(keystaticDecision({ VERCEL_ENV: 'production' }, 'build').enabled).toBe(false);
    // CONTENT_STAGE=preview on www must not bring the admin with it.
    const www = { VERCEL_ENV: 'production', CONTENT_STAGE: 'preview', KEYSTATIC_STORAGE: 'github', KEYSTATIC_GITHUB_REPO: 'org/site' };
    expect(keystaticDecision(www, 'build').enabled).toBe(false);
    expect(keystaticDecision({ CONTENT_STAGE: 'production', KEYSTATIC_STORAGE: 'github', KEYSTATIC_GITHUB_REPO: 'org/site' }, 'build').enabled).toBe(false);
  });

  it('keeps it out of Vitest, astro sync and local-storage builds', () => {
    expect(keystaticDecision({ VITEST: 'true' }, 'dev').enabled).toBe(false);
    expect(keystaticDecision({}, 'sync').enabled).toBe(false);
    expect(keystaticDecision({}, 'build').enabled).toBe(false);
    expect(keystaticDecision({ VERCEL_ENV: 'preview' }, 'build').enabled).toBe(false);
  });

  it('builds a preview deployment with github storage only when the repo is named', () => {
    expect(keystaticDecision({ VERCEL_ENV: 'preview', KEYSTATIC_STORAGE: 'github', KEYSTATIC_GITHUB_REPO: 'org/site' }, 'build')).toMatchObject({
      enabled: true,
      storage: 'github',
      repo: 'org/site',
    });
    expect(() => keystaticDecision({ KEYSTATIC_STORAGE: 'github' }, 'build')).toThrow(/KEYSTATIC_GITHUB_REPO/);
    expect(() => keystaticDecision({ KEYSTATIC_STORAGE: 'github', KEYSTATIC_GITHUB_REPO: 'site' }, 'dev')).toThrow();
  });
});

describe('rewriteKeystaticDevUrl', () => {
  it('serves every admin URL from /keystatic/ without changing the browser URL', () => {
    expect(rewriteKeystaticDevUrl('/keystatic')).toBe('/keystatic/');
    expect(rewriteKeystaticDevUrl('/keystatic/collection/posts')).toBe('/keystatic/');
    expect(rewriteKeystaticDevUrl('/keystatic/collection/posts/item/clinic-cash-flow')).toBe('/keystatic/');
    expect(rewriteKeystaticDevUrl('/keystatic/collection/posts/?x=1')).toBe('/keystatic/?x=1');
  });

  it('adds the trailing slash to API calls and keeps the query', () => {
    expect(rewriteKeystaticDevUrl('/api/keystatic/tree')).toBe('/api/keystatic/tree/');
    expect(rewriteKeystaticDevUrl('/api/keystatic/update')).toBe('/api/keystatic/update/');
    expect(rewriteKeystaticDevUrl('/api/keystatic/blob/abc/src/data/site.yaml')).toBe('/api/keystatic/blob/abc/src/data/site.yaml/');
    expect(rewriteKeystaticDevUrl('/api/keystatic/github/oauth/callback?code=1&state=2')).toBe('/api/keystatic/github/oauth/callback/?code=1&state=2');
    expect(rewriteKeystaticDevUrl('/api/keystatic/tree/')).toBe('/api/keystatic/tree/');
  });

  it('leaves every other URL alone, including the modules Vite serves from the keystatic/ folder', () => {
    for (const url of ['/', '/features/emr/', '/keystatics/', '/api/other', '/@vite/client', '/_astro/x.js', '/demo/confirmation', '/keystatic/fields.ts', '/keystatic/blocks/index.ts?t=123']) {
      expect(rewriteKeystaticDevUrl(url)).toBe(url);
    }
  });
});

describe('admin CSP', () => {
  const astroPolicy =
    "default-src 'self'; img-src 'self'; script-src 'self' https://www.googletagmanager.com 'sha256-abc=' 'sha256-def='; style-src 'self' 'sha256-xyz='; object-src 'none'";

  it("keeps Astro's script-src verbatim and allows runtime styles", () => {
    const policy = adminCsp(astroPolicy);
    expect(policy).toContain("script-src 'self' https://www.googletagmanager.com 'sha256-abc=' 'sha256-def='");
    expect(policy).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(policy).not.toContain('sha256-xyz');
    expect(policy.match(/script-src[^;]*/)?.[0]).not.toContain('unsafe');
    expect(policy.split('; ')).toHaveLength(ADMIN_CSP_DIRECTIVES.length + 1);
  });

  it('only applies to the admin page', () => {
    expect(isAdminPath('/keystatic/')).toBe(true);
    expect(isAdminPath('/keystatic/collection/posts/')).toBe(true);
    expect(isAdminPath('/api/keystatic/tree/')).toBe(false);
    expect(isAdminPath('/keystatics/')).toBe(false);
  });
});

describe('Vercel routes for the admin', () => {
  const input = { redirects: [], gone: [], canonicalHost: 'www.easyclinic.io', indexingEnabled: false };

  it('adds the admin rewrites only to builds that contain Keystatic', () => {
    expect(buildRoutes(input).some((r) => String(r.src).includes('keystatic'))).toBe(false);
    const routes = buildRoutes({ ...input, keystatic: true });
    expect(routes.filter((r) => String(r.src).includes('keystatic'))).toEqual(KEYSTATIC_ROUTES);
  });

  it('rewrites rather than redirects', () => {
    for (const route of KEYSTATIC_ROUTES) {
      expect(route.status).toBeUndefined();
      expect(route.headers?.Location).toBeUndefined();
    }
    const [admin, api] = KEYSTATIC_ROUTES.map((r) => new RegExp(String(r.src)));
    expect(admin.test('/keystatic/collection/posts')).toBe(true);
    expect(admin.test('/keystatics')).toBe(false);
    expect(api.test('/api/keystatic/tree')).toBe(true);
    expect(api.test('/api/keystatic/tree/')).toBe(false);
  });
});
