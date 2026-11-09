import { createHash, randomUUID } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { isExternal, matchesRule, normalizePath, type MatchMode } from '../../../integrations/routes-core.ts';
import { resolveDeep, type TokenData } from '../content/tokens.ts';
import { roleFor } from './auth.ts';
import { checkAgainstLedger, checkForBuild } from './harness.ts';
import { PublicError, formText } from './http.ts';
import { actionsFor, BULK_CAP, formatIst, isActive, REVISION_CAP, siteFor, statusLabel, TRASH_DAYS, workFor, type BulkRowResult, type PostAction, type SiteState, type WorkState } from './lifecycle.ts';
import { hashContent, parsePost, serializePost } from './mdx-file.ts';
import { assertPlanPaths, assertSlug, getRepo, postPath, RepoConflictError, RepoRateLimitError } from './repo.ts';
import { fieldLabel } from './review.ts';
import { ADMIN_GONE, ADMIN_REDIRECTS, blockingRule, exactRuleAt, inboundAdmin, inboundFixed, planRules, readMainRules, validateRules, type MainRules, type RouteChoice, type RuleEdit } from './routing-edit.ts';
import { ActiveSlugError, getStore, StaleWriteError } from './store.ts';
import type { AdminUser, Check, CommitPlan, ContentRepo, HistoryAction, PostContent, PostFlag, ScheduleRun, Store, Submission, SubmissionState } from './types.ts';

const LOCK_MS = 2 * 60 * 1000;
const MAX_RAW_BYTES = 900_000; // GitHub's contents API returns text only up to 1 MB.
const RECORD_TRIES = 3;
const MAX_FAQ = 50;
const MAX_PER_RUN = 5;
const MAX_OVERDUE_MS = 7 * 86_400_000;
const MAX_SCHEDULE_MS = 366 * 86_400_000;
/** Root paths that are routes, not content (src/pages), plus what the admin and Keystatic use. */
const RESERVED = new Set(['admin', 'api', 'blog', 'demo', 'og', 'gone', 'keystatic', '404', 'rss', 'robots', 'sitemap']);

export interface RouteRules {
  /** Every content page, with the post slug when the page is a post. */
  pages: Array<{ path: string; postSlug?: string; status?: string }>;
  redirects: Array<{ from: string; match?: MatchMode }>;
  gone: Array<{ path: string; match?: MatchMode }>;
  /** Head keywords of published pages, resolved: the build fails on a repeat (registry.ts, cannibalisation). */
  headKeywords?: Array<{ keyword: string; path: string; postSlug?: string }>;
  /** The tokens this deployment resolves. A token missing here would fail the build. */
  tokenData?: TokenData;
}

const NO_TOKENS: TokenData = { prices: {}, facts: {}, figures: {}, publications: {}, contacts: {} };

export interface Deps {
  store: Store;
  repo: ContentRepo;
  check: (content: PostContent, rules: RouteRules) => Check[];
  routes: () => Promise<RouteRules>;
  now: () => Date;
  /** Published bodies for the copied-post check on AI drafts. */
  existingPosts?: () => Promise<Array<{ slug: string; body: string }>>;
  /** Whether this address may still approve. The schedule runner asks: a frozen approval dies with the approver's rights. */
  stillApprover?: (email: string) => boolean;
}

/** What this deployment was built with. If it cannot be read, the caller fails closed. */
async function deployedRoutes(): Promise<RouteRules> {
  const [{ getRegistry }, { getCollection }] = await Promise.all([import('../content/registry.ts'), import('astro:content')]);
  const registry = await getRegistry();
  const redirects = (await getCollection('redirects')).map((entry) => entry.data as RouteRules['redirects'][number]);
  const gone = (await getCollection('gone')).map((entry) => entry.data as RouteRules['gone'][number]);
  const postSlug = (p: (typeof registry.pages)[number]) => (p.collection === 'posts' ? p.id : undefined);
  return {
    pages: registry.pages.map((p) => ({ path: p.path, postSlug: postSlug(p), status: p.status })),
    redirects,
    gone,
    headKeywords: registry.pages.filter((p) => p.status === 'published').map((p) => ({ keyword: p.data.headKeyword, path: p.path, postSlug: postSlug(p) })),
    tokenData: registry.tokenData,
  };
}

export function defaultDeps(): Deps {
  return {
    stillApprover: (email) => roleFor(email) === 'approver',
    store: getStore(),
    repo: getRepo(),
    check: (content, rules) => checkForBuild(content, rules.tokenData ?? NO_TOKENS),
    routes: deployedRoutes,
    now: () => new Date(),
    existingPosts: async () => (await import('./engine.ts')).existingPostBodies(),
  };
}

/* ---------- Pure rules ---------- */

/** Why a post cannot live at /<slug>/, or null. A published post on a redirect or gone path fails the whole site build. */
export function slugConflict(slug: string, routes: RouteRules, self: boolean): string | null {
  const path = `/${slug}/`;
  if (RESERVED.has(slug)) return `${path} is reserved by the site.`;
  const page = routes.pages.find((p) => p.path === path);
  if (page && !(self && page.postSlug === slug)) return `${path} is already a page on the site.`;
  if (routes.redirects.some((r) => matchesRule(path, r.from, r.match ?? 'exact'))) return `${path} is a redirect, so a post cannot be published there.`;
  if (routes.gone.some((r) => matchesRule(path, r.path, r.match ?? 'exact'))) return `${path} is marked as gone, so a post cannot be published there.`;
  return null;
}

const errorsIn = (checks: Check[]) => checks.filter((c) => c.severity === 'error');

/** Why this head keyword would fail the build, or null. Reads the store too: the deployment may not have the latest post yet. */
export function keywordConflict(content: PostContent, slugOrSlugs: string | string[], rules: RouteRules, submissions: Submission[], flags: PostFlag[] = []): string | null {
  const tokens = rules.tokenData ?? NO_TOKENS;
  const resolved = (value: unknown) => (typeof value === 'string' ? resolveDeep(value, tokens).value.trim().toLowerCase() : '');
  const wanted = resolved(content.frontmatter.headKeyword);
  if (!wanted) return null;
  const own = new Set([slugOrSlugs].flat()); // A rename is both its old and its new address.
  // Taken offline or removed since: this post no longer holds any keyword, even in a deployment that still lists it.
  const gone = new Map(flags.filter((f) => f.unpublished || f.removed).map((f) => [f.id, (f.removed ?? f.unpublished)!.at]));
  const page = rules.headKeywords?.find((k) => !(k.postSlug && (own.has(k.postSlug) || gone.has(k.postSlug))) && k.keyword.trim().toLowerCase() === wanted);
  if (page) return `The head keyword "${wanted}" already belongs to ${page.path}. Two published pages cannot share one, because the site build would fail.`;
  const latest = new Map<string, Submission>();
  for (const s of submissions) {
    if (s.state !== 'published' || own.has(s.slug)) continue;
    const removedAt = gone.get(s.slug);
    if (removedAt && removedAt >= s.updatedAt) continue;
    const seen = latest.get(s.slug);
    if (!seen || s.updatedAt > seen.updatedAt) latest.set(s.slug, s);
  }
  const twin = [...latest.values()].find((s) => resolved(s.content.frontmatter.headKeyword) === wanted);
  return twin ? `The head keyword "${wanted}" already belongs to /${twin.slug}/. Two published pages cannot share one, because the site build would fail.` : null;
}

/** A store row saying "published" is only a claim: a developer may have taken the post down since. Main decides. */
async function stillPublished(submissions: Submission[], deps: Deps): Promise<Submission[]> {
  const out: Submission[] = [];
  for (const s of submissions) {
    if (s.state !== 'published') continue;
    const file = await deps.repo.readPost(s.slug).catch(() => ({ raw: serializePost(s.content), sha: null }));
    if (file && parsePost(file.raw).frontmatter.status === 'published') out.push(s);
  }
  return out;
}

/** An AI draft stays held to its evidence, including after later edits by a person. */
async function ledgerChecks(sub: Submission, content: PostContent, deps: Deps): Promise<Check[]> {
  if (!sub.jobId) return [];
  const job = await deps.store.getJob(sub.jobId);
  if (!job) return [{ rule: 'ledger', severity: 'error', path: 'job', message: 'The AI job behind this post is missing, so its facts cannot be checked. Reject this post and write it again.' }];
  const others = ((await deps.existingPosts?.()) ?? []).filter((p) => p.slug !== sub.slug);
  return checkAgainstLedger(content, job.claims, job.sources, others);
}

