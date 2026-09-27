/**
 * Turns the posts manifest (migration/posts-manifest.csv, spec 3.6 blog pruning) into redirect and 410
 * rows, gated on marketing's `confirmed` column: only rows marked `yes` generate anything.
 *
 * - merge + confirmed: a 301 from the post to its `target` (src/data/redirects-posts.yaml)
 * - drop + confirmed: a 410 (src/data/gone-posts.yaml; spec 3.6 "noindex or delete the frontier-technology posts")
 * - keep and review: nothing (kept posts are imported as pages; review rows need a decision first)
 *
 * A post already covered by a hand-written row in redirects.yaml or gone.yaml is left to that row.
 *
 * A confirmed merge or drop can land while the post's draft MDX is still in src/content/posts. The build allows
 * that for a draft on an exact rule (integrations/routes-core.ts pageYieldsTo): production serves the 301 or 410,
 * preview renders the draft. leftoverPosts() lists those posts so the drafts get deleted once the rule is live.
 */
import { parse as parseYaml } from 'yaml';
import { isExternal, matchesRule, normalizePath, pageYieldsTo, type GoneRule, type MatchMode, type RedirectRule } from '../../integrations/routes-core.ts';

export const MANIFEST_CSV = 'migration/posts-manifest.csv';
export const REDIRECTS_OUT = 'src/data/redirects-posts.yaml';
export const GONE_OUT = 'src/data/gone-posts.yaml';
export const POSTS_DIR = 'src/content/posts';

export interface ManifestRow {
  path: string;
  research_class: string;
  proposed_decision: string;
  target: string;
  owner_page: string;
  reason: string;
  confirmed: string;
}

export interface GeneratedRules {
  redirects: RedirectRule[];
  gone: GoneRule[];
  /** Confirmed rows that generate nothing, with why. */
  skipped: Array<{ path: string; reason: string }>;
  /** Unusable confirmed rows (bad target, unknown decision); the generator refuses to write. */
  errors: string[];
  /** Non-blocking notes (unrecognised `confirmed` values, disagreements with the hand-written data). */
  warnings: string[];
  /**
   * Confirmed merge and drop rows that take a post off the site, with the rule that does it: the generated one, or
   * the hand-written row that covers the post. `rule` reads "301 to /ai/" or "410".
   */
  removals: Array<{ path: string; decision: 'merge' | 'drop'; rule: string; match: MatchMode }>;
}

/** Only an explicit yes confirms a row (case and surrounding spaces ignored). */
export function isConfirmed(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'yes';
}

export function generatePostRules(rows: ManifestRow[], existing: { redirects: RedirectRule[]; gone: GoneRule[] }): GeneratedRules {
  const out: GeneratedRules = { redirects: [], gone: [], skipped: [], errors: [], warnings: [], removals: [] };
  const seen = new Set<string>();

  for (const row of rows) {
    const path = normalizePath(row.path);
    const decision = row.proposed_decision.trim().toLowerCase();
    const confirmedValue = row.confirmed.trim();
    if (!isConfirmed(confirmedValue)) {
      if (confirmedValue && confirmedValue.toLowerCase() !== 'no') {
        out.warnings.push(`${path}: confirmed="${confirmedValue}" is not understood; only "yes" confirms a row`);
      }
      continue;
    }
    if (seen.has(path)) {
      out.errors.push(`${path}: listed twice in the manifest`);
      continue;
    }
    seen.add(path);

    if (decision === 'keep' || decision === 'review') {
      out.skipped.push({ path, reason: `${decision}: generates nothing` });
      continue;
    }
    if (decision !== 'merge' && decision !== 'drop') {
      out.errors.push(`${path}: unknown decision "${row.proposed_decision}" (expected keep, merge, drop or review)`);
      continue;
    }

    const handRedirect = existing.redirects.find((r) => matchesRule(path, r.from, r.match));
    const handGone = existing.gone.find((g) => matchesRule(path, g.path, g.match));
    if (handRedirect || handGone) {
      const by = handRedirect ? `redirects.yaml (${handRedirect.from} -> ${handRedirect.to})` : `gone.yaml (${handGone!.path})`;
      out.skipped.push({ path, reason: `already covered by ${by}` });
      const agrees = decision === 'merge' ? handRedirect && normalizePath(handRedirect.to) === normalizePath(row.target) : Boolean(handGone);
      if (!agrees) out.warnings.push(`${path}: manifest says ${decision}${decision === 'merge' ? ` to ${row.target}` : ''}, but ${by} wins; align one of them`);
      out.removals.push(
        handRedirect
          ? { path, decision, rule: `${handRedirect.status ?? 301} to ${handRedirect.to}`, match: handRedirect.match ?? 'exact' }
          : { path, decision, rule: '410', match: handGone!.match ?? 'exact' },
      );
      continue;
    }

    if (decision === 'drop') {
      out.gone.push({ path, note: 'posts manifest: drop (confirmed)' });
      out.removals.push({ path, decision, rule: '410', match: 'exact' });
      continue;
    }
    const target = row.target.trim();
    if (!target.startsWith('/') && !isExternal(target)) {
      out.errors.push(`${path}: merge target "${row.target}" is not a path`);
      continue;
    }
    if (normalizePath(target) === path) {
      out.errors.push(`${path}: merge target is the post itself`);
      continue;
    }
    const to = isExternal(target) ? target : normalizePath(target);
    out.redirects.push({ from: path, to, note: 'posts manifest: merge (confirmed)' });
    out.removals.push({ path, decision, rule: `301 to ${to}`, match: 'exact' });
  }

  const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  out.redirects.sort((a, b) => byPath(a.from, b.from));
  out.gone.sort((a, b) => byPath(a.path, b.path));
  out.removals.sort((a, b) => byPath(a.path, b.path));
  return out;
}

