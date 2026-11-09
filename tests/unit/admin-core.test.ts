import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const secrets: Record<string, string | undefined> = {};
vi.mock('../../src/lib/admin/env.ts', () => ({ env: (name: string) => secrets[name] }));

const auth = await import('../../src/lib/admin/auth.ts');
const { assertSameOrigin, readFlash, redirectFlash, safeBack } = await import('../../src/lib/admin/http.ts');
const { hashContent, parsePost, serializePost } = await import('../../src/lib/admin/mdx-file.ts');
const { RepoConflictError, RepoRateLimitError, assertSlug, createGithubRepo, createLocalRepo } = await import('../../src/lib/admin/repo.ts');
const { StaleWriteError, createFileStore, createPostgresStore } = await import('../../src/lib/admin/store.ts');

const SECRET = 'x'.repeat(40);

function fakeContext(path = '/admin/', cookies: Record<string, string> = {}) {
  const jar = { ...cookies };
  return {
    url: new URL(`https://site.test${path}`),
    request: new Request(`https://site.test${path}`),
    jar,
    cookies: {
      get: (name: string) => (jar[name] === undefined ? undefined : { value: jar[name] }),
      set: (name: string, value: string) => void (jar[name] = value),
      delete: (name: string) => void delete jar[name],
    },
  } as any;
}

beforeEach(() => {
  for (const key of Object.keys(secrets)) delete secrets[key];
  Object.assign(secrets, { ADMIN_SESSION_SECRET: SECRET, ADMIN_APPROVERS: 'Boss@x.com', ADMIN_EDITORS: 'ed@x.com, both@x.com', ADMIN_EMAIL: 'Admin@x.com', ADMIN_PASSWORD: 'correct horse' });
});
afterEach(() => vi.unstubAllEnvs());

describe('mdx-file', () => {
  const root = join(process.cwd(), 'src/content/posts');
  it('round-trips every real post', () => {
    const slugs = readdirSync(root);
    expect(slugs.length).toBeGreaterThan(100);
    for (const slug of slugs) {
      const once = parsePost(readFileSync(join(root, slug, 'index.mdx'), 'utf8'));
      const text = serializePost(once);
      expect(parsePost(text), slug).toEqual(once);
      expect(serializePost(parsePost(text)), slug).toBe(text);
    }
  });
  it('keeps dates as unquoted YYYY-MM-DD strings', () => {
    const text = serializePost({ frontmatter: { lastUpdated: '2026-09-27' }, body: 'x' });
    expect(text).toContain('lastUpdated: 2026-09-27\n');
    expect(parsePost(text).frontmatter.lastUpdated).toBe('2026-09-27');
  });
  it('hash ignores key order (jsonb reorders) and changes with content', () => {
    const a = { frontmatter: { a: 1, b: { c: 2, d: 3 } }, body: 'x' };
    expect(hashContent({ frontmatter: { b: { d: 3, c: 2 }, a: 1 }, body: 'x' })).toBe(hashContent(a));
    expect(hashContent({ ...a, body: 'y' })).not.toBe(hashContent(a));
  });
  it('rejects a file with no frontmatter, or non-object frontmatter', () => {
    expect(() => parsePost('no fence')).toThrow();
    expect(() => parsePost('---\n- a\n---\nx')).toThrow();
  });
});

