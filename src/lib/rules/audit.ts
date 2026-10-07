/**
 * The publish checklist (spec 9.2) as code. `auditEntry` returns every issue for an entry; the content
 * schema turns errors into build failures for published entries, and the preview toolbar and
 * `pnpm facts:report` show them for drafts.
 */
import { checkText, wordCount, type Issue } from './text.ts';
import { walk } from './walk.ts';

export type { Issue } from './text.ts';

export interface FamilyRules {
  /** Allowed FAQ count when a FAQ is present; `null` means the family carries no FAQ. */
  faq: [number, number] | null;
  author: boolean;
  proof: boolean;
  editorialPass: boolean;
}

const LANDING: FamilyRules = { faq: [5, 8], author: true, proof: true, editorialPass: true };

export const FAMILY_RULES: Record<string, FamilyRules> = {
  home: LANDING,
  hub: { ...LANDING, faq: [5, 8] },
  feature: LANDING,
  solution: LANDING,
  selector: { ...LANDING, faq: [5, 8] },
  ai: LANDING,
  curapilot: LANDING,
  trust: LANDING,
  integrations: { ...LANDING, proof: false },
  switch: LANDING,
  customers: LANDING,
  specialty: LANDING,
  pricing: LANDING,
  // Spec 5.13: country pages carry 8 to 10 FAQs in the country's own terms.
  country: { ...LANDING, faq: [8, 10] },
  countryDemo: { ...LANDING, faq: [5, 8] },
  listicle: LANDING,
  comparison: { ...LANDING, faq: [5, 8] },
  company: { faq: [5, 8], author: true, proof: false, editorialPass: true },
  legal: { faq: null, author: false, proof: false, editorialPass: false },
  guide: { faq: [5, 8], author: true, proof: false, editorialPass: true },
  post: { faq: [3, 8], author: true, proof: false, editorialPass: true },
  glossary: { faq: null, author: true, proof: false, editorialPass: true },
  kitchenSink: { faq: [0, 99], author: false, proof: false, editorialPass: false },
};

/** Section types that count as a page's proof block (spec 2.4). */
export const PROOF_BLOCKS = new Set(['proofBlock', 'testimonialRow', 'testimonialCard', 'studyCard', 'testimonialGrid']);

/**
 * Research and outcome claims that must come from src/data/study.yaml via {fig:...} tokens, or carry
 * a `claimsReview` sign-off. See research finding 2 in the plan.
 */
const CLAIMS = /peer[- ]reviewed|\bNature (?:Medicine|Health)\b|\bproven\b|39,?849|108 physicians|\b34 ?%|\b67 ?%|\b45[- ]day|\b99\.97 ?%|\b16 ?% fewer/i;

export const LIMITS = { title: 60, meta: 155, metaMin: 70, faqAnswerWords: 12 };

/**
 * Length as rendered. Unresolved tokens count as 7 characters, the width of their longest typical value
 * ("₹1,999", "5,000+", "39,849"); the registry re-checks the exact length after resolving tokens.
 */
export function renderedLength(text: string): number {
  return text.replace(/\{(?:price|fact|fig|contact):[^}]+\}/g, 'XXXXXXX').length;
}

interface Entryish {
  status?: string;
  title?: string;
  metaDescription?: string;
  faq?: Array<{ question: string; answer: string }>;
  sections?: Array<{ discriminant: string; value: Record<string, unknown> }>;
  author?: unknown;
  lastUpdated?: unknown;
  editorialPass?: unknown;
  claimsReview?: unknown;
  [key: string]: unknown;
}

function countTestimonials(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((n, v) => n + countTestimonials(v), 0);
  const obj = value as Record<string, unknown>;
  if (obj.collection === 'testimonials' && typeof obj.id === 'string') return 1;
  return Object.values(obj).reduce<number>((n, v) => n + countTestimonials(v), 0);
}

