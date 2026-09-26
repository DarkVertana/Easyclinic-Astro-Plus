/**
 * Builds migration/posts-triage.csv: every blog post held in the 2026-09-26 refresh, with the merge target its
 * triage note names and the published page that target resolves to. scripts/posts-manifest.ts reads the file and
 * turns each held post's "keep" row into a merge proposal for marketing to confirm.
 *
 * A held post is a post that is not published and carries a notes[] line such as
 * "Triage 2026-09-26: hold, <reason>; merge into <path>". The last "merge into <path>" in the line is the target.
 *
 * The final target is resolved one step at a time:
 * - a held post: follow that post's own merge target;
 * - any other unpublished page (a draft post that is not held, or a draft landing page): the first of these that is
 *   published and not held, else the first that exists: the fallback src/data/redirects.yaml already gives that page
 *   while it is a draft, its owner (only posts have one: the landing page that owns it), its hub, the hub of its family;
 * - a path that is not a page but a redirect source: follow the redirect.
 * A chain that returns to the post itself or loops, or a target that is not a page, stops the script with an error.
 *
 * Usage: node scripts/posts-triage.ts
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { matchesRule, normalizePath } from '../integrations/routes-core.ts';
import { stringifyCsv } from './lib/csv.ts';

export const TRIAGE_CSV = 'migration/posts-triage.csv';
export const TRIAGE_COLUMNS = ['path', 'target', 'final_target', 'reason'] as const;
export const TRIAGE_DATE = '2026-09-26';

/** URL prefix per src/content folder when a page sets no `path` (src/lib/content/registry.ts). */
const PREFIX: Record<string, string> = { pricing: '/pricing/', features: '/features/', solutions: '/solutions/', alternatives: '/compare/' };

/**
 * The hub a page family falls back to when an unpublished page has no fallback of its own (spec 3.1 site tree).
 * Trust pages have no hub page: /resources/ is the hub that lists /trust/ and /integrations/.
 */
export const FAMILY_HUB: Record<string, { hub: string; family: string }> = {
  features: { hub: '/features/', family: 'feature' },
  solutions: { hub: '/solutions/', family: 'solution' },
  specialties: { hub: '/specialties/', family: 'specialty' },
  'country-pages': { hub: '/countries/', family: 'country' },
  'country-demos': { hub: '/countries/', family: 'country demo' },
  pricing: { hub: '/pricing/', family: 'pricing' },
  guides: { hub: '/start-a-clinic/', family: 'guide' },
  comparisons: { hub: '/compare/', family: 'comparison' },
  listicles: { hub: '/compare/', family: 'listicle' },
  alternatives: { hub: '/compare/', family: 'alternatives' },
  curapilot: { hub: '/ai/', family: 'CuraPilot' },
  trust: { hub: '/resources/', family: 'trust' },
  company: { hub: '/resources/', family: 'company' },
  customers: { hub: '/resources/', family: 'customers' },
  glossary: { hub: '/resources/', family: 'glossary' },
  posts: { hub: '/blog/', family: 'post' },
};

export interface SitePage {
  path: string;
  /** src/content folder: posts, features, country-pages... */
  collection: string;
  status: string;
  hub?: string;
  owner?: string;
}

export interface Hold {
  path: string;
  target: string;
  reason: string;
}

export interface SiteRedirect {
  from: string;
  to: string;
  match?: 'exact' | 'prefix' | 'children';
  fallback?: string;
}

export interface Site {
  pages: Map<string, SitePage>;
  /** Held posts by path. */
  holds: Map<string, Hold>;
  /** Hand-written and generated redirects, plus each page's redirectFrom. */
  redirects: SiteRedirect[];
  gone: Array<{ path: string; match?: 'exact' | 'prefix' | 'children' }>;
}

export interface Resolution {
  finalTarget: string;
  /** One line per hop, in order; empty when the named target is already a published page. */
  steps: string[];
}