/** Everything that decides whether this content may go forward. Submit, approve and the pages all read this one list. */
export async function gateChecks(sub: Submission, content: PostContent, deps: Deps = defaultDeps(), known?: RouteRules): Promise<Check[]> {
  const rules = known ?? (await deps.routes());
  const checks = [...deps.check(content, rules), ...(await ledgerChecks(sub, content, deps))];
  const [subs, flags] = await Promise.all([deps.store.listSubmissions(), deps.store.listFlags()]);
  const own = sub.renameTo ? [sub.slug, sub.renameTo] : [sub.slug];
  let keyword = keywordConflict(content, own, rules, subs, flags);
  if (keyword) keyword = keywordConflict(content, own, rules, await stillPublished(subs, deps), flags);
  if (keyword) checks.push({ rule: 'cannibalisation', severity: 'error', path: 'headKeyword', message: keyword });
  return checks;
}

function assertState(sub: Submission, allowed: SubmissionState[], doing: string): void {
  if (!allowed.includes(sub.state)) throw new PublicError(`This post is ${sub.state.replace('_', ' ')}, so you cannot ${doing} it now.`, 409);
}

function assertUnlocked(sub: Submission, now: Date): void {
  if (sub.publishLockUntil && new Date(sub.publishLockUntil) > now) throw new PublicError('An approver is publishing this post right now. Refresh in a minute.', 409);
}

/** Strictly later than the last write, so two writes in one millisecond still differ for the stale check. */
function stamp(sub: Submission, now: Date): string {
  return new Date(Math.max(now.getTime(), new Date(sub.updatedAt).getTime() + 1)).toISOString();
}

function withEvent(sub: Submission, by: string, action: HistoryAction, at: string, note?: string): Submission['history'] {
  return [...sub.history, { at, by, action, ...(note ? { note } : {}) }];
}

function requireNote(note: unknown): string {
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) throw new PublicError('Please write a note saying why.', 400);
  return text.slice(0, 2000);
}

function requireApproverRole(user: AdminUser): void {
  if (user.role !== 'approver') throw new PublicError('Only an approver can do this.', 403);
}

async function load(deps: Deps, id: string): Promise<Submission> {
  const sub = await deps.store.getSubmission(id);
  if (!sub) throw new PublicError('That post is not in the admin.', 404);
  return sub;
}

async function write(deps: Deps, next: Submission, expected: string | undefined): Promise<Submission> {
  try {
    await deps.store.putSubmission(next, expected);
    return next;
  } catch (error) {
    if (error instanceof StaleWriteError) throw new PublicError('Someone else changed this post first. Refresh and try again.', 409);
    if (error instanceof ActiveSlugError) throw new PublicError(error.message, 409);
    throw error;
  }
}

function assertSize(content: PostContent): void {
  if (Buffer.byteLength(serializePost(content)) > MAX_RAW_BYTES) throw new PublicError('This post is too long to publish.', 413);
}

/** Fields approving sets, so a difference there says nothing about what an editor did. */
const STAMPS = new Set(['status', 'lastUpdated', 'editorialPass']);

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.replace(/\r\n/g, '\n').trim() || undefined;
  if (Array.isArray(value)) {
    const items = value.map(canonical).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])] as const).filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value ?? undefined;
}

const signature = (value: unknown) => JSON.stringify(canonical(value)) ?? '';

/**
 * Whether two versions say the same thing. A form round trip trims, drops empties, and a browser eats a textarea's
 * first newline, none of which is an edit. Status and dates set by approving are ignored.
 */
export function sameEdit(a: PostContent, b: PostContent): boolean {
  const strip = (fm: Record<string, unknown>) => Object.fromEntries(Object.entries(fm).filter(([k]) => !STAMPS.has(k)));
  return signature(strip(a.frontmatter)) === signature(strip(b.frontmatter)) && signature(a.body) === signature(b.body);
}

function checkedSlug(slug: string): void {
  try {
    assertSlug(slug);
  } catch (error) {
    throw new PublicError((error as Error).message, 400);
  }
}

/* ---------- The save form ---------- */

const PLAIN_FIELDS = ['title', 'metaDescription', 'h1', 'linkLabel', 'headKeyword', 'openingAnswer', 'summary', 'author', 'topic', 'owner'];

function safeHref(value: string): string {
  if (value && !/^(\/(?![/\\])|https:\/\/)/.test(value)) throw new PublicError('Links must start with / or https://.', 400);
  return value;
}

function parseFaq(text: string): Array<{ question: string; answer: string }> {
  const bad = () => new PublicError('The FAQ could not be read.', 400);
  if (!text.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw bad();
  }
  if (!Array.isArray(value) || value.length > MAX_FAQ) throw bad();
  return value.map((item) => {
    const { question, answer } = (item ?? {}) as Record<string, unknown>;
    if (typeof question !== 'string' || typeof answer !== 'string') throw bad();
    return { question, answer };
  });
}

/** Named fields only: anything else in the form is ignored, and fields the form lacks keep their value. */
export function contentFromForm(form: FormData, current: PostContent): PostContent {
  const frontmatter: Record<string, unknown> = { ...current.frontmatter };
  for (const name of PLAIN_FIELDS) {
    if (form.has(name)) frontmatter[name] = formText(form, name).replace(/\r\n/g, '\n').trim();
  }
  // The schema's "unknown" is null, which the publish rules refuse. An empty string would slip past them.
  if (frontmatter.author === '') frontmatter.author = null;
  const ctas = { ...((current.frontmatter.ctas ?? {}) as Record<string, unknown>) };
  const link = (slot: 'primary' | 'secondary', label: string, href: string) => {
    if (!form.has(label) && !form.has(href)) return;
    const value = { label: formText(form, label).trim(), href: safeHref(formText(form, href).trim()) };
    if (value.label || value.href) ctas[slot] = value;
    else delete ctas[slot];
  };
  link('primary', 'ctaPrimaryLabel', 'ctaPrimaryHref');
  link('secondary', 'ctaSecondaryLabel', 'ctaSecondaryHref');
  if (form.has('whatsapp')) ctas.whatsapp = formText(form, 'whatsapp').trim();
  frontmatter.ctas = ctas;
  if (form.has('faq')) {
    const faq = parseFaq(formText(form, 'faq'));
    if (faq.length) frontmatter.faq = faq;
    else delete frontmatter.faq;
  }
  return { frontmatter, body: form.has('body') ? formText(form, 'body').replace(/\r\n/g, '\n') : current.body };
}

/* ---------- Creating ---------- */

async function activeFor(deps: Deps, slug: string): Promise<Submission | undefined> {
  return (await deps.store.listSubmissions()).find((s) => s.slug === slug && isActive(s.state));
}

function fresh(slug: string, kind: Submission['kind'], content: PostContent, baseSha: string | null, user: AdminUser, now: Date, sourceStatus: string | null = null): Submission {
  const at = now.toISOString();
  return {
    id: randomUUID(), slug, kind, state: 'draft', content, contentHash: hashContent(content), baseSha, sourceStatus,
    submittedHash: null, previewBranch: null, jobId: null,
    history: [{ at, by: user.email, action: 'created' }], createdAt: at, updatedAt: at, createdBy: user.email,
  };
}

/** Fields every post must have that the form does not ask for. Existing values are kept. */
export function withPostDefaults(frontmatter: Record<string, unknown>, today: string): Record<string, unknown> {
  return { ...frontmatter, lastUpdated: frontmatter.lastUpdated ?? today, links: frontmatter.links ?? { hub: '/blog/' } };
}

export async function createSubmission(
  input: { slug: string; title: string; topic: string; owner: string; fromJob?: { content: PostContent; jobId: string; createdBy: string } },
  user: AdminUser,
  deps = defaultDeps(),
): Promise<Submission> {
  checkedSlug(input.slug);
  const conflict = slugConflict(input.slug, await deps.routes(), false);
  if (conflict) throw new PublicError(conflict, 409);
  // The deployment may be behind main, so ask main as well.
  if (await deps.repo.readPost(input.slug)) throw new PublicError('A post with that slug already exists. Open it instead.', 409);
  if (await activeFor(deps, input.slug)) throw new PublicError('Someone is already working on a post with that slug.', 409);
  const today = deps.now().toISOString().slice(0, 10);
  const content: PostContent = input.fromJob
    ? { frontmatter: withPostDefaults({ ...input.fromJob.content.frontmatter, status: 'draft' }, today), body: input.fromJob.content.body }
    : { frontmatter: withPostDefaults({ status: 'draft', title: input.title, topic: input.topic, owner: input.owner }, today), body: '\n' };
  assertSize(content);
  const base = fresh(input.slug, 'new', content, null, user, deps.now());
  // One write with the content in it: a failure leaves no blank draft for a retry to mistake for finished work.
  const sub = input.fromJob ? { ...base, jobId: input.fromJob.jobId, createdBy: input.fromJob.createdBy } : base;
  try {
    await deps.store.putSubmission(sub);
  } catch (error) {
    if (error instanceof ActiveSlugError) throw new PublicError(error.message, 409);
    throw error;
  }
  return sub;
}

