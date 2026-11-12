/**
 * Redirects made in the admin: listing every rule, adding and removing the admin's own rows in
 * src/data/redirects-admin.yaml. Each change is checked with the same rule resolver the build runs
 * (routing-edit.ts validateRules), so a bad row is refused here instead of failing a deploy.
 * The hand-written files are shown read-only.
 */
import { stringify } from 'yaml';
import { isExternal, normalizePath, type RedirectRule } from '../../../integrations/routes-core.ts';
import { env } from './env.ts';
import { PublicError } from './http.ts';
import { ADMIN_REDIRECTS, readMainRules, validateRules, type MainRules } from './routing-edit.ts';
import type { AdminUser, BlogRecent, ContentRepo, Store } from './types.ts';
import type { RouteRules } from './workflow.ts';

export type RedirectStatus = 301 | 302 | 307 | 308;

export interface RedirectRow {
  from: string;
  to: string;
  status: RedirectStatus;
  match: 'exact' | 'prefix' | 'children';
  note: string;
  /** Made in the admin, so it can be removed here. */
  editable: boolean;
}

export interface RedirectSuggestion {
  path: string;
  title: string;
  why: 'deleted' | 'unpublished';
  at: string;
}

export interface RedirectDeps {
  repo: ContentRepo;
  store: Store;
  routes: () => Promise<RouteRules>;
  now: () => Date;
}

const HEADER = '# Machine-owned: the blog admin commits this file. Do not edit by hand. Rules: src/lib/admin/routing-edit.ts.\n';
const STATUSES: RedirectStatus[] = [301, 302, 307, 308];

async function rules(deps: RedirectDeps): Promise<MainRules> {
  const main = await readMainRules(deps.repo);
  if (!main) throw new PublicError('The redirect rules could not be read from the content store.', 503);
  return main;
}

export async function listRedirects(deps: RedirectDeps): Promise<{ rows: RedirectRow[]; suggestions: RedirectSuggestion[] }> {
  const main = await rules(deps);
  const rows: RedirectRow[] = main.redirects.map((r) => ({
    from: r.from,
    to: r.to,
    status: (r.status ?? 301) as RedirectStatus,
    match: r.match ?? 'exact',
    note: r.note ?? '',
    editable: r.file === ADMIN_REDIRECTS,
  }));
  // Posts taken off the site or deleted lately with no rule yet: their old links now 404.
  const covered = (path: string) => main.redirects.some((r) => normalizePath(r.from) === path) || main.gone.some((g) => normalizePath(g.path) === path);
  let recent: BlogRecent[] = [];
  try {
    recent = await deps.store.listDocs<BlogRecent>('recent');
  } catch {
    recent = [];
  }
  const suggestions = recent
    .filter((r) => r.state === 'deleted' || r.state === 'draft')
    .map((r) => ({ path: `/${r.id}/`, title: r.title, why: (r.state === 'deleted' ? 'deleted' : 'unpublished') as RedirectSuggestion['why'], at: r.updatedAt }))
    .filter((s) => !covered(s.path))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { rows, suggestions };
}