export function auditEntry(data: Entryish, family: string): Issue[] {
  const rules = FAMILY_RULES[family] ?? LANDING;
  const issues: Issue[] = [];
  const err = (rule: string, path: string, message: string) => issues.push({ rule, severity: 'error', path, message });
  const warn = (rule: string, path: string, message: string) => issues.push({ rule, severity: 'warning', path, message });

  for (const leaf of walk(data)) {
    if (leaf.kind === 'string') {
      issues.push(...checkText(leaf.value, leaf));
      if (!leaf.verbatim && !data.claimsReview && CLAIMS.test(leaf.value.replace(/\{fig:[^}]+\}/g, ''))) {
        err('claims', leaf.path, 'Research or outcome figure written as text; use a {fig:...} token from study.yaml or add claimsReview');
      }
    } else if (leaf.kind === 'null') {
      if (leaf.path === 'author' && !rules.author) continue;
      if (leaf.path === 'lastUpdated' && !rules.author) continue;
      const message =
        leaf.path === 'author'
          ? 'Named author required: a clinician, the product lead or a country lead, never "Easy Clinic Team" (spec 2.7)'
          : leaf.path === 'lastUpdated'
            ? 'Last-updated date required (spec 2.7)'
            : `Unknown fact at ${leaf.path}; the company must supply it`;
      err('unknown-fact', leaf.path, message);
    } else {
      err('missing-media', leaf.path, `Screenshot or image needed${leaf.needed ? `: ${leaf.needed}` : ''} (spec 12)`);
    }
  }

  if (typeof data.title === 'string') {
    const n = renderedLength(data.title);
    if (n > LIMITS.title) err('length', 'title', `Title is ${n} characters; the limit is ${LIMITS.title}`);
  }
  if (typeof data.metaDescription === 'string') {
    const n = renderedLength(data.metaDescription);
    if (n > LIMITS.meta) err('length', 'metaDescription', `Meta description is ${n} characters; the limit is ${LIMITS.meta}`);
    else if (n < LIMITS.metaMin) warn('length', 'metaDescription', `Meta description is only ${n} characters`);
  }

  const faq = data.faq ?? [];
  if (faq.length > 0) {
    if (!rules.faq) err('faq', 'faq', 'This page family carries no FAQ');
    else {
      const [min, max] = rules.faq;
      if (faq.length < min || faq.length > max) {
        err('faq', 'faq', `FAQ has ${faq.length} questions; this family needs ${min} to ${max}, or none (spec 2.5)`);
      }
    }
    faq.forEach((item, i) => {
      if (wordCount(item.answer) < LIMITS.faqAnswerWords) {
        err('faq', `faq[${i}].answer`, 'Answer in at least one full sentence (spec 2.5); one-word answers are not allowed');
      }
      if (!item.question.trim().endsWith('?')) warn('faq', `faq[${i}].question`, 'FAQ questions end with a question mark');
    });
  }

  if (rules.proof) {
    const hasProof = (data.sections ?? []).some((s) => PROOF_BLOCKS.has(s.discriminant));
    if (!hasProof) err('proof', 'sections', 'Every page carries one proof block that belongs to it (spec 2.4)');
  }

  const testimonials = countTestimonials(data.sections);
  // Owner decision 2026-10-07: the home page shows the nine-card testimonial wall from the live site.
  const testimonialCap = data.path === '/' ? 9 : 3;
  if (testimonials > testimonialCap) {
    err('testimonials', 'sections', `${testimonials} testimonials on one page; never more than ${testimonialCap} (spec 7.3)`);
  }

  if (rules.editorialPass && !data.editorialPass) {
    err('editorial-pass', 'editorialPass', "Record the editor's two-question pass before publishing (spec 6.5)");
  }

  // Spec 3.6: every post is owned by a landing page. /blog/ lists posts; it does not own them.
  if (family === 'post' && typeof data.owner === 'string' && data.owner.startsWith('/blog/')) {
    err('owner', 'owner', 'Name the landing page that owns this post (spec 3.6); /blog/ lists posts but owns none');
  }

  return issues;
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.severity === 'error');
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `  [${i.rule}] ${i.path}: ${i.message}${i.excerpt ? `\n      "${i.excerpt}"` : ''}`).join('\n');
}

/**
 * Lints a Markdown/MDX body line by line with the same text rules (guides and posts). Code fences,
 * import/export lines and JSX component lines are skipped; headings get the heading rules.
 */
export function auditBody(body: string): Issue[] {
  const issues: Issue[] = [];
  let inFence = false;
  body.split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence || /^\s*(import|export)\s/.test(line) || /^\s*<\/?[A-Z]/.test(line) || !line.trim()) return;
    const heading = /^#{1,6}\s/.test(line);
    const text = line.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
    for (const issue of checkText(text, { path: `body:${i + 1}`, key: heading ? 'heading' : 'body', verbatim: false, isCtaLabel: false })) issues.push(issue);
    if (/^#\s/.test(line)) issues.push({ rule: 'h1', severity: 'error', path: `body:${i + 1}`, message: 'The body cannot contain an H1; the template renders the page H1' });
  });
  return issues;
}