/* ---------- Reading a post writes nothing ---------- */

export interface PostStatus {
  slug: string;
  site: SiteState;
  work: WorkState;
  trashed: boolean;
  active: Submission | null;
  file: { raw: string; sha: string | null } | null;
  flag: PostFlag | null;
  actions: PostAction[];
}

/** Read-only. Site status from main, work state from the store, and what this user may do. */
export async function postStatus(slug: string, role: AdminUser['role'], deps: Deps = defaultDeps()): Promise<PostStatus> {
  checkedSlug(slug);
  const [file, flag, subs] = await Promise.all([deps.repo.readPost(slug), deps.store.getFlag(slug), deps.store.listSubmissions()]);
  const active = subs.find((s) => s.slug === slug && isActive(s.state)) ?? null;
  const site = siteFor(file ? String(parsePost(file.raw).frontmatter.status ?? 'draft') : null, Boolean(flag?.unpublished));
  const now = deps.now();
  const work = workFor(active, now);
  const trashed = Boolean(flag?.trashed);
  const latest = subs.filter((s) => s.slug === slug).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const due = active?.scheduled ? new Date(active.scheduled.at) <= now : undefined;
  return { slug, site, work, trashed, active, file, flag, actions: actionsFor(site, work, role, { trashed, rejected: !active && latest?.state === 'rejected', due }) };
}

function assertAllowed(status: PostStatus, action: PostAction): void {
  if (status.actions.includes(action)) return;
  throw new PublicError(`You cannot ${action.replace('-', ' ')} this post now. It is: ${statusLabel(status.site, status.work, { trashed: status.trashed })}.`, status.site !== 'never' && (action === 'unpublish' || action === 'delete') ? 403 : 409);
}

async function refuseIfTrashed(slug: string, deps: Deps): Promise<void> {
  if ((await deps.store.getFlag(slug))?.trashed) throw new PublicError('This post is in the trash. Restore it first.', 409);
}

/* ---------- Editing and submitting ---------- */

async function snapshot(deps: Deps, sub: Submission, by: string, at: string): Promise<void> {
  const id = `${sub.id}-${sub.contentHash.slice(0, 12)}`;
  // A snapshot failing must not lose the save it follows.
  try {
    await deps.store.putRevision({ id, submissionId: sub.id, hash: sub.contentHash, updatedAt: at, by, content: sub.content });
    const all = await deps.store.listRevisions(sub.id);
    for (const old of all.slice(REVISION_CAP)) await deps.store.deleteRevision(old.id);
  } catch {
    console.error('[admin] revision not saved');
  }
}

/** Status and the editorial pass belong to approve(), whatever a form sends. */
function keepApprovalFields(content: PostContent, source: PostContent): PostContent {
  const frontmatter: Record<string, unknown> = { ...content.frontmatter, status: source.frontmatter.status };
  delete frontmatter.editorialPass;
  if (source.frontmatter.editorialPass !== undefined) frontmatter.editorialPass = source.frontmatter.editorialPass;
  return { frontmatter, body: content.body };
}

/** Returns the same submission, unwritten, when nothing changed. Compare updatedAt to tell "No changes". */
export async function saveEdit(id: string, content: PostContent, user: AdminUser, expectedUpdatedAt: string, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'changes_requested'], 'edit');
  await refuseIfTrashed(sub.slug, deps);
  const nextContent = keepApprovalFields(content, sub.content);
  assertSize(nextContent);
  if (sameEdit(nextContent, sub.content)) return sub;
  const at = stamp(sub, deps.now());
  const saved = await write(deps, {
    ...sub,
    content: nextContent,
    contentHash: hashContent(nextContent),
    submittedHash: null, // Any approval in view is void.
    history: withEvent(sub, user.email, 'edited', at),
    updatedAt: at,
  }, expectedUpdatedAt);
  if (!(await deps.store.listRevisions(sub.id).catch(() => [1])).length) await snapshot(deps, sub, sub.createdBy, sub.updatedAt);
  await snapshot(deps, saved, user.email, at);
  return saved;
}

/**
 * The first save of an existing post: the only way a working copy of one comes to exist. Returns null when the fields
 * match main, having written nothing. A conflict leaves the typed text in the browser, because the error says so
 * and the page keeps the form.
 */
export async function startEdit(slug: string, build: (current: PostContent) => PostContent, baseSha: string | null, user: AdminUser, deps = defaultDeps()): Promise<Submission | null> {
  checkedSlug(slug);
  await refuseIfTrashed(slug, deps);
  const active = await activeFor(deps, slug);
  if (active) throw new PublicError('Someone already has changes in progress on this post. Open their copy; your text is still in this page.', 409, { submissionId: active.id });
  const file = await deps.repo.readPost(slug);
  if (!file) throw new PublicError('There is no post with that slug.', 404);
  if (deps.repo.mode === 'github' && file.sha !== baseSha) throw new PublicError('This post changed on main after you opened it. Your text is still in this page; reload in a new tab to compare.', 409, { stale: true, currentSha: file.sha });
  const current = parsePost(file.raw);
  const content = keepApprovalFields(build(current), current);
  assertSize(content);
  if (sameEdit(content, current)) return null;
  const sub = fresh(slug, 'edit', content, file.sha, user, deps.now(), String(current.frontmatter.status ?? 'draft'));
  try {
    await deps.store.putSubmission(sub);
  } catch (error) {
    if (error instanceof ActiveSlugError) {
      const winner = await activeFor(deps, slug);
      throw new PublicError('Someone started changes on this post a moment ago. Your text is still in this page.', 409, winner ? { submissionId: winner.id } : {});
    }
    throw error;
  }
  await snapshot(deps, sub, user.email, sub.updatedAt);
  return sub;
}

/** For an explicit act on a post with no copy (submit a Git draft, rename). Never reached by viewing. */
async function ensureCopy(slug: string, user: AdminUser, deps: Deps): Promise<Submission> {
  const active = await activeFor(deps, slug);
  if (active) return active;
  const file = await deps.repo.readPost(slug);
  if (!file) throw new PublicError('There is no post with that slug.', 404);
  const current = parsePost(file.raw);
  const sub = fresh(slug, 'edit', current, file.sha, user, deps.now(), String(current.frontmatter.status ?? 'draft'));
  await write(deps, sub, undefined);
  return sub;
}

/** Main moved under this post. Found here so the editor learns before an approver spends time on it. */
async function assertBaseCurrent(sub: Submission, main: { raw: string; sha: string | null } | null, deps: Deps): Promise<void> {
  if (sub.kind === 'new' && main) throw new PublicError('A post with this slug now exists on main. Discard this copy and open that post instead.', 409);
  if (sub.kind === 'edit' && deps.repo.mode === 'github' && (main?.sha ?? null) !== sub.baseSha) {
    throw new PublicError('This post changed on main after you started editing. Compare the two versions and choose what to keep.', 409, { stale: true });
  }
}

export async function submitForApproval(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'changes_requested'], 'submit');
  await refuseIfTrashed(sub.slug, deps);
  const content: PostContent = { frontmatter: { ...withPostDefaults(sub.content.frontmatter, deps.now().toISOString().slice(0, 10)), status: 'review' }, body: sub.content.body };
  assertSize(content);
  const main = await deps.repo.readPost(sub.slug);
  // An untouched live post must not earn a new date and editorial pass. A Git draft may go forward as it stands.
  if (sub.kind === 'edit' && sub.sourceStatus === 'published' && !sub.renameTo && main && sameEdit(sub.content, parsePost(main.raw))) {
    throw new PublicError('Nothing has changed from the live version, so there is nothing to submit.', 422);
  }
  const target = sub.renameTo ?? sub.slug;
  const rules = await rulesForPublish(target, deps);
  const errors = errorsIn(await gateChecks(sub, content, deps, rules));
  if (errors.length) throw new PublicError(`Fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before submitting.`, 422, { checks: errors });
  const conflict = slugConflict(target, rules, sub.kind === 'edit' && !sub.renameTo);
  if (conflict) throw new PublicError(conflict, 409);
  await assertBaseCurrent(sub, main, deps);
  // Branch first: if the store write fails the post stays a draft, and the next try reuses the branch.
  const previewBranch = await deps.repo.writePreview(sub.slug, serializePost(content), sub.id);
  const hash = hashContent(content);
  const at = stamp(sub, deps.now());
  return write(deps, { ...sub, state: 'pending', content, contentHash: hash, submittedHash: hash, previewBranch, history: withEvent(sub, user.email, 'submitted', at), updatedAt: at }, sub.updatedAt);
}

