/**
 * The writing pipeline as a resumable state machine: advanceJob runs one stage, persists, and returns, so each call
 * fits a 300 s Vercel function and a crash loses at most the stage in flight. The engine's only output is a Submission
 * in state draft. It has no route to publishing: it does not import the repo, and approval stays with a person.
 * Failure handling and its sources: docs/research/admin-engine-edge-cases.md.
 */
import { randomUUID } from 'node:crypto';
import { POST_TOPICS } from '../../schemas/constants.ts';
import { INTERNAL_PATH } from '../../schemas/patterns.ts';
import { addUsage, AiError, AiNotConfiguredError, ClaudeClient, type MessagesClient } from './claude.ts';
import { BLOCKED_HOSTS, classifyTier, fetchSource, isBlockedHost, quoteAppearsIn, type FetchResult } from './fetcher.ts';
import { checkAgainstLedger, checkConflicts, checkFreshness, checkPost, extractNumbers, isHumanOnly } from './harness.ts';
import { PublicError } from './http.ts';
import * as P from './prompts.ts';
import { MAX_REVISIONS, type AdminUser, type Check, type Claim, type ClaimConflict, type Job, type JobBrief, type JobStage, type Outline, type PostContent, type Source, type SourceCandidate, type Store, type Submission, type TopicIdea, type Usage } from './types.ts';

const MIN_SOURCES = 3;
const MIN_CLAIMS = 5;
const MAX_FETCHES = 12;
const ENOUGH_SOURCES = 8;
const READ_BUDGET_MS = 200_000;
const SAME_HOST_GAP_MS = 1_000;
const LEASE_MS = 320_000;
const SETTLE_MS = 250;
const MAX_SLUG_TRIES = 6;
export const MAX_RETRIES = 3;
const MAX_LEASE_EXPIRIES = 2;

export class WeeklyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`The team has used its ${limit} AI drafts for this week. The count resets on Monday (UTC).`);
    this.name = 'WeeklyLimitError';
  }
}
export class JobNotFoundError extends Error {}
export class InvalidBriefError extends Error {}
export class JobStateError extends Error {}
/** Another request holds this job's stage. The caller waits and polls. */
export class JobBusyError extends Error {
  constructor(id: string) {
    super(`Job ${id} is already running a stage`);
    this.name = 'JobBusyError';
  }
}
export class WeeklySpendError extends Error {
  constructor(readonly limit: number) {
    super(`The team has reached this week's AI spending limit of $${limit}. It resets on Monday (UTC).`);
    this.name = 'WeeklySpendError';
  }
}
/** An honest stop: the research does not support a post. */
class ThinResearchError extends Error {}

export interface EngineDeps {
  store: Store;
  client?: MessagesClient;
  fetch: (url: string) => Promise<FetchResult>;
  createSubmission: (input: { slug: string; content: PostContent; jobId: string; createdBy: string }) => Promise<Submission>;
  existingPosts: () => Promise<Array<{ slug: string; body: string }>>;
  now: () => Date;
  wait: (ms: number) => Promise<void>;
  /** Time shared by the model calls in one stage. Tests shorten it. */
  stageDeadlineMs?: number;
}

