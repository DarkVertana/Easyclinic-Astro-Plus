/**
 * String-level writing rules from spec 6.1, 6.2 and 6.4, applied to every string in a content entry
 * (and to MDX bodies by scripts/lint-content.ts). Pure functions: no Astro imports, runnable by Node.
 */

export type Severity = 'error' | 'warning';

export interface Issue {
  rule: string;
  severity: Severity;
  path: string;
  message: string;
  excerpt?: string;
}

/** [bracketed placeholder], not a markdown link `[text](url)` or reference `[text][ref]`. */
export const PLACEHOLDER = /(?<!\])\[(?!\s*\])([^[\]\n]{1,160})\](?![([:])/g;

/** Spec 6.2 banned vocabulary, with inflections. Quotes are exempt (they are verbatim). */
const BANNED: Array<[RegExp, string]> = [
  [/\bseamless(?:ly)?\b/i, 'seamless'],
  [/\bstreamlin(?:e|es|ed|ing)\b/i, 'streamline'],
  [/\bempower(?:s|ed|ing|ment)?\b/i, 'empower'],
  [/\brobust(?:ly)?\b/i, 'robust'],
  [/\bcomprehensive(?:ly)?\b/i, 'comprehensive'],
  [/\bleverag(?:e|es|ed|ing)\b/i, 'leverage'],
  [/\bcutting[- ]edge\b/i, 'cutting-edge'],
  [/\bholistic(?:ally)?\b/i, 'holistic'],
  [/\belevat(?:e|es|ed|ing)\b/i, 'elevate'],
  [/\bunlock(?:s|ed|ing)?\b/i, 'unlock'],
  [/\bhassle[- ]free\b/i, 'hassle-free'],
  [/\bone[- ]stop\b/i, 'one-stop'],
  [/\bend[- ]to[- ]end\b/i, 'end-to-end'],
  [/\brevolutioni[sz](?:e|es|ed|ing)\b|\brevolutionary\b/i, 'revolutionise'],
  [/\bnext[- ]generation\b|\bnext[- ]gen\b/i, 'next-generation'],
  [/\bstate[- ]of[- ]the[- ]art\b/i, 'state-of-the-art'],
  [/\bfor modern healthcare\b/i, 'for modern healthcare'],
  [/\bmodern clinics?\b/i, 'modern clinics'],
  [/\bworld[- ]class\b/i, 'world-class'],
];

/** Phrases that contain a banned word but are allowed (a competitor name, a technical term). */
const ALLOWLIST = [/\bStreamline Health\b/g, /\bend-to-end encrypt(?:ed|ion)\b/gi];

const NON_ANSWER = /\bconfirm(?:ed)?(?: it)? (?:in|during) (?:the |a )?demo\b|\bdiscuss(?:ed)? on the call\b|\b(?:work )?in progress\b|\bcoming soon\b|\bask (?:us )?in (?:the |a )?demo\b/i;

const STAT_LINE = [
  /5,?000\+?\s*doctors\s*[·•|,\-–—]\s*18 countries/i,
  /\bExplore the rest of the platform\b/i,
  /\bPut EMR, billing,? and care in one place\b/i,
  /Frequently Asked Questions for AI Featured Snippets/i,
];

/** Spec 1.2: one spelling, exactly two AI names. The legal entity name is allowed. */
const NAMING: Array<[RegExp, string]> = [
  [/\bEasy Clinic\b/, 'Write "EasyClinic" as one word'],
  [/\bEasyclinic\b|\bEASYCLINIC\b|\beasyClinic\b/, 'Write "EasyClinic" with a capital C'],
  [/\bAI Assistant\b/, 'The plan feature is "Cura AI (documentation)"'],
  [/\bEasy ?Clinic AI\b/, 'The AI features are called "Cura AI"'],
  [/\bCura ?Pilot AI\b|\bCurapilot\b|\bCura-Pilot\b/, 'Write "CuraPilot"'],
  [/\bCuraAI\b|\bCura-AI\b/, 'Write "Cura AI"'],
];

const WEAK_CTA = /^(?:get started|learn more|read more|click here|submit|know more|explore)$/i;

/** Keys whose values are headings or metadata, where an em dash is an error (body text: warning). */
export const HEADING_KEYS = new Set(['title', 'metaDescription', 'h1', 'heading', 'question', 'linkLabel', 'label']);

function stripMarkup(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\]\([^)]*\)/g, ']') // link targets
    .replace(/\{(?:price|fact|fig|contact):[^}]+\}/g, 'TOKEN') // tokens
    .replace(/`[^`]*`/g, ''); // inline code
}

function allowlisted(text: string): string {
  let out = text;
  for (const re of ALLOWLIST) out = out.replace(re, '');
  return out;
}

function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - 30);
  return `${start > 0 ? '…' : ''}${text.slice(start, index + 40).trim()}${index + 40 < text.length ? '…' : ''}`;
}

export interface TextContext {
  path: string;
  key: string;
  /** Verbatim quotes: only the placeholder rule applies. */
  verbatim: boolean;
  /** CTA labels get the weak-label rule. */
  isCtaLabel: boolean;
}

export function checkText(raw: string, ctx: TextContext): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: string, severity: Severity, message: string, index = 0) =>
    issues.push({ rule, severity, path: ctx.path, message, excerpt: excerpt(raw, index) });

  for (const match of raw.matchAll(PLACEHOLDER)) {
    add('placeholder', 'error', `Unfilled placeholder ${match[0]}`, match.index ?? 0);
  }
  if (ctx.verbatim) return issues;

  const text = allowlisted(stripMarkup(raw));

  for (const [re, word] of BANNED) {
    const m = re.exec(text);
    if (m) add('banned-word', 'error', `"${word}" is on the spec 6.2 list; delete it and the sentence usually survives`, m.index);
  }
  const nonAnswer = NON_ANSWER.exec(text);
  if (nonAnswer) add('non-answer', 'error', `"${nonAnswer[0]}" is not an answer; give the status and a date (spec 2.6)`, nonAnswer.index);

  for (const re of STAT_LINE) {
    const m = re.exec(text);
    if (m) add('shared-block', 'error', 'Shared stat line or closing block (spec 2.11); use one page-specific proof point', m.index);
  }
  for (const [re, message] of NAMING) {
    const m = re.exec(text);
    if (m && !/Novel Medicare Solutions/.test(text)) add('naming', 'error', message, m.index);
  }
  const bang = text.indexOf('!');
  if (bang >= 0) add('exclamation', 'error', 'No exclamation marks anywhere on the site (spec 6.1)', bang);

  const dash = text.search(/—|\s–\s/);
  if (dash >= 0) {
    add('em-dash', HEADING_KEYS.has(ctx.key) ? 'error' : 'warning', 'Use full stops and commas rather than dashes (spec 6.2)', dash);
  }
  const notJust = /\bnot just\b|\bit['’]s not [^.,]{1,40}, it['’]s\b/i.exec(text);
  if (notJust) add('not-x-its-y', 'warning', 'State the point directly (spec 6.2)', notJust.index);

  if (ctx.isCtaLabel && WEAK_CTA.test(text.trim())) {
    add('cta-label', 'error', 'CTA labels say what happens, e.g. "Book a 20-minute demo" (spec 7.9)');
  }
  if (/\bclick here\b/i.test(text)) add('cta-label', 'error', 'Use descriptive link text, never "click here" (spec 7.7)');

  // Title tags in spec section 4 are title case by design; the sentence-case rule is for on-page headings.
  if ((ctx.key === 'h1' || ctx.key === 'heading' || ctx.key === 'question') && looksTitleCase(text)) {
    add('title-case', 'warning', 'Headings use sentence case (spec 2.3)');
  }
  return issues;
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'or', 'the', 'of', 'in', 'on', 'for', 'to', 'vs', 'with', 'by', 'at', 'from']);

/** Heuristic: four or more words and every non-small word capitalised, ignoring acronyms and the first word. */
export function looksTitleCase(text: string): boolean {
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(1)
    .filter((w) => !SMALL_WORDS.has(w.toLowerCase()) && !/^[A-Z0-9]{2,}$/.test(w) && /^\p{L}/u.test(w));
  if (words.length < 3) return false;
  return words.every((w) => /^\p{Lu}/u.test(w));
}

/** Rough reading of whether a string is a question. */
export function wordCount(text: string): number {
  return stripMarkup(text).split(/\s+/).filter(Boolean).length;
}
