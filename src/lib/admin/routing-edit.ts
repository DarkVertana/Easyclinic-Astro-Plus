/**
 * Reads the routing data from main and plans edits to the admin's own two rule files. The hand-written and generated
 * files are never written: a comment-preserving re-serialise is impossible, and CI checks the generated ones.
 * A commit to main that fails the build blocks every later deploy, so each plan is checked first with the same
 * resolveRules the build runs (integrations/routes-core.ts).
 */
import { parse, stringify } from 'yaml';
import { isExternal, matchesRule, normalizePath, resolveRules, type GoneRule, type MatchMode, type RedirectRule } from '../../../integrations/routes-core.ts';
import type { CommitPlan, ContentRepo } from './types.ts';

export const ADMIN_REDIRECTS = 'src/data/redirects-admin.yaml';
export const ADMIN_GONE = 'src/data/gone-admin.yaml';
const REDIRECT_FILES = ['src/data/redirects.yaml', 'src/data/redirects-posts.yaml', ADMIN_REDIRECTS];
const GONE_FILES = ['src/data/gone.yaml', 'src/data/gone-posts.yaml', ADMIN_GONE];
const HEADER = '# Machine-owned: the blog admin commits this file. Do not edit by hand. Rules: src/lib/admin/routing-edit.ts.\n';

export type Sourced<T> = T & { file: string };

export interface MainRules {
  redirects: Array<Sourced<RedirectRule>>;
  gone: Array<Sourced<GoneRule>>;
  /** Blob sha of each admin file at the time of reading, for the commit's expected list. */
  adminShas: Record<string, string | null>;
}

export type RouteChoice = { kind: 'gone' } | { kind: 'redirect'; to: string };

function list<T>(raw: string | undefined, file: string): Array<Sourced<T>> {
  const rows = raw === undefined ? [] : (parse(raw) ?? []);
  if (!Array.isArray(rows)) throw new Error(`${file} must be a YAML list`);
  return rows.map((row) => ({ ...(row as T), file }));
}

/** The rules at main's head, not this deployment's. null when main has no routing data, which only a test repo lacks. */
export async function readMainRules(repo: ContentRepo): Promise<MainRules | null> {
  const paths = [...REDIRECT_FILES, ...GONE_FILES];
  const files = await Promise.all(paths.map((path) => repo.readFile(path)));
  if (!files[0]) return null;
  const read = (path: string) => files[paths.indexOf(path)];
  return {
    redirects: REDIRECT_FILES.flatMap((file) => list<RedirectRule>(read(file)?.raw, file)),
    gone: GONE_FILES.flatMap((file) => list<GoneRule>(read(file)?.raw, file)),
    adminShas: { [ADMIN_REDIRECTS]: read(ADMIN_REDIRECTS)?.sha ?? null, [ADMIN_GONE]: read(ADMIN_GONE)?.sha ?? null },
  };
}

const samePath = (a: string, b: string) => normalizePath(a) === normalizePath(b);
const exact = (match?: MatchMode) => (match ?? 'exact') === 'exact';

/** The rule of any kind whose exact row is this path. */
export function exactRuleAt(rules: MainRules, path: string): Sourced<RedirectRule> | Sourced<GoneRule> | undefined {
  return rules.redirects.find((r) => exact(r.match) && samePath(r.from, path)) ?? rules.gone.find((g) => exact(g.match) && samePath(g.path, path));
}

export interface RuleEdit {
  /** Lift the admin's own exact rows on these paths. */
  lift?: string[];
  /** Add one row for this path, unless an exact row already covers it. */
  add?: { path: string; choice: RouteChoice; note: string };
  /** Admin rows whose target is this path move to the new target. */
  retarget?: { from: string; to: string };
}

const clean = <T extends { file: string }>(row: T): Omit<T, 'file'> => {
  const { file: _file, ...rest } = row;
  return rest;
};

