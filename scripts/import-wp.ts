/**
 * Imports WordPress posts from the live site as draft MDX entries. Images are downloaded next to each entry
 * so nothing depends on the WordPress host after cutover; WordPress junk is stripped (scripts/lib/wp-convert.ts).
 *
 * Guides (default): src/content/guides/<slug>/index.mdx, for the start-a-clinic guides (plan Phase 1). The
 *   refresh (spec 5.18) adds the byline, date, licensing checklist, cost table and InlineCta.
 * Posts (--collection posts): src/content/posts/<slug>/index.mdx, for the blog posts the posts manifest
 *   keeps (plan Phase 3, spec 3.6). Each starts as a draft with no author; its owner is the manifest's
 *   owner_page and its /blog/ topic follows from the owner (TOPIC_BY_OWNER in scripts/lib/wp-convert.ts,
 *   where the mapping is documented); a post the manifest gives to /blog/ takes a provisional topic from its
 *   slug and title (TOPIC_BY_KEYWORD, same file). The refresh (spec 5.18/5.19) adds the author, a real opening answer
 *   and summary, and an FAQ where one is warranted.
 *
 * Usage:
 *   node scripts/import-wp.ts <slug> [<slug> ...] [--collection guides|posts] [--force]
 *   node scripts/import-wp.ts --from-manifest [--dry-run] [--delay 1000] [--force]
 *
 * --from-manifest   imports every migration/posts-manifest.csv row with proposed_decision "keep" as a post,
 *                   except paths that are already a page in src/content (the guides and comparison pages),
 *                   paths that redirects.yaml, gone.yaml or a page's redirectFrom already claim, and posts
 *                   already imported. The manifest's decisions are PROPOSED; marketing has not confirmed them.
 * --dry-run         prints what would be imported and skipped, without fetching or writing.
 * --delay <ms>      pause between WordPress requests (default 1000), one request at a time.
 * --cache <dir>     keep the WordPress API responses in <dir> and reuse them on the next run.
 * --out <dir>       write the entries under <dir>/<collection>/ instead of src/content (to try the converter).
 * --force           overwrite existing entries.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, stringify } from 'yaml';
import { matchesRule, type MatchMode } from '../integrations/routes-core.ts';
import {
  WP_ORIGIN,
  cleanHtml,
  decode,
  demoHrefFor,
  htmlToMdx,
  imageSources,
  keywordFrom,
  linkLabelFrom,
  firstHeadingText,
  firstSentences,
  leadText,
  metaFrom,
  summaryFrom,
  topicForPost,
} from './lib/wp-convert.ts';

const ROOT = process.cwd();
const UA = { 'user-agent': 'EasyClinic site migration (Astro rebuild)' };

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const option = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const valued = new Set(['--collection', '--delay', '--cache', '--out']);
const slugs = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
const force = flag('--force');
const dryRun = flag('--dry-run');
const fromManifest = flag('--from-manifest');
const collection = fromManifest ? 'posts' : (option('--collection') ?? 'guides');
const delay = Number(option('--delay') ?? 1000);
const cacheDir = option('--cache');
const outDir = option('--out') ?? join(ROOT, 'src/content');
if (!['guides', 'posts'].includes(collection)) throw new Error(`--collection must be guides or posts, not ${collection}`);

/** Head keywords for the start-a-clinic guides (spec 4.4). */
const GUIDE_KEYWORDS: Record<string, string> = {
  'the-ultimate-guide-to-starting-a-clinic-in-kenya': 'how to start a clinic in Kenya',
  'how-do-i-get-approval-from-the-kmpdc-in-kenya': 'KMPDC registration for clinics',
  'how-much-does-it-cost-to-open-a-clinic-in-nairobi': 'cost of opening a clinic in Nairobi',
  'clinic-in-uganda': 'how to start a clinic in Uganda',
  'clinic-in-india': 'how to start a clinic in India',
  'how-to-setup-clinic-legally-in-india-compliance-guide': 'clinic licences in India',
  'how-much-does-it-cost-to-open-a-clinic-in-mumbai': 'clinic setup cost in Mumbai',
  'how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci': 'NMC registration for clinics',
  'patient-data-privacy-laws-in-india': 'patient data privacy laws India',
  'clinic-in-nigeria': 'how to start a clinic in Nigeria',
  'clinic-in-ethiopia': 'how to start a clinic in Ethiopia',
};

