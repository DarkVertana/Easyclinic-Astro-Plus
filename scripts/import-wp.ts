/**
 * Imports WordPress posts from the live site into MDX guide entries (plan Phase 1: the ranking
 * start-a-clinic guides keep their slugs). Downloads images next to each guide so nothing depends on
 * the WordPress host after cutover. Imported guides start as drafts; the refresh pass (spec 5.18) adds
 * the byline, date, licensing checklist, cost table, "choosing software" section and InlineCta.
 *
 * Usage: node scripts/import-wp.ts <slug> [<slug> ...] [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import TurndownService from 'turndown';
// @ts-expect-error no bundled types
import { gfm } from 'turndown-plugin-gfm';
import { stringify } from 'yaml';

const WP = 'https://www.easyclinic.io';
const UA = { 'user-agent': 'EasyClinic site migration (Astro rebuild)' };
const slugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');

/** Head keywords from spec 4.4. */
const KEYWORDS: Record<string, string> = {
  'the-ultimate-guide-to-starting-a-clinic-in-kenya': 'how to start a clinic in Kenya',
  'how-do-i-get-approval-from-the-kmpdc-in-kenya': 'KMPDC registration for clinics',
  'how-much-does-it-cost-to-open-a-clinic-in-nairobi': 'cost of opening a clinic in Nairobi',
  'clinic-in-uganda': 'how to start a clinic in Uganda',
  'clinic-in-india': 'how to start a clinic in India',
  'how-to-setup-clinic-legally-in-india-compliance-guide': 'clinic licences in India',
  'how-much-does-it-cost-to-open-a-clinic-in-mumbai': 'clinic setup cost in Mumbai',
  'how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci': 'NMC registration for clinics',
  'patient-data-privacy-laws-in-india': 'patient data privacy laws India',
};
/** Country for links and the demo CTA. */
const COUNTRY: Record<string, string> = { kenya: 'ke', nairobi: 'ke', kmpdc: 'ke', india: 'in', mumbai: 'in', nmc: 'in', uganda: 'ug' };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();

function turndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
  td.use(gfm);
  // Drop the in-content table of contents: the guide template renders one from the headings.
  td.addRule('toc', {
    filter: (node) => node.nodeName === 'UL' && /href="#/.test((node as HTMLElement).outerHTML) && ((node as HTMLElement).previousElementSibling?.textContent ?? '').toLowerCase().includes('table of contents'),
    replacement: () => '',
  });
  td.addRule('tocHeading', {
    filter: (node) => /^H[2-4]$/.test(node.nodeName) && (node.textContent ?? '').trim().toLowerCase() === 'table of contents',
    replacement: () => '',
  });
  td.remove(['script', 'style', 'iframe', 'noscript']);
  return td;
}

/** MDX treats {, } and <letter as syntax; escape them outside code. */
function mdxSafe(md: string): string {
  return md
    .split(/(```[\s\S]*?```|`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/<(?=[A-Za-z/!])/g, '&lt;')))
    .join('');
}

async function download(url: string, dir: string): Promise<string | null> {
  const clean = url.split('?')[0];
  const name = clean.split('/').pop()!.replace(/[^a-zA-Z0-9._-]/g, '-');
  const target = join(dir, name);
  if (!existsSync(target)) {
    const res = await fetch(clean, { headers: UA });
    if (!res.ok) return null;
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
  return `./images/${name}`;
}

for (const slug of slugs) {
  const dir = join(process.cwd(), 'src/content/guides', slug);
  const file = join(dir, 'index.mdx');
  if (existsSync(file) && !force) {
    console.log(`skip ${slug} (exists; --force to overwrite)`);
    continue;
  }
  const res = await fetch(`${WP}/wp-json/wp/v2/posts?slug=${slug}&_fields=slug,title,date,modified,excerpt,content,link`, { headers: UA });
  const [post] = (await res.json()) as Array<{ title: { rendered: string }; date: string; modified: string; excerpt: { rendered: string }; content: { rendered: string } }>;
  if (!post) {
    console.error(`✗ ${slug}: not found`);
    continue;
  }
  mkdirSync(join(dir, 'images'), { recursive: true });

  let html = post.content.rendered;
  // Localise images; drop srcset and WordPress sizing attributes.
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)];
  for (const [tag, src] of images) {
    const local = /^https?:\/\/(www\.)?easyclinic\.io\/wp-content\//.test(src) ? await download(src, join(dir, 'images')) : null;
    const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? '';
    html = html.replace(tag, local ? `<img src="${local}" alt="${alt}">` : '');
  }
  // Internal links become site-relative with a trailing slash.
  html = html.replace(/href="https?:\/\/(?:www\.)?easyclinic\.io(\/[^"#?]*)?([^"]*)"/g, (_, path = '/', rest) => `href="${path.endsWith('/') ? path : `${path}/`}${rest}"`);

  const body = mdxSafe(turndown().turndown(html))
    // Headings are plain text (the template styles them), and the in-body TOC label goes with the TOC.
    .replace(/^(#{1,6}) \*\*(.+?)\*\*\s*$/gm, '$1 $2')
    .replace(/^\*\*Table of Contents\*\*\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const title = decode(post.title.rendered);
  const excerpt = decode(post.excerpt.rendered).replace(/\s*\[…\]$/, '');
  const countryKey = Object.keys(COUNTRY).find((k) => slug.includes(k));
  const country = countryKey ? COUNTRY[countryKey] : undefined;
  const demo = country === 'ke' ? '/kenyademo/' : country === 'in' ? '/indiademo/' : '/contact-us/#book-a-demo';

  const frontmatter = {
    status: 'draft',
    headKeyword: KEYWORDS[slug] ?? title.toLowerCase(),
    title,
    metaDescription: excerpt.length > 155 ? `${excerpt.slice(0, 150).replace(/\s+\S*$/, '')}…` : excerpt,
    h1: title,
    linkLabel: title.length > 48 ? title.slice(0, 45).replace(/\s+\S*$/, '') : title,
    openingAnswer: excerpt,
    author: null,
    lastUpdated: post.modified.slice(0, 10),
    ctas: { primary: { label: 'Book a 20-minute demo', href: demo } },
    links: { hub: '/start-a-clinic/', related: [] },
    notes: [`Imported from ${WP}/${slug}/ (published ${post.date.slice(0, 10)}, modified ${post.modified.slice(0, 10)}). Needs the spec 5.18 refresh before publishing.`],
  };
  writeFileSync(file, `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${body}\n`);
  console.log(`✓ ${slug}: ${body.length} chars, ${images.length} images`);
}