const HOLD_NOTE = new RegExp(`^\\s*Triage\\s+${TRIAGE_DATE}\\s*[:,.-]?\\s*hold\\b[\\s,:;.-]*`, 'i');
const MERGE_INTO = /\bmerged?\s+(?:it\s+|this\s+|the\s+post\s+)?into\s+[`'"]?(\/[^\s`'",;:)]*)/gi;

/**
 * Reads a triage hold line: "Triage 2026-09-26: hold, <reason>; merge into <path>" and its variants ("hold:",
 * "hold (reason)", "merge it into", a quoted or unslashed path, a trailing full stop). Returns null for any other
 * note. The target is '' when the line names none, and the reason is the text before the last "merge into".
 */
export function parseHoldNote(note: string): { reason: string; target: string } | null {
  const head = note.match(HOLD_NOTE);
  if (!head) return null;
  const rest = note.slice(head[0].length);
  const last = [...rest.matchAll(MERGE_INTO)].at(-1);
  if (!last) return { reason: tidy(rest), target: '' };
  const before = tidy(rest.slice(0, last.index));
  const after = tidy(rest.slice(last.index + last[0].length));
  const target = normalizePath(last[1].replace(/\.+$/, '').toLowerCase());
  return { reason: before || after, target };
}

const tidy = (text: string) =>
  text
    .replace(/^[\s,;:.)-]+/, '')
    .replace(/[\s,;:.(-]+$/, '')
    .replace(/^\(([^()]*)\)$/, '$1')
    .trim();

/**
 * Resolves the merge target of held post `from` to a published page, following held posts, draft posts,
 * unpublished pages and redirects. Throws on a self-target, a cycle, an unknown target or a gone target.
 */
export function resolveTarget(from: string, target: string, site: Site): Resolution {
  const origin = normalizePath(from);
  const chain = [origin];
  const steps: string[] = [];
  let current = normalizePath(target);
  for (;;) {
    if (current === origin) {
      throw new Error(
        chain.length === 1 ? `${origin}: the merge target is the post itself` : `${origin}: the merge chain returns to the post (${[...chain, current].join(' -> ')})`,
      );
    }
    if (chain.includes(current)) throw new Error(`${origin}: the merge chain loops (${[...chain, current].join(' -> ')})`);
    chain.push(current);

    const page = site.pages.get(current);
    if (!page) {
      const gone = site.gone.find((g) => matchesRule(current, g.path, g.match));
      if (gone) throw new Error(`${origin}: merge target ${current} is marked gone (410) in the routing data`);
      const rule = site.redirects.find((r) => matchesRule(current, r.from, r.match));
      if (!rule) throw new Error(`${origin}: merge target ${current} is not a page in src/content or a redirect source`);
      const to = normalizePath(rule.to);
      steps.push(`${current} is not a page and redirects to ${to}`);
      current = to;
      continue;
    }

    const hold = site.holds.get(current);
    if (hold) {
      if (!hold.target) throw new Error(`${origin}: merge target ${current} is held but names no merge target`);
      steps.push(`${current} is held too and merges into ${hold.target}`);
      current = hold.target;
      continue;
    }
    if (page.status === 'published') return { finalTarget: current, steps };

    const next = fallbackFor(page, site);
    if (!next) throw new Error(`${origin}: merge target ${current} is ${page.status} and has no published page to fall back to`);
    steps.push(next.why);
    current = next.path;
  }
}

/** The closest page to use while `page` is unpublished: the first published candidate, else the first that exists. */
function fallbackFor(page: SitePage, site: Site): { path: string; why: string } | undefined {
  const status = page.status || 'unpublished';
  const precedent = site.redirects.find((r) => r.fallback && normalizePath(r.to) === page.path)?.fallback;
  const family = FAMILY_HUB[page.collection];
  const isPost = page.collection === 'posts';
  const candidates: Array<{ path: string | undefined; why: (p: string) => string }> = [
    { path: precedent, why: (p) => `${page.path} is a ${status}, so this uses ${p}, the fallback src/data/redirects.yaml already gives it, until it publishes` },
    { path: page.owner, why: (p) => `${page.path} is a ${status} ${isPost ? 'post with no merge target' : 'page'}, so this follows its owner ${p}` },
    { path: page.hub, why: (p) => `${page.path} is a ${status}, so this uses its hub ${p} until it publishes` },
    { path: family?.hub, why: (p) => `${page.path} is a ${status} with no hub, so this uses ${p}, the hub for ${family?.family} pages, until it publishes` },
  ];
  const usable = candidates
    .filter((c): c is { path: string; why: (p: string) => string } => Boolean(c.path))
    .map((c) => ({ path: normalizePath(c.path), why: c.why }))
    .filter((c) => c.path !== page.path && site.pages.has(c.path));
  const pick = usable.find((c) => site.pages.get(c.path)?.status === 'published' && !site.holds.has(c.path)) ?? usable[0];
  return pick && { path: pick.path, why: pick.why(pick.path) };
}

/** The reason column: the triage reason, plus how the target was resolved when it differs from the one named. */
export function describe(reason: string, resolution: Resolution): string {
  if (!resolution.steps.length) return reason;
  return `${reason}. Merge target: ${resolution.steps.join('; ')}`;
}

export interface TriageRow {
  path: string;
  target: string;
  final_target: string;
  reason: string;
}

/** Every held post as a CSV row, sorted by path, plus every error (a hold with no target, a cycle...). */
export function triageRows(site: Site): { rows: TriageRow[]; resolved: Array<TriageRow & { steps: string[] }>; errors: string[] } {
  const rows: TriageRow[] = [];
  const resolved: Array<TriageRow & { steps: string[] }> = [];
  const errors: string[] = [];
  for (const hold of [...site.holds.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!hold.target) {
      errors.push(`${hold.path}: the hold note names no "merge into <path>"`);
      continue;
    }
    if (!hold.reason) errors.push(`${hold.path}: the hold note gives no reason`);
    try {
      const resolution = resolveTarget(hold.path, hold.target, site);
      const row = { path: hold.path, target: hold.target, final_target: resolution.finalTarget, reason: describe(hold.reason, resolution) };
      rows.push(row);
      if (resolution.steps.length) resolved.push({ ...row, steps: resolution.steps });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { rows, resolved, errors };
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ya?ml|mdx)$/.test(name) ? [p] : [];
  });
}