describe('session', () => {
  it('rejects tampering, expiry and a state cookie used as a session', () => {
    const token = auth.signValue('session', { email: 'a', exp: 2000 }, SECRET);
    expect(auth.verifyValue('session', token, SECRET, 1000)).toBeTruthy();
    expect(auth.verifyValue('session', token, SECRET, 3000)).toBeNull();
    expect(auth.verifyValue('session', `${token}x`, SECRET, 1000)).toBeNull();
    expect(auth.verifyValue('session', token, 'y'.repeat(40), 1000)).toBeNull();
    expect(auth.verifyValue('oauth', token, SECRET, 1000)).toBeNull();
  });
  it('removing an email revokes a live session on the next request', async () => {
    vi.stubEnv('DEV', false);
    const context = fakeContext();
    auth.startSession(context, { email: 'ed@x.com', name: 'Ed' });
    expect((await auth.currentUser(context))?.role).toBe('approver');
    secrets.ADMIN_EDITORS = 'other@x.com';
    expect(await auth.currentUser(context)).toBeNull();
  });
  it('the admin and every listed address may do everything; emails compare without case', async () => {
    expect(auth.roleFor('ADMIN@x.com')).toBe('approver');
    expect(auth.roleFor('ed@X.com')).toBe('approver');
    expect(auth.roleFor('stranger@x.com')).toBeNull();
  });
  it('a dev role in a cookie means nothing in production', async () => {
    vi.stubEnv('DEV', false);
    const context = fakeContext();
    auth.startSession(context, { email: 'stranger@x.com', name: 'S', devRole: 'approver' });
    expect(await auth.currentUser(context)).toBeNull();
  });
  it('fails closed when deployed without settings, and names only the missing keys', async () => {
    vi.stubEnv('DEV', false);
    secrets.ADMIN_SESSION_SECRET = 'short';
    const problem = auth.authSetupProblem();
    expect(problem).toContain('ADMIN_SESSION_SECRET');
    expect(problem).not.toContain('short');
    expect(await auth.currentUser(fakeContext())).toBeNull();
  });
  it('pages redirect to login; API routes get 401 and 403', async () => {
    vi.stubEnv('DEV', false);
    const page = await auth.requireUser(fakeContext('/admin/queue/')).catch((r) => r);
    expect(page.status).toBe(303);
    expect(page.headers.get('location')).toContain('/admin/login/');
    // A plain form post goes to sign-in rather than showing raw JSON.
    const form = await auth.requireUser(fakeContext('/admin/api/posts/new/')).catch((r) => r);
    expect(form.status).toBe(303);
    expect(form.headers.get('location')).toBe('/admin/login/?back=%2Fadmin%2F');
    const jsonContext = fakeContext('/admin/api/posts/new/');
    jsonContext.request.headers.set('accept', 'application/json');
    const api = await auth.requireUser(jsonContext).catch((r) => r);
    expect(api.status).toBe(401);
  });
});

describe('password sign-in', () => {
  it('accepts the admin email in any case with the exact password', () => {
    expect(auth.checkPassword('admin@X.com', 'correct horse')).toBe(true);
    expect(auth.checkPassword(' admin@x.com ', 'correct horse')).toBe(true);
  });
  it('refuses a wrong password, a wrong email and a missing setting', () => {
    expect(auth.checkPassword('admin@x.com', 'Correct horse')).toBe(false);
    expect(auth.checkPassword('ed@x.com', 'correct horse')).toBe(false);
    expect(auth.checkPassword('admin@x.com', '')).toBe(false);
    vi.stubEnv('DEV', false);
    delete secrets.ADMIN_PASSWORD;
    expect(auth.checkPassword('admin@x.com', 'correct horse')).toBe(false);
    expect(auth.authSetupProblem()).toContain('ADMIN_PASSWORD');
  });
  it('blocks a key after eight failures for fifteen minutes', () => {
    const key = `ip|${Math.random()}`;
    for (let i = 0; i < 8; i++) auth.noteFailedSignIn(key, 1000);
    expect(auth.signInBlocked(key, 2000)).toBe(true);
    expect(auth.signInBlocked(key, 1000 + 15 * 60_000 + 1)).toBe(false);
    auth.clearFailedSignIns(key);
    expect(auth.signInBlocked(key, 2000)).toBe(false);
  });
});

