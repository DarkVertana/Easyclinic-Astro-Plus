import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { realBackendsAllowed } from './dev-guard.ts';
import { env } from './env.ts';
import type { CommitPlan, ContentRepo } from './types.ts';

const SLUG = /^[a-z0-9-]+$/;
const API = 'https://api.github.com';
const MAIN = 'main';

export class RepoConflictError extends Error {
  constructor(message = 'This post changed on main since it was opened.') {
    super(message);
    this.name = 'RepoConflictError';
  }
}

export class RepoRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`GitHub is rate limiting us. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minutes.`);
    this.name = 'RepoRateLimitError';
  }
}

/** Status only: GitHub's text can echo request details, so it stays out of errors and logs. */
export class RepoError extends Error {
  constructor(readonly status: number, what: string) {
    super(`GitHub refused to ${what} (status ${status}).`);
    this.name = 'RepoError';
  }
}

export function assertSlug(slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || slug.length > 120 || !SLUG.test(slug)) throw new Error('Slugs use only lowercase letters, digits and hyphens.');
}

/** One branch per submission, so two submissions for a slug can never share a preview. */
export function previewBranchName(slug: string, submissionId: string): string {
  return `content/${slug}-${submissionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()}`;
}

export const postPath = (slug: string) => `src/content/posts/${slug}/index.mdx`;

/** A plan may only touch content folders and the admin's own rule files. Enforced again here, under the commit. */
const ALLOWED_WRITE = /^(src\/content\/posts\/[a-z0-9-]+\/[A-Za-z0-9._/-]+|src\/data\/(redirects|gone)-admin\.yaml)$/;

function assertRepoPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\')) throw new Error('Invalid repository path.');
}

export function assertPlanPaths(plan: CommitPlan): void {
  for (const path of [...plan.writes.map((w) => w.path), ...plan.deletes]) {
    if (!ALLOWED_WRITE.test(path) || path.includes('..')) throw new Error(`A commit may not touch ${path}.`);
  }
  if (!plan.writes.length && !plan.deletes.length) throw new Error('Nothing to commit.');
}

function rateLimit(response: Response, nowMs: number): RepoRateLimitError | null {
  if (response.status !== 403 && response.status !== 429) return null;
  const retryAfter = Number(response.headers.get('retry-after'));
  if (retryAfter > 0) return new RepoRateLimitError(retryAfter);
  if (response.headers.get('x-ratelimit-remaining') === '0') {
    return new RepoRateLimitError(Math.max(60, Number(response.headers.get('x-ratelimit-reset')) - nowMs / 1000));
  }
  // A 429 with neither header: GitHub's guide says wait at least a minute. A plain 403 is a permission error.
  return response.status === 429 ? new RepoRateLimitError(60) : null;
}

