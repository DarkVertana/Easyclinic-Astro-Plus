/**
 * The real harness, workflow, store rules and registry logic together. Only the database, GitHub and the content
 * collections are stand-ins. If approve() produces something the real registry would refuse, this fails, which is the
 * failure that would stop every site deploy.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, Claim, ContentRepo, Job, PostContent, Source, Store, Submission } from '../../src/lib/admin/types.ts';
import { fakeRepo, storeExtras } from './admin-fakes.ts';

const collections = vi.hoisted(() => ({ data: {} as Record<string, unknown[]> }));
vi.mock('../../src/lib/admin/env.ts', () => ({ env: () => undefined }));
vi.mock('astro:content', async () => ({
  ...(await (await import('./keystatic-harness.ts')).astroContentMock()),
  getCollection: async (name: string) => collections.data[name] ?? [],
}));

const wf = await import('../../src/lib/admin/workflow.ts');
const { authorProblem, checkForBuild } = await import('../../src/lib/admin/harness.ts');
const { createDraftSubmission, toContent } = await import('../../src/lib/admin/engine.ts');
const { parsePost } = await import('../../src/lib/admin/mdx-file.ts');
const { ActiveSlugError, StaleWriteError, createFileStore, createPostgresStore } = await import('../../src/lib/admin/store.ts');
const { postSchema } = await import('../../src/schemas/families.ts');

const editor: AdminUser = { email: 'ed@x.com', name: 'Ed', role: 'editor' };
const boss: AdminUser = { email: 'boss@x.com', name: 'Boss', role: 'approver' };
const ANSWERS = { onlyUsCouldWrite: 'Our own clinic numbers.', readsMachineWritten: 'No.' };
const TOKENS = { prices: {}, facts: { doctors: { label: 'Doctors', value: '5,000+', asOf: new Date('2026-01-01') }, pending: { label: 'Pending', value: '12', asOf: null }, blank: { label: 'Blank', value: null, asOf: null } }, figures: {}, publications: {}, contacts: {} };

const BODY = `A bill stays open when nobody asks at the desk before the patient leaves.

## Why it happens

Some text that links to the [billing page](/features/billing/) and says what to do at the desk each evening.

<InlineCta heading="Keep the balance on the bill." href="/features/billing/" label="See part payments">Easy Clinic shows the balance when the bill opens.</InlineCta>

## What to do

Check the drawer each evening.
`;
const AUTHOR = Object.keys(import.meta.glob('/src/data/authors/*.yaml')).map((p) => /([^/]+)\.yaml$/.exec(p)![1]).find((id) => !authorProblem(id)) ?? '';

const frontmatter = (over: Record<string, unknown> = {}) => ({
  status: 'draft', headKeyword: 'open clinic bills', title: 'Open clinic bills and how to close them',
  metaDescription: 'Why a clinic bill stays open past the visit and what the desk can do about it each evening before closing.',
  h1: 'Open clinic bills', linkLabel: 'Open clinic bills', openingAnswer: 'A bill stays open when nobody asks at the desk. Ask before the patient leaves and record it.',
  summary: 'What to do at the desk.', author: AUTHOR, lastUpdated: '2026-11-06', topic: 'billing-and-claims', owner: '/features/billing/',
  ctas: { primary: { label: 'Book a demo', href: '/indiademo/' } }, links: { hub: '/blog/' }, ...over,
});

function memoryStore() {
  const subs = new Map<string, string>();
  const jobs = new Map<string, Job>();
  const store: Store & { puts: Submission[] } = {
    puts: [],
    getSubmission: async (id) => (subs.has(id) ? JSON.parse(subs.get(id)!) : null),
    listSubmissions: async () => [...subs.values()].map((d) => JSON.parse(d)),
    async putSubmission(value, expected) {
      if (expected !== undefined && (subs.has(value.id) ? JSON.parse(subs.get(value.id)!).updatedAt : undefined) !== expected) throw new StaleWriteError();
      store.puts.push(value);
      subs.set(value.id, JSON.stringify(value));
    },
    getJob: async (id) => jobs.get(id) ?? null,
    listJobs: async () => [...jobs.values()],
    putJob: async (job) => void jobs.set(job.id, job),
    ...storeExtras(async () => [...subs.values()].map((d) => JSON.parse(d)), (id) => subs.delete(id)),
  };
  return store;
}

let store: ReturnType<typeof memoryStore>;
let repo: ContentRepo;
let files: Record<string, { raw: string; sha: string | null }>;
let deps: import('../../src/lib/admin/workflow.ts').Deps;
let rules: import('../../src/lib/admin/workflow.ts').RouteRules;

beforeEach(() => {
  store = memoryStore();
  ({ repo, files } = fakeRepo());
  repo.writePreview = async (slug, _raw, id) => `content/${slug}-${id.slice(0, 8)}`;
  rules = { pages: [], redirects: [], gone: [], headKeywords: [], tokenData: TOKENS as never };
  deps = { store, repo, check: (c, r) => checkForBuild(c, r.tokenData!), routes: async () => rules, now: () => new Date('2026-11-06T10:00:00Z'), existingPosts: async () => [] };
});

async function draft(over: Record<string, unknown> = {}, body = BODY, slug = 'open-clinic-bills', jobId: string | null = null): Promise<Submission> {
  const made = await wf.createSubmission({ slug, title: 'T', topic: 'billing-and-claims', owner: '/features/billing/' }, editor, deps);
  return wf.saveEdit(made.id, { frontmatter: frontmatter(over), body }, editor, made.updatedAt, deps).then(async (saved) => {
    if (!jobId) return saved;
    const linked = { ...saved, jobId };
    await store.putSubmission(linked, saved.updatedAt);
    return linked;
  });
}
const approveIt = (sub: Submission) => wf.approve(sub.id, boss, { viewedHash: sub.contentHash, ...ANSWERS }, deps);
const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as { status: number; message: string; details?: { checks?: Array<{ rule: string; path: string; message: string }> }; checks?: unknown };
  }
  throw new Error('Expected a refusal');
};
const rulesOf = (error: any): string[] => (error.details?.checks ?? error.extra?.checks ?? error.checks ?? []).map((c: { rule: string }) => c.rule);

/** The real registry, built over what approve() wrote, parsed by the real schema as the build parses it. */
async function buildRegistry(raw: string, slug: string, others: Array<{ id: string; data: Record<string, unknown> }> = []) {
  const { frontmatter: fm, body } = parsePost(raw);
  const schema = (postSchema as unknown as (ctx: never) => z.ZodType)({ image: () => z.string() } as never);
  const data = schema.parse(fm) as Record<string, unknown>;
  collections.data = {
    posts: [{ id: slug, data, body }, ...others.map((o) => ({ id: o.id, data: o.data, body: '' }))],
    facts: [{ data: { facts: TOKENS.facts } }],
  };
  vi.resetModules();
  const { getRegistry } = await import('../../src/lib/content/registry.ts');
  return getRegistry();
}

