import { storeExtras } from './admin-fakes.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPreview } from '../../src/lib/admin/preview.ts';
import { robotsAllows } from '../../src/lib/admin/fetcher.ts';
import { ClaudeClient, type ApiMessage, type MessagesClient } from '../../src/lib/admin/claude.ts';
import type { Job, JobBrief, Store } from '../../src/lib/admin/types.ts';

const secrets = vi.hoisted(() => ({ values: {} as Record<string, string | undefined> }));
vi.mock('../../src/lib/admin/env.ts', () => ({ env: (name: string) => secrets.values[name] }));
const neon = vi.hoisted(() => vi.fn(() => ({ query: async () => [] })));
vi.mock('@neondatabase/serverless', () => ({ neon }));
vi.mock('astro:content', async () => (await import('./keystatic-harness.ts')).astroContentMock());

const { advanceJob, autoRunAllowed, createJob, MAX_RETRIES, retryBlocked, retryJob, suggestTopics, WeeklyLimitError, WeeklySpendError } = await import('../../src/lib/admin/engine.ts');
const { diffFields, flattenFields } = await import('../../src/lib/admin/review.ts');

const brief: JobBrief = { topicIdea: 'Dues', audience: 'owners', country: 'in', topic: 'billing-and-claims', owner: '/features/billing/' };

function memoryStore() {
  const jobs = new Map<string, Job>();
  const store: Store & { jobs: typeof jobs } = {
    jobs,
    getSubmission: async () => null,
    listSubmissions: async () => [],
    putSubmission: async () => {},
    getJob: async (id) => structuredClone(jobs.get(id) ?? null),
    listJobs: async () => [...jobs.values()],
    putJob: async (v) => void jobs.set(v.id, structuredClone(v)),
    ...storeExtras(async () => []),
    claimJob: async (v, expected) => {
      if (jobs.get(v.id)?.updatedAt !== expected) return false;
      jobs.set(v.id, structuredClone(v));
      return true;
    },
  };
  return store;
}

const search = (usd = 0): ApiMessage => ({ content: [{ type: 'web_search_tool_result', content: ['https://a.gov.in/r', 'https://b.who.int/r', 'https://c.nih.gov/r'].map((url) => ({ type: 'web_search_result', url, title: 'T', page_age: null })) }], stop_reason: 'end_turn', usage: { input_tokens: Math.round(usd / (4 / 1e6)), output_tokens: 0 } });
const clientOf = (answer: () => Promise<ApiMessage>) => {
  const calls: unknown[] = [];
  const client: MessagesClient = { beta: { messages: { stream(params: never, options) { calls.push(options); return { finalMessage: answer }; } } } };
  return { client, calls };
};
const failing = () => clientOf(async () => { throw new Error('boom'); });

beforeEach(() => {
  for (const key of ['ADMIN_WEEKLY_AI_LIMIT', 'ADMIN_JOB_MAX_USD', 'ADMIN_WEEKLY_MAX_USD']) delete process.env[key];
  secrets.values = {};
});
afterEach(() => vi.unstubAllEnvs());

describe('5. stored XSS in the preview', () => {
  it.each([
    'Hello <code> <img src=x onerror=alert(1) tail',
    'Hello <pre> <img src=x onerror=alert(1) tail',
    'Hello <kbd> <svg onload=alert(1) tail',
    'Hello <script> <img src=x onerror=alert(1) tail',
    '- item <code> <img src=x onerror=alert(1) tail',
    '> quote <code> <img src=x onerror=alert(1) tail',
    '| a |\n|---|\n| <code> <img src=x onerror=alert(1) |',
    '**bold <code> <img src=x onerror=alert(1) tail**',
    'Hello <code> &lt;img src=x onerror=alert(1) tail',
  ])('%s yields no live element', (body) => {
    const dom = renderPreview(body);
    expect(dom).not.toMatch(/<(?:img|svg|code|pre|kbd|script)\b[^>]*(?:onerror|onload|src=|>\s*<img)/i);
    expect(dom).not.toMatch(/<img\b/i);
  });
  it('ordinary text still reads normally', () => {
    expect(renderPreview('Tom & Jerry')).toContain('Tom &amp; Jerry');
    expect(renderPreview('Some **bold** text')).toContain('<strong>bold</strong>');
  });
});