export function createGithubRepo(options: { token: string; repo: string; fetchFn?: typeof fetch; now?: () => number }): ContentRepo {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) throw new Error('ADMIN_GITHUB_REPO must look like owner/name.');
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;

  async function call(method: string, path: string, what: string, body?: unknown, allowed: number[] = []): Promise<{ status: number; data: any }> {
    const response = await fetchFn(`${API}/repos/${options.repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const limited = rateLimit(response, now());
    if (limited) throw limited;
    if (!response.ok && !allowed.includes(response.status)) throw new RepoError(response.status, what);
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { status: response.status, data };
  }

  async function readFileAt(slug: string, ref: string): Promise<{ raw: string; sha: string } | null> {
    assertSlug(slug);
    const result = await call('GET', `/contents/${postPath(slug)}?ref=${encodeURIComponent(ref)}`, 'read the post', undefined, [404]);
    if (result.status === 404) return null;
    // Over 1 MB the contents API returns no text. The admin caps posts below that.
    if (result.data?.encoding !== 'base64') throw new RepoError(413, 'return a post this large');
    return { raw: Buffer.from(result.data.content, 'base64').toString('utf8'), sha: result.data.sha };
  }

  async function readPathAt(path: string, ref: string): Promise<{ raw: string; sha: string } | null> {
    assertRepoPath(path);
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const result = await call('GET', `/contents/${encoded}?ref=${encodeURIComponent(ref)}`, 'read a file', undefined, [404]);
    if (result.status === 404) return null;
    if (result.data?.encoding !== 'base64') throw new RepoError(413, 'return a file this large');
    return { raw: Buffer.from(result.data.content, 'base64').toString('utf8'), sha: result.data.sha };
  }

  const mainSha = async () => (await call('GET', `/git/ref/heads/${MAIN}`, 'read main')).data.object.sha as string;

  /**
   * Writes the file only if `sha` is still current. GitHub's guide says parallel writes conflict, so a 409 can mean
   * only that the branch moved. One retry, and only after a re-read shows the file itself has not changed.
   * The re-read sha never replaces the expected one: that would overwrite someone else's edit.
   */
  async function put(slug: string, branch: string, raw: string, sha: string | null, message: string): Promise<string> {
    const body = { message, content: Buffer.from(raw).toString('base64'), branch, ...(sha ? { sha } : {}) };
    for (let attempt = 0; ; attempt++) {
      const result = await call('PUT', `/contents/${postPath(slug)}`, 'write the post', body, [409, 422]);
      if (result.status !== 409 && result.status !== 422) return result.data.commit.sha;
      // A 422 about anything but the sha is a real refusal, not a conflict.
      if (result.status === 422 && !/sha/i.test(String(result.data?.message))) throw new RepoError(422, 'write the post');
      const current = await readFileAt(slug, branch);
      if (attempt > 0 || (current?.sha ?? null) !== sha) throw new RepoConflictError();
    }
  }

  return {
    mode: 'github',
    readPost: (slug) => readFileAt(slug, MAIN),
    async writePreview(slug, raw, submissionId) {
      assertSlug(slug);
      const branch = previewBranchName(slug, submissionId);
      const base = await mainSha();
      const created = await call('POST', '/git/refs', 'create the preview branch', { ref: `refs/heads/${branch}`, sha: base }, [409, 422]);
      if (created.status !== 201) {
        // Already there from an earlier submission: this namespace is ours, so restart it from main.
        await call('PATCH', `/git/refs/heads/${branch}`, 'update the preview branch', { sha: base, force: true });
      }
      const current = await readFileAt(slug, branch);
      await put(slug, branch, raw, current?.sha ?? null, `Preview ${slug}`);
      return branch;
    },
    readFile: (path) => readPathAt(path, MAIN),
    async listFolder(slug) {
      assertSlug(slug);
      const walk = async (dir: string): Promise<string[]> => {
        const result = await call('GET', `/contents/${dir}?ref=${MAIN}`, 'list the post folder', undefined, [404]);
        if (result.status === 404 || !Array.isArray(result.data)) return [];
        const nested = await Promise.all(result.data.map((item: { type: string; path: string }) => (item.type === 'dir' ? walk(item.path) : Promise.resolve([item.path]))));
        return nested.flat();
      };
      return walk(`src/content/posts/${slug}`);
    },
    /**
     * Git Data API: verify each expected blob at the head, build a tree on it, commit, then move main with
     * force:false, which is the compare-and-swap. A refused ref update means main moved: re-read the head, re-verify,
     * retry once, then conflict. Expected shas are never replaced by re-read ones.
     */
    async commit(plan) {
      assertPlanPaths(plan);
      for (let attempt = 0; ; attempt++) {
        const head = await mainSha();
        for (const expected of plan.expect) {
          const current = await readPathAt(expected.path, head);
          if ((current?.sha ?? null) !== expected.sha) throw new RepoConflictError();
        }
        const parent = await call('GET', `/git/commits/${head}`, 'read the head commit');
        const tree = await call('POST', '/git/trees', 'build the commit', {
          base_tree: parent.data.tree.sha,
          tree: [
            ...plan.writes.map((w) => ({ path: w.path, mode: '100644', type: 'blob', content: w.content })),
            ...plan.deletes.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
          ],
        });
        const commit = await call('POST', '/git/commits', 'create the commit', { message: plan.message, tree: tree.data.sha, parents: [head] });
        const moved = await call('PATCH', `/git/refs/heads/${MAIN}`, 'update main', { sha: commit.data.sha, force: false }, [409, 422]);
        if (moved.status === 200) return commit.data.sha as string;
        if (attempt > 0) throw new RepoConflictError('Main kept changing while this was being committed. Try again.');
      }
    },
    async deletePreview(branch) {
      if (!/^content\/[a-z0-9-]+$/.test(branch)) throw new Error('Not a preview branch.');
      await call('DELETE', `/git/refs/heads/${branch}`, 'delete the preview branch', undefined, [404, 422]);
    },
  };
}

export function createLocalRepo(root: string): ContentRepo {
  const file = (slug: string) => {
    assertSlug(slug);
    return join(root, 'src', 'content', 'posts', slug, 'index.mdx');
  };
  return {
    mode: 'local',
    async readPost(slug) {
      try {
        return { raw: await readFile(file(slug), 'utf8'), sha: null };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async writePreview(slug) {
      assertSlug(slug);
      return null;
    },
    async readFile(path) {
      assertRepoPath(path);
      try {
        return { raw: await readFile(join(root, path), 'utf8'), sha: null };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async listFolder(slug) {
      assertSlug(slug);
      const folder = join(root, 'src', 'content', 'posts', slug);
      const names = await readdir(folder, { recursive: true, withFileTypes: true }).catch(() => []);
      return names.filter((n) => n.isFile()).map((n) => relative(root, join(n.parentPath, n.name)).replaceAll('\\', '/'));
    },
    /** Dev only, so there are no shas to check. Writes first, so a failure part way never loses a post. */
    async commit(plan) {
      assertPlanPaths(plan);
      for (const { path, content } of plan.writes) {
        const target = join(root, path);
        await mkdir(dirname(target), { recursive: true });
        const temp = `${target}.${process.pid}.tmp`;
        await writeFile(temp, content);
        await rename(temp, target);
      }
      for (const path of plan.deletes) await rm(join(root, path), { force: true });
      for (const folder of new Set(plan.deletes.map((p) => dirname(join(root, p))))) {
        if ((await readdir(folder).catch(() => ['x'])).length === 0) await rm(folder, { recursive: true, force: true });
      }
      return 'local';
    },
    async deletePreview() {},
  };
}

export function getRepo(): ContentRepo {
  const token = env('GITHUB_TOKEN');
  const repo = env('ADMIN_GITHUB_REPO');
  if (token && repo && realBackendsAllowed()) return createGithubRepo({ token, repo });
  if (import.meta.env.DEV) return createLocalRepo(process.cwd());
  throw new Error('GITHUB_TOKEN and ADMIN_GITHUB_REPO are not set, so the admin cannot reach the content repository.');
}
