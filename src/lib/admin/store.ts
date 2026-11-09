import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { realBackendsAllowed } from './dev-guard.ts';
import { env } from './env.ts';
import { ACTIVE_STATES } from './lifecycle.ts';
import type { Job, PostFlag, Revision, ScheduleRun, Store, Submission } from './types.ts';

export class StaleWriteError extends Error {
  constructor() {
    super('Someone else changed this first.');
    this.name = 'StaleWriteError';
  }
}

/** Two submissions cannot both be open for one slug: they would overwrite each other on publish. */
export class ActiveSlugError extends Error {
  constructor() {
    super('Someone is already working on a post with that slug.');
    this.name = 'ActiveSlugError';
  }
}

const activeSlug = (value: unknown): string | undefined => {
  const { slug, state } = value as { slug?: string; state?: string };
  return slug && state && (ACTIVE_STATES as readonly string[]).includes(state) ? slug : undefined;
};
const dueFrom = (subs: Submission[], now: Date) =>
  subs.filter((s) => s.state === 'scheduled' && s.scheduled && new Date(s.scheduled.at) <= now).sort((a, b) => a.scheduled!.at.localeCompare(b.scheduled!.at));
const UNIQUE_VIOLATION = '23505';

const SAFE_ID = /^[A-Za-z0-9-]{1,100}$/;
function assertId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error('Invalid id');
}

/** `json` is text because jsonb reorders keys, which would reorder the fields of the published file. */
const pack = (value: { updatedAt: string }) => {
  const slug = activeSlug(value);
  return JSON.stringify({ updatedAt: value.updatedAt, json: JSON.stringify(value), ...(slug ? { activeSlug: slug } : {}) });
};
const unpack = <T>(data: unknown): T => {
  const row = (typeof data === 'string' ? JSON.parse(data) : data) as { json: string };
  return JSON.parse(row.json) as T;
};

