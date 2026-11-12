/** Redirects made in the admin: checked like the build checks them, written only to the admin's own file. */
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import type { AdminUser, Store } from '../../src/lib/admin/types.ts';
import { fakeRepo, storeExtras } from './admin-fakes.ts';

vi.mock('../../src/lib/admin/env.ts', () => ({ env: () => undefined }));
const { addRedirect, listRedirects, removeRedirect, cleanPath } = await import('../../src/lib/admin/redirects.ts');

const me: AdminUser = { email: 'admin@x.com', name: 'Admin', role: 'approver' };
const HEAD = '# Machine-owned\n';

function setup(recent: unknown[] = []) {
  const tree: Record<string, { raw: string; sha: string | null }> = {
    'src/data/redirects.yaml': { raw: '- { from: /legacy/, to: /features/ }\n', sha: 'a' },
    'src/data/redirects-posts.yaml': { raw: '[]\n', sha: 'b' },
    'src/data/redirects-admin.yaml': { raw: `${HEAD}[]\n`, sha: 'c' },
    'src/data/gone.yaml': { raw: '- { path: /dead/ }\n', sha: 'd' },
    'src/data/gone-posts.yaml': { raw: '[]\n', sha: 'e' },
    'src/data/gone-admin.yaml': { raw: `${HEAD}[]\n`, sha: 'f' },
  };
  const store = { ...storeExtras(async () => []) } as unknown as Store;
  for (const r of recent) void store.putDoc('recent', r as never);
  const { repo } = fakeRepo(tree);
  const pages = ['/', '/features/', '/new-post/', '/pricing/'].map((path) => ({ path, status: 'published' }));
  const deps = { store, repo, routes: async () => ({ pages, redirects: [], gone: [] }), now: () => new Date('2026-11-11T00:00:00Z') };
  const admin = () => parse(tree['src/data/redirects-admin.yaml'].raw) as Array<Record<string, unknown>>;
  return { deps, admin, tree };
}

describe('admin redirects', () => {
  it('cleans addresses typed in any form', () => {
    expect(cleanPath('old-post')).toBe('/old-post/');
    expect(cleanPath('https://www.easyclinic.io/old-post?x=1')).toBe('/old-post/');
    expect(() => cleanPath('/bad path/')).toThrow(/valid web address/);
  });

  it('adds a 301 to the admin file only, and removes it again', async () => {
    const { deps, admin, tree } = setup();
    await addRedirect({ from: 'old-post', to: '/new-post/', status: 301 }, me, deps);
    expect(admin()).toEqual([{ from: '/old-post/', to: '/new-post/', note: 'Added by admin@x.com on 2026-11-11' }]);
    expect(tree['src/data/redirects.yaml'].raw).toContain('/legacy/');
    const { rows } = await listRedirects(deps);
    expect(rows.find((r) => r.from === '/old-post/')).toMatchObject({ status: 301, editable: true });
    expect(rows.find((r) => r.from === '/legacy/')).toMatchObject({ editable: false });
    await removeRedirect('/old-post/', me, deps);
    expect(admin() ?? []).toEqual([]);
  });

  it('keeps a temporary type and refuses loops, duplicates, chains, gone paths and built-in rows', async () => {
    const { deps, admin } = setup();
    await addRedirect({ from: '/promo/', to: '/pricing/', status: 302 }, me, deps);
    expect(admin()[0]).toMatchObject({ status: 302 });
    await expect(addRedirect({ from: '/x/', to: '/x/', status: 301 }, me, deps)).rejects.toThrow(/itself/);
    await expect(addRedirect({ from: '/promo/', to: '/features/', status: 301 }, me, deps)).rejects.toThrow(/already redirects/);
    await expect(addRedirect({ from: '/y/', to: '/promo/', status: 301 }, me, deps)).rejects.toThrow(/Point straight at/);
    await expect(addRedirect({ from: '/dead/', to: '/features/', status: 301 }, me, deps)).rejects.toThrow(/gone/);
    await expect(addRedirect({ from: '/pricing/', to: '/features/', status: 301 }, me, deps)).rejects.toThrow(/break the site build/);
    await expect(removeRedirect('/legacy/', me, deps)).rejects.toThrow(/built-in/);
  });

  it('suggests deleted and unpublished posts that have no rule yet', async () => {
    const { deps } = setup([
      { id: 'gone-post', title: 'Gone post', state: 'deleted', updatedAt: '2026-11-10T00:00:00Z' },
      { id: 'live-post', title: 'Live', state: 'published', updatedAt: '2026-11-10T00:00:00Z' },
    ]);
    expect((await listRedirects(deps)).suggestions.map((s) => s.path)).toEqual(['/gone-post/']);
    await addRedirect({ from: '/gone-post/', to: '/new-post/', status: 301 }, me, deps);
    expect((await listRedirects(deps)).suggestions).toEqual([]);
  });
});