/* ---------- The posts manifest ---------- */

interface ManifestRow {
  path: string;
  research_class: string;
  proposed_decision: string;
  target: string;
  owner_page: string;
  reason: string;
  /** Marketing's sign-off on the proposed decision ("yes"), added to the manifest by scripts/posts-redirects.ts. */
  confirmed?: string;
}

function readManifest(): ManifestRow[] {
  const [header, ...lines] = readFileSync(join(ROOT, 'migration/posts-manifest.csv'), 'utf8').trim().split('\n');
  const cols = header.split(',');
  const split = (line: string) => [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"')).slice(0, cols.length);
  return lines.map((line) => Object.fromEntries(split(line).map((v, i) => [cols[i], v])) as unknown as ManifestRow);
}

/* ---------- What the site already claims ---------- */

/** Collection folder to URL prefix; mirrors PAGE_COLLECTIONS in src/lib/content/registry.ts. */
const PREFIX: Record<string, string> = { pricing: '/pricing/', features: '/features/', solutions: '/solutions/', alternatives: '/compare/' };

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkFiles(p) : /\.(ya?ml|mdx)$/.test(name) ? [p] : [];
  });
}

/** Every page path in src/content (explicit `path`, else prefix + file or folder name) and every redirectFrom. */
function claimedPaths(): { pages: Map<string, string>; redirectFrom: Set<string> } {
  const pages = new Map<string, string>();
  const redirectFrom = new Set<string>();
  const base = join(ROOT, 'src/content');
  for (const file of walkFiles(base)) {
    const rel = relative(base, file);
    const [dir] = rel.split('/');
    const source = readFileSync(file, 'utf8');
    const data = (file.endsWith('.mdx') ? parse(source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') : parse(source)) as { path?: string; redirectFrom?: string[] } | null;
    const id = file.endsWith('/index.mdx') ? rel.split('/').slice(1, -1).join('/') : rel.split('/').slice(1).join('/').replace(/\.(ya?ml|mdx)$/, '');
    pages.set(data?.path ?? `${PREFIX[dir] ?? '/'}${id}/`, rel);
    for (const from of data?.redirectFrom ?? []) redirectFrom.add(from);
  }
  return { pages, redirectFrom };
}

/** Redirect and 410 rules, hand-written and generated from the manifest (scripts/posts-redirects.ts). */
function routingRules(): Array<{ source: string; match: MatchMode; file: string }> {
  const rows = (file: string, key: 'from' | 'path') => {
    const path = join(ROOT, 'src/data', file);
    if (!existsSync(path)) return [];
    return ((parse(readFileSync(path, 'utf8')) ?? []) as Array<Record<string, string>>).map((r) => ({
      source: r[key],
      match: (r.match ?? 'exact') as MatchMode,
      file,
    }));
  };
  return [...rows('redirects.yaml', 'from'), ...rows('redirects-posts.yaml', 'from'), ...rows('gone.yaml', 'path'), ...rows('gone-posts.yaml', 'path')];
}

/* ---------- WordPress ---------- */

interface WpPost {
  slug: string;
  title: { rendered: string };
  date: string;
  modified: string;
  excerpt: { rendered: string };
  content: { rendered: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function fetchPost(slug: string): Promise<WpPost | null> {
  const cached = cacheDir ? join(cacheDir, `${slug}.json`) : null;
  if (cached && existsSync(cached)) return (JSON.parse(readFileSync(cached, 'utf8')) as WpPost[])[0] ?? null;
  if (requests++ > 0) await sleep(delay);
  const res = await fetch(`${WP_ORIGIN}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=slug,title,date,modified,excerpt,content,link`, { headers: UA });
  if (!res.ok) throw new Error(`WordPress answered ${res.status}`);
  const text = await res.text();
  if (cached) {
    mkdirSync(cacheDir!, { recursive: true });
    writeFileSync(cached, text);
  }
  return (JSON.parse(text) as WpPost[])[0] ?? null;
}

async function download(url: string, dir: string): Promise<string | null> {
  const clean = url.split('?')[0];
  if (!/^https?:\/\/(?:www\.)?easyclinic\.io\/wp-content\//.test(clean)) return null;
  const name = clean.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!/\.(?:jpe?g|png|webp|gif|avif|svg)$/i.test(name)) return null;
  const target = join(dir, name);
  if (!existsSync(target)) {
    await sleep(Math.min(delay, 500));
    const res = await fetch(clean, { headers: UA });
    if (!res.ok) return null;
    mkdirSync(dir, { recursive: true });
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
  return `./images/${name}`;
}

/* ---------- One entry ---------- */

type Outcome = { status: 'imported'; detail: string } | { status: 'skipped' | 'failed'; reason: string };

async function importOne(slug: string, row?: ManifestRow): Promise<Outcome> {
  const dir = join(outDir, collection, slug);
  const file = join(dir, 'index.mdx');
  if (existsSync(file) && !force) return { status: 'skipped', reason: 'already imported (--force to overwrite)' };
  const owner = row?.owner_page;
  if (collection === 'posts' && !owner) return { status: 'failed', reason: 'no owner_page in migration/posts-manifest.csv' };
  if (dryRun) return { status: 'imported', detail: 'dry run' };

  const post = await fetchPost(slug);
  if (!post) return { status: 'failed', reason: 'not found on WordPress' };

  const title = decode(post.title.rendered);
  const local = new Map<string, string | null>();
  for (const src of imageSources(post.content.rendered)) local.set(src, await download(src, join(dir, 'images')));
  const cleaned = cleanHtml(post.content.rendered, local, title);
  const body = htmlToMdx(cleaned);
  if (!body) return { status: 'failed', reason: 'empty body after conversion' };

  // Opening answer, summary and meta description are cut from the lead; the refresh rewrites all three.
  const lead = leadText(decode(post.excerpt.rendered), cleaned, firstHeadingText(post.content.rendered));
  const published = post.date.slice(0, 10);
  const modified = post.modified.slice(0, 10);
  const meta = metaFrom(lead);
  const imported = `Imported from ${WP_ORIGIN}/${slug}/ (published ${published}, modified ${modified}).`;
  const { topic, provisional } = collection === 'posts' ? topicForPost(owner!, slug, title) : { topic: undefined, provisional: false };
  const confirmed = (row?.confirmed ?? '').trim().toLowerCase() === 'yes' ? 'marketing confirmed the decision' : 'marketing has not confirmed the decision';

  const frontmatter =
    collection === 'posts'
      ? {
          status: 'draft',
          headKeyword: keywordFrom(title),
          title,
          metaDescription: meta,
          h1: title,
          linkLabel: linkLabelFrom(title),
          openingAnswer: firstSentences(lead, 2, 400),
          summary: summaryFrom(lead),
          author: null,
          lastUpdated: modified,
          originallyPublished: published,
          topic,
          owner,
          ctas: { primary: { label: 'Book a 20-minute demo', href: demoHrefFor(slug, owner) } },
          links: { hub: '/blog/', related: [] },
          notes: [
            `${imported} Needs the spec 5.18/5.19 refresh before publishing.`,
            provisional
              ? `Owner ${owner} from migration/posts-manifest.csv (${row!.research_class}, proposed decision "${row!.proposed_decision}"); ${confirmed}. /blog/ cannot own a post, so the topic ${topic} was chosen from the slug and title (TOPIC_BY_KEYWORD in scripts/lib/wp-convert.ts) and is provisional until a landing page owns the post.`
              : `Owner ${owner} and topic from migration/posts-manifest.csv (${row!.research_class}, proposed decision "${row!.proposed_decision}"); ${confirmed}.`,
          ],
        }
      : {
          status: 'draft',
          headKeyword: GUIDE_KEYWORDS[slug] ?? keywordFrom(title),
          title,
          metaDescription: meta,
          h1: title,
          linkLabel: linkLabelFrom(title),
          openingAnswer: firstSentences(lead, 2, 400),
          author: null,
          lastUpdated: modified,
          ctas: { primary: { label: 'Book a 20-minute demo', href: demoHrefFor(slug) } },
          links: { hub: '/start-a-clinic/', related: [] },
          notes: [`${imported} Needs the spec 5.18 refresh before publishing.`],
        };

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${body}\n`);
  const images = [...local.values()].filter(Boolean).length;
  return { status: 'imported', detail: `${body.length} chars, ${images}/${local.size} images` };
}

/* ---------- Run ---------- */

const queue: Array<{ slug: string; row?: ManifestRow }> = [];
const skipped: Array<{ slug: string; reason: string }> = [];

if (fromManifest) {
  const { pages, redirectFrom } = claimedPaths();
  const rules = routingRules();
  for (const row of readManifest().filter((r) => r.proposed_decision === 'keep')) {
    const slug = row.path.replace(/^\/|\/$/g, '');
    const existing = pages.get(row.path);
    const rule = rules.find((r) => matchesRule(row.path, r.source, r.match));
    if (!/^[a-z0-9-]+$/.test(slug)) skipped.push({ slug, reason: 'not a root slug' });
    else if (existing && !existing.startsWith('posts/')) skipped.push({ slug, reason: `already a page: src/content/${existing}` });
    else if (rule) skipped.push({ slug, reason: `claimed by src/data/${rule.file} (${rule.source})` });
    else if (redirectFrom.has(row.path)) skipped.push({ slug, reason: 'listed in a page’s redirectFrom' });
    else queue.push({ slug, row });
  }
} else {
  if (!slugs.length) throw new Error('Name at least one slug, or pass --from-manifest');
  const rows = collection === 'posts' ? readManifest() : [];
  for (const slug of slugs) queue.push({ slug, row: rows.find((r) => r.path === `/${slug}/`) });
}

const results: Array<{ slug: string } & Outcome> = skipped.map((s) => ({ ...s, status: 'skipped' as const }));
for (const { slug, row } of queue) {
  let outcome: Outcome;
  try {
    outcome = await importOne(slug, row);
  } catch (error) {
    outcome = { status: 'failed', reason: (error as Error).message };
  }
  results.push({ slug, ...outcome });
  const mark = outcome.status === 'imported' ? '✓' : outcome.status === 'skipped' ? '-' : '✗';
  console.log(`${mark} ${slug}: ${outcome.status === 'imported' ? outcome.detail : outcome.reason}`);
}

const count = (s: Outcome['status']) => results.filter((r) => r.status === s);
console.log(`\n${dryRun ? '[dry run] ' : ''}${collection}: ${count('imported').length} imported, ${count('skipped').length} skipped, ${count('failed').length} failed`);
if (count('skipped').length) {
  console.log('\nSkipped:');
  for (const r of count('skipped')) console.log(`  - ${r.slug}: ${(r as { reason: string }).reason}`);
}
if (count('failed').length) {
  console.log('\nFailed:');
  for (const r of count('failed')) console.log(`  ✗ ${r.slug}: ${(r as { reason: string }).reason}`);
  process.exitCode = 1;
}