describe('6. nothing published is hidden from the approver', () => {
  const fm = { title: 'T', headKeyword: 'k', secondaryKeywords: ['a'], topic: 'x', summary: 'S', linkLabel: 'L', newFieldNobodyKnows: 'surprise', ctas: { primary: { label: 'Go', href: 'https://evil.example/' }, secondary: { label: 'See', href: '/features/lab/' }, whatsapp: 'Hi' }, links: { hub: '/blog/', related: [{ href: '/x/', label: 'X', description: 'D' }] }, faq: [{ question: 'Q?', answer: 'See [this](https://other.example/).' }] };
  it('every leaf gets a row, including fields added later', () => {
    const paths = flattenFields(fm).map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'headKeyword', 'secondaryKeywords[0]', 'topic', 'summary', 'linkLabel', 'newFieldNobodyKnows', 'ctas.primary.label', 'ctas.primary.href', 'ctas.secondary.href', 'ctas.whatsapp', 'links.related[0].href', 'faq[0].answer']));
  });
  it('marks external links, in a value or inside Markdown, and not internal ones', () => {
    const rows = new Map(flattenFields(fm).map((r) => [r.path, r.external]));
    expect(rows.get('ctas.primary.href')).toBe(true);
    expect(rows.get('faq[0].answer')).toBe(true);
    expect(rows.get('ctas.secondary.href')).toBe(false);
  });
  it('the edit summary covers CTAs, FAQ and links', () => {
    const changed = diffFields({ ...fm, ctas: { primary: { label: 'Go', href: '/indiademo/' } }, faq: [], links: { hub: '/blog/' } }, fm).join('\n');
    expect(changed).toMatch(/Address changed: https:\/\/evil\.example/);
    expect(changed).toMatch(/FAQ 1, Answer added/);
    expect(changed).toMatch(/Links, Related 1, Address added/);
    expect(diffFields(fm, { ...fm, status: 'published' })).toEqual([]);
  });
});