describe('http', () => {
  const url = new URL('https://site.test/admin/api/x/');
  const post = (origin?: string) => new Request(url, { method: 'POST', headers: origin ? { origin } : {} });
  it('refuses a foreign or missing Origin', () => {
    expect(() => assertSameOrigin(post('https://site.test'), url)).not.toThrow();
    for (const origin of ['https://evil.test', 'null', undefined]) {
      try {
        assertSameOrigin(post(origin), url);
        expect.unreachable();
      } catch (error) {
        expect((error as Response).status).toBe(403);
      }
    }
  });
  it.each(['//evil.test/admin/', '/\\evil.test', 'https://evil.test/admin/', '/admin/../etc', '/blog/', '/admin/%2f%2fevil', '/admin//evil', '/admin/\nx', 'admin/', ''])('safeBack refuses %s', (value) => {
    expect(safeBack(value)).toBe('/admin/');
  });
  it('safeBack keeps real admin paths', () => {
    expect(safeBack('/admin/posts/1/?a=1#b')).toBe('/admin/posts/1/?a=1#b');
  });
  it('flash round-trips, and cannot redirect away', () => {
    const response = redirectFlash('https://evil.test/', 'Saved & done', 'success');
    const location = response.headers.get('location')!;
    expect(location.startsWith('/admin/?')).toBe(true);
    expect(readFlash(new URL(location, 'https://site.test'))).toEqual({ message: 'Saved & done', kind: 'success' });
    expect(readFlash(new URL('https://site.test/?flash=a&flashKind=<x>'))?.kind).toBe('info');
  });
});

describe('store', () => {
  const sub = (updatedAt: string) => ({ id: 'a1', updatedAt, content: { frontmatter: { z: 1, a: 2 }, body: '' } }) as any;

  it('file store: stale write refused, ids cannot traverse, 20 racers leave one winner', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'admin-store-'));
    try {
      const store = createFileStore(dir);
      await store.putSubmission(sub('t0'));
      await expect(store.putSubmission(sub('t1'), 'wrong')).rejects.toBeInstanceOf(StaleWriteError);
      const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => store.putSubmission(sub(`r${i}`), 't0')));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await expect(store.getSubmission('../../etc/passwd')).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('postgres: parameterized, the check is in the UPDATE, and no row means stale', async () => {
    const calls: Array<[string, unknown[] | undefined]> = [];
    let rows: Array<Record<string, unknown>> = [];
    const store = createPostgresStore(async (text, params) => {
      calls.push([text, params]);
      return text.startsWith('UPDATE') ? rows : [];
    });
    await expect(store.putSubmission(sub("t'; DROP TABLE admin_docs;--"), 'old')).rejects.toBeInstanceOf(StaleWriteError);
    const update = calls.find(([text]) => text.startsWith('UPDATE'))!;
    expect(update[0]).toContain("data->>'updatedAt' = $3");
    expect(update[0]).not.toContain('DROP');
    expect(update[1]![2]).toBe('old');
    rows = [{ id: 'a1' }];
    await expect(store.putSubmission(sub('t2'), 'old')).resolves.toBeUndefined();
    expect(calls.filter(([text]) => text.startsWith('CREATE TABLE'))).toHaveLength(1);
  });

  it('postgres: key order survives jsonb, and a failed table create is retried', async () => {
    let saved: unknown;
    let failCreate = true;
    const store = createPostgresStore(async (text, params) => {
      if (text.startsWith('CREATE') && failCreate) {
        failCreate = false;
        throw new Error('cold start');
      }
      if (text.startsWith('INSERT')) saved = JSON.parse(params![2] as string);
      if (text.startsWith('SELECT')) return [{ data: saved }];
      return [];
    });
    await expect(store.putSubmission(sub('t'))).rejects.toThrow('cold start');
    await store.putSubmission(sub('t'));
    const back = await store.getSubmission('a1');
    expect(Object.keys(back!.content.frontmatter)).toEqual(['z', 'a']);
  });
});

