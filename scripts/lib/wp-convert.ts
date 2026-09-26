/**
 * WordPress post HTML to MDX, and the frontmatter helpers, for scripts/import-wp.ts. Pure functions (no
 * network or file access) so tests/unit/posts.test.ts can pin the output.
 *
 * What counts as WordPress junk, and is removed: tables of contents (plugin blocks and hand-made lists of
 * in-page anchors), share and related-post widgets, scripts, embeds and forms, empty paragraphs, a heading
 * that opens the post before any text when it repeats the title, and every attribute except href, src and
 * alt (inline styles, classes, ids, Elementor and ChatGPT-paste data attributes). Heading levels are
 * normalised so the body starts at h2 and never skips a level.
 */
import { parse, type HTMLElement } from 'node-html-parser';
import TurndownService from 'turndown';
// @ts-expect-error no bundled types
import { gfm } from 'turndown-plugin-gfm';
import { POST_TOPICS, type PostTopic } from '../../src/schemas/constants.ts';

export const WP_ORIGIN = 'https://www.easyclinic.io';

/* ---------- Text helpers ---------- */

const ENTITIES: Record<string, string> = {
  '&#8217;': '’',
  '&rsquo;': '’',
  '&#8216;': '‘',
  '&lsquo;': '‘',
  '&#8220;': '“',
  '&ldquo;': '“',
  '&#8221;': '”',
  '&rdquo;': '”',
  '&#8211;': '–',
  '&ndash;': '–',
  '&#8212;': '—',
  '&mdash;': '—',
  '&#8230;': '…',
  '&hellip;': '…',
  '&#038;': '&',
  '&amp;': '&',
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

/** A numeric character reference (`&#215;`, `&#xd7;`) as its character, or undefined. */
function numericEntity(e: string): string | undefined {
  const m = e.match(/^&#(?:x([0-9a-f]+)|(\d+));$/i);
  if (!m) return undefined;
  const code = m[1] ? parseInt(m[1], 16) : Number(m[2]);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code === 160 ? 32 : code) : undefined;
}

/** Rendered WordPress text (a title or excerpt) to plain text. */
export function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#?[a-z0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? numericEntity(e) ?? e)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Where a sentence can end: terminal punctuation (and a closing quote or bracket) followed by the end of
 * the text, or by whitespace and something that starts a sentence (a capital, a digit, an opening quote or
 * bracket). A full stop inside a word or number ("a.m.", "e.g.", "2.5", "easyclinic.io") is not an end.
 */
const SENTENCE_END = /[.?!]+["”’)\]]*(?=\s+["“‘(\[]?[\p{Lu}\p{N}]|\s*$)/gu;
/** Abbreviations that are followed by a capital or a number without ending the sentence ("Dr. Rao", "Rs. 500"). */
const ABBREVIATION = /(?:^|[\s(])(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|No|Nos|vs|approx|Rs|Ksh|Inc|Ltd|Co|Fig|e\.g|i\.e)\.$/i;

/**
 * Splits `text` into its complete sentences and the unterminated text after the last one. Nothing is
 * thrown away: the sentences and `rest`, joined with spaces, are the whole text.
 */
export function splitSentences(text: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let start = 0;
  for (const m of text.matchAll(SENTENCE_END)) {
    const end = m.index + m[0].length;
    const candidate = text.slice(start, end).trim();
    if (!candidate || ABBREVIATION.test(candidate)) continue;
    sentences.push(candidate);
    start = end;
  }
  return { sentences, rest: text.slice(start).trim() };
}

/** Complete sentences from the start of `text` that fit in `max` characters (at least one sentence, cut at a word if needed). */
export function sentencesWithin(text: string, max: number): string {
  const clean = text.replace(/\s*\[…\]\s*$/, '').replace(/\s*…\s*$/, '').trim();
  const { sentences } = splitSentences(clean);
  let out = '';
  for (const s of sentences) {
    const next = `${out} ${s.trim()}`.trim();
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  // No sentence fits: cut the first one at a word boundary.
  const cut = clean.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,:;–—-]+$/, '');
  return `${cut}…`;
}

/**
 * Whole sentences from the start of `lead` within `max` characters; when they come to less than `min`
 * (one short sentence before a long one), a word-boundary cut at `max` instead.
 */
export function cutWithin(lead: string, max: number, min: number): string {
  const whole = sentencesWithin(lead, max);
  if (whole.length >= min || lead.length <= whole.length) return whole;
  return `${lead.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,:;–—-]+$/, '')}…`;
}

/** Meta description: schema minimum 40 characters, rules 70 to 155. */
export const metaFrom = (lead: string) => cutWithin(lead, 155, 70);
/** Summary for cards and the /blog/ list: schema maximum 220 characters. */
export const summaryFrom = (lead: string) => cutWithin(lead, 220, 100);

/** The first `n` sentences of `text`, within `max` characters. */
export function firstSentences(text: string, n: number, max: number): string {
  const { sentences } = splitSentences(text);
  return sentencesWithin(sentences.slice(0, n).join(' ').trim() || text, max);
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const INLINE_TAGS = new Set(['A', 'ABBR', 'B', 'BR', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'INS', 'MARK', 'Q', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U']);
type LeadBlock = { kind: 'heading' | 'text' | 'other'; text: string };

/**
 * A post's blocks in reading order: headings, text (paragraphs, and runs of bare text and inline tags,
 * which some WordPress posts use instead of paragraphs) and everything else (lists, tables, figures).
 * Wrappers such as Elementor's divs are read through.
 */
function leadBlocks(container: HTMLElement): LeadBlock[] {
  const out: LeadBlock[] = [];
  let run = '';
  const flush = () => {
    if (squash(run)) out.push({ kind: 'text', text: squash(run) });
    run = '';
  };
  for (const node of container.childNodes) {
    if (node.nodeType === 3) {
      run += node.text;
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as HTMLElement;
    if (INLINE_TAGS.has(el.tagName)) {
      run += el.tagName === 'BR' ? ' ' : el.text;
      continue;
    }
    flush();
    if (/^H[1-6]$/.test(el.tagName)) out.push({ kind: 'heading', text: squash(el.text) });
    else if (el.tagName === 'P') out.push({ kind: 'text', text: squash(el.text) });
    else if (/^(?:UL|OL|DL|TABLE|FIGURE|BLOCKQUOTE|PRE|IMG|HR)$/.test(el.tagName)) out.push({ kind: 'other', text: squash(el.text) });
    else out.push(...leadBlocks(el));
  }
  flush();
  return out.filter((b) => b.kind !== 'text' || b.text);
}

/** Lead text shorter than this (the meta description rules' minimum) runs on past a heading. */
const LEAD_MIN = 70;

/**
 * The text an imported draft's opening answer, summary and meta description are cut from. A manual
 * excerpt is used as written. Otherwise the post's opening text: its paragraphs (and bare text) before the
 * first heading that follows some text, so a later section never runs into the lead, up to about 600
 * characters. (Only an opening shorter than a meta description runs on into the next section.) A post with
 * no text at all falls back to WordPress's automatic excerpt (the first 55 words, ending "[…]"), without
 * the leading heading (`firstHeading`, the raw post's first heading) that the excerpt runs into the text.
 */
export function leadText(excerpt: string, cleanedHtml: string, firstHeading = ''): string {
  if (excerpt && !/(?:\[…\]|…)\s*$/.test(excerpt)) return excerpt;
  let lead = '';
  for (const block of leadBlocks(parse(cleanedHtml))) {
    if (block.kind === 'heading' && lead.length >= LEAD_MIN) break;
    if (block.kind !== 'text') continue;
    lead = `${lead} ${block.text}`.trim();
    if (lead.length >= 600) break;
  }
  if (lead) return lead;
  const heading = squash(firstHeading);
  return heading && excerpt.toLowerCase().startsWith(heading.toLowerCase()) ? excerpt.slice(heading.length).trim() : excerpt;
}

/** The text of the first heading in a post's raw HTML (what WordPress's automatic excerpt starts with). */
export function firstHeadingText(html: string): string {
  return squash(parse(html, { comment: false }).querySelector('h1, h2, h3, h4, h5, h6')?.text ?? '');
}

/** Link label (schema: 2 to 48 characters): the part before a colon or question mark when it fits, else a word-boundary cut. */
export function linkLabelFrom(title: string): string {
  const head = title.split(/[:?|]/)[0].trim();
  if (head.length >= 12 && head.length <= 48) return head;
  if (title.length <= 48) return title.replace(/[?]$/, '');
  const cut = title.slice(0, 48).replace(/\s+\S*$/, '');
  return cut.replace(/\s+(?:and|or|the|a|an|of|for|to|in|with|on|&)$/i, '').replace(/[,:;–—-]+$/, '');
}

/** Head keyword from the title: lower case, without a trailing question mark or year. The refresh sets the real one. */
export function keywordFrom(title: string): string {
  const head = title.split(/[:?|]/)[0].trim();
  return (head.split(/\s+/).length >= 3 ? head : title)
    .toLowerCase()
    .replace(/[?!.]+$/, '')
    .replace(/\s+(?:in|for)\s+20\d\d$/, '')
    .replace(/\s+20\d\d$/, '')
    .trim();
}

/* ---------- Owner and topic ---------- */

/**
 * Owner page (the manifest's owner_page) to /blog/ topic (spec 5.19). The owner is the landing page a
 * post feeds; the topic is where /blog/ lists it. First match wins; editors can change either per post.
 *
 *   /features/emr/, /switch/                           switching-to-emr
 *   /solutions/clinic-chain/, /features/multi-location/ running-a-chain
 *   /trust/, /privacy/...                              compliance-by-country
 *   /ai/, /curapilot/                                  cura-ai
 *   /features/billing|insurance-claims|revenue-management/   billing-and-claims
 *   /features/whatsapp|patient-engagement|appointment-scheduling|telehealth/   patient-engagement
 *   /start-a-clinic/ and the country pages             start-a-clinic (their kept posts are about opening a clinic there)
 *   anything else (pharmacy, lab, reports, /blog/)     running-a-clinic
 */
export const TOPIC_BY_OWNER: Array<[RegExp, PostTopic]> = [
  [/^\/features\/emr\/$|^\/switch\/$/, 'switching-to-emr'],
  [/^\/solutions\/clinic-chain\/$|^\/features\/multi-location\/$/, 'running-a-chain'],
  [/^\/trust\/$|^\/privacy\//, 'compliance-by-country'],
  [/^\/(?:ai|curapilot)\/$/, 'cura-ai'],
  [/^\/features\/(?:billing|insurance-claims|revenue-management)\/$/, 'billing-and-claims'],
  [/^\/features\/(?:whatsapp|patient-engagement|appointment-scheduling|telehealth)\/$/, 'patient-engagement'],
  [/^\/start-a-clinic\/$|^\/(?:clinic-management-software-[a-z-]+|emr-software-in-kenya|hospital-management-software-nigeria)\/$/, 'start-a-clinic'],
];

export function topicForOwner(owner: string): PostTopic {
  const topic = TOPIC_BY_OWNER.find(([re]) => re.test(owner))?.[1] ?? 'running-a-clinic';
  if (!POST_TOPICS.includes(topic)) throw new Error(`Unknown topic ${topic}`);
  return topic;
}

/**
 * A post the manifest gives to /blog/ has no landing page to take a topic from, so its topic comes from
 * its slug and title instead (lower case, hyphens read as spaces). First match wins; no match is
 * running-a-clinic. The result is provisional: the importer notes it, and naming a real owner settles it.
 *
 *   start, open or set up a clinic                         start-a-clinic
 *   migration, legacy system, switching to                 switching-to-emr
 *   AI, transcription, virtual clinical assistant          cura-ai
 *   payment, billing, financing, insurance, claims, NHIS   billing-and-claims
 *   multiple sites or locations, multi-location, chain     running-a-chain (a "supply chain" is not one)
 *   patient portal, WhatsApp, teleconsultation, telemedicine, CRM, automated communication
 *                                                          patient-engagement
 */
export const TOPIC_BY_KEYWORD: Array<[RegExp, PostTopic]> = [
  [/\b(?:start(?:ing)?|open(?:ing)?|set(?:ting)? up|setup)(?: an?| your)?(?: new)? clinic\b/, 'start-a-clinic'],
  [/\bmigrat(?:e|ion|ing)\b|\blegacy\b|\bswitch(?:ing)? to\b/, 'switching-to-emr'],
  [/\bai\b|\btranscription\b|\bvirtual clinical assistant\b/, 'cura-ai'],
  [/\bpayments?\b|\bbilling\b|\bfinancing\b|\binsurance\b|\bclaims?\b|\bnhis\b/, 'billing-and-claims'],
  [/\bmultiple (?:clinic )?(?:sites|locations|branches)\b|\bmulti(?: |-)?location\b|(?<!supply )\bchains?\b/, 'running-a-chain'],
  [/\bportals?\b|\bwhatsapp\b|\bteleconsult(?:ation)?s?\b|\btele(?:medicine|health)\b|\bcrm\b|\bautomated communication\b/, 'patient-engagement'],
];

/** A post's /blog/ topic: from its owner, or, for a post owned by /blog/, from its slug and title (provisional). */
export function topicForPost(owner: string, slug: string, title: string): { topic: PostTopic; provisional: boolean } {
  if (owner !== '/blog/') return { topic: topicForOwner(owner), provisional: false };
  const text = `${slug.replace(/-/g, ' ')} ${title}`.toLowerCase();
  return { topic: TOPIC_BY_KEYWORD.find(([re]) => re.test(text))?.[1] ?? 'running-a-clinic', provisional: true };
}

/** Demo page for the call to action: the country's own demo page where the slug names a country, else the contact page. */
export function demoHrefFor(slug: string, owner = ''): string {
  const key = `${slug} ${owner}`;
  if (/kenya|nairobi|kmpdc|nhif/.test(key)) return '/kenyademo/';
  if (/india|mumbai|nmc|abdm|ndhm|tier-2|upi/.test(key)) return '/indiademo/';
  if (/nigeria|lagos/.test(key)) return '/nigeriademo/';
  if (/dubai|uae|abu-dhabi/.test(key)) return '/uaedemo/';
  return '/contact-us/#book-a-demo';
}

/* ---------- HTML clean-up ---------- */

const REMOVE_TAGS = 'script, style, iframe, noscript, form, button, input, select, textarea, svg, nav, object, embed, video, audio';
/** Class or id fragments of TOC, sharing and related-post widgets. */
const JUNK = /\b(?:ez-toc|lwptoc|rank-math-toc|toc_container|table-of-contents|elementor-toc|sharedaddy|sd-sharing|addtoany|a2a_kit|social-share|share-buttons|elementor-share|jp-relatedposts|related-posts|yarpp)/i;
const KEEP_ATTRS: Record<string, string[]> = { a: ['href'], img: ['src', 'alt'] };

/** Links to the site: www.easyclinic.io, easyclinic.io, or the staging server's bare IP address. */
const SITE_LINK = /^https?:\/\/(?:(?:www\.)?easyclinic\.io|143\.198\.231\.228)(\/[^?#\s]*)?([?#]\S*)?$/;

const textOf = (el: HTMLElement) => el.text.replace(/ /g, ' ').trim();
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An image's real source: lazy-load plugins park it in data-src or data-lazy-src behind a data: placeholder. */
function imageSource(img: HTMLElement): string | undefined {
  return [img.getAttribute('src'), img.getAttribute('data-src'), img.getAttribute('data-lazy-src')].find((s): s is string => !!s && !s.startsWith('data:'));
}

/** Every image source in the post, for downloading before the clean-up. */
export function imageSources(html: string): string[] {
  return parse(html, { comment: false })
    .querySelectorAll('img')
    .map(imageSource)
    .filter((s): s is string => !!s);
}

const STOP_WORDS = new Set('a an and are as at by can do does for from how in is it its of on or our the this that to we what why with you your'.split(' '));
/** A heading's or title's content words, lower case, singular. */
const contentWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w));

/** True when most (60% or more) of a heading's content words are in the title: a subtitle that repeats it. */
export function repeatsTitle(heading: string, title: string): boolean {
  const words = contentWords(heading);
  const inTitle = new Set(contentWords(title));
  return words.length > 0 && inTitle.size > 0 && words.filter((w) => inTitle.has(w)).length / words.length >= 0.6;
}

/** A paragraph that is only a Markdown link with no text, pasted in as literal text ("[](https://…)"): a lost citation. */
const LITERAL_EMPTY_LINK = /^\[\]\((https?:\/\/\S+?)\)$/;

/**
 * Cleans a post's HTML. `localImages` maps each image source to its downloaded copy (`./images/x.png`);
 * an image with no local copy (a failed download, or one hosted elsewhere) is dropped. `title` is the
 * post's title: a heading that opens the post before any text is dropped only when it repeats it.
 */
export function cleanHtml(html: string, localImages: Map<string, string | null> = new Map(), title = ''): string {
  const root = parse(html, { comment: false });
  const h1s = new Set(root.querySelectorAll('h1'));
  for (const el of root.querySelectorAll(REMOVE_TAGS)) el.remove();
  for (const el of root.querySelectorAll('[class], [id]')) {
    if (JUNK.test(`${el.getAttribute('class') ?? ''} ${el.getAttribute('id') ?? ''}`)) el.remove();
  }

  // Hand-made tables of contents: a "Table of contents" label and the list of in-page anchors after it,
  // or any list whose links all point inside the page.
  for (const el of root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, strong, b')) {
    if (/^(?:table of contents|contents|in this article)\s*:?$/i.test(textOf(el))) {
      const next = el.nextElementSibling;
      if (next && /^(?:UL|OL)$/.test(next.tagName)) next.remove();
      el.remove();
    }
  }
  for (const list of root.querySelectorAll('ul, ol')) {
    const links = list.querySelectorAll('a');
    if (links.length >= 3 && links.every((a) => (a.getAttribute('href') ?? '').startsWith('#'))) list.remove();
  }

  // Images: point at the local copy (resolving lazy-load attributes first), or drop the image.
  for (const img of root.querySelectorAll('img')) {
    const src = imageSource(img);
    const local = src ? localImages.get(src) : null;
    if (local) img.setAttribute('src', local);
    else img.remove();
  }

  // Every attribute except href, src and alt goes: inline styles, classes, ids, data-* and aria-*.
  for (const el of root.querySelectorAll('*')) {
    const keep = KEEP_ATTRS[el.tagName.toLowerCase()] ?? [];
    for (const name of Object.keys(el.attributes)) if (!keep.includes(name.toLowerCase())) el.removeAttribute(name);
  }

  // Links: site links (including the staging server's bare IP, which some posts link to) become relative
  // with a trailing slash, and a site URL used as the link text reads as the www address. In-page anchors
  // (their targets' ids are gone) and empty links become plain text; line breaks inside a link go.
  for (const a of root.querySelectorAll('a')) {
    for (const br of a.querySelectorAll('br')) br.replaceWith(' ');
    const href = a.getAttribute('href') ?? '';
    const site = href.match(SITE_LINK);
    if (!href || href.startsWith('#') || !textOf(a)) {
      a.replaceWith(a.innerHTML);
    } else if (site && !/^\/wp-content\//.test(site[1] ?? '/')) {
      const path = site[1] || '/';
      const hasExt = /\.[a-z0-9]+$/i.test(path);
      const local = hasExt || path.endsWith('/') ? path : `${path}/`;
      a.setAttribute('href', `${local}${(site[2] ?? '').startsWith('#') ? site[2] : ''}`);
      if (SITE_LINK.test(textOf(a)) || /^(?:www\.)?easyclinic\.io\//.test(textOf(a))) {
        // Keep the whitespace around the old text, which turndown moves outside the link.
        const pad = (re: RegExp) => (re.test(a.text) ? ' ' : '');
        a.set_content(`${pad(/^\s/)}${escapeHtml(`www.easyclinic.io${local}`)}${pad(/\s$/)}`);
      }
    }
  }

  // A citation pasted as literal Markdown with no link text ("[](https://…)") becomes a labelled source link.
  for (const p of root.querySelectorAll('p')) {
    const m = textOf(p).match(LITERAL_EMPTY_LINK);
    if (!m) continue;
    let host: string;
    try {
      host = new URL(m[1]).hostname.replace(/^www\./, '');
    } catch {
      p.remove();
      continue;
    }
    p.set_content(`Source: <a href="${escapeHtml(m[1]).replace(/"/g, '&quot;')}">${escapeHtml(host)}</a>`);
  }

  // Tracking parameters pasted in with links (utm_source=chatgpt.com and the like).
  for (const a of root.querySelectorAll('a[href*="utm_"]')) {
    const url = new URL(a.getAttribute('href')!, WP_ORIGIN);
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
    a.setAttribute('href', a.getAttribute('href')!.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.href);
  }

  // Headings: plain text (the template styles them), never H1 (the template renders the page H1). A
  // heading inside a list item is a bold lead-in, not a section.
  for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const text = textOf(h).replace(/\s+/g, ' ');
    if (!text) {
      h.remove();
      continue;
    }
    if (h.closest('li')) {
      h.replaceWith(`<p><strong>${escapeHtml(text)}</strong></p>`);
      continue;
    }
    if (h.tagName === 'H1') h.tagName = 'h2';
    h.set_content(escapeHtml(text));
  }

  // Empty paragraphs and list items.
  for (const el of root.querySelectorAll('p, li')) {
    if (!textOf(el) && !el.querySelector('img')) el.remove();
  }

  // A heading before any text that was the post's H1 or repeats the title: drop it (the template renders
  // the H1). Any other opening heading ("1. Introduction") is a real section and stays.
  if (leadBlocks(root)[0]?.kind === 'heading') {
    const first = root.querySelector('h2, h3, h4, h5, h6');
    if (first && (h1s.has(first) || repeatsTitle(textOf(first), title))) first.remove();
  }

  // Heading levels: the body starts at h2 (the template's H1 is the only h1) and never skips a level. Each
  // heading sits one level below the nearest earlier heading of a shallower source level, so an h3-only
  // post becomes h2s, and h4s straight after an h2 become h3s.
  const open: Array<{ source: number; level: number }> = [];
  for (const h of root.querySelectorAll('h2, h3, h4, h5, h6')) {
    const source = Number(h.tagName[1]);
    while (open.length && open[open.length - 1].source >= source) open.pop();
    const level = Math.min((open[open.length - 1]?.level ?? 1) + 1, 6);
    h.tagName = `h${level}`;
    open.push({ source, level });
  }

  // Tables: GFM has one header row, then the body. Rows after the first in a <thead> move to the body
  // (turndown would otherwise write a "| --- |" rule after each), the first row's cells become header
  // cells, and empty tables go.
  for (const table of root.querySelectorAll('table')) {
    if (!table.querySelector('tr')) {
      table.remove();
      continue;
    }
    const thead = table.querySelector('thead');
    const extra = thead ? thead.querySelectorAll('tr').slice(1) : [];
    if (thead && extra.length) {
      const moved = extra.map((row) => row.toString()).join('');
      for (const row of extra) row.remove();
      const tbody = table.querySelector('tbody');
      if (tbody) tbody.insertAdjacentHTML('afterbegin', moved);
      else thead.insertAdjacentHTML('afterend', `<tbody>${moved}</tbody>`);
    }
    for (const cell of table.querySelector('tr')!.querySelectorAll('td')) cell.tagName = 'th';
  }

  return root.toString();
}

/* ---------- Markdown ---------- */

function turndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', strongDelimiter: '**' });
  td.use(gfm);
  // Table cells hold one line in GFM: flatten paragraphs, lists and line breaks, and escape pipes.
  td.addRule('flatCell', {
    filter: ['th', 'td'],
    replacement: (content, node) => {
      const flat = content.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').replace(/\|/g, '\\|').trim();
      const index = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node);
      return `${index === 0 ? '| ' : ' '}${flat} |`;
    },
  });
  return td;
}

/**
 * Makes Markdown safe for MDX outside code: `{` and `}` start expressions, `<` starts JSX, and a line that
 * begins with `import ` or `export ` is read as ESM.
 */
export function mdxSafe(md: string): string {
  return md
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/[{}]/g, (c) => `\\${c}`)
            .replace(/</g, '&lt;')
            .replace(/^(\s*)(import|export)(\s)/gm, (_, sp, word, ws) => `${sp}&#${word.charCodeAt(0)};${word.slice(1)}${ws}`),
    )
    .join('');
}

/** Cleaned WordPress HTML to an MDX body. */
export function htmlToMdx(html: string): string {
  return mdxSafe(turndown().turndown(html))
    .replace(/ /g, ' ')
    .replace(/^(#{1,6}) \*\*(.+?)\*\*\s*$/gm, '$1 $2')
    .replace(/^\s*(?:\*\*|\*|__)\s*$/gm, '')
    .replace(/^(\s*)- {3}/gm, '$1- ')
    .replace(/(\S) {2,}(?=\S)/g, '$1 ')
    .replace(/[ \t]+$/gm, (m) => (m === '  ' ? m : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