describe('8. attempts, deadline and money', () => {
  const failedJob = async (store: ReturnType<typeof memoryStore>, c = failing()) => {
    const job = await createJob(brief, { email: 'a@x' }, { store, client: c.client, wait: async () => undefined, now: () => new Date() });
    return { job, deps: { store, client: c.client, wait: async () => undefined } };
  };

  it('allows three retries, then refuses', async () => {
    const store = memoryStore();
    const { job, deps } = await failedJob(store);
    expect((await advanceJob(job.id, deps)).stage).toBe('failed');
    for (let i = 0; i < MAX_RETRIES; i++) {
      await retryJob(job.id, deps);
      expect((await advanceJob(job.id, deps)).stage).toBe('failed');
    }
    await expect(retryJob(job.id, deps)).rejects.toThrow(/used its 3 retries/);
    expect(retryBlocked(store.jobs.get(job.id)!)).toMatch(/retries/);
  });

  it('a stalled model call stops at the shared deadline and the job is saved', async () => {
    const store = memoryStore();
    const never = clientOf(() => new Promise(() => {}));
    const job = await createJob(brief, { email: 'a@x' }, { store });
    const done = await advanceJob(job.id, { store, client: never.client, stageDeadlineMs: 30 });
    expect(done.stage).toBe('failed');
    expect(done.error).toMatch(/ran out of time/);
  });

  it('every request gets a timeout and an abort signal within the deadline', async () => {
    const c = clientOf(async () => search());
    await new ClaudeClient(c.client, { deadlineMs: 5000 }).searchWeb({ system: '', user: '', maxUses: 1, blockedDomains: [] });
    const options = c.calls[0] as { timeout: number; signal: AbortSignal };
    expect(options.timeout).toBeLessThanOrEqual(5000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('the real SDK client is built without retries', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/lib/admin/claude.ts', 'utf8')).toContain('maxRetries: 0');
  });

  it('saves usage after each response, before the stage ends', async () => {
    const store = memoryStore();
    let seenDuringSecond = -1;
    let n = 0;
    let jobId = '';
    const c = clientOf(async () => {
      if (++n === 1) return { content: [], stop_reason: 'pause_turn', usage: { input_tokens: 1000, output_tokens: 0 } };
      await new Promise((r) => setTimeout(r, 5));
      seenDuringSecond = store.jobs.get(jobId)!.usage.inputTokens;
      return search();
    });
    const job = await createJob(brief, { email: 'a@x' }, { store });
    jobId = job.id;
    await advanceJob(job.id, { store, client: c.client });
    expect(seenDuringSecond).toBe(1000);
  });

  it('stops a job at its dollar limit and will not retry it', async () => {
    process.env.ADMIN_JOB_MAX_USD = '1';
    const store = memoryStore();
    const c = clientOf(async () => { throw new Error('should not be called'); });
    const job = await createJob(brief, { email: 'a@x' }, { store });
    store.jobs.set(job.id, { ...store.jobs.get(job.id)!, usage: { inputTokens: 0, outputTokens: 0, costUsd: 1.5 } });
    const stopped = await advanceJob(job.id, { store, client: c.client });
    expect(stopped.stage).toBe('failed');
    expect(stopped.error).toMatch(/spending limit of \$1/);
    expect(c.calls).toHaveLength(0);
    await expect(retryJob(job.id, { store })).rejects.toThrow(/spending limit/);
  });

  it('a paused turn stops at the limit mid-stage', async () => {
    const client = clientOf(async () => ({ content: [], stop_reason: 'pause_turn', usage: { input_tokens: 1e6, output_tokens: 0 } }));
    await expect(new ClaudeClient(client.client, { maxUsd: 3 }).searchWeb({ system: '', user: '', maxUses: 1, blockedDomains: [] })).rejects.toThrow(/spending limit/);
    expect(client.calls).toHaveLength(1);
  });

  it('the weekly dollar limit stops new jobs and running ones', async () => {
    process.env.ADMIN_WEEKLY_MAX_USD = '2';
    const store = memoryStore();
    const c = clientOf(async () => search());
    const job = await createJob(brief, { email: 'a@x' }, { store });
    store.jobs.set(job.id, { ...store.jobs.get(job.id)!, usage: { inputTokens: 0, outputTokens: 0, costUsd: 2 } });
    await expect(createJob(brief, { email: 'a@x' }, { store })).rejects.toBeInstanceOf(WeeklySpendError);
    await expect(suggestTopics({ audience: 'a', country: '' }, [], { store, client: c.client })).rejects.toBeInstanceOf(WeeklySpendError);
    expect((await advanceJob(job.id, { store, client: c.client })).error).toMatch(/spending limit/);
    expect(c.calls).toHaveLength(0);
  });

  it('topic ideas count as a weekly run and record their cost, without becoming a job anyone runs', async () => {
    process.env.ADMIN_WEEKLY_AI_LIMIT = '1';
    const store = memoryStore();
    const ideas: ApiMessage = { content: [{ type: 'text', text: JSON.stringify({ ideas: [] }) }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 100 } };
    let n = 0;
    const c = clientOf(async () => (n++ === 0 ? search() : ideas));
    await suggestTopics({ audience: 'a', country: '' }, [], { store, client: c.client }, 'ed@x');
    const [row] = store.jobs.values();
    expect(row.kind).toBe('topics');
    expect(row.usage.costUsd).toBeGreaterThan(0);
    expect(row.createdBy).toBe('ed@x');
    await expect(suggestTopics({ audience: 'a', country: '' }, [], { store, client: c.client })).rejects.toBeInstanceOf(WeeklyLimitError);
    await expect(createJob(brief, { email: 'a@x' }, { store })).rejects.toBeInstanceOf(WeeklyLimitError);
    expect((await advanceJob(row.id, { store, client: c.client })).stage).toBe('done');
    expect(c.calls).toHaveLength(2);
  });

  it('the page does not auto-run after a cap or an expired lease, and a second expiry fails the job', async () => {
    const store = memoryStore();
    const job = await createJob(brief, { email: 'a@x' }, { store });
    const now = new Date();
    expect(autoRunAllowed(job, now)).toBe(true);
    expect(autoRunAllowed({ ...job, retries: MAX_RETRIES }, now)).toBe(false);
    expect(autoRunAllowed({ ...job, usage: { ...job.usage, costUsd: 5 } }, now)).toBe(false);
    expect(autoRunAllowed({ ...job, leaseExpiries: 1 }, now)).toBe(false);
    const dead = { ...job, leaseId: 'x', leaseUntil: new Date(now.getTime() - 1000).toISOString() };
    expect(autoRunAllowed(dead, now)).toBe(false);

    const c = clientOf(async () => { throw new Error('should not be called'); });
    store.jobs.set(job.id, { ...dead, leaseExpiries: 1 });
    const stopped = await advanceJob(job.id, { store, client: c.client });
    expect(stopped.stage).toBe('failed');
    expect(stopped.error).toMatch(/twice/);
    expect(c.calls).toHaveLength(0);
  });
});

describe('12. astro dev cannot reach production by accident', () => {
  const REAL = { GITHUB_TOKEN: 'real', ADMIN_GITHUB_REPO: 'o/r', DATABASE_URL: 'postgres://real' };
  const fresh = async () => {
    vi.resetModules();
    neon.mockClear();
    const [repo, store, auth, guard] = await Promise.all([import('../../src/lib/admin/repo.ts'), import('../../src/lib/admin/store.ts'), import('../../src/lib/admin/auth.ts'), import('../../src/lib/admin/dev-guard.ts')]);
    return { repo, store, auth, guard, neon };
  };
  const session = (auth: Awaited<ReturnType<typeof fresh>>['auth'], secret: string) => {
    const value = auth.signValue('session', { email: 'x@y.z', name: 'X', devRole: 'approver', exp: Date.now() / 1000 + 100 }, secret);
    return { url: new URL('http://localhost/admin/'), request: new Request('http://localhost/admin/'), cookies: { get: () => ({ value }), set() {}, delete() {} } } as never;
  };

  it('dev with real settings keeps to local files, and sign-in stays', async () => {
    secrets.values = { ...REAL };
    const { repo, store, guard, neon } = await fresh();
    expect(repo.getRepo().mode).toBe('local');
    store.getStore();
    expect(neon).not.toHaveBeenCalled();
    expect(guard.devSignInEnabled()).toBe(true);
  });

  it('ADMIN_DEV_ALLOW_REAL=1 reaches them, and the development sign-in is off', async () => {
    secrets.values = { ...REAL, ADMIN_DEV_ALLOW_REAL: '1' };
    const { repo, store, auth, guard, neon } = await fresh();
    expect(repo.getRepo().mode).toBe('github');
    store.getStore();
    expect(neon).toHaveBeenCalled();
    expect(guard.devSignInEnabled()).toBe(false);
    expect(auth.authSetupProblem()).toMatch(/not set up/);
    expect(await auth.currentUser(session(auth, 'development-only-admin-session-secret'))).toBeNull();
  });

  it('with real sign-in configured, a signed dev role still grants nothing', async () => {
    const secret = 'x'.repeat(40);
    secrets.values = { ...REAL, ADMIN_DEV_ALLOW_REAL: '1', ADMIN_SESSION_SECRET: secret, GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', ADMIN_APPROVERS: 'boss@x.com' };
    const { auth } = await fresh();
    expect(await auth.currentUser(session(auth, secret))).toBeNull();
  });

  it('production is unaffected', async () => {
    vi.stubEnv('DEV', false as never);
    secrets.values = { ...REAL };
    const { repo, guard } = await fresh();
    expect(repo.getRepo().mode).toBe('github');
    expect(guard.devSignInEnabled()).toBe(false);
  });
});

describe('13. robots matching has no backtracking', () => {
  const rule = (path: string, allow = false) => ({ allow, path });
  it('a hostile pattern finishes quickly', () => {
    const started = performance.now();
    expect(robotsAllows([rule(`/${'*a'.repeat(40)}b`)], `/${'a'.repeat(100_000)}`)).toBe(true);
    expect(performance.now() - started).toBeLessThan(200);
  });
  it.each([
    ['/private', '/private/x', false],
    ['/private$', '/private', false],
    ['/private$', '/private/x', true],
    ['/*.pdf$', '/a/b.pdf', false],
    ['/*.pdf$', '/a/b.pdf?x', true],
    ['/a*b*c', '/a-b-c-d', false],
    ['/a*b*c', '/a-c-b', true],
    ['/*$', '/anything', false],
    ['/a*a$', '/a', true],
    ['*', '/x', false],
  ])('%s against %s: allowed %s', (pattern, path, allowed) => {
    expect(robotsAllows([rule(pattern)], path)).toBe(allowed);
  });
});