const postBodies = import.meta.glob('/src/content/posts/*/index.mdx', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const slugFromPath = (path: string) => {
  const parts = path.replace(/\.(?:mdx|yaml)$/, '').split('/');
  const last = parts[parts.length - 1];
  return last === 'index' ? parts[parts.length - 2] : last;
};

/**
 * workflow.ts owns creating. It refuses a slug that is a page, redirect, gone path, existing post or active submission
 * (409), reading main as well as this deployment. The row is written once, with its content and job, so a retry after
 * a failure can never find a blank draft and call it done.
 */
export async function createDraftSubmission(input: { slug: string; content: PostContent; jobId: string; createdBy: string }, workflowDeps?: import('./workflow.ts').Deps): Promise<Submission> {
  const { createSubmission } = await import('./workflow.ts');
  const engine: AdminUser = { email: 'engine', name: 'Writing engine', role: 'editor' };
  const fm = input.content.frontmatter;
  return createSubmission({ slug: input.slug, title: String(fm.title), topic: String(fm.topic), owner: String(fm.owner), fromJob: { content: input.content, jobId: input.jobId, createdBy: input.createdBy } }, engine, workflowDeps);
}

export const existingPostBodies = async (): Promise<Array<{ slug: string; body: string }>> =>
  Promise.all(Object.entries(postBodies).map(async ([path, load]) => ({ slug: slugFromPath(path), body: (await load()).replace(/^---\n[\s\S]*?\n---\n?/, '') })));

async function resolveDeps(overrides: Partial<EngineDeps> = {}): Promise<EngineDeps> {
  const store = overrides.store ?? (await (await import('./store.ts')).getStore());
  return {
    store,
    fetch: (url) => fetchSource(url),
    createSubmission: createDraftSubmission,
    existingPosts: existingPostBodies,
    now: () => new Date(),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...overrides,
  };
}

/* ---------- Creating and steering jobs ---------- */

const weeklyLimit = () => {
  const n = Number(process.env.ADMIN_WEEKLY_AI_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 10;
};

function weekStart(now: Date): number {
  const day = (now.getUTCDay() + 6) % 7;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day);
}

async function usedThisWeek(store: Store, now: Date): Promise<Job[]> {
  const start = weekStart(now);
  return (await store.listJobs()).filter((j) => !j.limitRejected && Date.parse(j.createdAt) >= start);
}

const usdLimit = (name: 'ADMIN_JOB_MAX_USD' | 'ADMIN_WEEKLY_MAX_USD', fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const jobMaxUsd = () => usdLimit('ADMIN_JOB_MAX_USD', 5);
const weeklyMaxUsd = () => usdLimit('ADMIN_WEEKLY_MAX_USD', 50);
const spent = (jobs: Job[]) => jobs.reduce((sum, j) => sum + j.usage.costUsd, 0);

/** Stages that call the model. The others are free, so a job at its limit can still hand over the draft it has. */
const PAID_STAGES = new Set<JobStage>(['research', 'ledger', 'outline', 'draft', 'review', 'revise']);

/** Why a person may not press retry, or null. Every retry spends money. */
export function retryBlocked(job: Job): string | null {
  if ((job.retries ?? 0) >= MAX_RETRIES) return `This job has used its ${MAX_RETRIES} retries. Start a new brief, changing what caused the failure.`;
  if (job.usage.costUsd >= jobMaxUsd()) return `This job has reached its spending limit of $${jobMaxUsd()}. Start a new brief.`;
  return null;
}

/** The job page runs steps by itself only while nothing suggests that more runs would waste money. */
export function autoRunAllowed(job: Job, now: Date): boolean {
  const leaseExpired = Boolean(job.leaseUntil) && Date.parse(job.leaseUntil!) <= now.getTime();
  return retryBlocked(job) === null && !leaseExpired && (job.leaseExpiries ?? 0) === 0;
}

/** The count check of createJob, shared with topic ideas. See createJob for why there is no transaction. */
async function reserveRun(store: Store, job: Job, now: Date): Promise<void> {
  const limit = weeklyLimit();
  const week = await usedThisWeek(store, now);
  if (week.length >= limit) throw new WeeklyLimitError(limit);
  if (spent(week) >= weeklyMaxUsd()) throw new WeeklySpendError(weeklyMaxUsd());
  await store.putJob(job);
  if ((await usedThisWeek(store, now)).length > limit) {
    await store.putJob({ ...job, limitRejected: true, stage: 'failed', error: 'Lost a race for the last weekly slot' });
    throw new WeeklyLimitError(limit);
  }
}

/** Saves usage after each response, so a killed function cannot lose what was already spent. */
function usageSaver(store: Store, job: Job, stillHeld: (current: Job) => boolean) {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    save(usage: Usage) {
      const total = { ...job.usage };
      addUsage(total, usage);
      queue = queue
        .then(async () => {
          const current = await store.getJob(job.id);
          if (current && stillHeld(current)) await store.putJob({ ...current, usage: total });
        })
        .catch(() => console.error('[admin] usage not saved'));
    },
    settled: () => queue,
  };
}

function validateBrief(brief: JobBrief): void {
  if (!brief.topicIdea?.trim()) throw new InvalidBriefError('Give the topic idea.');
  if (!(POST_TOPICS as readonly string[]).includes(brief.topic)) throw new InvalidBriefError(`Unknown topic "${brief.topic}".`);
  if (!brief.owner || !INTERNAL_PATH.test(brief.owner)) throw new InvalidBriefError('The owner is a landing page path, such as /features/billing/.');
  if (brief.owner.startsWith('/blog/')) throw new InvalidBriefError('A post is owned by a landing page; /blog/ lists posts but owns none.');
}

/**
 * Limit check without a transaction: count, write, then count again. Two racing requests each see the other's row on
 * the recount, at worst both give way. That can under-admit one draft under a race and can never exceed the limit.
 */
export async function createJob(brief: JobBrief, user: Pick<AdminUser, 'email'>, overrides: Partial<EngineDeps> = {}): Promise<Job> {
  validateBrief(brief);
  const deps = await resolveDeps(overrides);
  const now = deps.now();
  const at = now.toISOString();
  const job: Job = {
    id: randomUUID(),
    brief: { ...brief, topicIdea: brief.topicIdea.trim() },
    stage: 'research',
    sources: [],
    claims: [],
    rejectedClaims: [],
    outline: null,
    draft: null,
    checks: [],
    reviewFindings: [],
    revisions: 0,
    submissionId: null,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, webSearches: 0 },
    log: [{ at, message: `Created by ${user.email}` }],
    createdAt: at,
    updatedAt: at,
    createdBy: user.email,
  };
  await reserveRun(deps.store, job, now);
  return job;
}

