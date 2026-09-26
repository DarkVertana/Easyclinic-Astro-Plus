/**
 * Post-build checks on the real HTML (the staging audit's crawl script, spec 7.10 and 9.2).
 * Runs after `astro build` over .vercel/output/static and the build manifest.
 *
 * Always errors (any stage): missing or duplicate H1, placeholder sentinels leaking into markup or
 * JSON-LD, unparseable JSON-LD, FAQ schema not matching the visible FAQ, missing canonical, images
 * without alt/width/height, unexpected third-party scripts, sitemap entries that are not indexable pages,
 * JS over budget.
 * Production-only errors (warnings in preview): title/meta length, visible placeholders, broken internal
 * links, JSON-LD types missing for the page family, HTML/CSS over budget.
 *
 * Usage: node scripts/check-output.ts   (CONTENT_STAGE=production for strict mode)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';

const OUT = join(process.cwd(), '.vercel/output');
const STATIC = join(OUT, 'static');
const strict = process.env.CONTENT_STAGE === 'production';

interface ManifestPage {
  path: string;
  collection: string;
  status: string;
  indexable: boolean;
  family: string;
}
const manifest = JSON.parse(readFileSync(join(OUT, 'build-manifest.json'), 'utf8')) as {
  pages: ManifestPage[];
  activeRedirects: Array<{ from: string; to: string; match?: string }>;
};

const BUDGET = { jsGzip: 150 * 1024, jsTarget: 15 * 1024, cssGzip: 40 * 1024, htmlGzip: 60 * 1024 };
const REQUIRED_TYPES: Record<string, string[]> = {
  home: ['Organization', 'WebSite', 'SoftwareApplication', 'WebPage'],
  pricing: ['SoftwareApplication', 'WebPage'],
  guide: ['Article', 'WebPage'],
  listicle: ['Article', 'ItemList', 'WebPage'],
  comparison: ['Article', 'WebPage'],
};

let errors = 0;
let warnings = 0;
const report = (level: 'error' | 'warn', page: string, message: string) => {
  const isError = level === 'error';
  if (isError) errors++;
  else warnings++;
  console[isError ? 'error' : 'warn'](`${isError ? '✗' : '!'} ${page}: ${message}`);
};
/** Content-completeness problems: errors in production, warnings in preview. */
const contentIssue = (page: string, message: string) => report(strict ? 'error' : 'warn', page, message);

const fileFor = (path: string) => join(STATIC, path.endsWith('/') ? `${path}index.html` : path);
const existsPath = (path: string) => existsSync(fileFor(path.split('#')[0].split('?')[0]));
const redirectSources = manifest.activeRedirects ?? [];
const isRedirect = (path: string) =>
  redirectSources.some((r) => {
    const base = r.from.replace(/\/$/, '');
    if ((r.match ?? 'exact') === 'exact') return path === r.from || path === base;
    return path.startsWith(`${base}/`) || path === base;
  });
