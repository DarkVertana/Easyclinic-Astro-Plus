/**
 * Imports the live privacy policy and terms of service from WordPress as legal MDX pages, verbatim apart
 * from the HTML-to-Markdown conversion. Legal text is not rewritten here; changes go through legal review.
 *
 * Usage: node scripts/import-legal.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import TurndownService from 'turndown';
// @ts-expect-error no bundled types
import { gfm } from 'turndown-plugin-gfm';
import { stringify } from 'yaml';

const PAGES = [
  { slug: 'privacy-policy', file: 'privacy.mdx', path: '/privacy/', title: 'Privacy Policy: Easy Clinic', h1: 'Privacy policy', linkLabel: 'Privacy', headKeyword: 'Easy Clinic privacy policy', meta: 'How Novel Medicare Solutions Pvt Ltd, the company behind Easy Clinic, collects, uses and protects personal data on this website and in the product.' },
  { slug: 'terms-of-service', file: 'terms.mdx', path: '/terms/', title: 'Terms of Service: Easy Clinic', h1: 'Terms of service', linkLabel: 'Terms', headKeyword: 'Easy Clinic terms of service', meta: 'The terms of service that apply when you use the Easy Clinic website and software from Novel Medicare Solutions Pvt Ltd.' },
];

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
td.use(gfm);
td.remove(['script', 'style', 'iframe', 'noscript']);
const mdxSafe = (md: string) =>
  md
    .split(/(```[\s\S]*?```|`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/<(?=[A-Za-z/!])/g, '&lt;')))
    .join('');

mkdirSync(join(process.cwd(), 'src/content/legal'), { recursive: true });
for (const page of PAGES) {
  const res = await fetch(`https://www.easyclinic.io/wp-json/wp/v2/pages?slug=${page.slug}&_fields=modified,content`, { headers: { 'user-agent': 'Easy Clinic site migration' } });
  const [wp] = (await res.json()) as Array<{ modified: string; content: { rendered: string } }>;
  const html = wp.content.rendered.replace(/href="https?:\/\/(?:www\.)?easyclinic\.io(\/[^"#?]*)?([^"]*)"/g, (_, p = '/', rest) => `href="${p.endsWith('/') ? p : `${p}/`}${rest}"`);
  const body = mdxSafe(td.turndown(html))
    .replace(/^(#{1,6}) \*\*(.+?)\*\*\s*$/gm, '$1 $2')
    .replace(/^# /gm, '## ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const fm = {
    status: 'published',
    path: page.path,
    headKeyword: page.headKeyword,
    title: page.title,
    metaDescription: page.meta,
    h1: page.h1,
    linkLabel: page.linkLabel,
    openingAnswer: `This is the ${page.h1.toLowerCase()} of Novel Medicare Solutions Pvt Ltd, the company behind Easy Clinic, as published on easyclinic.io.`,
    author: null,
    lastUpdated: wp.modified.slice(0, 10),
    ctas: { primary: { label: 'Contact us about this policy', href: '/contact-us/' } },
    links: { related: [{ href: '/trust/' }, { href: '/contact-us/' }] },
    notes: [`Imported verbatim from https://www.easyclinic.io/${page.slug}/ (modified ${wp.modified.slice(0, 10)}). Spec 5.19 asks for a rewritten master policy and four country pages; both need legal review before they replace this text.`],
  };
  writeFileSync(join(process.cwd(), 'src/content/legal', page.file), `---\n${stringify(fm, { lineWidth: 0 })}---\n\n${body}\n`);
  console.log(`✓ ${page.path} (${body.length} chars, modified ${wp.modified.slice(0, 10)})`);
}