async function mustGet(store: Store, id: string): Promise<Job> {
  const job = await store.getJob(id);
  if (!job) throw new JobNotFoundError(`No job ${id}`);
  return job;
}

export async function approveOutline(id: string, user: Pick<AdminUser, 'email'>, note?: string, overrides: Partial<EngineDeps> = {}): Promise<Job> {
  const deps = await resolveDeps(overrides);
  const job = await mustGet(deps.store, id);
  if (job.stage !== 'awaiting_outline') throw new JobStateError(`This job is at ${job.stage}, not waiting for an outline`);
  const at = deps.now().toISOString();
  const next: Job = { ...job, stage: 'draft', updatedAt: at, log: [...job.log, { at, message: `Outline approved by ${user.email}` }] };
  if (note?.trim()) next.outlineNote = note.trim();
  await deps.store.putJob(next);
  return next;
}

export async function retryJob(id: string, overrides: Partial<EngineDeps> = {}): Promise<Job> {
  const deps = await resolveDeps(overrides);
  const job = await mustGet(deps.store, id);
  if (job.stage !== 'failed' || !job.failedStage || job.limitRejected) throw new JobStateError('Only a failed job can be retried');
  const blocked = retryBlocked(job);
  if (blocked) throw new JobStateError(blocked);
  if (PAID_STAGES.has(job.failedStage) && spent(await usedThisWeek(deps.store, deps.now())) >= weeklyMaxUsd()) throw new WeeklySpendError(weeklyMaxUsd());
  const at = deps.now().toISOString();
  const { error: _error, failedStage, ...rest } = job;
  const next: Job = { ...rest, stage: failedStage, retries: (job.retries ?? 0) + 1, leaseExpiries: 0, updatedAt: at, log: [...job.log, { at, message: `Retrying ${failedStage}` }] };
  await deps.store.putJob(next);
  return next;
}