describe('from draft to the real registry', () => {
  it('what approve() produces passes the real registry', async () => {
    const pending = await wf.submitForApproval((await draft()).id, editor, deps);
    const done = await approveIt(pending);
    expect(done.state).toBe('published');
    const registry = await buildRegistry(files['open-clinic-bills'].raw, 'open-clinic-bills');
    expect(registry.pages.find((p) => p.id === 'open-clinic-bills')?.status).toBe('published');
  });

  it('the registry really does fail on the duplicate keyword that approve now refuses', async () => {
    const pending = await wf.submitForApproval((await draft()).id, editor, deps);
    await approveIt(pending);
    const { frontmatter: fm } = parsePost(files['open-clinic-bills'].raw);
    const schema = (postSchema as unknown as (ctx: never) => z.ZodType)({ image: () => z.string() } as never);
    const twin = schema.parse({ ...fm, headKeyword: 'OPEN CLINIC BILLS' }) as Record<string, unknown>;
    await expect(buildRegistry(files['open-clinic-bills'].raw, 'open-clinic-bills', [{ id: 'twin', data: twin }])).rejects.toThrow(/cannibalisation/);
  });
});

describe('1. duplicate head keyword', () => {
  it('refused at submit and approve, ignoring case', async () => {
    const sub = await draft();
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    rules.headKeywords = [{ keyword: 'Open Clinic BILLS', path: '/other-page/' }];
    const atApprove = await refusal(approveIt(pending));
    expect(rulesOf(atApprove)).toContain('cannibalisation');
    const fresh = await draft({ headKeyword: 'OPEN clinic bills' }, BODY, 'second-post');
    expect(rulesOf(await refusal(wf.submitForApproval(fresh.id, editor, deps)))).toContain('cannibalisation');
  });
  it('an edit of the same post does not match itself', () => {
    rules.headKeywords = [{ keyword: 'open clinic bills', path: '/open-clinic-bills/', postSlug: 'open-clinic-bills' }];
    expect(wf.keywordConflict({ frontmatter: frontmatter(), body: '' }, 'open-clinic-bills', rules, [])).toBeNull();
    expect(wf.keywordConflict({ frontmatter: frontmatter(), body: '' }, 'another', rules, [])).toMatch(/already belongs/);
  });
  it('sees a post approved since this deployment was built', async () => {
    const first = await wf.submitForApproval((await draft()).id, editor, deps);
    await approveIt(first);
    const second = await draft({}, BODY, 'second-post');
    expect(rulesOf(await refusal(wf.submitForApproval(second.id, editor, deps)))).toContain('cannibalisation');
  });
});