/** Pure. The admin files as they should be after the edit; a file comes back only if its rows changed. */
export function planRules(rules: MainRules, edit: RuleEdit): { next: MainRules; writes: CommitPlan['writes']; expect: CommitPlan['expect'] } {
  const lifted = (path: string, match?: MatchMode) => exact(match) && (edit.lift ?? []).some((p) => samePath(p, path));
  let redirects = rules.redirects.filter((r) => !(r.file === ADMIN_REDIRECTS && lifted(r.from, r.match)));
  let gone = rules.gone.filter((g) => !(g.file === ADMIN_GONE && lifted(g.path, g.match)));
  if (edit.retarget) {
    const { from, to } = edit.retarget;
    redirects = redirects.map((r) => (r.file === ADMIN_REDIRECTS && !isExternal(r.to) && samePath(r.to, from) ? { ...r, to: normalizePath(to) } : r));
  }
  if (edit.add) {
    const path = normalizePath(edit.add.path);
    const covered = exactRuleAt({ ...rules, redirects, gone }, path);
    if (!covered) {
      if (edit.add.choice.kind === 'gone') gone = [...gone, { path, note: edit.add.note, file: ADMIN_GONE }];
      else redirects = [...redirects, { from: path, to: isExternal(edit.add.choice.to) ? edit.add.choice.to : normalizePath(edit.add.choice.to), note: edit.add.note, file: ADMIN_REDIRECTS }];
    }
  }
  // A redirect pointing at itself after the edit is the far end of a rename back: drop it, it would be a loop.
  redirects = redirects.filter((r) => r.file !== ADMIN_REDIRECTS || isExternal(r.to) || !samePath(r.from, r.to));
  const writes: CommitPlan['writes'] = [];
  const expect: CommitPlan['expect'] = [];
  const emit = (file: string, before: Array<{ file: string }>, after: Array<{ file: string }>) => {
    const was = before.filter((r) => r.file === file);
    const now = after.filter((r) => r.file === file);
    if (JSON.stringify(was) === JSON.stringify(now)) return;
    writes.push({ path: file, content: `${HEADER}${now.length ? stringify(now.map(clean), { lineWidth: 0 }) : '[]\n'}` });
    expect.push({ path: file, sha: rules.adminShas[file] ?? null });
  };
  emit(ADMIN_REDIRECTS, rules.redirects, redirects);
  emit(ADMIN_GONE, rules.gone, gone);
  return { next: { ...rules, redirects, gone }, writes, expect };
}

/** Redirects other than the admin's that send people to this path. Removing the path would turn them into 404s. */
export function inboundFixed(rules: MainRules, path: string): Array<Sourced<RedirectRule>> {
  return rules.redirects.filter((r) => r.file !== ADMIN_REDIRECTS && !isExternal(r.to) && !r.fallback && samePath(r.to.split('#')[0], path));
}

export function inboundAdmin(rules: MainRules, path: string): Array<Sourced<RedirectRule>> {
  return rules.redirects.filter((r) => r.file === ADMIN_REDIRECTS && !isExternal(r.to) && samePath(r.to.split('#')[0], path));
}

export interface PageList {
  /** Every built page. */
  pages: Set<string>;
  /** Built draft posts, which give way to an exact rule. */
  yielding: Set<string>;
}

/**
 * New build errors this rule set would cause. Errors already present are not this commit's, and would otherwise block
 * every admin action. Also catches what only the loader refuses: one source listed in two files.
 */
export function validateRules(before: MainRules | null, after: MainRules, built: PageList): string[] {
  const errorsOf = (rules: MainRules) => {
    const result = resolveRules(rules.redirects.map(clean) as RedirectRule[], rules.gone.map(clean) as GoneRule[], built.pages, built.yielding).errors;
    const seen = new Set<string>();
    for (const g of rules.gone) {
      const key = `${g.match ?? 'exact'}:${g.path}`;
      if (seen.has(key)) result.push(`Duplicate gone path ${g.path}`);
      seen.add(key);
    }
    return result;
  };
  const known = new Set(before ? errorsOf(before) : []);
  return errorsOf(after).filter((e) => !known.has(e));
}

/** Prefix rules can't yield, and the admin only lifts exact rows: name the file a person must change. */
export function blockingRule(rules: MainRules, path: string): string | null {
  const hit = rules.redirects.find((r) => r.file !== ADMIN_REDIRECTS && matchesRule(path, r.from, r.match)) ?? rules.gone.find((g) => g.file !== ADMIN_GONE && matchesRule(path, g.path, g.match));
  return hit ? hit.file : null;
}