export async function withdraw(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['pending'], 'withdraw');
  assertUnlocked(sub, deps.now());
  await assertNotLive(sub, deps);
  const at = stamp(sub, deps.now());
  const { publishAttempt: _attempt, ...rest } = sub;
  const next = await write(deps, { ...rest, state: 'draft', submittedHash: null, previewBranch: null, history: withEvent(sub, user.email, 'withdrawn', at), updatedAt: at }, sub.updatedAt);
  if (sub.previewBranch) await deps.repo.deletePreview(sub.previewBranch).catch(() => console.error('[admin] preview branch not deleted'));
  return next;
}

/** Closes the working copy. The Git version, live or draft, is untouched. */
export async function discard(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'changes_requested'], 'discard');
  const at = stamp(sub, deps.now());
  const next = await write(deps, { ...sub, state: 'discarded', submittedHash: null, previewBranch: null, history: withEvent(sub, user.email, 'discarded', at), updatedAt: at }, sub.updatedAt);
  if (sub.previewBranch) await deps.repo.deletePreview(sub.previewBranch).catch(() => console.error('[admin] preview branch not deleted'));
  return next;
}

export async function restoreRevision(id: string, revisionId: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'changes_requested'], 'restore a version of');
  const revision = (await deps.store.listRevisions(id)).find((r) => r.id === revisionId);
  if (!revision) throw new PublicError('That version is no longer kept.', 404);
  const saved = await saveEdit(id, revision.content, user, sub.updatedAt, deps);
  return saved;
}

/** Both versions, field by field, when main moved under a working copy. null when there is nothing to reconcile. */
export async function baseConflict(sub: Submission, deps: Deps = defaultDeps()): Promise<{ mainSha: string | null; main: PostContent; fields: Array<{ field: string; label: string; mine: string; main: string }> } | null> {
  if (sub.kind !== 'edit' || deps.repo.mode !== 'github') return null;
  const file = await deps.repo.readPost(sub.slug);
  if (!file || file.sha === sub.baseSha) return null;
  const main = parsePost(file.raw);
  const show = (value: unknown) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : JSON.stringify(value));
  const keys = [...new Set([...Object.keys(main.frontmatter), ...Object.keys(sub.content.frontmatter)])].filter((k) => !STAMPS.has(k));
  const fields = keys
    .filter((k) => signature(sub.content.frontmatter[k]) !== signature(main.frontmatter[k]))
    .map((k) => ({ field: k, label: fieldLabel(k), mine: show(sub.content.frontmatter[k]), main: show(main.frontmatter[k]) }));
  if (signature(sub.content.body) !== signature(main.body)) fields.push({ field: 'body', label: 'Body', mine: sub.content.body, main: main.body });
  return { mainSha: file.sha, main, fields };
}

/** The editor chooses per field; anything not chosen stays theirs. Moves the copy's base to main's current version. */
export async function rebase(id: string, useMain: string[], user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'changes_requested'], 'update');
  const conflict = await baseConflict(sub, deps);
  if (!conflict) return sub;
  const frontmatter: Record<string, unknown> = { ...sub.content.frontmatter };
  for (const key of useMain) {
    if (key === 'body' || STAMPS.has(key)) continue;
    if (conflict.main.frontmatter[key] === undefined) delete frontmatter[key];
    else frontmatter[key] = conflict.main.frontmatter[key];
  }
  const content: PostContent = { frontmatter, body: useMain.includes('body') ? conflict.main.body : sub.content.body };
  const at = stamp(sub, deps.now());
  const saved = await write(deps, {
    ...sub, content, contentHash: hashContent(content), baseSha: conflict.mainSha, submittedHash: null, updatedAt: at,
    sourceStatus: String(conflict.main.frontmatter.status ?? 'draft'), history: withEvent(sub, user.email, 'rebased', at),
  }, sub.updatedAt);
  await snapshot(deps, saved, user.email, at);
  return saved;
}

/* ---------- The one gate to main ---------- */

const ruleError = (problems: string[]) => new PlanRefusedError(`This would fail the site build: ${problems[0]}`);

/** A refused plan: nothing was committed, and the reason is safe to show. */
export class PlanRefusedError extends RepoConflictError {
  constructor(message: string) {
    super(message);
    this.name = 'PlanRefusedError';
  }
}

/**
 * The ONLY call of repo.commit in the codebase; a source test enforces it. Reached from approve, publishNow, the
 * schedule runner, unpublish and deletePost. Checks the resulting rule set against the same rules the build runs.
 */
async function commitPlan(deps: Deps, plan: CommitPlan, change: { offline?: string[]; online?: string[] }): Promise<string> {
  assertPlanPaths(plan);
  const main = await readMainRules(deps.repo);
  if (main) {
    const routes = await deps.routes();
    const offline = new Set((change.offline ?? []).map((s) => `/${s}/`));
    const pages = new Set(routes.pages.map((p) => p.path).filter((p) => !offline.has(p)));
    for (const slug of change.online ?? []) pages.add(`/${slug}/`);
    const yielding = new Set(routes.pages.filter((p) => p.status === 'draft' && !offline.has(p.path) && !(change.online ?? []).includes(p.postSlug ?? '')).map((p) => p.path));
    const after: MainRules = { ...main };
    const written = (file: string) => plan.writes.find((w) => w.path === file)?.content;
    const fromYaml = (raw: string, file: string) => ((parseYaml(raw) ?? []) as Array<Record<string, unknown>>).map((row) => ({ ...row, file }));
    const nextRedirects = written(ADMIN_REDIRECTS);
    const nextGone = written(ADMIN_GONE);
    if (nextRedirects !== undefined) after.redirects = [...main.redirects.filter((r) => r.file !== ADMIN_REDIRECTS), ...(fromYaml(nextRedirects, ADMIN_REDIRECTS) as MainRules['redirects'])];
    if (nextGone !== undefined) after.gone = [...main.gone.filter((g) => g.file !== ADMIN_GONE), ...(fromYaml(nextGone, ADMIN_GONE) as MainRules['gone'])];
    const problems = validateRules(main, after, { pages, yielding });
    if (problems.length) throw ruleError(problems);
  }
  return deps.repo.commit(plan);
}

/** Every write already on main and every deletion gone: a commit from an earlier try landed. */
async function planLanded(deps: Deps, plan: CommitPlan): Promise<boolean> {
  for (const write of plan.writes) if ((await deps.repo.readFile(write.path))?.raw !== write.content) return false;
  for (const path of plan.deletes) if (await deps.repo.readFile(path)) return false;
  return true;
}

export function hashPlan(plan: CommitPlan): string {
  return createHash('sha256').update(JSON.stringify({ writes: plan.writes, deletes: plan.deletes, expect: plan.expect })).digest('hex');
}

/** The deployed rules, with main's rule rows when available, minus the admin's own rows on this path: approving lifts those. */
async function rulesForPublish(target: string, deps: Deps): Promise<RouteRules> {
  const [deployed, main] = await Promise.all([deps.routes(), readMainRules(deps.repo)]);
  if (!main) return deployed;
  const { next } = planRules(main, { lift: [`/${target}/`] });
  return { ...deployed, redirects: next.redirects, gone: next.gone };
}

async function publishPlan(sub: Submission, content: PostContent, message: string, deps: Deps): Promise<CommitPlan> {
  const target = sub.renameTo ?? sub.slug;
  const plan: CommitPlan = { writes: [{ path: postPath(target), content: serializePost(content) }], deletes: [], expect: [], message };
  plan.expect.push({ path: postPath(sub.slug), sha: sub.kind === 'edit' ? sub.baseSha : null });
  const main = await readMainRules(deps.repo);
  if (sub.renameTo) {
    if (!main) throw new PublicError('The site rules could not be read, so this rename cannot go ahead.', 502);
    const files = await deps.repo.listFolder(sub.slug);
    if (files.some((f) => f !== postPath(sub.slug))) throw new PublicError('This post has other files beside it, which the admin cannot move yet. Ask a developer to rename it.', 409);
    plan.deletes.push(postPath(sub.slug));
    plan.expect.push({ path: postPath(target), sha: null });
  }
  if (main) {
    const edit = planRules(main, {
      lift: [`/${target}/`],
      ...(sub.renameTo ? { add: { path: `/${sub.slug}/`, choice: { kind: 'redirect' as const, to: `/${target}/` }, note: 'Slug renamed in the blog admin' }, retarget: { from: `/${sub.slug}/`, to: `/${target}/` } } : {}),
    });
    plan.writes.push(...edit.writes);
    plan.expect.push(...edit.expect);
  }
  return plan;
}

