/** Test stand-ins shared by the admin suites. Each mirrors the real contract: expected shas, atomic plans, stale writes. */
import { vi } from 'vitest';
import type { CommitPlan, ContentRepo, PostFlag, Revision, ScheduleRun, Store, Submission } from '../../src/lib/admin/types.ts';

/** The Store methods added for the lifecycle, in memory. Spread into a suite's own store. */
export function storeExtras(all: () => Promise<Submission[]>, remove: (id: string) => void = () => {}) {
  const flags = new Map<string, PostFlag>();
  const revisions = new Map<string, Revision>();
  const runs: ScheduleRun[] = [];
  return {
    flags, revisions, runs,
    deleteSubmission: async (id: string) => remove(id),
    listDue: async (now: Date) => (await all()).filter((s) => s.state === 'scheduled' && s.scheduled && new Date(s.scheduled.at) <= now),
    getFlag: async (slug: string) => flags.get(slug) ?? null,
    listFlags: async () => [...flags.values()],
    putFlag: async (value: PostFlag) => void flags.set(value.id, value),
    deleteFlag: async (slug: string) => void flags.delete(slug),
    putRevision: async (value: Revision) => void revisions.set(value.id, value),
    listRevisions: async (id: string) => [...revisions.values()].filter((r) => r.submissionId === id).reverse(),
    deleteRevision: async (id: string) => void revisions.delete(id),
    putScheduleRun: async (value: ScheduleRun) => void runs.unshift(value),
    listScheduleRuns: async (limit: number) => runs.slice(0, limit),
  } satisfies Partial<Store> & Record<string, unknown>;
}

const POST = /^src\/content\/posts\/([a-z0-9-]+)\/index\.mdx$/;

/** `tree` is every file on main by repository path. Commits apply all or nothing, and refuse a wrong expected sha. */
export function fakeRepo(tree: Record<string, { raw: string; sha: string | null }> = {}) {
  let serial = 0;
  const commit = vi.fn(async (plan: CommitPlan) => {
    for (const expected of plan.expect) {
      if ((tree[expected.path]?.sha ?? null) !== expected.sha) {
        const { RepoConflictError } = await import('../../src/lib/admin/repo.ts');
        throw new RepoConflictError();
      }
    }
    for (const path of plan.deletes) delete tree[path];
    for (const write of plan.writes) tree[write.path] = { raw: write.content, sha: `blob-${++serial}` };
    return `commit-${serial}`;
  });
  const repo: ContentRepo & { commit: typeof commit } = {
    mode: 'github',
    readPost: async (slug) => {
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('bad slug');
      return tree[`src/content/posts/${slug}/index.mdx`] ?? null;
    },
    readFile: async (path) => tree[path] ?? null,
    listFolder: async (slug) => Object.keys(tree).filter((p) => p.startsWith(`src/content/posts/${slug}/`)),
    writePreview: vi.fn(async (slug: string) => `content/${slug}`),
    commit,
    deletePreview: vi.fn(async () => {}),
  };
  /** Same files addressed by slug, for tests that only care about posts. */
  const files = new Proxy({} as Record<string, { raw: string; sha: string | null }>, {
    get: (_t, slug: string) => tree[`src/content/posts/${slug}/index.mdx`],
    set: (_t, slug: string, value) => {
      tree[`src/content/posts/${slug}/index.mdx`] = value;
      return true;
    },
  });
  return { repo, tree, files };
}

export const postFileRe = POST;