describe('2. tokens in frontmatter', () => {
  it.each([
    ['unknown token', '{fact:nope} clinics', 'token'],
    ['fact with no asOf', '{fact:pending} clinics', 'unknown-fact'],
    ['fact with no value', '{fact:blank} clinics', 'unknown-fact'],
  ])('%s is refused', async (_name, summary, rule) => {
    const sub = await draft({ summary });
    expect(rulesOf(await refusal(wf.submitForApproval(sub.id, editor, deps)))).toContain(rule);
  });
  it('re-checks length after tokens resolve', async () => {
    const long = { ...TOKENS, facts: { ...TOKENS.facts, wide: { label: 'W', value: 'x'.repeat(40), asOf: new Date() } } };
    rules.tokenData = long as never;
    // 57 rendered characters by the 7-character estimate, 90 once resolved.
    const sub = await draft({ title: `{fact:wide} ${'y'.repeat(49)}` });
    const error = await refusal(wf.submitForApproval(sub.id, editor, deps));
    expect(rulesOf(error)).toContain('length');
  });
  it('a known confirmed token passes', async () => {
    const sub = await draft({ summary: 'Used by {fact:doctors} doctors.' });
    expect((await wf.submitForApproval(sub.id, editor, deps)).state).toBe('pending');
  });
  it('a token in the body is refused', async () => {
    const sub = await draft({}, `${BODY}\nWe have {fact:doctors} doctors.\n`);
    expect(rulesOf(await refusal(wf.submitForApproval(sub.id, editor, deps)))).toContain('mdx-expression');
  });
});

describe('3. MDX the real compiler refuses', () => {
  const cta = '<InlineCta heading="H." href="/features/billing/" label="L">';
  it.each([
    ['unclosed', BODY.replace('</InlineCta>', '')],
    ['misordered', BODY.replace(/<InlineCta.*<\/InlineCta>/, `</InlineCta>${cta}`)],
  ])('%s InlineCta is refused at submit', async (_name, body) => {
    const error = await refusal(wf.submitForApproval((await draft({}, body)).id, editor, deps));
    expect(rulesOf(error)).toContain('mdx-compile');
  });
  it('a nested InlineCta is refused', async () => {
    const body = BODY.replace(/<InlineCta.*<\/InlineCta>/, `${cta}${cta}x</InlineCta></InlineCta>`);
    expect(rulesOf(await refusal(wf.submitForApproval((await draft({}, body)).id, editor, deps)))).toContain('mdx-jsx');
  });
  it.each([
    ['definition in a blockquote', '> [r]: javascript:alert(1)'],
    ['definition with an escaped bracket', '[a\\]b]: javascript:alert(1)'],
    ['definition in a list', '- [q]: javascript:alert(1)'],
    ['entity in a scheme', '[x](java&#115;cript:alert(1))'],
  ])('%s is refused', async (_name, line) => {
    const error = await refusal(wf.submitForApproval((await draft({}, `${BODY}\n${line}\n`)).id, editor, deps));
    expect(rulesOf(error)).toContain('mdx-link');
  });
});