const postWrite = (plan: CommitPlan) => plan.writes.find((w) => /^src\/content\/posts\/[^/]+\/index\.mdx$/.test(w.path));

/* ---------- Approval ---------- */

export interface ApprovalInput {
  viewedHash: string;
  onlyUsCouldWrite: string;
  readsMachineWritten: string;
}

function publishedContent(sub: Submission, user: AdminUser, input: ApprovalInput, today: string): PostContent {
  return {
    frontmatter: {
      ...sub.content.frontmatter,
      status: 'published',
      lastUpdated: today,
      editorialPass: { by: user.name, on: today, onlyUsCouldWrite: input.onlyUsCouldWrite.trim(), readsMachineWritten: input.readsMachineWritten.trim() },
    },
    body: sub.content.body,
  };
}

/** Records the commit. Retries because the post is already live; the record must end up saying so. */
async function record(deps: Deps, claimed: Submission, plan: CommitPlan, by: string, at: string, commitSha?: string): Promise<Submission> {
  const content = parsePost(postWrite(plan)!.content);
  const { publishLockUntil: _lock, publishAttempt: _attempt, scheduled: _scheduled, renameTo: _rename, ...rest } = claimed;
  const slug = claimed.renameTo ?? claimed.slug;
  const next: Submission = {
    ...rest, slug, state: 'published', content, contentHash: hashContent(content), previewBranch: null, updatedAt: at, ...(commitSha ? { commitSha } : {}),
    history: [...claimed.history, { at, by, action: 'approved' as const }, ...(claimed.renameTo ? [{ at, by, action: 'renamed' as const, note: `/${claimed.slug}/ to /${slug}/` }] : []), { at, by, action: 'published' as const }],
  };
  let recorded = false;
  let expected = claimed.updatedAt;
  for (let tries = 0; tries < RECORD_TRIES && !recorded; tries++) {
    try {
      await deps.store.putSubmission(next, expected);
      recorded = true;
    } catch (error) {
      if (error instanceof StaleWriteError) {
        const current = await deps.store.getSubmission(claimed.id).catch(() => null);
        if (current?.state === 'published') return current;
        if (current) expected = current.updatedAt;
      }
    }
  }
  if (!recorded) throw new PublicError('The post is live, but the admin could not record that. Press approve again to record it; it will not publish twice.', 502);
  if (claimed.previewBranch) await deps.repo.deletePreview(claimed.previewBranch).catch(() => console.error('[admin] preview branch not deleted'));
  await settleFlags(deps, slug, claimed.renameTo ? claimed.slug : null, by, at).catch(() => console.error('[admin] post flags not updated'));
  return next;
}

/** Live again: no longer unpublished or removed. A renamed post's old slug is now removed. */
async function settleFlags(deps: Deps, slug: string, oldSlug: string | null, by: string, at: string): Promise<void> {
  if (await deps.store.getFlag(slug)) await deps.store.deleteFlag(slug);
  if (oldSlug) await deps.store.putFlag({ id: oldSlug, updatedAt: at, removed: { at, by, renamedTo: slug } });
}

function assertAnswers(input: ApprovalInput): void {
  if ((input.onlyUsCouldWrite ?? '').trim().length < 10 || (input.readsMachineWritten ?? '').trim().length < 2) {
    throw new PublicError('Please answer both editorial questions.', 400);
  }
}

async function assertPublishable(sub: Submission, content: PostContent, doing: string, deps: Deps): Promise<void> {
  const target = sub.renameTo ?? sub.slug;
  const rules = await rulesForPublish(target, deps);
  const errors = errorsIn(await gateChecks(sub, content, deps, rules));
  if (errors.length) throw new PublicError(`Fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before ${doing}.`, 422, { checks: errors });
  const conflict = slugConflict(target, rules, sub.kind === 'edit' && !sub.renameTo);
  if (conflict) throw new PublicError(conflict, 409);
}

export async function approve(id: string, user: AdminUser, input: ApprovalInput, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const sub = await load(deps, id);
  assertState(sub, ['pending'], 'approve');
  if (input.viewedHash !== sub.contentHash) throw new PublicError('This post changed after you opened it. Read it again before approving.', 409);
  assertAnswers(input);
  const now = deps.now();

  // A commit from an earlier try may have landed with the record lost: finish that, never commit twice.
  if (sub.publishAttempt && (await planLanded(deps, sub.publishAttempt.plan))) {
    return record(deps, sub, sub.publishAttempt.plan, sub.publishAttempt.by, stamp(sub, now));
  }
  assertUnlocked(sub, now);

  const content = publishedContent(sub, user, input, now.toISOString().slice(0, 10));
  await assertPublishable(sub, content, 'approving', deps);
  const plan = await publishPlan(sub, content, `Publish ${sub.renameTo ?? sub.slug} (approved by ${user.email})`, deps);
  const main = await deps.repo.readPost(sub.renameTo ?? sub.slug);
  const claimAt = stamp(sub, now);
  const claimed: Submission = {
    ...sub,
    publishLockUntil: new Date(now.getTime() + LOCK_MS).toISOString(),
    publishAttempt: { plan, by: user.email, at: claimAt },
    updatedAt: claimAt,
  };
  // The atomic step: of two approvers, exactly one passes.
  await write(deps, claimed, sub.updatedAt);

  let commitSha: string;
  try {
    if (sub.kind === 'new' && main) throw new RepoConflictError('A post with this slug now exists on main.');
    commitSha = await commitPlan(deps, plan, { online: [sub.renameTo ?? sub.slug], offline: sub.renameTo ? [sub.slug] : [] });
  } catch (error) {
    const safe = error instanceof RepoConflictError || error instanceof RepoRateLimitError ? error.message : 'GitHub did not accept the commit.';
    const at = stamp(claimed, deps.now());
    const { publishLockUntil: _lock, ...rest } = claimed;
    // Keeps publishAttempt: after a timeout the commit may still have landed, and the retry checks for it.
    await deps.store
      .putSubmission({ ...rest, history: withEvent(claimed, user.email, 'publish_failed', at, safe), updatedAt: at }, claimed.updatedAt)
      .catch(() => console.error('[admin] publish failure not recorded')); // The lock is a lease and expires by itself.
    throw new PublicError(`Not published: ${safe} The post is still waiting for approval.`, error instanceof RepoConflictError ? 409 : 502);
  }
  return record(deps, claimed, plan, user.email, stamp(claimed, deps.now()), commitSha);
}

/** A timed-out commit may be live already. Sending that post back would hide the fact. */
async function assertNotLive(sub: Submission, deps: Deps): Promise<void> {
  if (!sub.publishAttempt) return;
  if (await planLanded(deps, sub.publishAttempt.plan)) throw new PublicError('This post is already live. Press approve to record that.', 409);
}

export async function requestChanges(id: string, user: AdminUser, note: string, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const text = requireNote(note);
  const sub = await load(deps, id);
  assertState(sub, ['pending'], 'send back');
  assertUnlocked(sub, deps.now());
  await assertNotLive(sub, deps);
  const at = stamp(sub, deps.now());
  return write(deps, { ...sub, state: 'changes_requested', submittedHash: null, history: withEvent(sub, user.email, 'changes_requested', at, text), updatedAt: at }, sub.updatedAt);
}

export async function reject(id: string, user: AdminUser, note: string, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const text = requireNote(note);
  const sub = await load(deps, id);
  assertState(sub, ['draft', 'pending', 'changes_requested'], 'reject');
  assertUnlocked(sub, deps.now());
  await assertNotLive(sub, deps);
  const at = stamp(sub, deps.now());
  const next = await write(deps, { ...sub, state: 'rejected', submittedHash: null, previewBranch: null, history: withEvent(sub, user.email, 'rejected', at, text), updatedAt: at }, sub.updatedAt);
  if (sub.previewBranch) await deps.repo.deletePreview(sub.previewBranch).catch(() => console.error('[admin] preview branch not deleted'));
  return next;
}

export async function reopen(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const sub = await load(deps, id);
  assertState(sub, ['rejected', 'changes_requested'], 'reopen');
  if (sub.state === 'rejected' && (await activeFor(deps, sub.slug))) throw new PublicError('Someone is already working on this slug.', 409);
  const at = stamp(sub, deps.now());
  const { publishAttempt: _attempt, publishLockUntil: _lock, ...rest } = sub;
  return write(deps, { ...rest, state: 'draft', submittedHash: null, history: withEvent(sub, user.email, 'reopened', at), updatedAt: at }, sub.updatedAt);
}