/* ---------- Lease ---------- */

async function claim(store: Store, job: Job, deps: EngineDeps): Promise<Job> {
  const now = deps.now();
  if (job.leaseUntil && Date.parse(job.leaseUntil) > now.getTime()) throw new JobBusyError(job.id);
  const leaseId = randomUUID();
  const held: Job = { ...job, leaseId, leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(), updatedAt: now.toISOString() };
  if (held.updatedAt === job.updatedAt) held.updatedAt = new Date(now.getTime() + 1).toISOString();
  if (store.claimJob) {
    if (!(await store.claimJob(held, job.updatedAt))) throw new JobBusyError(job.id);
    return held;
  }
  await store.putJob(held);
  await deps.wait(SETTLE_MS);
  if ((await store.getJob(job.id))?.leaseId !== leaseId) throw new JobBusyError(job.id);
  return held;
}

/* ---------- Ledger verification ---------- */

const INJECTION = /\b(?:ignore|disregard|forget)\b[^.\n]{0,40}\b(?:instructions?|prompts?|rules?)\b|\b(?:system prompt|you are now|as an ai)\b/i;

/** Code, not the model, decides what enters the ledger. */
export function verifyClaims(proposed: Array<{ sourceId: string; statement: string; quote: string }>, sources: Source[]): { claims: Claim[]; rejected: Claim[] } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const claims: Claim[] = [];
  const rejected: Claim[] = [];
  proposed.forEach((p, i) => {
    const claim: Claim = { id: `c${i + 1}`, sourceId: p.sourceId, statement: p.statement, quote: p.quote };
    const source = byId.get(p.sourceId);
    const key = (n: { value: number; unit: string }) => `${n.unit}|${n.value}`;
    const quoted = new Set(extractNumbers(p.quote).map(key));
    const numbersHold = extractNumbers(p.statement).every((n) => quoted.has(key(n)));
    const ok = source && quoteAppearsIn(p.quote, source.text) && numbersHold && !INJECTION.test(p.quote) && !INJECTION.test(p.statement);
    (ok ? claims : rejected).push(claim);
  });
  return { claims, rejected };
}

function mapConflicts(raw: Array<{ quotes: string[]; note: string }>, claims: Claim[]): ClaimConflict[] {
  const normal = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const out: ClaimConflict[] = [];
  for (const c of raw) {
    const ids = claims.filter((claim) => c.quotes.some((q) => normal(q) === normal(claim.quote))).map((claim) => claim.id);
    if (ids.length >= 2) out.push({ claimIds: ids, note: c.note });
  }
  return out;
}

/* ---------- Draft assembly ---------- */

interface DraftOutput {
  headKeyword: string;
  secondaryKeywords: string[];
  title: string;
  metaDescription: string;
  h1: string;
  linkLabel: string;
  openingAnswer: string;
  summary: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  whatsapp: string;
  faq: Array<{ question: string; answer: string }>;
  related: Array<{ href: string; label: string; description: string }>;
  body: string;
}

/** Where a post's main button goes, by the brief's country. Mirrors what the published posts use. */
const DEMO_PATHS: Record<string, string> = { in: '/indiademo/', ke: '/kenyademo/', ae: '/uaedemo/', ng: '/nigeriademo/' };
const demoPath = (country: string) => DEMO_PATHS[country.trim().toLowerCase()] ?? '/contact-us/#book-a-demo';

