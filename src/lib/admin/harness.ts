/**
 * Deterministic checks on a post. Nothing here calls a model, so a passing check is evidence and a failing
 * one cannot be talked around. Calibrated against the published posts: see tests/unit/admin-harness.test.ts.
 *
 * postSchema comes from families.ts, which imports `astro:content`. Inside Astro that is the real module; Astro's
 * `reference()` is a pure Zod transform, so validating here reads no collection. Tests mock it as the Keystatic
 * tests do (`vi.mock('astro:content', ...)`). No schema logic is copied.
 */
import { markdownToMdast, mdxToJs, mdxToMdast } from 'satteri';
import { resolveDeep, type TokenData } from '../content/tokens.ts';
import { auditBody, auditEntry } from '../rules/audit.ts';
import { PLACEHOLDER } from '../rules/text.ts';
import { INTERNAL_PATH } from '../../schemas/patterns.ts';
import { postSchema } from '../../schemas/families.ts';
import { z } from 'astro/zod';
import type { Check, ClaimConflict, Claim, PostContent, Source } from './types.ts';

const schemaContext = { image: () => z.string() } as never;
const STALE_YEARS = 5;

/* ---------- Numbers ---------- */

/** Values behind the confirmed tokens in docs/briefs/page-writing-rules.md, which a body must write as plain text. */
export const CONFIRMED_NUMBERS: readonly string[] = [
  '$79', '$99', '$129', '₹1,499', '₹1,899', '₹1,999', '₹2,499',
  '5,000', '200', '18', '2003', '200,000', '100', '3', '4', '4.9', '4.8', '92%', '98%',
  '39,849', '16%', '13%', '32%', '10%', '15', '108', '2017', '20',
];

export interface NumberMention {
  raw: string;
  value: number;
  unit: '' | '%' | 'INR' | 'USD' | 'KES' | 'AED' | 'NGN' | 'date' | 'time';
  index: number;
}

const CURRENCY_WORDS: Record<string, NumberMention['unit']> = {
  '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', rupee: 'INR', rupees: 'INR',
  $: 'USD', usd: 'USD', dollar: 'USD', dollars: 'USD',
  kes: 'KES', ksh: 'KES', 'kshs': 'KES', shilling: 'KES', shillings: 'KES',
  aed: 'AED', dirham: 'AED', dirhams: 'AED',
  ngn: 'NGN', '₦': 'NGN', naira: 'NGN',
};
const MULTIPLIERS: Record<string, number> = {
  thousand: 1e3, k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, million: 1e6, mn: 1e6, crore: 1e7, crores: 1e7, cr: 1e7, billion: 1e9, bn: 1e9,
};
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = `(?:${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)`;
const monthIndex = (m: string) => MONTHS.findIndex((name) => name.startsWith(m.toLowerCase().slice(0, 3)));
const dateValue = (y: number, m: number, d: number) => y * 10000 + (m + 1) * 100 + d;

