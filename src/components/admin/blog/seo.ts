/**
 * The SEO checklist in the editor sidebar: plain, live checks on the post's fields and Markdown body, in the spirit of
 * Rank Math's analysis. Advisory only: the pre-publish checks (src/lib/admin/harness.ts) still decide what may publish.
 */

export type SeoState = 'pass' | 'warn' | 'fail';

export interface SeoItem {
  id: string;
  state: SeoState;
  /** What the check found, written as an instruction when it fails. */
  text: string;
  /** Field to jump to: a front matter key, or `body`. */
  target: string;
}

export interface SeoGroup {
  id: string;
  title: string;
  items: SeoItem[];
}

export interface SeoInput {
  slug: string;
  frontmatter: Record<string, any>;
  body: string;
  hasCover: boolean;
  /** Main keywords other published pages hold. Without it the "used before" check is skipped. */
  usedKeywords?: Array<{ keyword: string; path: string }>;
}

export interface SeoReport {
  score: number;
  groups: SeoGroup[];
  counts: Record<SeoState, number>;
}

/* ---------- Reading the post ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

/** Whole-phrase match, ignoring case and punctuation. */
export function hasKeyword(text: string, keyword: string): boolean {
  const k = norm(keyword);
  return k.length > 0 && ` ${norm(text)} `.includes(` ${k} `);
}

function countKeyword(text: string, keyword: string): number {
  const k = norm(keyword);
  if (!k) return 0;
  return ` ${norm(text)} `.split(` ${k} `).length - 1;
}

interface Parsed {
  text: string;
  words: number;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  paragraphs: string[];
}