/* ---------- Scheduling ---------- */

/** Approves for a time: the exact file is computed now and frozen with its hash. Nothing is committed. */
export async function schedule(id: string, user: AdminUser, input: ApprovalInput & { at: string }, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const sub = await load(deps, id);
  assertState(sub, ['pending'], 'schedule');
  if (input.viewedHash !== sub.contentHash) throw new PublicError('This post changed after you opened it. Read it again before approving.', 409);
  assertAnswers(input);
  const now = deps.now();
  assertUnlocked(sub, now);
  await assertNotLive(sub, deps);
  const when = new Date(input.at);
  if (!input.at || Number.isNaN(when.getTime())) throw new PublicError('Please pick a date and time.', 400);
  if (when <= now) throw new PublicError('That time has passed. Pick a later one, or approve and publish now.', 400);
  if (when.getTime() - now.getTime() > MAX_SCHEDULE_MS) throw new PublicError('Pick a time within the next year.', 400);
  const at = when.toISOString();
  const content = publishedContent(sub, user, input, at.slice(0, 10));
  await assertPublishable(sub, content, 'scheduling', deps);
  const plan = await publishPlan(sub, content, `Publish ${sub.renameTo ?? sub.slug} (scheduled, approved by ${user.email})`, deps);
  const stampAt = stamp(sub, now);
  const { publishAttempt: _attempt, ...rest } = sub;
  return write(deps, {
    ...rest, state: 'scheduled', updatedAt: stampAt,
    scheduled: { at, plan, planHash: hashPlan(plan), reviewedHash: sub.contentHash, approvedBy: user.email, approvedAt: stampAt },
    history: withEvent(sub, user.email, 'scheduled', stampAt, formatIst(at)),
  }, sub.updatedAt);
}

/** Back to review, voiding the frozen approval. */
export async function unschedule(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const sub = await load(deps, id);
  assertState(sub, ['scheduled'], 'unschedule');
  assertUnlocked(sub, deps.now());
  const at = stamp(sub, deps.now());
  const { scheduled: _scheduled, publishAttempt: _attempt, ...rest } = sub;
  return write(deps, { ...rest, state: 'pending', updatedAt: at, history: withEvent(sub, user.email, 'schedule_cancelled', at) }, sub.updatedAt);
}

type FireOutcome = { outcome: 'published' | 'failed' | 'skipped'; message: string; sub: Submission };

/** Holds no approval of its own: it only executes one frozen by schedule(). Any doubt voids it, back to review. */
async function fire(sub: Submission, by: string, manual: boolean, deps: Deps): Promise<FireOutcome> {
  const frozen = sub.scheduled!;
  const now = deps.now();
  if (sub.publishLockUntil && new Date(sub.publishLockUntil) > now) return { outcome: 'skipped', message: 'Already being published.', sub };
  const fail = async (from: Submission, reason: string): Promise<FireOutcome> => {
    const at = stamp(from, deps.now());
    const { scheduled: _scheduled, publishLockUntil: _lock, ...rest } = from;
    const next: Submission = { ...rest, state: 'pending', updatedAt: at, history: withEvent(from, by, 'schedule_failed', at, reason) };
    await deps.store.putSubmission(next, from.updatedAt);
    return { outcome: 'failed', message: reason, sub: next };
  };
  if (sub.publishAttempt && (await planLanded(deps, sub.publishAttempt.plan))) {
    return { outcome: 'published', message: 'Recorded a commit that had already landed.', sub: await record(deps, sub, sub.publishAttempt.plan, sub.publishAttempt.by, stamp(sub, now)) };
  }
  const file = postWrite(frozen.plan);
  if (!file || hashPlan(frozen.plan) !== frozen.planHash || sub.contentHash !== frozen.reviewedHash) return fail(sub, 'The frozen approval no longer matches this post.');
  const content = parsePost(file.content);
  if (content.body !== sub.content.body) return fail(sub, 'The frozen approval no longer matches this post.');
  if (deps.stillApprover && !deps.stillApprover(frozen.approvedBy)) return fail(sub, 'The approver who scheduled this no longer has approval rights.');
  if (!manual && now.getTime() - new Date(frozen.at).getTime() > MAX_OVERDUE_MS) return fail(sub, 'This was more than 7 days overdue, so it needs a fresh approval.');
  try {
    await assertPublishable(sub, content, 'publishing', deps);
  } catch (error) {
    if (error instanceof PublicError) return fail(sub, error.message);
    throw error;
  }
  const claimAt = stamp(sub, now);
  const claimed: Submission = { ...sub, publishLockUntil: new Date(now.getTime() + LOCK_MS).toISOString(), publishAttempt: { plan: frozen.plan, by, at: claimAt }, updatedAt: claimAt };
  try {
    await deps.store.putSubmission(claimed, sub.updatedAt);
  } catch (error) {
    if (error instanceof StaleWriteError) return { outcome: 'skipped', message: 'Another run took this one.', sub };
    throw error;
  }
  const target = sub.renameTo ?? sub.slug;
  let commitSha: string;
  try {
    commitSha = await commitPlan(deps, frozen.plan, { online: [target], offline: sub.renameTo ? [sub.slug] : [] });
  } catch (error) {
    if (error instanceof RepoRateLimitError) {
      // Still approved, still due: the next run tries again.
      const at = stamp(claimed, deps.now());
      const { publishLockUntil: _lock, publishAttempt: _attempt, ...rest } = claimed;
      await deps.store.putSubmission({ ...rest, updatedAt: at }, claimed.updatedAt).catch(() => console.error('[admin] schedule lease not released'));
      throw error;
    }
    return fail(claimed, error instanceof RepoConflictError ? error.message : 'GitHub did not accept the commit.');
  }
  return { outcome: 'published', message: 'Published.', sub: await record(deps, claimed, frozen.plan, by, stamp(claimed, deps.now()), commitSha) };
}

/** For a post whose time has come, when the job has not run yet. */
export async function publishNow(id: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  requireApproverRole(user);
  const sub = await load(deps, id);
  assertState(sub, ['scheduled'], 'publish');
  if (new Date(sub.scheduled!.at) > deps.now()) throw new PublicError('This post is not due yet. Unschedule it and approve it to publish today.', 409);
  let result: FireOutcome;
  try {
    result = await fire(sub, user.email, true, deps);
  } catch (error) {
    if (error instanceof RepoRateLimitError) throw new PublicError(`Not published: ${error.message}`, 502);
    throw error;
  }
  if (result.outcome === 'failed') throw new PublicError(`Not published: ${result.message} The post is back in review.`, 409);
  if (result.outcome === 'skipped') throw new PublicError(result.message, 409);
  return result.sub;
}

/**
 * Publish everything due. Delivery is best effort with possible duplicates, so this reconciles rather than trusts a
 * single firing; the claim in fire() makes a second concurrent run skip. At most MAX_PER_RUN, in sequence, because
 * each commit moves main. A rate limit stops the run and leaves the rest due.
 */
export async function runDueSchedules(deps: Deps = defaultDeps()): Promise<ScheduleRun> {
  const now = deps.now();
  const results: ScheduleRun['results'] = [];
  const due = await deps.store.listDue(now);
  for (const [index, sub] of due.entries()) {
    if (index >= MAX_PER_RUN) {
      results.push({ submissionId: sub.id, slug: sub.slug, outcome: 'postponed', message: 'Left for the next run.' });
      continue;
    }
    try {
      const { outcome, message } = await fire(sub, 'schedule', false, deps);
      results.push({ submissionId: sub.id, slug: sub.slug, outcome, message });
    } catch (error) {
      if (error instanceof RepoRateLimitError) {
        results.push({ submissionId: sub.id, slug: sub.slug, outcome: 'postponed', message: error.message });
        break;
      }
      console.error('[admin] scheduled publish failed', error instanceof Error ? error.name : 'unknown');
      results.push({ submissionId: sub.id, slug: sub.slug, outcome: 'failed', message: 'Unexpected error; it stays scheduled and the next run tries again.' });
    }
  }
  await purgeExpiredTrash(deps, now).catch(() => console.error('[admin] trash not purged'));
  const run: ScheduleRun = { id: results.length ? randomUUID() : 'latest-empty', updatedAt: now.toISOString(), results };
  await deps.store.putScheduleRun(run).catch(() => console.error('[admin] schedule run not recorded'));
  return run;
}

/* ---------- Lifecycle: unpublish, trash, restore, delete, rename, duplicate ---------- */