const CURRENCY_PREFIX = '₹|\\$|₦|rs\\.?|inr|usd|kes|kshs?|aed|ngn';
const NUMBER = '\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
const MULT = Object.keys(MULTIPLIERS).join('|');
const UNIT_SUFFIX = 'rupees?|dollars?|shillings?|dirhams?|naira|inr|usd|kes|aed|ngn';
const AMOUNT = new RegExp(
  `(?<![\\w.,/-])(?:(${CURRENCY_PREFIX})\\s?)?(${NUMBER})(?:\\s?(${MULT})\\b)?\\s?(%|per ?cent\\b|percent\\b|(?:${UNIT_SUFFIX})\\b)?`,
  'gi',
);
const WORD_MULTIPLE = new RegExp(`\\b(?:(${CURRENCY_PREFIX})\\s?)?(${Object.keys(WORD_NUMBERS).join('|')})\\s(${MULT})\\b(?:\\s(${UNIT_SUFFIX})\\b)?`, 'gi');
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s(${MONTH_RE})\\.?,?\\s(\\d{4})\\b`, 'gi');
const MONTH_FIRST = new RegExp(`\\b(${MONTH_RE})\\.?\\s(\\d{1,2})(?:st|nd|rd|th)?,?\\s(\\d{4})\\b`, 'gi');
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)(?![a-z])|\b\d{1,2}:\d{2}\b/gi;

function unitOf(prefix: string | undefined, suffix: string | undefined): NumberMention['unit'] {
  const s = suffix?.toLowerCase().replace(' ', '');
  if (s === '%' || s === 'percent') return '%';
  return CURRENCY_WORDS[(prefix ?? '').toLowerCase()] ?? CURRENCY_WORDS[s ?? ''] ?? '';
}

/**
 * Every number in prose as a value and unit, so "1,000", "1000", "1 thousand", "₹1,00,000" and "1 lakh rupees"
 * compare by meaning and $79 never matches ₹79. Link targets, tokens and placeholders are not prose.
 */
export function extractNumbers(raw: string): NumberMention[] {
  let text = raw
    .replace(/\]\([^)]*\)/g, (m) => ' '.repeat(m.length))
    .replace(/\{(?:price|fact|fig|contact):[^}]+\}/g, (m) => ' '.repeat(m.length))
    .replace(PLACEHOLDER, (m) => ' '.repeat(m.length))
    .replace(/https?:\/\/\S+/g, (m) => ' '.repeat(m.length))
    .replace(/^\s*\d+\.\s/gm, (m) => ' '.repeat(m.length));
  const out: NumberMention[] = [];
  const blank = (start: number, length: number) => {
    text = text.slice(0, start) + ' '.repeat(length) + text.slice(start + length);
  };
  const dates: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [DAY_FIRST, (m) => dateValue(+m[3], monthIndex(m[2]), +m[1])],
    [MONTH_FIRST, (m) => dateValue(+m[3], monthIndex(m[1]), +m[2])],
    [ISO, (m) => dateValue(+m[1], +m[2] - 1, +m[3])],
  ];
  for (const [re, value] of dates) {
    for (const m of [...text.matchAll(re)]) {
      out.push({ raw: m[0], value: value(m), unit: 'date', index: m.index });
      blank(m.index, m[0].length);
    }
  }
  for (const m of [...text.matchAll(TIME)]) {
    out.push({ raw: m[0], value: 0, unit: 'time', index: m.index });
    blank(m.index, m[0].length);
  }
  for (const m of [...text.matchAll(WORD_MULTIPLE)]) {
    out.push({ raw: m[0], value: WORD_NUMBERS[m[2].toLowerCase()] * MULTIPLIERS[m[3].toLowerCase()], unit: unitOf(m[1], m[4]), index: m.index });
    blank(m.index, m[0].length);
  }
  for (const m of text.matchAll(AMOUNT)) {
    const base = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    const value = m[3] ? base * MULTIPLIERS[m[3].toLowerCase()] : base;
    out.push({ raw: m[0].trim(), value: Math.round(value * 1e6) / 1e6, unit: unitOf(m[1], m[4]), index: m.index });
  }
  return out;
}

const numberKey = (n: Pick<NumberMention, 'value' | 'unit'>) => `${n.unit}|${n.value}`;

/* ---------- Text helpers ---------- */

function withoutCtaTags(body: string): string {
  return body.replace(/<InlineCta\b[^>]*>/g, ' ').replace(/<\/InlineCta>/g, ' ');
}

function plainProse(body: string): string {
  return withoutCtaTags(body)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/[*_`]/g, '');
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\b(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|No|St)\./g, (m) => m.replace('.', ''))
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .split(/(?<=[.?!])["')\]]*\s+(?=["'(\[]*[A-Z0-9₹$])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
}

/* ---------- MDX safety ---------- */

const CTA_OPEN = /<InlineCta((?:\s+[A-Za-z]+="[^"<>{}]*")+)\s*>/g;
const SAFE_LINK = /^(?:https:\/\/|mailto:|tel:|#)/;
/** An image uploaded through the editor sits in the post's own folder; Astro builds and optimises it. */
const LOCAL_IMAGE = /^\.\/[a-z0-9][a-z0-9._-]{0,80}\.(?:jpe?g|png|webp|gif)$/i;

interface AstNode {
  type: string;
  url?: string;
  name?: string | null;
  children?: AstNode[];
  position?: { start?: { line?: number } };
}

function visit(node: AstNode, each: (node: AstNode, parents: AstNode[]) => void, parents: AstNode[] = []): void {
  each(node, parents);
  for (const child of node.children ?? []) visit(child, each, [...parents, node]);
}

function parseMarkdown(text: string, mdx: boolean): AstNode {
  if (mdx) {
    try {
      return mdxToMdast(text) as unknown as AstNode;
    } catch {
      // The compile check reports this. Plain Markdown still finds the links, so a broken body hides none.
    }
  }
  return markdownToMdast(text) as unknown as AstNode;
}

/** Every link, image and reference definition, read from the parser's tree, so nesting and escapes cannot hide one. */
export function linkTargets(text: string, mdx = false): Array<{ target: string; line: number }> {
  const out: Array<{ target: string; line: number }> = [];
  visit(parseMarkdown(text, mdx), (node) => {
    if (typeof node.url === 'string') out.push({ target: node.url, line: node.position?.start?.line ?? 1 });
  });
  return out;
}

const compileMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const at = /^(\d+):\d+:/.exec(raw)?.[1];
  const reason = raw.replace(/^\d+:\d+:\s*/, '').replace(/\s*\(mdx[^)]*\)\s*$/, '');
  return { line: at ? Number(at) : 1, message: `The site could not build this body: ${reason}` };
};
function checkLinkTarget(target: string, path: string, out: Check[]): void {
  const squeezed = target.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
  if (/&#|&[a-z]+;|%[0-9a-f]{2}:/i.test(squeezed) && !squeezed.startsWith('https://')) {
    out.push({ rule: 'mdx-link', severity: 'error', path, message: 'Link target hides its scheme with an entity or escape', excerpt: target.slice(0, 80) });
  } else if (!SAFE_LINK.test(squeezed) && !INTERNAL_PATH.test(target)) {
    out.push({ rule: 'mdx-link', severity: 'error', path, message: 'Links are https, mailto, tel or a lowercase internal path with a trailing slash', excerpt: target.slice(0, 80) });
  }
}

/**
 * The body is compiled at build and its text can come from the web, so anything MDX would execute or fail on is an
 * error. The scan is a denylist of nothing: `{`, `}` and `<` are refused wherever they stand unless escaped, even
 * inside inline code, because a scanner that tries to recognise code spans can disagree with the MDX parser.
 */
export function checkMdxSafety(body: string): Check[] {
  const out: Check[] = [];
  const add = (rule: string, index: number, message: string, excerpt?: string) =>
    out.push({ rule, severity: 'error', path: `body:${lineOf(body, index)}`, message, excerpt });

  let scrubbed = body;
  for (const m of body.matchAll(CTA_OPEN)) {
    const attrs = [...m[1].matchAll(/([A-Za-z]+)="([^"]*)"/g)];
    const names = attrs.map((a) => a[1]).sort().join(',');
    if (names !== 'heading,href,label') add('mdx-jsx', m.index, 'InlineCta takes exactly heading, href and label', m[0].slice(0, 80));
    const href = attrs.find((a) => a[1] === 'href')?.[2] ?? '';
    if (!INTERNAL_PATH.test(href)) add('mdx-jsx', m.index, 'InlineCta href must be an internal path', href);
    scrubbed = scrubbed.replace(m[0], ' '.repeat(m[0].length));
  }
  scrubbed = scrubbed.replace(/<\/InlineCta>/g, (m) => ' '.repeat(m.length));

  for (let i = 0; i < scrubbed.length; i++) {
    const ch = scrubbed[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{' || ch === '}') add('mdx-expression', i, `Unescaped ${ch}: MDX would run it as code. Write \\${ch} or remove it`, scrubbed.slice(Math.max(0, i - 20), i + 20));
    if (ch === '<') add('mdx-jsx', i, 'Only <InlineCta> may appear here: raw HTML and other JSX are refused. Write \\< for a literal', scrubbed.slice(i, i + 40));
  }
  for (const m of scrubbed.matchAll(/^\s*(import|export)\b.*$/gm)) add('mdx-esm', m.index, `A line starting "${m[1]}" is compiled as code. Reword the sentence`, m[0].slice(0, 80));
  for (const m of scrubbed.matchAll(/^\s*(?:```|~~~)/gm)) add('mdx-fence', m.index, 'Code blocks do not belong in a post');
  for (const m of scrubbed.matchAll(/!\[([^\]]*)\]\(([^)\s]*)/g)) {
    if (!LOCAL_IMAGE.test(m[2])) add('mdx-image', m.index, 'Images must be uploaded with the editor; links to images elsewhere are refused', m[0].slice(0, 80));
    else if (!m[1].trim() || m[1].trim() === 'Describe the image') add('mdx-image', m.index, 'Describe the image in its alt text, between the square brackets', m[0].slice(0, 80));
  }
  try {
    mdxToJs(body);
  } catch (error) {
    const { line, message } = compileMessage(error);
    out.push({ rule: 'mdx-compile', severity: 'error', path: `body:${line}`, message });
  }
  visit(parseMarkdown(body, true), (node, parents) => {
    if (node.name === 'InlineCta' && parents.some((p) => p.name === 'InlineCta')) {
      out.push({ rule: 'mdx-jsx', severity: 'error', path: `body:${node.position?.start?.line ?? 1}`, message: 'An InlineCta cannot sit inside another InlineCta' });
    }
  });
  for (const { target, line } of linkTargets(body, true)) if (!LOCAL_IMAGE.test(target)) checkLinkTarget(target, `body:${line}`, out);
  return out;
}

/* ---------- Slop ---------- */

const STOCK: Array<[RegExp, string, 'error' | 'warning']> = [
  [/\bin today['’]s\b/i, "In today's", 'error'],
  [/\bfast[- ]paced\b/i, 'fast-paced', 'error'],
  [/\bdelv(?:e|es|ing)\b/i, 'delve', 'error'],
  [/\bgame[- ]chang(?:er|ing)\b/i, 'game-changer', 'error'],
  [/\bit['’]s worth noting\b/i, "it's worth noting", 'error'],
  [/\bnavigat(?:e|ing) the\b/i, 'navigate the', 'warning'],
  [/\blandscape\b/i, 'landscape', 'warning'],
];

const THREE_LIST = /\b[\p{L}-]+(?: [\p{L}-]+){0,2}, [\p{L}-]+(?: [\p{L}-]+){0,2},? (?:and|or) [\p{L}-]+/gu;

/** Style rules beyond the banned list. Thresholds are set above what the published posts do. */
export function checkSlop(body: string, opening = ''): Check[] {
  const out: Check[] = [];
  const prose = plainProse(body);
  const all = `${opening}\n${prose}`;
  for (const [re, label, severity] of STOCK) {
    const m = re.exec(all);
    if (m) out.push({ rule: 'slop-phrase', severity, path: 'body', message: `Stock phrase "${label}"; say the specific thing`, excerpt: all.slice(Math.max(0, m.index - 25), m.index + 35).trim() });
  }
  const dash = /—/.exec(all);
  if (dash) out.push({ rule: 'slop-em-dash', severity: 'error', path: 'body', message: 'No em dashes; use a full stop or comma', excerpt: all.slice(Math.max(0, dash.index - 25), dash.index + 25).trim() });
  const notJust = /\bnot just\b/i.exec(all);
  if (notJust) out.push({ rule: 'slop-not-just', severity: 'warning', path: 'body', message: 'State the point directly rather than "not just"', excerpt: all.slice(Math.max(0, notJust.index - 25), notJust.index + 30).trim() });

  const totalWords = words(prose).length;
  const threes = [...prose.replace(/^\s*[-*].*$/gm, '').matchAll(THREE_LIST)].length;
  if (totalWords > 300 && threes / totalWords > 0.012) {
    out.push({ rule: 'slop-threes', severity: 'warning', path: 'body', message: `${threes} groups of three in ${totalWords} words; a list of what actually applies reads less mechanical` });
  }

  const paragraphs = prose.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !/^(?:#|[-*] |\d+\. )/.test(p));
  let run = 1;
  let reported = false;
  for (const paragraph of paragraphs) {
    const firsts = sentences(paragraph).map((s) => words(s)[0]);
    for (let i = 1; i < firsts.length; i++) {
      run = firsts[i] && firsts[i] === firsts[i - 1] ? run + 1 : 1;
      if (run >= 4 && !reported) {
        reported = true;
        out.push({ rule: 'slop-openings', severity: 'warning', path: 'body', message: `Four sentences in a row start with "${firsts[i]}"`, excerpt: paragraph.slice(0, 80) });
      }
    }
    run = 1;
  }

  const lengths = paragraphs.map((p) => words(p).length).filter((n) => n > 0);
  if (lengths.length >= 8) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    if (sd / mean < 0.2) out.push({ rule: 'slop-paragraphs', severity: 'warning', path: 'body', message: `${lengths.length} paragraphs of nearly the same length (about ${Math.round(mean)} words each)` });
  }

  const headings = (body.match(/^##\s/gm) ?? []).length;
  if (totalWords > 500 && headings < 2) out.push({ rule: 'slop-headings', severity: 'warning', path: 'body', message: `${totalWords} words under ${headings} headings` });
  if (headings > 0 && totalWords / headings < 40) out.push({ rule: 'slop-headings', severity: 'warning', path: 'body', message: `${headings} headings over ${totalWords} words; sections this short read as an outline` });
  return out;
}

/* ---------- Medical advice ---------- */

const DOSING = /\b(?:take|give|prescribe|administer|increase|reduce)\b[^.\n]{0,40}\b\d+(?:\.\d+)?\s?(?:mg|mcg|ml|iu|units?)\b|\b\d+(?:\.\d+)?\s?mg\/kg\b/i;
const PATIENT_DIRECTIVE = /\b(?:stop taking|you should take|do not need to see a doctor|no need to see a doctor|instead of seeing a doctor|cures? (?:your|the) (?:disease|condition|illness))\b/i;

/** Posts speak to people running clinics. Dosing and directions to patients are clinical advice no reviewer here signs off. */
export function checkMedicalAdvice(text: string, path = 'body'): Check[] {
  const out: Check[] = [];
  const dose = DOSING.exec(text);
  if (dose) out.push({ rule: 'medical-advice', severity: 'error', path, message: 'Dosing instructions are clinical advice; a blog post for clinic owners does not give them', excerpt: dose[0] });
  const directive = PATIENT_DIRECTIVE.exec(text);
  if (directive) out.push({ rule: 'medical-advice', severity: 'error', path, message: 'Direction to a patient about their treatment; refer them to their clinician', excerpt: directive[0] });
  return out;
}

/* ---------- The post as a whole ---------- */

function frontmatterProse(content: PostContent): Array<{ path: string; text: string }> {
  const fm = content.frontmatter;
  const out: Array<{ path: string; text: string }> = [];
  if (typeof fm.openingAnswer === 'string') out.push({ path: 'openingAnswer', text: fm.openingAnswer });
  if (typeof fm.summary === 'string') out.push({ path: 'summary', text: fm.summary });
  if (Array.isArray(fm.faq)) {
    fm.faq.forEach((item: { answer?: unknown }, i) => {
      if (typeof item?.answer === 'string') out.push({ path: `faq[${i}].answer`, text: item.answer });
    });
  }
  return out;
}

const AUTHOR_FILES = import.meta.glob('/src/data/authors/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Why this author cannot appear on a live page, or null. A placeholder role would fail the production output check. */
export function authorProblem(id: string, files: Record<string, string> = AUTHOR_FILES): string | null {
  const raw = Object.entries(files).find(([path]) => path.endsWith(`/${id}.yaml`))?.[1];
  if (raw === undefined) return 'That author does not exist. Choose one from the list.';
  if (/^(?:role|name):\s*['"]?\[/m.test(raw)) return 'This author\'s role is still a placeholder. Fill it in under src/data/authors/ or choose another author.';
  return null;
}

/**
 * What the registry re-checks at build (registry.ts: resolveDeep, then auditEntry on the result), so a post that would
 * stop the deploy is refused here. Run with the tokens of this deployment. The claims rule reads raw text, as there.
 */
export function checkResolved(content: PostContent, tokenData: TokenData): Check[] {
  const fm = content.frontmatter;
  const { value, issues } = resolveDeep(fm, tokenData);
  const audit = auditEntry(value as never, 'post').filter((i) => i.rule !== 'claims' && (fm.status === 'published' || i.rule !== 'editorial-pass'));
  return [...issues, ...audit].map(({ rule, severity, path, message }) => ({ rule, severity, path, message }));
}

/** checkPost plus the token checks. The real gate for submitting and approving. */
export function checkForBuild(content: PostContent, tokenData: TokenData): Check[] {
  const checks = checkPost(content);
  const seen = new Set(checks.map((c) => `${c.rule}|${c.path}|${c.message}`));
  return [...checks, ...checkResolved(content, tokenData).filter((c) => !seen.has(`${c.rule}|${c.path}|${c.message}`))];
}

const FIELD_NAMES: Record<string, string> = {
  title: 'the title',
  headKeyword: 'the head keyword',
  metaDescription: 'the meta description',
  h1: 'the H1',
  linkLabel: 'the link label',
  openingAnswer: 'the opening answer',
  summary: 'the summary',
  author: 'an author',
  topic: 'a topic',
  owner: 'an owner page',
  ctas: 'the calls to action',
  'ctas.primary': 'the primary call to action',
  'ctas.primary.label': 'the primary call to action label',
  'ctas.primary.href': 'the primary call to action link',
};

/** The schema's wording is for developers. Say which field is missing instead. */
function plainSchemaMessage(path: string, message: string): string {
  const name = FIELD_NAMES[path];
  return name && /received undefined|Invalid input$/.test(message) ? `Add ${name}.` : message;
}

export function checkPost(content: PostContent): Check[] {
  const { frontmatter: fm, body } = content;
  const checks: Check[] = [];

  const parsed = (postSchema as unknown as (ctx: never) => z.ZodType)(schemaContext).safeParse(fm);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (/^\[[a-z-]+\] /.test(issue.message)) continue;
      const path = issue.path.map(String).join('.');
      checks.push({ rule: 'schema', severity: 'error', path, message: plainSchemaMessage(path, issue.message) });
    }
  }
  // Only approving can supply the editorial pass, so before that it cannot count against the post.
  const audit = auditEntry(fm as never, 'post').filter((issue) => fm.status === 'published' || issue.rule !== 'editorial-pass');
  checks.push(...audit, ...auditBody(body));
  // The rules only require an author once published; nobody should reach an approver without one. Drafts may wait.
  if (fm.status === 'review' && !fm.author) {
    checks.push({ rule: 'author', severity: 'error', path: 'author', message: 'Choose a named author before submitting.' });
  }
  const problem = typeof fm.author === 'string' && fm.author ? authorProblem(fm.author) : null;
  if (problem) checks.push({ rule: 'author', severity: 'error', path: 'author', message: problem });
  checks.push(...checkMdxSafety(body));

  const opening = typeof fm.openingAnswer === 'string' ? fm.openingAnswer : '';
  checks.push(...checkSlop(body, opening));
  checks.push(...checkMedicalAdvice(body));
  for (const { path, text } of frontmatterProse(content)) {
    checks.push(...checkMedicalAdvice(text, path));
    if (/<[a-zA-Z/!]/.test(text)) checks.push({ rule: 'mdx-jsx', severity: 'error', path, message: 'Raw HTML in a Markdown field', excerpt: text.slice(0, 60) });
    for (const { target } of linkTargets(text)) checkLinkTarget(target, path, checks);
  }

  const owner = typeof fm.owner === 'string' ? fm.owner : '';
  if (!owner || owner === '/blog/' || owner.startsWith('/blog/')) {
    checks.push({ rule: 'owner', severity: 'error', path: 'owner', message: 'A post is owned by a landing page, never /blog/' });
  }
  const ctas = body.match(/<InlineCta\b/g)?.length ?? 0;
  if (ctas !== 1) checks.push({ rule: 'inline-cta', severity: 'error', path: 'body', message: `A post carries one InlineCta; this one has ${ctas}` });
  if (owner && !body.includes(`](${owner}`) && !new RegExp(`href="${owner.replace(/[/\\^$*+?.()|[\]{}-]/g, '\\$&')}"`).test(body)) {
    checks.push({ rule: 'owner-link', severity: 'error', path: 'body', message: `The body must link to the owner page ${owner}` });
  }
  if (opening) {
    const n = sentences(opening.replace(/\]\([^)]*\)/g, ']')).length;
    if (n < 2 || n > 3) checks.push({ rule: 'opening-answer', severity: 'warning', path: 'openingAnswer', message: `The opening answer is ${n} sentence${n === 1 ? '' : 's'}; aim for two` });
    if (words(opening.replace(/\]\([^)]*\)/g, ']')).length > 110) checks.push({ rule: 'opening-answer', severity: 'warning', path: 'openingAnswer', message: 'The opening answer runs past 110 words' });
  }
  return checks.map(({ rule, severity, path, message, excerpt }) => (excerpt === undefined ? { rule, severity, path, message } : { rule, severity, path, message, excerpt }));
}

/* ---------- Against the ledger ---------- */

const COMPLIANCE_STATUS = /\b(?:certified|accredited|compliant|compliance[- ]ready|fully compliant|meets? (?:all )?(?:the )?(?:requirements|standards)|hipaa[- ]ready|approved by)\b/i;
const OUR_PRODUCT = /\b(?:Easy ?Clinic|Cura ?AI|CuraPilot|our (?:software|platform|product|system|emr))\b/i;
const BARE_STATUS = /\b(?:HIPAA|GDPR|ABDM|NDHM|DPDP|ISO ?27001|SOC ?2)[- ](?:compliant|certified)\b/i;

/** Compliance status is unknown everywhere, so a sentence pairing the product with a status claim is refused. */
export function checkCompliance(text: string, path: string): Check[] {
  return sentences(plainProse(text))
    .filter((s) => (OUR_PRODUCT.test(s) && COMPLIANCE_STATUS.test(s)) || (OUR_PRODUCT.test(s) && BARE_STATUS.test(s)))
    .map((s) => ({ rule: 'compliance-claim', severity: 'error' as const, path, message: "Easy Clinic's compliance status is not confirmed; describe the regulation, not our standing", excerpt: s.slice(0, 120) }));
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(key)) u.searchParams.delete(key);
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw;
  }
}

function shingles(text: string, n = 8): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

const withoutQuotations = (text: string) => text.replace(/"[^"\n]*"|“[^”\n]*”/g, ' ');

function overlap(ours: Set<string>, theirs: string): string[] {
  const other = shingles(theirs);
  return [...ours].filter((s) => other.has(s));
}

export function checkAgainstLedger(content: PostContent, claims: Claim[], sources: Source[], existingPosts: Array<{ slug: string; body: string }> = []): Check[] {
  const out: Check[] = [];
  const { body } = content;
  const prose = frontmatterProse(content);
  const allText: Array<{ path: string; text: string }> = [{ path: 'body', text: body }, ...prose];

  const ledgerUrls = new Set(sources.map((s) => normalizeUrl(s.url)));
  for (const { path, text } of allText) {
    for (const { target } of linkTargets(text, path === 'body')) {
      if (/^https?:/i.test(target) && !ledgerUrls.has(normalizeUrl(target))) {
        out.push({ rule: 'unsourced-link', severity: 'error', path, message: 'External link is not a source in the ledger. Remove it, or link a source this AI job read.', excerpt: target.slice(0, 100) });
      }
    }
  }

  const known = new Set<string>();
  const addKnown = (text: string) => extractNumbers(text).forEach((n) => known.add(numberKey(n)));
  claims.forEach((c) => {
    addKnown(c.statement);
    addKnown(c.quote);
  });
  CONFIRMED_NUMBERS.forEach(addKnown);
  const sourceText = sources.map((s) => s.text).join('\n');
  const inSources = new Set(extractNumbers(sourceText).map(numberKey));

  for (const { path, text } of [{ path: 'body', text: plainProse(body).replace(/^#+ .*$/gm, (h) => h) }, ...prose.filter((p) => p.path.startsWith('faq') || p.path === 'openingAnswer')]) {
    for (const n of extractNumbers(text)) {
      if (n.unit === 'time') {
        out.push({ rule: 'unsourced-number', severity: 'warning', path, message: `Clock time "${n.raw}" has no source; fine as an example only if a reader will read it as one`, excerpt: n.raw });
        continue;
      }
      if (known.has(numberKey(n))) continue;
      const small = n.unit === '' && Number.isInteger(n.value) && n.value < 10;
      const year = n.unit === '' && Number.isInteger(n.value) && n.value >= 1900 && n.value <= 2100 && inSources.has(numberKey(n));
      const severity = small || year ? 'warning' : 'error';
      const excerpt = text.slice(Math.max(0, n.index - 30), n.index + n.raw.length + 20).replace(/\s+/g, ' ').trim();
      out.push({ rule: 'unsourced-number', severity, path, message: `"${n.raw}" is not in a ledger claim, its quote or the confirmed facts. Remove it, or reword it using a sourced figure.`, excerpt });
    }
  }

  for (const { path, text } of allText) out.push(...checkCompliance(text, path));

  const ours = shingles(withoutQuotations(plainProse(body)));
  if (ours.size > 0) {
    for (const source of sources) {
      const shared = overlap(ours, withoutQuotations(source.text));
      if (shared.length >= 5) out.push({ rule: 'copied-source', severity: 'error', path: 'body', message: `${shared.length} eight-word runs copied from ${source.host}; rewrite them or quote and link`, excerpt: shared[0] });
      else if (shared.length > 0) out.push({ rule: 'copied-source', severity: 'warning', path: 'body', message: `${shared.length} eight-word run${shared.length === 1 ? '' : 's'} shared with ${source.host}`, excerpt: shared[0] });
    }
    for (const post of existingPosts) {
      const shared = overlap(ours, post.body);
      if (shared.length / ours.size > 0.05) out.push({ rule: 'copied-post', severity: 'error', path: 'body', message: `${Math.round((100 * shared.length) / ours.size)}% of this body repeats /${post.slug}/`, excerpt: shared[0] });
      else if (shared.length >= 5) out.push({ rule: 'copied-post', severity: 'warning', path: 'body', message: `${shared.length} eight-word runs shared with /${post.slug}/`, excerpt: shared[0] });
    }
  }
  return out;
}

/* ---------- Source condition ---------- */

/** Old is not wrong (the 2002 ethics regulations are in force), so age is shown to the reader of the draft, not fatal. */
export function checkFreshness(sources: Source[], claims: Claim[], now = new Date()): Check[] {
  const used = new Set(claims.map((c) => c.sourceId));
  const out: Check[] = [];
  for (const s of sources) {
    if (!used.has(s.id)) continue;
    if (!s.publishedAt) {
      if (s.tier !== 'official') out.push({ rule: 'source-age', severity: 'warning', path: `sources.${s.id}`, message: `${s.host} shows no date; check the claims from it are still current`, excerpt: s.url });
      continue;
    }
    const years = (now.getTime() - new Date(s.publishedAt).getTime()) / (365.25 * 864e5);
    if (years > STALE_YEARS) out.push({ rule: 'source-age', severity: 'warning', path: `sources.${s.id}`, message: `${s.host} dates from ${s.publishedAt.slice(0, 10)}; confirm it still applies and say the year in the text`, excerpt: s.url });
  }
  return out;
}

export function checkConflicts(conflicts: ClaimConflict[]): Check[] {
  return conflicts.map((c, i) => ({ rule: 'source-conflict', severity: 'warning' as const, path: `conflicts[${i}]`, message: `Sources disagree (${c.claimIds.join(', ')}): ${c.note}` }));
}

/** Rules a person settles when they take over the draft; the writer model cannot and should not try. */
export const HUMAN_ONLY_RULES = new Set(['editorial-pass', 'placeholder']);
export function isHumanOnly(check: Check): boolean {
  return HUMAN_ONLY_RULES.has(check.rule) || (check.rule === 'unknown-fact' && (check.path === 'author' || check.path === 'lastUpdated'));
}