/** A post's MDX file, as the build's route registry sees it: path from frontmatter `path` or the folder name. */
export interface PostFile {
  path: string;
  file: string;
  status: string;
}

export function parsePostFile(id: string, file: string, text: string): PostFile {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const data = ((frontmatter ? parseYaml(frontmatter[1]) : null) ?? {}) as { path?: unknown; status?: unknown };
  return { path: normalizePath(typeof data.path === 'string' ? data.path : `/${id}/`), file, status: String(data.status ?? '') };
}

export interface LeftoverPost {
  path: string;
  file: string;
  status: string;
  /** True when the build accepts the post where it is (a draft on an exact rule); false when the build fails. */
  ok: boolean;
  message: string;
}

/** Confirmed merges and drops whose post is still in src/content/posts, with what to do about each. */
export function leftoverPosts(removals: GeneratedRules['removals'], posts: Map<string, PostFile>): LeftoverPost[] {
  const out: LeftoverPost[] = [];
  for (const removal of removals) {
    const post = posts.get(removal.path);
    if (!post) continue;
    const { path, file, status } = post;
    const what = removal.decision === 'merge' ? `redirect (${removal.rule})` : removal.rule;
    if (pageYieldsTo({ collection: 'posts', status }, removal.match)) {
      out.push({
        path,
        file,
        status,
        ok: true,
        message: `${path}: the draft ${file} can be deleted once the ${what} is live in production; preview builds render the draft and skip the rule until then.`,
      });
    } else if (status === 'draft') {
      out.push({ path, file, status, ok: false, message: `${path}: the draft ${file} sits under a ${removal.match} rule (${removal.rule}), so the build fails; delete the draft.` });
    } else {
      out.push({ path, file, status, ok: false, message: `${path}: ${file} has status ${status || '(none)'}, so the build fails on the ${what}; set it to status: draft or delete it.` });
    }
  }
  return out;
}

/** A YAML scalar: plain when it is a simple path or slug, JSON-quoted (valid YAML) otherwise. */
const scalar = (value: string) => (/^[A-Za-z0-9/._-]+$/.test(value) ? value : JSON.stringify(value));

const header = (what: string) =>
  [
    `# GENERATED by scripts/posts-redirects.ts from ${MANIFEST_CSV}. Do not edit by hand.`,
    '# Regenerate after marketing updates the manifest: node scripts/posts-redirects.ts',
    `# Lists ${what} for manifest rows with confirmed=yes only (spec 3.6). Keep and review rows generate nothing.`,
    '',
  ].join('\n');

export function renderRedirectsYaml(rules: RedirectRule[]): string {
  const rows = rules.map((r) => `- { from: ${scalar(r.from)}, to: ${scalar(r.to)}${r.note ? `, note: ${scalar(r.note)}` : ''} }`);
  return `${header('a 301 to the merge target')}${rows.length ? rows.join('\n') : '[]'}\n`;
}

export function renderGoneYaml(rules: GoneRule[]): string {
  const rows = rules.map((g) => `- { path: ${scalar(g.path)}${g.note ? `, note: ${scalar(g.note)}` : ''} }`);
  return `${header('a 410 Gone for each dropped post')}${rows.length ? rows.join('\n') : '[]'}\n`;
}