const ON_DEMAND = [/^\/demo\//, /^\/_actions\//];

const assetSize = new Map<string, number>();
const gz = (file: string) => {
  if (!assetSize.has(file)) assetSize.set(file, existsSync(file) ? gzipSync(readFileSync(file)).length : 0);
  return assetSize.get(file)!;
};

for (const page of manifest.pages.filter((p) => p.collection !== 'static')) {
  const file = fileFor(page.path);
  if (!existsSync(file)) {
    report('error', page.path, 'page in manifest but no HTML file was built');
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const root = parse(html, { comment: false });
  const published = page.status === 'published';

  if (/[⟦⟧]/.test(html)) report('error', page.path, 'placeholder sentinel characters leaked into the HTML');

  const h1s = root.querySelectorAll('h1');
  if (h1s.length !== 1) report('error', page.path, `expected exactly one <h1>, found ${h1s.length}`);

  const title = root.querySelector('title')?.text.trim() ?? '';
  const description = root.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  if (!title) report('error', page.path, 'missing <title>');
  if (title.length > 60) contentIssue(page.path, `title is ${title.length} characters (limit 60)`);
  if (description.length > 155) contentIssue(page.path, `meta description is ${description.length} characters (limit 155)`);

  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  if (!/^https:\/\/www\.easyclinic\.io\/.*\/$|^https:\/\/www\.easyclinic\.io\/$/.test(canonical)) {
    report('error', page.path, `canonical must be absolute on www with a trailing slash, got "${canonical}"`);
  }
  const robots = root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  if (page.indexable === robots.includes('noindex')) report('error', page.path, `robots meta "${robots}" does not match indexable=${page.indexable}`);

  // Placeholders can also come from shared data (a testimonial role, an author field) that page lint does
  // not see; in production any bracketed text in the page body of a published page is an error.
  const mainClone = parse(root.querySelector('main')?.toString() ?? '');
  for (const node of mainClone.querySelectorAll('script, style')) node.remove();
  const bodyText = mainClone.text;
  const literal = bodyText.match(/(?<!\])\[(?!\s*\])[^[\]\n]{2,160}\](?![([:])/g) ?? [];
  if (strict && published && literal.length) report('error', page.path, `bracketed placeholder text in a published page: ${literal.slice(0, 3).join(', ')}`);
  const marks = root.querySelectorAll('mark[data-placeholder]').length;
  if (marks) contentIssue(page.path, `${marks} placeholders visible on the page`);
  // Published pages may show optional-detail placeholders in preview (production omits them); the
  // production run's literal-bracket check above is the hard gate.

  // JSON-LD
  const types = new Set<string>();
  let faqQuestions = -1;
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      for (const node of data['@graph'] ?? [data]) {
        types.add(node['@type']);
        if (node['@type'] === 'FAQPage') faqQuestions = node.mainEntity.length;
      }
    } catch (error) {
      report('error', page.path, `JSON-LD does not parse: ${(error as Error).message}`);
    }
  }
  // ContactPage, AboutPage and CollectionPage are WebPage subtypes.
  if (['ContactPage', 'AboutPage', 'CollectionPage'].some((t) => types.has(t))) types.add('WebPage');
  for (const type of REQUIRED_TYPES[page.family] ?? ['WebPage']) {
    if (!types.has(type)) contentIssue(page.path, `JSON-LD missing ${type}`);
  }
  if (page.path !== '/' && !types.has('BreadcrumbList')) report('warn', page.path, 'no BreadcrumbList (set links.hub)');
  const visibleFaq = root.querySelectorAll('details[data-faq]').length;
  if ((faqQuestions === -1 ? 0 : faqQuestions) !== visibleFaq) {
    report('error', page.path, `FAQPage has ${faqQuestions} questions but the page shows ${visibleFaq}`);
  }

  // Shared blocks the spec removes (2.11), checked on rendered text.
  const text = root.querySelector('main')?.text ?? '';
  if (/5,?000\+?\s*doctors\s*[·•|]\s*18 countries/i.test(text)) report('error', page.path, 'shared stat line present (spec 2.11)');
  if (/Explore the rest of the platform/i.test(text)) report('error', page.path, '"Explore the rest of the platform" block present (spec 2.11)');

  // Images
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (img.getAttribute('alt') === undefined) report('error', page.path, `image without alt: ${src}`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) report('error', page.path, `image without width/height: ${src}`);
  }

  // Internal links
  for (const a of root.querySelectorAll('a[href^="/"]')) {
    const href = a.getAttribute('href')!;
    const path = href.split('#')[0].split('?')[0];
    if (!path || existsPath(path) || isRedirect(path) || ON_DEMAND.some((re) => re.test(path))) continue;
    contentIssue(page.path, `link to ${href}, which is not built`);
  }
  for (const form of root.querySelectorAll('form[action^="/"]')) {
    const action = form.getAttribute('action')!;
    if (!ON_DEMAND.some((re) => re.test(action))) report('error', page.path, `form posts to ${action}, which is not an on-demand route`);
  }

  // Scripts and budgets
  let js = 0;
  for (const script of root.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src')!;
    if (src.startsWith('/_astro/')) js += gz(join(STATIC, src));
    else report('error', page.path, `unexpected external script ${src}`);
  }
  for (const script of root.querySelectorAll('script:not([src]):not([type="application/ld+json"])')) js += gzipSync(script.textContent).length;
  if (js > BUDGET.jsGzip) report('error', page.path, `JavaScript ${(js / 1024).toFixed(1)} KB gzipped exceeds 150 KB`);
  else if (js > BUDGET.jsTarget) report('warn', page.path, `JavaScript ${(js / 1024).toFixed(1)} KB gzipped exceeds the 15 KB target`);

  let css = 0;
  for (const link of root.querySelectorAll('link[rel="stylesheet"]')) css += gz(join(STATIC, link.getAttribute('href')!));
  for (const style of root.querySelectorAll('style')) css += gzipSync(style.textContent).length;
  if (css > BUDGET.cssGzip) contentIssue(page.path, `CSS ${(css / 1024).toFixed(1)} KB gzipped exceeds 40 KB`);
  const htmlGz = gzipSync(html).length;
  if (htmlGz > BUDGET.htmlGzip) contentIssue(page.path, `HTML ${(htmlGz / 1024).toFixed(1)} KB gzipped exceeds 60 KB`);
  if (!process.env.QUIET) console.log(`  ${page.path}  ${page.status}  html ${(htmlGz / 1024).toFixed(1)}K  css ${(css / 1024).toFixed(1)}K  js ${(js / 1024).toFixed(1)}K`);
}

// Sitemaps must list exactly the indexable pages.
const indexable = new Set(manifest.pages.filter((p) => p.indexable).map((p) => `https://www.easyclinic.io${p.path}`));
const listed = new Set<string>();
for (const name of existsSync(STATIC) ? readdirSync(STATIC).filter((f) => /^sitemap-(?!index).*\.xml$/.test(f)) : []) {
  for (const m of readFileSync(join(STATIC, name), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) listed.add(m[1]);
}
for (const url of listed) if (!indexable.has(url)) report('error', 'sitemap', `${url} is listed but not indexable`);
for (const url of indexable) if (!listed.has(url)) report('error', 'sitemap', `${url} is indexable but missing from the sitemap`);

console.log(`\ncheck-output (${strict ? 'production' : 'preview'}): ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