export function parseBody(body: string): Parsed {
  const withoutCta = body.replace(/<InlineCta\b[^>]*>[\s\S]*?<\/InlineCta>/g, ' ');
  const images = [...withoutCta.matchAll(/!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g)].map((m) => ({ alt: m[1].trim(), src: m[2] }));
  const links = [...withoutCta.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)].map((m) => ({ text: m[1].replace(/[*_\\]/g, '').trim(), href: m[2] }));
  const headings = [...withoutCta.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].replace(/[*_\\]/g, '').trim() }));
  const text = withoutCta
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
    .replace(/[#>*_`|\\]/g, ' ')
    .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, ' ');
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const paragraphs = withoutCta
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(#|!\[|\||[-+] |\d+\. |>)/.test(p))
    .map((p) => p.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
  return { text, words, headings, links, images, paragraphs };
}

const isInternal = (href: string) => href.startsWith('/') || /^https?:\/\/(www\.)?easyclinic\.io/i.test(href);
const isExternal = (href: string) => /^https?:\/\//i.test(href) && !isInternal(href);
const pathOf = (href: string) => href.replace(/^https?:\/\/(www\.)?easyclinic\.io/i, '').split(/[?#]/)[0].replace(/\/?$/, '/');
const VAGUE = /^(click here|here|read more|more|learn more|this|link|this link|this page|this article)$/i;
const fileLike = (alt: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(alt) || /^(img|image|dsc|screenshot)[-_ ]?\d*$/i.test(alt);

/* ---------- The checks ---------- */

const item = (id: string, ok: boolean | SeoState, pass: string, fix: string, target: string, warnOnly = false): SeoItem => {
  const state: SeoState = typeof ok === 'string' ? ok : ok ? 'pass' : warnOnly ? 'warn' : 'fail';
  return { id, state, text: state === 'pass' ? pass : fix, target };
};

export function seoReport({ slug, frontmatter: fm, body, hasCover, usedKeywords }: SeoInput): SeoReport {
  const p = parseBody(body);
  const kw = String(fm.headKeyword ?? '').trim();
  const title = String(fm.title ?? '').trim();
  const meta = String(fm.metaDescription ?? '').trim();
  const h1 = String(fm.h1 ?? '').trim();
  const opening = String(fm.openingAnswer ?? '').trim();
  const owner = String(fm.owner ?? '').trim();
  const faq: Array<{ question?: string; answer?: string }> = Array.isArray(fm.faq) ? fm.faq : [];
  const fullText = `${opening} ${p.text}`;
  const totalWords = p.words + (opening ? opening.split(/\s+/).length : 0);

  /* Focus keyword */
  const keyword: SeoItem[] = [];
  if (!kw) {
    keyword.push(item('kw-set', false, '', 'Set a main keyword: the phrase people search to find this post.', 'headKeyword'));
  } else {
    const firstTenth = `${opening} ${p.text.split(/\s+/).slice(0, Math.max(60, Math.ceil(p.words / 10))).join(' ')}`;
    const slugWords = slug.split('-');
    const inSlug = norm(kw).split(' ').filter((w) => w.length > 2).every((w) => slugWords.includes(w));
    const times = countKeyword(fullText, kw);
    const density = totalWords ? (times * norm(kw).split(' ').length * 100) / totalWords : 0;
    keyword.push(
      item('kw-title', hasKeyword(title, kw), 'Main keyword is in the SEO title.', 'Use the main keyword in the SEO title, ideally near the start.', 'title'),
      item('kw-title-start', hasKeyword(title.split(/\s+/).slice(0, Math.ceil(title.split(/\s+/).length / 2)).join(' '), kw), 'Main keyword sits in the first half of the SEO title.', 'Move the main keyword towards the start of the SEO title.', 'title', true),
      item('kw-meta', hasKeyword(meta, kw), 'Main keyword is in the meta description.', 'Use the main keyword in the meta description.', 'metaDescription'),
      item('kw-url', inSlug, 'Main keyword is in the URL.', 'Put the main keyword in the URL (set it before the first publish).', 'slug'),
      item('kw-h1', hasKeyword(h1, kw), 'Main keyword is in the post title.', 'Use the main keyword in the post title.', 'h1'),
      item('kw-intro', hasKeyword(firstTenth, kw), 'Main keyword appears in the first 10% of the content.', 'Use the main keyword in the opening paragraph.', 'openingAnswer'),
      item('kw-subhead', p.headings.some((h) => hasKeyword(h.text, kw)), 'Main keyword is in a subheading.', 'Use the main keyword in at least one H2 or H3 subheading.', 'body', true),
      item(
        'kw-density',
        density === 0 ? 'fail' : density < 0.5 || density > 2.5 ? 'warn' : 'pass',
        `Keyword density is ${density.toFixed(2)}%: the main keyword appears ${times} times.`,
        density === 0 ? 'The main keyword is not in the content. Use it a few times where it reads naturally.' : density < 0.5 ? `Keyword density is ${density.toFixed(2)}% (${times} time${times === 1 ? '' : 's'}). Use the keyword a little more (aim for 0.5–2.5%).` : `Keyword density is ${density.toFixed(2)}% (${times} times): that reads as stuffing. Use it less (aim for 0.5–2.5%).`,
        'body',
      ),
    );
  }

  /* Title, description and URL */
  const meta_: SeoItem[] = [
    item('title-len', title.length >= 30 && title.length <= 60 ? 'pass' : title ? 'warn' : 'fail', `SEO title is ${title.length} characters.`, title ? `SEO title is ${title.length} characters. Aim for 30–60 so Google shows it whole.` : 'Write an SEO title.', 'title'),
    item('meta-len', meta.length >= 120 && meta.length <= 160 ? 'pass' : meta ? 'warn' : 'fail', `Meta description is ${meta.length} characters.`, meta ? `Meta description is ${meta.length} characters. Aim for 120–160.` : 'Write a meta description: the two lines under the title in Google.', 'metaDescription'),
    item('title-unique', !title || !meta || title !== meta, 'SEO title and meta description differ.', 'The meta description repeats the SEO title. Write it as a short summary instead.', 'metaDescription'),
    item('url-len', slug.length <= 60 && slug.split('-').length <= 8, 'URL is short and readable.', `URL is ${slug.split('-').length} words long. Keep it under 8 words.`, 'slug', true),
    item('h1', h1.length > 0, 'Post has a title.', 'Add a post title.', 'h1'),
  ];

  /* Content */
  const longParas = p.paragraphs.filter((x) => x.split(/\s+/).length > 150).length;
  let skipped = false;
  for (let i = 1, prev = 1; i <= p.headings.length; i++) { const l = p.headings[i - 1].level; if (l > prev + 1) skipped = true; prev = l; }
  const content: SeoItem[] = [
    item('length', totalWords >= 1000 ? 'pass' : totalWords >= 600 ? 'warn' : 'fail', `Content is ${totalWords.toLocaleString('en-GB')} words long.`, `Content is ${totalWords.toLocaleString('en-GB')} words. Posts that rank usually run 1,000 words or more.`, 'body'),
    item('subheads', p.headings.filter((h) => h.level === 2).length >= 2, 'Content is split into sections with H2 subheadings.', 'Break the content into sections with at least two H2 subheadings.', 'body'),
    item('no-h1', !p.headings.some((h) => h.level === 1), 'No second H1 inside the content.', 'The content has an H1. The post title is already the H1: change it to an H2.', 'body'),
    item('order', !skipped, 'Subheadings go in order (H2, then H3).', 'A subheading skips a level (for example H2 to H4). Keep them in order.', 'body', true),
    item('paras', longParas === 0, 'Paragraphs are a comfortable length.', `${longParas} paragraph${longParas === 1 ? ' is' : 's are'} over 150 words. Split long paragraphs.`, 'body', true),
    item('opening', opening.length > 0, 'Post has an opening paragraph.', 'Write the opening paragraph: answer the question in two or three sentences.', 'openingAnswer'),
  ];

  /* Links */
  const internal = p.links.filter((l) => isInternal(l.href));
  const external = p.links.filter((l) => isExternal(l.href));
  const vague = p.links.filter((l) => VAGUE.test(l.text));
  const links: SeoItem[] = [
    item('internal', internal.length >= 2 ? 'pass' : internal.length ? 'warn' : 'fail', `${internal.length} links to other Easy Clinic pages.`, internal.length ? 'Add at least one more link to another Easy Clinic page.' : 'Link to at least two other Easy Clinic pages.', 'body'),
    owner
      ? item('owner', internal.some((l) => pathOf(l.href) === pathOf(owner)), 'Links to its landing page.', `Link to the landing page (${owner}) somewhere in the content.`, 'body')
      : item('owner', false, '', 'Choose a landing page under “Topic and landing page”, then link to it.', 'owner', true),
    item('external', external.length >= 1, `${external.length} link${external.length === 1 ? '' : 's'} to outside sources.`, 'Link to at least one trusted outside source (a study, regulator or official site).', 'body', true),
    item('anchors', vague.length === 0, 'Link text describes where each link goes.', `${vague.length} link${vague.length === 1 ? ' says' : 's say'} “${vague[0]?.text}”. Use words that say where the link goes.`, 'body'),
  ];

  /* Images */
  const noAlt = p.images.filter((i) => !i.alt || i.alt === 'Describe the image');
  const badAlt = p.images.filter((i) => i.alt && i.alt !== 'Describe the image' && (fileLike(i.alt) || i.alt.split(/\s+/).length < 3));
  const images: SeoItem[] = [
    item('cover', hasCover, 'Featured image is set.', 'Set a featured image. It is the picture shown when the post is shared.', 'image'),
    item('img-alt', noAlt.length === 0, p.images.length ? `All ${p.images.length} image${p.images.length === 1 ? ' has' : 's have'} alt text.` : 'No images without alt text.', `${noAlt.length} image${noAlt.length === 1 ? ' has' : 's have'} no alt text. Click the image and describe it in the bar under the toolbar.`, 'body'),
    item('img-alt-quality', badAlt.length === 0, 'Alt text describes each image.', `${badAlt.length} alt text${badAlt.length === 1 ? ' is' : 's are'} too short or a file name. Describe what the image shows in a few words.`, 'body', true),
  ];
  if (p.images.length === 0) images.push(item('img-any', totalWords < 600, '', 'Add at least one image or screenshot to break up the text.', 'body', true));
  if (kw && p.images.length) images.push(item('img-kw', p.images.some((i) => hasKeyword(i.alt, kw)), 'Main keyword is in an image’s alt text.', 'Use the main keyword in one image’s alt text, where it fits.', 'body', true));

  /* Rich results */
  const rich: SeoItem[] = [
    item('faq', faq.length >= 3 ? 'pass' : 'warn', `FAQ has ${faq.length} questions, eligible for FAQ rich results.`, faq.length ? `FAQ has ${faq.length} question${faq.length === 1 ? '' : 's'}. Add at least 3.` : 'Add 3 to 8 FAQ questions. They can show as rich results in Google.', 'faq'),
    item('excerpt', String(fm.summary ?? '').trim().length > 0, 'Excerpt is written.', 'Write an excerpt for blog cards and the “In short” box.', 'summary', true),
    item('author', String(fm.author ?? '').trim().length > 0, 'Author is set.', 'Choose an author. A named author helps Google trust the post.', 'author'),
  ];

  /* Additional, as Rank Math groups them: pulled from the lists above, plus URL length and keyword reuse. */
  const ADDITIONAL = new Set(['kw-subhead', 'img-kw', 'kw-density', 'external', 'internal']);
  const pick = (list: SeoItem[]) => list.filter((i) => ADDITIONAL.has(i.id));
  const drop = (list: SeoItem[]) => list.filter((i) => !ADDITIONAL.has(i.id));
  const urlChars = `easyclinic.io/${slug}/`.length;
  const additional: SeoItem[] = [
    ...pick(keyword),
    ...pick(images),
    item('url-chars', urlChars <= 75, `URL is ${urlChars} characters long.`, `URL is ${urlChars} characters long. Keep it under 75.`, 'slug', true),
    ...pick(links),
  ];
  if (kw && usedKeywords) {
    const clash = usedKeywords.find((u) => norm(u.keyword) === norm(kw));
    additional.push(item('kw-unique', !clash, 'You have not used this main keyword on another page.', `${clash?.path} already uses this main keyword. Pick a different one: two pages cannot share it.`, 'headKeyword'));
  }

  const groups: SeoGroup[] = [
    { id: 'keyword', title: 'Main keyword', items: drop(keyword) },
    { id: 'meta', title: 'Title, description and URL', items: meta_ },
    { id: 'content', title: 'Content', items: content },
    { id: 'links', title: 'Links', items: drop(links) },
    { id: 'images', title: 'Images', items: drop(images) },
    { id: 'additional', title: 'Additional', items: additional },
    { id: 'rich', title: 'Search extras', items: rich },
  ].map((g) => ({ ...g, items: g.items.filter((i) => i.text) }));

  const all = groups.flatMap((g) => g.items);
  const counts = { pass: 0, warn: 0, fail: 0 } as Record<SeoState, number>;
  for (const i of all) counts[i.state]++;
  const score = all.length ? Math.round(((counts.pass + counts.warn * 0.5) / all.length) * 100) : 0;
  return { score, groups, counts };
}