describe('7. the ledger still holds after a person edits', () => {
  const source: Source = { id: 's1', url: 'https://a.gov.in/r', title: 'T', host: 'a.gov.in', tier: 'official', fetchedAt: '2026-11-01', text: 'Report text with 41% of clinics.' };
  const claim: Claim = { id: 'c1', sourceId: 's1', statement: 'About 41% of clinics do this', quote: 'with 41% of clinics' };
  const job = (id: string): Job => ({ id, brief: { topicIdea: 'x', audience: '', country: '', topic: 'billing-and-claims', owner: '/features/billing/' }, stage: 'done', sources: [source], claims: [claim], rejectedClaims: [], outline: null, draft: null, checks: [], reviewFindings: [], revisions: 0, submissionId: null, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, log: [], createdAt: 'x', updatedAt: 'x', createdBy: 'x' });
  const withLine = (line: string) => BODY.replace('Check the drawer each evening.', line);

  it.each([
    ['unsourced number', 'About 73% of clinics agree here.', 'unsourced-number'],
    ['unsourced link', 'Read [this page](https://not-a-source.example/x) first.', 'unsourced-link'],
    ['compliance claim', 'Easy Clinic is fully compliant with the rules.', 'compliance-claim'],
  ])('%s blocks submit', async (_name, line, rule) => {
    await store.putJob(job('j1'));
    const sub = await draft({}, withLine(line), 'ai-post', 'j1');
    expect(rulesOf(await refusal(wf.submitForApproval(sub.id, editor, deps)))).toContain(rule);
  });
  it('also blocks at approve, if the job gained nothing but the text is already pending', async () => {
    await store.putJob(job('j1'));
    const sub = await draft({}, withLine('About 41% of clinics agree here.'), 'ai-post', 'j1');
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    await store.putJob({ ...job('j1'), claims: [] });
    expect(rulesOf(await refusal(approveIt(pending)))).toContain('unsourced-number');
  });
  it('copied text from an existing post blocks', async () => {
    await store.putJob(job('j1'));
    deps.existingPosts = async () => [{ slug: 'other', body: BODY }];
    const sub = await draft({}, BODY, 'ai-post', 'j1');
    expect(rulesOf(await refusal(wf.submitForApproval(sub.id, editor, deps)))).toContain('copied-post');
  });
  it('a sourced number and link pass, and a missing job fails closed', async () => {
    await store.putJob(job('j1'));
    const ok = await draft({}, withLine(`About 41% of clinics, says [the ministry](${source.url}).`), 'ai-post', 'j1');
    expect((await wf.submitForApproval(ok.id, editor, deps)).state).toBe('pending');
    const orphan = await draft({}, BODY, 'orphan-post', 'gone-job');
    expect(rulesOf(await refusal(wf.submitForApproval(orphan.id, editor, deps)))).toContain('ledger');
  });
  it('a confirmed fact a person adds is allowed', async () => {
    await store.putJob(job('j1'));
    const sub = await draft({}, withLine('It started in 2003 and has grown.'), 'ai-post', 'j1');
    expect((await wf.submitForApproval(sub.id, editor, deps)).state).toBe('pending');
  });
});

describe('6. buttons the model cannot aim', () => {
  const output = { headKeyword: 'k', secondaryKeywords: [], title: 't', metaDescription: 'm', h1: 'h', linkLabel: 'l', openingAnswer: 'o', summary: 's', ctaPrimaryLabel: 'Go', ctaPrimaryHref: 'https://evil.example/', ctaSecondaryLabel: 'See', whatsapp: 'Hi', faq: [], related: [{ href: 'https://evil.example/', label: 'x', description: 'y' }, { href: '/features/lab/', label: 'Lab', description: 'y' }], body: 'b' };
  const brief = (country: string) => ({ topicIdea: 'x', audience: '', country, topic: 't', owner: '/features/billing/' });
  it('ignores a model-chosen target, and drops external related links', () => {
    const { ctas, ...fm } = toContent(output, brief('in'), new Date()).frontmatter as any;
    expect(ctas.primary.href).toBe('/indiademo/');
    expect(ctas.secondary.href).toBe('/features/billing/');
    expect(fm.links.related.map((r: { href: string }) => r.href)).toEqual(['/features/lab/']);
    expect((toContent(output, brief(''), new Date()).frontmatter as any).ctas.primary.href).toBe('/contact-us/#book-a-demo');
  });
});

describe('11. one write for an AI draft', () => {
  it('the row has its job and content from the first and only write', async () => {
    const content: PostContent = { frontmatter: frontmatter(), body: BODY };
    const sub = await createDraftSubmission({ slug: 'from-ai', content, jobId: 'j9', createdBy: 'ed@x.com' }, deps);
    expect(store.puts).toHaveLength(1);
    expect(store.puts[0]).toMatchObject({ jobId: 'j9', createdBy: 'ed@x.com', state: 'draft' });
    expect(store.puts[0].content.body).toBe(BODY);
    expect(sub.content.frontmatter.headKeyword).toBe('open clinic bills');
  });
});