const yamlList = <T>(file: string): T[] => ((existsSync(file) ? parseYaml(readFileSync(file, 'utf8')) : []) ?? []) as T[];

/** Reads every page in src/content (path, status, hub, owner), the held posts and the routing data. */
export function loadSite(root = '.'): { site: Site; warnings: string[] } {
  const contentDir = join(root, 'src/content');
  const pages = new Map<string, SitePage>();
  const holds = new Map<string, Hold>();
  const redirects: SiteRedirect[] = [
    ...yamlList<SiteRedirect>(join(root, 'src/data/redirects.yaml')),
    ...yamlList<SiteRedirect>(join(root, 'src/data/redirects-posts.yaml')),
  ];
  const gone = [...yamlList<Site['gone'][number]>(join(root, 'src/data/gone.yaml')), ...yamlList<Site['gone'][number]>(join(root, 'src/data/gone-posts.yaml'))];
  const warnings: string[] = [];

  for (const file of files(contentDir)) {
    const rel = relative(contentDir, file).split('\\').join('/');
    const collection = rel.split('/')[0];
    const source = readFileSync(file, 'utf8');
    const fm = file.endsWith('.mdx') ? source.match(/^---\n([\s\S]*?)\n---/) : null;
    if (file.endsWith('.mdx') && !fm) continue;
    const data = (parseYaml(fm ? fm[1] : source) ?? {}) as Record<string, unknown>;
    const id = rel
      .slice(collection.length + 1)
      .replace(/\/index\.mdx$/, '')
      .replace(/\.(ya?ml|mdx)$/, '');
    const path = normalizePath(typeof data.path === 'string' ? data.path : `${PREFIX[collection] ?? '/'}${id}/`);
    const links = (data.links ?? {}) as Record<string, unknown>;
    const page: SitePage = {
      path,
      collection,
      status: String(data.status ?? ''),
      hub: typeof links.hub === 'string' ? normalizePath(links.hub) : undefined,
      owner: typeof data.owner === 'string' ? normalizePath(data.owner) : undefined,
    };
    pages.set(path, page);
    for (const from of Array.isArray(data.redirectFrom) ? data.redirectFrom : []) redirects.push({ from: String(from), to: path });

    if (collection !== 'posts') continue;
    const notes = (Array.isArray(data.notes) ? data.notes : []).map(String);
    const hold = notes.map(parseHoldNote).filter((h) => h !== null).at(-1);
    if (!hold) continue;
    if (page.status === 'published') {
      warnings.push(`${path} has a triage hold note but is published; not treated as held`);
      continue;
    }
    holds.set(path, { path, ...hold });
  }
  return { site: { pages, holds, redirects, gone }, warnings };
}

function main() {
  const { site, warnings } = loadSite();
  const { rows, resolved, errors } = triageRows(site);
  for (const w of warnings) console.warn(`  ! ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`\n${errors.length} held posts cannot be resolved; ${TRIAGE_CSV} not written.`);
    process.exit(1);
  }
  writeFileSync(TRIAGE_CSV, stringifyCsv([[...TRIAGE_COLUMNS], ...rows.map((r) => TRIAGE_COLUMNS.map((c) => r[c]))]));
  const posts = [...site.pages.values()].filter((p) => p.collection === 'posts');
  const published = posts.filter((p) => p.status === 'published').length;
  console.log(`posts: ${posts.length}  published: ${published}  held: ${rows.length}  other drafts: ${posts.length - published - rows.length}`);
  console.log(`held posts whose target needed a chain or fallback: ${resolved.length}`);
  for (const r of resolved) console.log(`  - ${r.path}: ${[r.target, ...r.steps].join('\n      ')}\n      => ${r.final_target}`);
  console.log(`Wrote ${TRIAGE_CSV}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