function routeChoice(mode: unknown, target: unknown, slug: string): RouteChoice {
  if (mode === 'gone') return { kind: 'gone' };
  if (mode !== 'redirect') throw new PublicError('Choose what the old address should do: gone, or redirect.', 400);
  const to = typeof target === 'string' ? target.trim() : '';
  if (!/^(\/(?![/\\])[^\s]*|https:\/\/[^\s]+)$/.test(to)) throw new PublicError('Enter the address to redirect to, starting with / or https://.', 400);
  if (!isExternal(to) && normalizePath(to) === `/${slug}/`) throw new PublicError('A post cannot redirect to itself.', 400);
  return { kind: 'redirect', to };
}

/** Rules that would start pointing at nothing. Admin rows move with a redirect; anyone else's stop the action. */
function refuseOrphans(rules: MainRules, slug: string, choice: RouteChoice | null): RuleEdit['retarget'] {
  const path = `/${slug}/`;
  const fixed = inboundFixed(rules, path);
  if (fixed.length) throw new PublicError(`${fixed[0].from} redirects here from ${fixed[0].file}. A developer must change that row first.`, 409);
  const own = inboundAdmin(rules, path);
  if (!own.length) return undefined;
  if (choice?.kind !== 'redirect') throw new PublicError(`${own.length} earlier redirect${own.length === 1 ? ' points' : 's point'} here. Choose a redirect so they keep working.`, 409);
  return { from: path, to: choice.to };
}

export async function unpublish(slug: string, user: AdminUser, input: { mode?: unknown; target?: unknown }, deps = defaultDeps()): Promise<void> {
  requireApproverRole(user);
  const status = await postStatus(slug, user.role, deps);
  assertAllowed(status, 'unpublish');
  const choice = routeChoice(input.mode, input.target, slug);
  const main = await readMainRules(deps.repo);
  if (!main) throw new PublicError('The site rules could not be read, so this cannot go ahead.', 502);
  const retarget = refuseOrphans(main, slug, choice);
  const current = parsePost(status.file!.raw);
  const edit = planRules(main, { add: { path: `/${slug}/`, choice, note: `Unpublished in the blog admin by ${user.email}` }, retarget });
  const plan: CommitPlan = {
    writes: [{ path: postPath(slug), content: serializePost({ frontmatter: { ...current.frontmatter, status: 'draft' }, body: current.body }) }, ...edit.writes],
    deletes: [],
    expect: [{ path: postPath(slug), sha: status.file!.sha }, ...edit.expect],
    message: `Unpublish ${slug} (by ${user.email})`,
  };
  await commitOrExplain(deps, plan, { offline: [slug] }, 'unpublished');
  const at = deps.now().toISOString();
  await deps.store.putFlag({ id: slug, updatedAt: at, unpublished: { at, by: user.email } });
  await noteOnActive(status.active, user.email, 'unpublished', deps);
}

async function commitOrExplain(deps: Deps, plan: CommitPlan, change: Parameters<typeof commitPlan>[2], doing: string): Promise<string> {
  try {
    return await commitPlan(deps, plan, change);
  } catch (error) {
    if (error instanceof RepoConflictError) throw new PublicError(`Not ${doing}: ${error.message}`, 409);
    if (error instanceof RepoRateLimitError) throw new PublicError(`Not ${doing}: ${error.message}`, 502);
    console.error('[admin] commit failed', error instanceof Error ? error.name : 'unknown');
    throw new PublicError(`Not ${doing}: GitHub did not accept the commit. Refresh to see the current state before retrying.`, 502);
  }
}

async function noteOnActive(active: Submission | null, by: string, action: HistoryAction, deps: Deps): Promise<void> {
  if (!active) return;
  const at = stamp(active, deps.now());
  await deps.store.putSubmission({ ...active, updatedAt: at, history: withEvent(active, by, action, at) }, active.updatedAt).catch(() => console.error('[admin] history not updated'));
}

/** Store flag only. A live post has to be unpublished first, so its address has an answer before it can be thrown away. */
export async function trash(slug: string, user: AdminUser, deps = defaultDeps()): Promise<void> {
  const status = await postStatus(slug, user.role, deps);
  if (status.site === 'live' && !status.trashed) throw new PublicError('A published post must be unpublished before it can go in the trash.', 409);
  assertAllowed(status, 'trash');
  const at = deps.now().toISOString();
  await deps.store.putFlag({ ...(status.flag ?? { id: slug }), updatedAt: at, trashed: { at, by: user.email } });
  await noteOnActive(status.active, user.email, 'trashed', deps);
}

/** Never goes live: a draft stays a draft, and an unpublished post can return only through review. */
export async function restore(slug: string, user: AdminUser, deps = defaultDeps()): Promise<void> {
  const status = await postStatus(slug, user.role, deps);
  if (!status.trashed) throw new PublicError('This post is not in the trash.', 409);
  assertAllowed(status, 'restore');
  const { trashed: _trashed, ...flag } = status.flag!;
  if (flag.unpublished || flag.removed) await deps.store.putFlag({ ...flag, updatedAt: deps.now().toISOString() });
  else await deps.store.deleteFlag(slug);
  await noteOnActive(status.active, user.email, 'restored', deps);
}

async function hasManifestRow(slug: string, deps: Deps): Promise<boolean> {
  const manifest = await deps.repo.readFile('migration/posts-manifest.csv').catch(() => null);
  return Boolean(manifest?.raw.split(/\r?\n/).some((line) => line.startsWith(`/${slug}/,`)));
}

/** Permanent. A file on main goes in one commit with its rule; a post only in the store simply goes. Git keeps history. */
export async function deletePost(slug: string, user: AdminUser, input: { confirm: unknown; mode?: unknown; target?: unknown }, deps = defaultDeps()): Promise<void> {
  requireApproverRole(user);
  const status = await postStatus(slug, user.role, deps);
  if (!status.trashed) throw new PublicError('Move this post to the trash first.', 409);
  assertAllowed(status, 'delete');
  if (input.confirm !== slug) throw new PublicError('Type the post address exactly to confirm.', 400);
  await deleteConfirmed(status, user.email, input, deps);
}

async function deleteConfirmed(status: PostStatus, by: string, input: { mode?: unknown; target?: unknown }, deps: Deps): Promise<void> {
  const { slug } = status;
  const at = deps.now().toISOString();
  const subs = (await deps.store.listSubmissions()).filter((s) => s.slug === slug);
  if (!status.file) {
    for (const s of subs) {
      for (const revision of await deps.store.listRevisions(s.id)) await deps.store.deleteRevision(revision.id);
      await deps.store.deleteSubmission(s.id);
    }
    await deps.store.deleteFlag(slug);
    return;
  }
  const main = await readMainRules(deps.repo);
  if (!main) throw new PublicError('The site rules could not be read, so this cannot go ahead.', 502);
  const covered = exactRuleAt(main, `/${slug}/`);
  // The imported drafts still carry live WordPress addresses, and a live-then-offline post has been indexed.
  const needsRule = !covered && (status.site === 'unpublished' || (await hasManifestRow(slug, deps)));
  const choice = input.mode ? routeChoice(input.mode, input.target, slug) : null;
  if (needsRule && !choice) throw new PublicError('This address was public. Choose what it should do now: gone, or redirect.', 400);
  const retarget = refuseOrphans(main, slug, choice);
  const edit = planRules(main, { ...(choice ? { add: { path: `/${slug}/`, choice, note: `Deleted in the blog admin by ${by}` } } : {}), retarget });
  const deletes = await deps.repo.listFolder(slug);
  if (!deletes.includes(postPath(slug))) deletes.push(postPath(slug));
  const plan: CommitPlan = { writes: edit.writes, deletes, expect: [{ path: postPath(slug), sha: status.file.sha }, ...edit.expect], message: `Delete ${slug} (by ${by})` };
  await commitOrExplain(deps, plan, { offline: [slug] }, 'deleted');
  await deps.store.putFlag({ id: slug, updatedAt: at, removed: { at, by } });
  for (const s of subs.filter((x) => isActive(x.state))) {
    const when = stamp(s, deps.now());
    await write(deps, { ...s, state: 'discarded', updatedAt: when, history: withEvent(s, by, 'deleted', when) }, s.updatedAt);
  }
}

export const EMPTY_TRASH_CONFIRM = 'empty trash';