describe('14. one open submission per slug', () => {
  it('two tabs creating at once: the file store lets exactly one through', async () => {
    const root = mkdtempSync(join(tmpdir(), 'admin-'));
    try {
      const fileDeps = { ...deps, store: createFileStore(root) };
      const results = await Promise.allSettled([1, 2].map(() => wf.createSubmission({ slug: 'race', title: 'T', topic: 't', owner: '/features/lab/' }, editor, fileDeps)));
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.status).toBe(409);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('Postgres: a unique violation becomes the same refusal, and the index exists', async () => {
    const texts: string[] = [];
    const params: unknown[][] = [];
    const pg = createPostgresStore(async (text, p = []) => {
      texts.push(text);
      params.push(p);
      if (text.startsWith('INSERT') && JSON.parse(p[2] as string).activeSlug === 'taken') throw Object.assign(new Error('dup'), { code: '23505' });
      return [];
    });
    const sub = { id: 'a', slug: 'taken', state: 'draft', updatedAt: 'x' } as Submission;
    await expect(pg.putSubmission(sub)).rejects.toBeInstanceOf(ActiveSlugError);
    expect(texts.some((t) => /CREATE UNIQUE INDEX IF NOT EXISTS admin_docs_active_slug/.test(t))).toBe(true);
    await pg.putSubmission({ ...sub, slug: 'closed', state: 'published' });
    expect(JSON.parse(params.at(-1)![2] as string).activeSlug).toBeUndefined();
  });
  it('submit names the branch after the submission', async () => {
    const spy = vi.spyOn(repo, 'writePreview');
    const sub = await draft();
    const pending = await wf.submitForApproval(sub.id, editor, deps);
    expect(spy.mock.calls[0][2]).toBe(sub.id);
    expect(pending.previewBranch).toBe(`content/open-clinic-bills-${sub.id.slice(0, 8)}`);
  });
});

describe('the new lifecycle, through the real harness, schema and registry', () => {
  const publishedFile = () => `---\n${Object.entries({ ...frontmatter({ status: 'published', editorialPass: { by: 'A', on: '2026-01-01', onlyUsCouldWrite: 'Our own clinic numbers.', readsMachineWritten: 'No.' } }) }).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n${BODY}`;
  const fresh = () => deps;

  it('editing a live post: real checks at submit and approve, and the registry accepts the result', async () => {
    files['open-clinic-bills'] = { raw: publishedFile(), sha: 'v1' };
    const copy = (await wf.startEdit('open-clinic-bills', (c) => ({ ...c, body: `${BODY}\nOne more line for the desk.\n` }), 'v1', editor, fresh()))!;
    const pending = await wf.submitForApproval(copy.id, editor, fresh());
    expect(pending.state).toBe('pending');
    const done = await approveIt(pending);
    expect(done.state).toBe('published');
    const registry = await buildRegistry(files['open-clinic-bills'].raw, 'open-clinic-bills');
    expect(registry.pages.find((p) => p.id === 'open-clinic-bills')?.status).toBe('published');
  });

  it('a scheduled post: the frozen file passes real gates at fire time and the real registry afterwards', async () => {
    const pending = await wf.submitForApproval((await draft()).id, editor, deps);
    const sub = await wf.schedule(pending.id, boss, { viewedHash: pending.contentHash, ...ANSWERS, at: '2026-11-07T03:30:00Z' }, deps);
    const later = { ...deps, now: () => new Date('2026-11-07T04:00:00Z') };
    const run = await wf.runDueSchedules(later);
    expect(run.results).toMatchObject([{ outcome: 'published' }]);
    expect(files['open-clinic-bills'].raw).toBe(sub.scheduled!.plan.writes[0].content);
    const registry = await buildRegistry(files['open-clinic-bills'].raw, 'open-clinic-bills');
    expect(registry.pages.find((p) => p.id === 'open-clinic-bills')?.status).toBe('published');
  });

  it('a Git draft submits unchanged through the real harness, and a blocked one still reports its rule', async () => {
    files['open-clinic-bills'] = { raw: publishedFile().replace('"published"', '"draft"'), sha: 'd1' };
    const [row] = await wf.bulk('submit', ['open-clinic-bills'], {}, editor, deps);
    expect(row).toMatchObject({ ok: true });
    files['bad-draft'] = { raw: publishedFile().replace('"published"', '"draft"').replace('open clinic bills', 'bad draft').replace(/summary: .*/, 'summary: "{fact:nope} clinics"'), sha: 'd2' };
    const [bad] = await wf.bulk('submit', ['bad-draft'], {}, editor, deps);
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/Fix/);
  });

  it('after unpublishing, another post can take the keyword and the real checks pass', async () => {
    const made = fakeRepo({ 'src/data/redirects.yaml': { raw: '[]\n', sha: 'r' } });
    repo = made.repo;
    files = made.files;
    deps = { ...deps, repo };
    const pending = await wf.submitForApproval((await draft()).id, editor, deps);
    await approveIt(pending);
    const second = await draft({}, BODY, 'second-post');
    expect(rulesOf(await refusal(wf.submitForApproval(second.id, editor, deps)))).toContain('cannibalisation');
    await wf.unpublish('open-clinic-bills', boss, { mode: 'gone' }, deps);
    expect((await wf.submitForApproval(second.id, editor, deps)).state).toBe('pending');
  });
});