export type SqlQuery = (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

export function createPostgresStore(query: SqlQuery): Store {
  let ready: Promise<unknown> | null = null;
  const ensure = () => {
    ready ??= query(
      'CREATE TABLE IF NOT EXISTS admin_docs (kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, id))',
    ).then(() =>
      query("CREATE UNIQUE INDEX IF NOT EXISTS admin_docs_active_slug ON admin_docs ((data->>'activeSlug')) WHERE kind = 'submission' AND data ? 'activeSlug'"),
    ).catch((error) => {
      ready = null; // A failed start is retried by the next request.
      throw error;
    });
    return ready;
  };
  const get = async <T>(kind: string, id: string) => {
    assertId(id);
    await ensure();
    const rows = await query('SELECT data FROM admin_docs WHERE kind = $1 AND id = $2', [kind, id]);
    return rows[0] ? unpack<T>(rows[0].data) : null;
  };
  const all = async <T>(kind: string) => {
    await ensure();
    const rows = await query('SELECT data FROM admin_docs WHERE kind = $1 ORDER BY updated_at DESC', [kind]);
    return rows.map((row) => unpack<T>(row.data));
  };
  const refuseDuplicate = async <T>(write: () => Promise<T>): Promise<T> => {
    try {
      return await write();
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ActiveSlugError();
      throw error;
    }
  };
  const upsert = async (kind: string, value: { id: string; updatedAt: string }) => {
    assertId(value.id);
    await ensure();
    await query(
      'INSERT INTO admin_docs (kind, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now()) ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [kind, value.id, pack(value)],
    );
  };
  const remove = async (kind: string, id: string) => {
    assertId(id);
    await ensure();
    await query('DELETE FROM admin_docs WHERE kind = $1 AND id = $2', [kind, id]);
  };
  return {
    getSubmission: (id) => get<Submission>('submission', id),
    listSubmissions: () => all<Submission>('submission'),
    async putSubmission(value, expectedUpdatedAt) {
      if (expectedUpdatedAt === undefined) return refuseDuplicate(() => upsert('submission', value));
      assertId(value.id);
      await ensure();
      // One statement: the check and the write cannot be separated by another writer.
      const rows = await refuseDuplicate(() => query(
        "UPDATE admin_docs SET data = $1::jsonb, updated_at = now() WHERE kind = 'submission' AND id = $2 AND data->>'updatedAt' = $3 RETURNING id",
        [pack(value), value.id, expectedUpdatedAt],
      ));
      if (!rows.length) throw new StaleWriteError();
    },
    getJob: (id) => get<Job>('job', id),
    listJobs: () => all<Job>('job'),
    putJob: (value) => upsert('job', value),
    async claimJob(value, expectedUpdatedAt) {
      assertId(value.id);
      await ensure();
      const rows = await query(
        "UPDATE admin_docs SET data = $1::jsonb, updated_at = now() WHERE kind = 'job' AND id = $2 AND data->>'updatedAt' = $3 RETURNING id",
        [pack(value), value.id, expectedUpdatedAt],
      );
      return rows.length > 0;
    },
    deleteSubmission: (id) => remove('submission', id),
    listDue: async (now) => dueFrom(await all<Submission>('submission'), now),
    getFlag: (slug) => get<PostFlag>('flag', slug),
    listFlags: () => all<PostFlag>('flag'),
    putFlag: (value) => upsert('flag', value),
    deleteFlag: (slug) => remove('flag', slug),
    putRevision: (value) => upsert('revision', value),
    async listRevisions(submissionId) {
      assertId(submissionId);
      await ensure();
      const rows = await query("SELECT data FROM admin_docs WHERE kind = 'revision' AND id LIKE $1 ORDER BY updated_at DESC", [`${submissionId}-%`]);
      return rows.map((row) => unpack<Revision>(row.data)).filter((r) => r.submissionId === submissionId);
    },
    deleteRevision: (id) => remove('revision', id),
    putScheduleRun: (value) => upsert('run', value),
    async listScheduleRuns(limit) {
      await ensure();
      const rows = await query("SELECT data FROM admin_docs WHERE kind = 'run' ORDER BY updated_at DESC LIMIT $1", [limit]);
      return rows.map((row) => unpack<ScheduleRun>(row.data));
    },
  };
}

/** Dev only. One process, so a queue makes the expectedUpdatedAt check atomic. */
export function createFileStore(root: string): Store {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const file = (kind: string, id: string) => {
    assertId(id);
    return join(root, kind, `${id}.json`);
  };
  const get = async <T>(kind: string, id: string): Promise<T | null> => {
    try {
      return JSON.parse(await readFile(file(kind, id), 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  };
  const write = async (kind: string, value: { id: string }) => {
    const target = file(kind, value.id);
    await mkdir(join(root, kind), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2));
    await rename(temp, target);
  };
  const remove = async (kind: string, id: string) => {
    await rm(file(kind, id), { force: true });
  };
  const all = async <T extends { updatedAt: string }>(kind: string): Promise<T[]> => {
    const names = await readdir(join(root, kind)).catch(() => [] as string[]);
    const items = await Promise.all(names.filter((n) => n.endsWith('.json')).map((n) => get<T>(kind, n.slice(0, -5))));
    return (items.filter(Boolean) as T[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  return {
    getSubmission: (id) => get<Submission>('submission', id),
    listSubmissions: () => all<Submission>('submission'),
    putSubmission: (value, expected) =>
      serial(async () => {
        if (expected !== undefined) {
          const current = await get<Submission>('submission', value.id);
          if (current?.updatedAt !== expected) throw new StaleWriteError();
        }
        const slug = activeSlug(value);
        if (slug && (await all<Submission>('submission')).some((s) => s.id !== value.id && activeSlug(s) === slug)) throw new ActiveSlugError();
        await write('submission', value);
      }),
    getJob: (id) => get<Job>('job', id),
    listJobs: () => all<Job>('job'),
    putJob: (value) => serial(() => write('job', value)),
    claimJob: (value, expectedUpdatedAt) =>
      serial(async () => {
        const current = await get<Job>('job', value.id);
        if (current?.updatedAt !== expectedUpdatedAt) return false;
        await write('job', value);
        return true;
      }),
    deleteSubmission: (id) => serial(() => remove('submission', id)),
    listDue: async (now) => dueFrom(await all<Submission>('submission'), now),
    getFlag: (slug) => get<PostFlag>('flag', slug),
    listFlags: () => all<PostFlag>('flag'),
    putFlag: (value) => serial(() => write('flag', value)),
    deleteFlag: (slug) => serial(() => remove('flag', slug)),
    putRevision: (value) => serial(() => write('revision', value)),
    listRevisions: async (submissionId) => (await all<Revision>('revision')).filter((r) => r.submissionId === submissionId),
    deleteRevision: (id) => serial(() => remove('revision', id)),
    putScheduleRun: (value) => serial(() => write('run', value)),
    listScheduleRuns: async (limit) => (await all<ScheduleRun>('run')).slice(0, limit),
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = env('DATABASE_URL');
  if (url && realBackendsAllowed()) {
    const sql = neon(url);
    cached = createPostgresStore((text, params) => sql.query(text, params as any[]) as unknown as Promise<Array<Record<string, unknown>>>);
  } else if (import.meta.env.DEV) {
    cached = createFileStore(join(process.cwd(), '.admin-data'));
  } else {
    throw new Error('DATABASE_URL is not set, so the admin has nowhere to keep its work.');
  }
  return cached;
}