describe('slug handling', () => {
  it.each(['../x', 'A', 'a/b', 'a b', 'a%2fb', '', 'a.b', 'a\nb'])('refuses %j before any path or URL', async (slug) => {
    expect(() => assertSlug(slug)).toThrow();
    const fetchFn = vi.fn();
    const repo = createGithubRepo({ token: 't', repo: 'o/r', fetchFn: fetchFn as any });
    await expect(repo.readPost(slug)).rejects.toThrow();
    await expect(createLocalRepo(tmpdir()).readPost(slug)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('GitHub repo', () => {
  type Reply = { status: number; body?: unknown; headers?: Record<string, string> };
  function github(handler: (method: string, path: string, body: any) => Reply) {
    const calls: Array<{ method: string; path: string; body: any; token: string | null }> = [];
    const fetchFn = async (url: string, init: RequestInit) => {
      const path = url.replace('https://api.github.com/repos/o/r', '');
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method: init.method!, path, body, token: new Headers(init.headers).get('authorization') });
      const reply = handler(init.method!, path, body);
      return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), { status: reply.status, headers: reply.headers });
    };
    return { calls, repo: createGithubRepo({ token: 'secret-token', repo: 'o/r', fetchFn: fetchFn as any, now: () => 1_000_000 }) };
  }
  const file = (sha: string, raw = 'x') => ({ status: 200, body: { sha, encoding: 'base64', content: Buffer.from(raw).toString('base64') } });

  const PATH = 'src/content/posts/a/index.mdx';
  const plan = (sha: string | null, extra: Partial<import('../../src/lib/admin/types.ts').CommitPlan> = {}) => ({ writes: [{ path: PATH, content: 'x' }], deletes: [], expect: [{ path: PATH, sha }], message: 'm', ...extra });
  /** A whole Git Data API: refs, commits, trees. `moved` answers the ref update. */
  const dataApi = (blob: () => Reply, moved: () => Reply = () => ({ status: 200 })) => (method: string, path: string): Reply => {
    if (method === 'GET' && path.startsWith('/git/ref/heads/main')) return { status: 200, body: { object: { sha: 'head1' } } };
    if (method === 'GET' && path.startsWith('/git/commits/')) return { status: 200, body: { tree: { sha: 'tree0' } } };
    if (method === 'POST' && path === '/git/trees') return { status: 201, body: { sha: 'tree1' } };
    if (method === 'POST' && path === '/git/commits') return { status: 201, body: { sha: 'c1' } };
    if (method === 'PATCH') return moved();
    return blob();
  };
  it('a commit with a changed base never builds anything (main moved)', async () => {
    const { repo, calls } = github(dataApi(() => file('newer')));
    await expect(repo.commit(plan('old'))).rejects.toBeInstanceOf(RepoConflictError);
    expect(calls.some((c) => c.method === 'POST' || c.method === 'PATCH')).toBe(false);
  });
  it('a new post whose file appeared is a conflict', async () => {
    const { repo } = github(dataApi(() => file('sha')));
    await expect(repo.commit(plan(null))).rejects.toBeInstanceOf(RepoConflictError);
  });
  it('builds on base_tree, deletes with sha null, parents on the verified head, and moves main with force:false', async () => {
    const { repo, calls } = github(dataApi(() => file('base')));
    const del = 'src/content/posts/a/extra.txt';
    expect(await repo.commit(plan('base', { deletes: [del] }))).toBe('c1');
    const tree = calls.find((c) => c.path === '/git/trees')!.body;
    expect(tree.base_tree).toBe('tree0');
    expect(tree.tree).toContainEqual({ path: PATH, mode: '100644', type: 'blob', content: 'x' });
    expect(tree.tree).toContainEqual({ path: del, mode: '100644', type: 'blob', sha: null });
    expect(calls.find((c) => c.path === '/git/commits')!.body).toMatchObject({ parents: ['head1'], tree: 'tree1', message: 'm' });
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ sha: 'c1', force: false });
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    expect(calls.filter((c) => c.path.startsWith('/contents/')).every((c) => c.path.endsWith('?ref=head1'))).toBe(true);
  });
  it.each([409, 422])('main moving during the commit (%i): re-verifies, retries once, then conflicts', async (status) => {
    const { repo, calls } = github(dataApi(() => file('base'), () => ({ status })));
    await expect(repo.commit(plan('base'))).rejects.toBeInstanceOf(RepoConflictError);
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'PATCH').every((c) => c.body.force === false)).toBe(true);
  });
  it('main moving once, with the file unchanged, succeeds on the retry', async () => {
    let tries = 0;
    const { repo } = github(dataApi(() => file('base'), () => (tries++ === 0 ? { status: 409 } : { status: 200 })));
    expect(await repo.commit(plan('base'))).toBe('c1');
  });
  it('the file changing between tries is a conflict, and the new sha is never adopted', async () => {
    let reads = 0;
    const { repo, calls } = github(dataApi(() => file(reads++ === 0 ? 'base' : 'other'), () => ({ status: 409 })));
    await expect(repo.commit(plan('base'))).rejects.toBeInstanceOf(RepoConflictError);
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
  });
  it.each(['src/pages/x.astro', 'src/data/redirects.yaml', 'src/content/posts/../../evil', '.github/workflows/ci.yml'])('a plan cannot touch %s', async (path) => {
    const { repo, calls } = github(dataApi(() => file('base')));
    await expect(repo.commit({ writes: [{ path, content: 'x' }], deletes: [], expect: [], message: 'm' })).rejects.toThrow('may not touch');
    expect(calls).toHaveLength(0);
  });
  it.each([
    ['primary limit', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1600' } }, 600],
    ['retry-after', { status: 403, headers: { 'retry-after': '90' } }, 90],
    ['bare 429', { status: 429 }, 60],
  ])('%s stops at once, with no retry', async (_name, reply, wait) => {
    const { repo, calls } = github(() => reply as Reply);
    const error = await repo.readPost('a').catch((e) => e);
    expect(error).toBeInstanceOf(RepoRateLimitError);
    expect(error.retryAfterSeconds).toBe(wait);
    expect(calls).toHaveLength(1);
  });
  it('a plain 403 is a permission error, and errors never carry the token or GitHub text', async () => {
    const { repo } = github(() => ({ status: 403, body: { message: 'secret-token leaked' } }));
    const error = await repo.readPost('a').catch((e) => e);
    expect(error.name).toBe('RepoError');
    expect(error.message).not.toContain('secret-token');
  });
  it('a file over the contents limit is an error, not an empty post', async () => {
    const { repo } = github(() => ({ status: 200, body: { sha: 's', encoding: 'none', content: '' } }));
    await expect(repo.readPost('a')).rejects.toThrow();
  });
  it('preview: creates the branch, or resets an existing one to main and writes with its sha', async () => {
    const handler = (exists: boolean) => (method: string, path: string): Reply => {
      if (path.startsWith('/git/ref/heads/main')) return { status: 200, body: { object: { sha: 'mainsha' } } };
      if (path === '/git/refs') return exists ? { status: 422, body: { message: 'Reference already exists' } } : { status: 201 };
      if (method === 'PATCH') return { status: 200 };
      if (method === 'GET') return exists ? file('branchsha') : { status: 404 };
      return { status: 201, body: { commit: { sha: 'c' } } };
    };
    const fresh = github(handler(false));
    expect(await fresh.repo.writePreview('a', 'x', 'ABCD1234-ffff')).toBe('content/a-abcd1234');
    expect(await fresh.repo.writePreview('a', 'x', '99990000-ffff')).toBe('content/a-99990000');
    expect(fresh.calls.some((c) => c.method === 'PATCH')).toBe(false);
    const old = github(handler(true));
    await old.repo.writePreview('a', 'x', 'id');
    expect(old.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ sha: 'mainsha', force: true });
    expect(old.calls.find((c) => c.method === 'PUT')!.body.sha).toBe('branchsha');
  });
  it('deletePreview only touches content/ branches, and an already deleted one is fine', async () => {
    const { repo } = github(() => ({ status: 422, body: { message: 'Reference does not exist' } }));
    await expect(repo.deletePreview('main')).rejects.toThrow();
    await expect(repo.deletePreview('content/../main')).rejects.toThrow();
    await expect(repo.deletePreview('content/a')).resolves.toBeUndefined();
  });
});