/** A path on this site (`/old-post/`), from a bare slug, a path or a full easyclinic.io URL. */
export function cleanPath(input: string): string {
  let v = input.trim();
  v = v.replace(/^https?:\/\/(www\.)?easyclinic\.io/i, '');
  if (!v) return '';
  if (!v.startsWith('/')) v = `/${v}`;
  v = v.split(/[?#]/)[0];
  if (!/^\/[A-Za-z0-9._~\-/%]*$/.test(v)) throw new PublicError(`"${input}" is not a valid web address on this site. Use letters, numbers and hyphens, like /old-post/.`, 400);
  return normalizePath(v);
}

function cleanTarget(input: string): string {
  const v = input.trim();
  if (/^https?:\/\/(www\.)?easyclinic\.io/i.test(v) || !/^https?:\/\//i.test(v)) return cleanPath(v);
  if (!/^https:\/\/[^\s]+$/.test(v)) throw new PublicError('Links to other sites must start with https://.', 400);
  return v;
}

async function commitAdminRows(deps: RedirectDeps, main: MainRules, nextAdmin: RedirectRule[], message: string): Promise<void> {
  const after: MainRules = { ...main, redirects: [...main.redirects.filter((r) => r.file !== ADMIN_REDIRECTS), ...nextAdmin.map((r) => ({ ...r, file: ADMIN_REDIRECTS }))] };
  const routes = await deps.routes();
  const pages = new Set(routes.pages.map((p) => p.path));
  const yielding = new Set(routes.pages.filter((p) => p.status === 'draft').map((p) => p.path));
  const problems = validateRules(main, after, { pages, yielding });
  if (problems.length) throw new PublicError(`That redirect would break the site build: ${problems.join(' · ')}`, 409);
  const content = `${HEADER}${nextAdmin.length ? stringify(nextAdmin, { lineWidth: 0 }) : '[]\n'}`;
  await deps.repo.commit({ writes: [{ path: ADMIN_REDIRECTS, content }], deletes: [], expect: [{ path: ADMIN_REDIRECTS, sha: main.adminShas[ADMIN_REDIRECTS] ?? null }], message });
}

const adminRows = (main: MainRules): RedirectRule[] =>
  main.redirects.filter((r) => r.file === ADMIN_REDIRECTS).map(({ file: _file, ...rest }) => rest as RedirectRule);

const liveWhen = (deps: RedirectDeps) =>
  deps.repo.mode === 'supabase' && !env('VERCEL_DEPLOY_HOOK_URL') ? 'It works on the site after the next deploy.' : 'It works on the site in a minute or two.';

export async function addRedirect(input: { from: string; to: string; status: number }, user: AdminUser, deps: RedirectDeps): Promise<{ message: string }> {
  const from = cleanPath(input.from);
  const to = cleanTarget(input.to);
  const status = Number(input.status || 301) as RedirectStatus;
  if (!from || from === '/') throw new PublicError('Enter the old address to redirect from, like /old-post/.', 400);
  if (!to) throw new PublicError('Enter where it should go, like /new-post/.', 400);
  if (!STATUSES.includes(status)) throw new PublicError('Choose 301, 302, 307 or 308.', 400);
  if (!isExternal(to) && to === from) throw new PublicError('A page cannot redirect to itself.', 400);
  const main = await rules(deps);
  const clash = main.redirects.find((r) => (r.match ?? 'exact') === 'exact' && normalizePath(r.from) === from);
  if (clash) throw new PublicError(`${from} already redirects to ${clash.to}.${clash.file === ADMIN_REDIRECTS ? ' Remove that one first.' : ''}`, 409);
  if (main.gone.some((g) => (g.match ?? 'exact') === 'exact' && normalizePath(g.path) === from)) throw new PublicError(`${from} is marked as permanently gone (410). It cannot also redirect.`, 409);
  // A chain (A → B → C) slows people and search engines: point at the end of the chain instead.
  const onward = !isExternal(to) && main.redirects.find((r) => (r.match ?? 'exact') === 'exact' && normalizePath(r.from) === to);
  if (onward) throw new PublicError(`${to} itself redirects to ${onward.to}. Point straight at ${onward.to} instead.`, 409);
  const row: RedirectRule = { from, to, ...(status !== 301 ? { status } : {}), note: `Added by ${user.email} on ${deps.now().toISOString().slice(0, 10)}` };
  // Older admin rows pointing at the new source would now chain: send them straight to the new target.
  const next = adminRows(main).map((r) => (!isExternal(r.to) && normalizePath(r.to) === from ? { ...r, to } : r));
  await commitAdminRows(deps, main, [...next, row], `Redirect ${from} to ${to} (${user.email})`);
  return { message: `Redirect saved. ${liveWhen(deps)}` };
}

export async function removeRedirect(fromInput: string, user: AdminUser, deps: RedirectDeps): Promise<{ message: string }> {
  const from = cleanPath(fromInput);
  const main = await rules(deps);
  const mine = adminRows(main);
  const next = mine.filter((r) => normalizePath(r.from) !== from);
  if (next.length === mine.length) {
    const fixed = main.redirects.some((r) => normalizePath(r.from) === from);
    throw new PublicError(fixed ? 'That redirect is part of the site’s built-in rules and cannot be removed here.' : 'That redirect was not found.', 409);
  }
  await commitAdminRows(deps, main, next, `Remove redirect ${from} (${user.email})`);
  return { message: `Redirect removed. ${liveWhen(deps)}` };
}