/** Sequential, because each commit moves main. A row needing a rule choice stays in the trash and says so. */
export async function emptyTrash(user: AdminUser, confirm: unknown, deps = defaultDeps()): Promise<BulkRowResult[]> {
  requireApproverRole(user);
  if (confirm !== EMPTY_TRASH_CONFIRM) throw new PublicError(`Type "${EMPTY_TRASH_CONFIRM}" to confirm.`, 400);
  const flagged = (await deps.store.listFlags()).filter((f) => f.trashed).slice(0, BULK_CAP);
  const results: BulkRowResult[] = [];
  for (const flag of flagged) {
    results.push(await rowResult(flag.id, async () => {
      await deleteConfirmed(await postStatus(flag.id, user.role, deps), user.email, {}, deps);
      return 'Deleted.';
    }));
  }
  return results;
}

/** Only posts that were never in Git: deleting a Git file needs a commit, which always needs a person. */
async function purgeExpiredTrash(deps: Deps, now: Date): Promise<void> {
  for (const flag of await deps.store.listFlags()) {
    if (!flag.trashed || now.getTime() - new Date(flag.trashed.at).getTime() < TRASH_DAYS * 86_400_000) continue;
    const status = await postStatus(flag.id, 'approver', deps);
    if (!status.file) await deleteConfirmed(status, 'trash-expiry', {}, deps);
  }
}

/** A slug change. Never commits here: a post on main goes through review, and approval commits it with its redirect. */
export async function renamePost(slug: string, newSlug: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  checkedSlug(newSlug);
  const status = await postStatus(slug, user.role, deps);
  assertAllowed(status, 'rename');
  const back = status.active?.renameTo && newSlug === slug;
  if (newSlug === slug && !back) throw new PublicError('That is already the address.', 400);
  if (!back) {
    const rules = await rulesForPublish(newSlug, deps);
    const conflict = slugConflict(newSlug, rules, false);
    if (conflict) throw new PublicError(conflict, 409);
    const main = await readMainRules(deps.repo);
    const blocking = main && blockingRule(main, `/${newSlug}/`);
    if (blocking) throw new PublicError(`/${newSlug}/ is held by a rule in ${blocking}. A developer must change that row first.`, 409);
    if (await deps.repo.readPost(newSlug)) throw new PublicError('A post with that address already exists.', 409);
    if (await activeFor(deps, newSlug)) throw new PublicError('Someone is already working on a post with that address.', 409);
  }
  const copy = status.active ?? (status.file ? await ensureCopy(slug, user, deps) : null);
  if (!copy) throw new PublicError('There is no post with that slug.', 404);
  const at = stamp(copy, deps.now());
  const note = `/${slug}/ to /${newSlug}/`;
  if (copy.kind === 'new') return write(deps, { ...copy, slug: newSlug, updatedAt: at, history: withEvent(copy, user.email, 'renamed', at, note) }, copy.updatedAt);
  const { renameTo: _rename, ...rest } = copy;
  return write(deps, { ...rest, ...(back ? {} : { renameTo: newSlug }), submittedHash: null, updatedAt: at, history: withEvent(copy, user.email, 'renamed', at, back ? 'Rename cancelled' : note) }, copy.updatedAt);
}

/** A new draft from the working copy or main. The build refuses a shared head keyword, and a pass applies only to what was read. */
export async function duplicatePost(slug: string, user: AdminUser, deps = defaultDeps()): Promise<Submission> {
  const status = await postStatus(slug, user.role, deps);
  assertAllowed(status, 'duplicate');
  const source = status.active?.content ?? (status.file ? parsePost(status.file.raw) : null);
  if (!source) throw new PublicError('There is no post with that slug.', 404);
  const routes = await deps.routes();
  let candidate = `${slug}-copy`.slice(0, 118);
  for (let n = 2; slugConflict(candidate, routes, false) || (await deps.repo.readPost(candidate)) || (await activeFor(deps, candidate)); n++) {
    if (n > 50) throw new PublicError('Could not find a free address for the copy.', 409);
    candidate = `${slug}-copy-${n}`.slice(0, 118);
  }
  const { editorialPass: _pass, headKeyword: _keyword, ...frontmatter } = source.frontmatter;
  const content: PostContent = { frontmatter: { ...frontmatter, status: 'draft' }, body: source.body };
  // Keeps the job: an AI post stays held to its evidence.
  const sub: Submission = { ...fresh(candidate, 'new', content, null, user, deps.now()), jobId: status.active?.jobId ?? null };
  await write(deps, sub, undefined);
  return sub;
}

/* ---------- The one lifecycle entry point and bulk ---------- */

export interface LifecycleInput {
  slug: string;
  op: string;
  mode?: unknown;
  target?: unknown;
  confirm?: unknown;
  newSlug?: unknown;
}

export async function lifecycle(input: LifecycleInput, user: AdminUser, deps = defaultDeps()): Promise<{ message: string; submission?: Submission }> {
  checkedSlug(input.slug);
  switch (input.op) {
    case 'unpublish':
      await unpublish(input.slug, user, input, deps);
      return { message: 'Unpublished. The site updates after the next build.' };
    case 'trash':
      await trash(input.slug, user, deps);
      return { message: 'Moved to the trash.' };
    case 'restore':
      await restore(input.slug, user, deps);
      return { message: 'Restored. It is not live.' };
    case 'delete':
      await deletePost(input.slug, user, { confirm: input.confirm, mode: input.mode, target: input.target }, deps);
      return { message: 'Deleted permanently.' };
    case 'rename':
      return { message: 'Address change saved. It takes effect when approved.', submission: await renamePost(input.slug, String(input.newSlug ?? '').trim(), user, deps) };
    case 'duplicate':
      return { message: 'Duplicated as a new draft.', submission: await duplicatePost(input.slug, user, deps) };
    default:
      throw new PublicError('Unknown action.', 400);
  }
}

async function rowResult(slug: string, task: () => Promise<string>): Promise<BulkRowResult> {
  try {
    return { slug, ok: true, message: await task() };
  } catch (error) {
    if (error instanceof PublicError) return { slug, ok: false, message: error.message };
    console.error('[admin] bulk row failed', error instanceof Error ? error.name : 'unknown');
    return { slug, ok: false, message: 'Something went wrong with this one.' };
  }
}

/** Sets one frontmatter field, through the same save path as the editor. */
async function setField(slug: string, field: 'author' | 'topic', value: string, user: AdminUser, deps: Deps): Promise<string> {
  const status = await postStatus(slug, user.role, deps);
  assertAllowed(status, 'save');
  const change = (content: PostContent): PostContent => ({ frontmatter: { ...content.frontmatter, [field]: value }, body: content.body });
  if (status.active) {
    const saved = await saveEdit(status.active.id, change(status.active.content), user, status.active.updatedAt, deps);
    return saved.updatedAt === status.active.updatedAt ? 'No changes.' : 'Saved to the working copy.';
  }
  const made = await startEdit(slug, change, status.file?.sha ?? null, user, deps);
  return made ? 'Working copy created. Submit it to take effect.' : 'No changes.';
}

export const BULK_OPS = ['trash', 'restore', 'duplicate', 'submit', 'assign-author', 'set-topic'] as const;

/** Per-row results, one bad row stops nothing. There is no publish path here, on purpose: approval needs a person reading each post. */
export async function bulk(op: string, slugs: string[], fields: { author?: string; topic?: string }, user: AdminUser, deps = defaultDeps()): Promise<BulkRowResult[]> {
  if (!(BULK_OPS as readonly string[]).includes(op)) throw new PublicError('That cannot be done in bulk.', 400);
  const unique = [...new Set(slugs)];
  if (!unique.length) throw new PublicError('Select at least one post.', 400);
  if (unique.length > BULK_CAP) throw new PublicError(`Select at most ${BULK_CAP} posts at a time.`, 400);
  if (op === 'assign-author' && !fields.author?.trim()) throw new PublicError('Choose an author.', 400);
  if (op === 'set-topic' && !fields.topic?.trim()) throw new PublicError('Choose a topic.', 400);
  const results: BulkRowResult[] = [];
  for (const slug of unique) {
    results.push(await rowResult(slug, async () => {
      checkedSlug(slug);
      switch (op) {
        case 'trash':
          await trash(slug, user, deps);
          return 'Moved to the trash.';
        case 'restore':
          await restore(slug, user, deps);
          return 'Restored. It is not live.';
        case 'duplicate':
          return `Duplicated as /${(await duplicatePost(slug, user, deps)).slug}/.`;
        case 'submit': {
          const status = await postStatus(slug, user.role, deps);
          assertAllowed(status, 'submit');
          await submitForApproval((status.active ?? (await ensureCopy(slug, user, deps))).id, user, deps);
          return 'Submitted for approval.';
        }
        case 'assign-author':
          return setField(slug, 'author', fields.author!.trim(), user, deps);
        default:
          return setField(slug, 'topic', fields.topic!.trim(), user, deps);
      }
    }));
  }
  return results;
}