/** Fields that decide where a post goes and who stands behind it are set here, never taken from the model. */
export function toContent(d: DraftOutput, brief: JobBrief, now: Date): PostContent {
  return {
    frontmatter: {
      status: 'draft',
      headKeyword: d.headKeyword,
      secondaryKeywords: d.secondaryKeywords,
      title: d.title,
      metaDescription: d.metaDescription,
      h1: d.h1,
      linkLabel: d.linkLabel,
      openingAnswer: d.openingAnswer,
      summary: d.summary,
      author: null,
      lastUpdated: now.toISOString().slice(0, 10),
      topic: brief.topic,
      owner: brief.owner,
      ctas: { primary: { label: d.ctaPrimaryLabel, href: demoPath(brief.country) }, secondary: { label: d.ctaSecondaryLabel, href: brief.owner }, whatsapp: d.whatsapp },
      faq: d.faq,
      links: { hub: '/blog/', related: d.related.filter((r) => INTERNAL_PATH.test(r.href)) },
    },
    body: `\n${d.body.trim()}\n`,
  };
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 60).replace(/-+$/, '') || 'post';
}

/* ---------- Stages ---------- */

interface Ctx {
  deps: EngineDeps;
  claude: ClaudeClient;
  log: (message: string) => void;
}

const stages: Partial<Record<JobStage, (job: Job, ctx: Ctx) => Promise<Partial<Job>>>> = {
  async research(job, { claude, log }) {
    const { candidates, errors } = await claude.searchWeb({ ...P.researchPrompt(job.brief), maxUses: 8, blockedDomains: BLOCKED_HOSTS });
    if (errors.length) log(`Some searches failed: ${[...new Set(errors)].join(', ')}`);
    const usable = candidates.filter((c) => {
      try {
        return !isBlockedHost(new URL(c.url).hostname);
      } catch {
        return false;
      }
    });
    if (usable.length < MIN_SOURCES) throw new ThinResearchError(`Search found ${usable.length} usable pages; ${MIN_SOURCES} is the minimum. Narrow or reword the idea.`);
    log(`Found ${usable.length} candidate pages`);
    return { candidates: usable, stage: 'read' };
  },

  async read(job, { deps, log }) {
    const rank = { official: 0, research: 1, news: 2, other: 3 };
    const tierOf = (c: SourceCandidate) => classifyTier(new URL(c.url).hostname);
    const queue = [...(job.candidates ?? [])].sort((a, b) => rank[tierOf(a)] - rank[tierOf(b)]).slice(0, MAX_FETCHES);
    const started = deps.now().getTime();
    const sources: Source[] = [];
    const lastByHost = new Set<string>();
    for (const candidate of queue) {
      if (sources.length >= ENOUGH_SOURCES || deps.now().getTime() - started > READ_BUDGET_MS) break;
      const host = new URL(candidate.url).hostname;
      if (lastByHost.has(host)) await deps.wait(SAME_HOST_GAP_MS);
      lastByHost.add(host);
      const result = await deps.fetch(candidate.url);
      if (!result.ok) {
        log(`Skipped ${candidate.url}: ${result.detail}`);
        continue;
      }
      if (sources.some((s) => s.url === result.url || s.text === result.text)) continue;
      const fallbackDate = candidate.pageAge && !Number.isNaN(Date.parse(candidate.pageAge)) ? new Date(candidate.pageAge).toISOString().slice(0, 10) : null;
      sources.push({ id: `s${sources.length + 1}`, url: result.url, title: result.title || candidate.title, host: result.host, tier: result.tier, fetchedAt: result.fetchedAt, text: result.text, publishedAt: result.publishedAt ?? fallbackDate });
    }
    if (sources.length < MIN_SOURCES) throw new ThinResearchError(`Only ${sources.length} of the pages could be read; ${MIN_SOURCES} is the minimum. A thin post would be worse than none.`);
    log(`Read ${sources.length} sources`);
    return { sources, stage: 'ledger' };
  },

  async ledger(job, { claude, log }) {
    const out = await claude.structured<{ claims: Array<{ sourceId: string; statement: string; quote: string }>; conflicts: Array<{ quotes: string[]; note: string }> }>({
      ...P.ledgerPrompt(job.brief, job.sources),
      schema: P.ledgerSchema,
    });
    const { claims, rejected } = verifyClaims(out.claims, job.sources);
    const citing = new Set(claims.map((c) => c.sourceId)).size;
    log(`${claims.length} claims verified against the page text, ${rejected.length} dropped`);
    if (claims.length < MIN_CLAIMS || citing < MIN_SOURCES) {
      const failure = new ThinResearchError(`Only ${claims.length} claims from ${citing} sources could be verified; the minimum is ${MIN_CLAIMS} from ${MIN_SOURCES}. Stopping rather than writing thin content.`);
      Object.assign(failure, { partial: { claims, rejectedClaims: rejected } });
      throw failure;
    }
    return { claims, rejectedClaims: rejected, conflicts: mapConflicts(out.conflicts, claims), stage: 'outline' };
  },

  async outline(job, { claude }) {
    const outline = await claude.structured<Outline>({ ...P.outlinePrompt(job.brief, job.claims, job.sources, job.conflicts ?? []), schema: P.outlineSchema });
    const known = new Set(job.claims.map((c) => c.id));
    for (const section of outline.sections) section.claimIds = section.claimIds.filter((id) => known.has(id));
    return { outline, stage: 'awaiting_outline' };
  },

  async draft(job, { claude, deps }) {
    if (!job.outline) throw new JobStateError('No outline to write from');
    const out = await claude.structured<DraftOutput>({ ...P.draftPrompt(job.brief, job.outline, job.outlineNote, job.claims, job.sources, job.conflicts ?? []), schema: P.draftSchema });
    return { draft: toContent(out, job.brief, deps.now()), stage: 'check' };
  },

  async check(job, { deps }) {
    if (!job.draft) throw new JobStateError('No draft to check');
    const checks: Check[] = [
      ...checkPost(job.draft),
      ...checkAgainstLedger(job.draft, job.claims, job.sources, await deps.existingPosts()),
      ...checkFreshness(job.sources, job.claims, deps.now()),
      ...checkConflicts(job.conflicts ?? []),
    ];
    return { checks, stage: 'review' };
  },

  async review(job, { claude }) {
    if (!job.draft) throw new JobStateError('No draft to review');
    type Findings = { findings: Array<{ severity: 'error' | 'warning'; passage: string; problem: string }>; onlyUsCouldWrite: string };
    const [facts, edit] = await Promise.all([
      claude.structured<Findings>({ ...P.factCheckPrompt(job.draft, job.claims, job.sources), schema: P.findingsSchema }),
      claude.structured<Findings>({ ...P.editorPrompt(job.draft), schema: P.findingsSchema }),
    ]);
    const haystack = JSON.stringify(job.draft).replace(/\\"/g, '"').replace(/\\n/g, '\n');
    const toCheck = (rule: string) => (f: Findings['findings'][number]): Check => {
      const located = f.passage.trim() !== '' && haystack.includes(f.passage);
      return { rule, severity: located ? f.severity : 'warning', path: 'review', message: located ? f.problem : `${f.problem} (the reviewer's quote was not found in the draft)`, excerpt: f.passage.slice(0, 200) };
    };
    const findings = [...facts.findings.map(toCheck('fact-check')), ...edit.findings.map(toCheck('editor'))];
    if (edit.onlyUsCouldWrite.trim()) findings.push({ rule: 'only-us-could-write', severity: 'warning', path: 'review', message: edit.onlyUsCouldWrite });
    const blocking = [...job.checks.filter((c) => c.severity === 'error' && !isHumanOnly(c)), ...findings.filter((c) => c.severity === 'error')];
    return { reviewFindings: findings, stage: blocking.length > 0 && job.revisions < MAX_REVISIONS ? 'revise' : 'done' };
  },

  async revise(job, { claude, deps }) {
    if (!job.draft) throw new JobStateError('No draft to revise');
    const findings = [...job.checks.filter((c) => !isHumanOnly(c)), ...job.reviewFindings].filter((c) => c.rule !== 'only-us-could-write');
    const out = await claude.structured<DraftOutput>({ ...P.revisePrompt(job.brief, job.draft, findings, job.claims, job.sources, job.conflicts ?? []), schema: P.draftSchema });
    return { draft: toContent(out, job.brief, deps.now()), revisions: job.revisions + 1, stage: 'check' };
  },

  async done(job, { deps, log }) {
    if (!job.draft) throw new JobStateError('No draft to hand over');
    const prior = (await deps.store.listSubmissions()).find((s) => s.jobId === job.id);
    if (prior) return { submissionId: prior.id, stage: 'done' };
    const base = slugify(String(job.draft.frontmatter.headKeyword ?? job.draft.frontmatter.title ?? job.brief.topicIdea));
    const content: PostContent = { ...job.draft, frontmatter: { ...job.draft.frontmatter, links: job.draft.frontmatter.links ?? { hub: '/blog/' }, status: 'draft', author: null } };
    for (let n = 1; n <= MAX_SLUG_TRIES; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      try {
        const submission = await deps.createSubmission({ slug, content, jobId: job.id, createdBy: job.createdBy });
        if (n > 1) log(`Slug ${base} is taken; using ${slug}`);
        return { submissionId: submission.id, stage: 'done' };
      } catch (err) {
        if ((err as { status?: number }).status !== 409) throw err;
      }
    }
    throw new JobStateError(`Slugs from ${base} to ${base}-${MAX_SLUG_TRIES} are all taken. Change the head keyword.`);
  },
};

/** Runs at most one stage. Waiting and finished jobs come back unchanged. */
export async function advanceJob(id: string, overrides: Partial<EngineDeps> = {}): Promise<Job> {
  const deps = await resolveDeps(overrides);
  const job = await mustGet(deps.store, id);
  const finished = job.stage === 'done' && job.submissionId !== null;
  if (job.kind === 'topics' || job.stage === 'awaiting_outline' || job.stage === 'failed' || finished) return job;

  const stopWith = async (error: string): Promise<Job> => {
    const at = deps.now();
    const updatedAt = new Date(Math.max(at.getTime(), Date.parse(job.updatedAt) + 1)).toISOString();
    const stopped: Job = { ...job, stage: 'failed', failedStage: job.stage, error, leaseId: null, leaseUntil: null, updatedAt, log: [...job.log, { at: at.toISOString(), message: error }] };
    await deps.store.putJob(stopped);
    return stopped;
  };
  const leaseExpired = Boolean(job.leaseUntil) && Date.parse(job.leaseUntil!) <= deps.now().getTime();
  const leaseExpiries = (job.leaseExpiries ?? 0) + (leaseExpired ? 1 : 0);
  if (leaseExpiries >= MAX_LEASE_EXPIRIES) return stopWith('This step stopped without finishing twice, so it was not run again. Nothing was published.');

  let maxUsd = Infinity;
  if (PAID_STAGES.has(job.stage)) {
    const left = Math.min(jobMaxUsd() - job.usage.costUsd, weeklyMaxUsd() - spent(await usedThisWeek(deps.store, deps.now())));
    if (left <= 0) return stopWith(job.usage.costUsd >= jobMaxUsd() ? `This job reached its spending limit of $${jobMaxUsd()}. Nothing was published.` : new WeeklySpendError(weeklyMaxUsd()).message);
    maxUsd = left;
  }

  const held = await claim(deps.store, { ...job, leaseExpiries }, deps);
  const saver = usageSaver(deps.store, held, (current) => current.leaseId === held.leaseId);
  const claude = new ClaudeClient(deps.client, { deadlineMs: deps.stageDeadlineMs, maxUsd, onUsage: saver.save });
  const log: Array<{ at: string; message: string }> = [];
  const note = (message: string) => log.push({ at: deps.now().toISOString(), message });
  let patch: Partial<Job>;
  try {
    patch = await stages[job.stage]!(held, { deps, claude, log: note });
    if (patch.stage !== job.stage) note(`${job.stage} finished`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    note(`${job.stage} failed: ${message}`);
    const partial = (err as { partial?: Partial<Job> }).partial ?? {};
    patch = { ...partial, stage: 'failed', failedStage: job.stage, error: message };
  }
  if (patch.stage !== 'failed') patch.leaseExpiries = 0;
  await saver.settled();

  const current = await deps.store.getJob(id);
  if (current?.leaseId !== held.leaseId) {
    throw new JobBusyError(id);
  }
  const usage = { ...held.usage };
  addUsage(usage, claude.usage);
  const next: Job = { ...held, ...patch, usage, log: [...held.log, ...log], leaseId: null, leaseUntil: null, updatedAt: deps.now().toISOString() };
  if (next.updatedAt <= held.updatedAt) next.updatedAt = new Date(Date.parse(held.updatedAt) + 1).toISOString();
  await deps.store.putJob(next);
  return next;
}

/* ---------- Topic ideas ---------- */

/** Costs real money, so it counts as a weekly run and its cost is kept in a job row that no page lists. */
export async function suggestTopics(args: { audience: string; country: string }, existingSlugs: string[], overrides: Partial<EngineDeps> = {}, by = 'unknown'): Promise<TopicIdea[]> {
  const deps = await resolveDeps(overrides);
  const now = deps.now();
  const at = now.toISOString();
  const run: Job = {
    id: randomUUID(), kind: 'topics', brief: { topicIdea: 'Topic ideas', audience: args.audience, country: args.country, topic: '', owner: '' },
    stage: 'done', sources: [], claims: [], rejectedClaims: [], outline: null, draft: null, checks: [], reviewFindings: [], revisions: 0, submissionId: null,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, webSearches: 0 }, log: [], createdAt: at, updatedAt: at, createdBy: by,
  };
  await reserveRun(deps.store, run, now);
  const maxUsd = Math.min(jobMaxUsd(), weeklyMaxUsd() - spent(await usedThisWeek(deps.store, now)));
  const saver = usageSaver(deps.store, run, () => true);
  const claude = new ClaudeClient(deps.client, { deadlineMs: deps.stageDeadlineMs, maxUsd, onUsage: saver.save });
  try {
    const { candidates } = await claude.searchWeb({ ...P.topicsPrompt(args), maxUses: 5, blockedDomains: BLOCKED_HOSTS });
    if (candidates.length === 0) throw new AiError('search_failed', 'Search returned nothing to base ideas on');
    const out = await claude.structured<{ ideas: TopicIdea[] }>({ ...P.topicsJudgePrompt({ ...args, candidates, existingSlugs }), schema: P.topicsSchema });
    const urls = new Set(candidates.map((c) => c.url));
    const slugs = new Set(existingSlugs);
    return out.ideas.map((idea) => ({ ...idea, sourceUrls: idea.sourceUrls.filter((u) => urls.has(u)), overlapsWith: idea.overlapsWith.filter((s) => slugs.has(s)) }));
  } finally {
    await saver.settled();
  }
}

export const existingPostSlugs = (): string[] => Object.keys(postBodies).map(slugFromPath);

/** Engine errors a signed-in user should read; anything else stays a generic failure in guarded(). */
export function toPublicError(err: unknown): unknown {
  if (err instanceof WeeklyLimitError || err instanceof WeeklySpendError) return new PublicError(err.message, 429);
  if (err instanceof InvalidBriefError) return new PublicError(err.message, 400);
  if (err instanceof JobNotFoundError) return new PublicError(err.message, 404);
  if (err instanceof JobBusyError || err instanceof JobStateError) return new PublicError(err.message, 409);
  if (err instanceof AiNotConfiguredError) return new PublicError(err.message, 503);
  if (err instanceof AiError) return new PublicError(err.message, 502);
  return err;
}
