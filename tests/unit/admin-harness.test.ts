import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { authorProblem, checkAgainstLedger, checkCompliance, checkConflicts, checkFreshness, checkMdxSafety, checkMedicalAdvice, checkPost, checkSlop, extractNumbers } from '../../src/lib/admin/harness.ts';
import type { Check, Claim, PostContent, Source } from '../../src/lib/admin/types.ts';

vi.mock('astro:content', async () => (await import('./keystatic-harness.ts')).astroContentMock());

const POSTS = join(process.cwd(), 'src/content/posts');
function published(): Array<{ slug: string; content: PostContent }> {
  return readdirSync(POSTS).flatMap((slug) => {
    const raw = readFileSync(join(POSTS, slug, 'index.mdx'), 'utf8').replace(/\r\n/g, '\n');
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!m) return [];
    const frontmatter = parse(m[1]);
    return frontmatter.status === 'published' ? [{ slug, content: { frontmatter, body: m[2] } }] : [];
  });
}

const body = `Your front desk loses money when a bill stays open past the visit.

## Why it happens

Some text that links to the [billing page](/features/billing/) and says what to do at the desk each evening.

<InlineCta heading="Keep the balance on the bill." href="/features/billing/" label="See part payments">Easy Clinic shows the balance when the bill opens.</InlineCta>

## What to do

Check the drawer each evening.
`;

const good = (over: Partial<PostContent['frontmatter']> = {}, b = body): PostContent => ({
  frontmatter: {
    status: 'draft', headKeyword: 'clinic bills', title: 'Open clinic bills and how to close them', metaDescription: 'Why a clinic bill stays open past the visit and what the desk can do about it each evening before closing.',
    h1: 'Open clinic bills', linkLabel: 'Open clinic bills', openingAnswer: 'A bill stays open when nobody asks at the desk. Ask before the patient leaves and record it.',
    author: null, lastUpdated: '2026-11-06', topic: 'billing-and-claims', owner: '/features/billing/',
    ctas: { primary: { label: 'Book a 20-minute demo', href: '/indiademo/' } }, links: { hub: '/blog/' }, ...over,
  },
  body: b,
});

const rules = (checks: Check[], severity?: string) => checks.filter((c) => !severity || c.severity === severity).map((c) => c.rule);

describe('MDX safety', () => {
  const attacks: Array<[string, string]> = [
    ['expression', 'A sum {1+1} here'],
    ['expression after escaped backslash', 'Looks escaped \\\\{process.exit()}'],
    ['closing brace', 'stray } here'],
    ['import', 'import fs from "node:fs"'],
    ['export', 'export const a = 1'],
    ['script', '<script>alert(1)</script>'],
    ['other jsx', '<Foo bar="1" />'],
    ['html comment', '<!-- x -->'],
    ['autolink', '<https://evil.example>'],
    ['less than', 'when x < 5 days'],
    ['javascript link', '[x](javascript:alert(1))'],
    ['cased javascript', '[x](JaVaScRiPt:alert(1))'],
    ['data link', '[x](data:text/html;base64,AAAA)'],
    ['entity scheme', '[x](&#106;avascript:alert(1))'],
    ['reference definition', '[x]: javascript:alert(1)'],
    ['cta expression attribute', '<InlineCta heading={evil()} href="/a/" label="b">t</InlineCta>'],
    ['cta extra attribute', '<InlineCta heading="a" href="/a/" label="b" onClick="x">t</InlineCta>'],
    ['cta external href', '<InlineCta heading="a" href="https://evil.example/" label="b">t</InlineCta>'],
    ['code fence', '```\nx\n```'],
  ];
  it.each(attacks)('refuses %s', (_name, text) => {
    expect(checkMdxSafety(text).filter((c) => c.severity === 'error').length).toBeGreaterThan(0);
  });
  it('allows the InlineCta, escapes, tables and normal links', () => {
    expect(checkMdxSafety(`${body}\nA literal \\{x\\} and \\< sign, [a](https://who.int/x), [b](mailto:a@b.co).\n\n| A | B |\n| - | - |\n| 1 | 2 |\n`)).toEqual([]);
  });
  it('allows an image uploaded into the post folder, with alt text; refuses outside images and missing alt text', () => {
    expect(checkMdxSafety(`${body}\n![A chart of wait times](./wait-times-ab12cd.webp)\n`)).toEqual([]);
    for (const image of ['![A chart](https://cdn.example/x.png)', '![A chart](../other/x.png)', '![](./x.png)', '![Describe the image](./x.png)', '![A file](./x.svg)']) {
      expect(checkMdxSafety(`${body}\n${image}\n`).some((c) => c.rule === 'mdx-image' || c.rule === 'mdx-link'), image).toBe(true);
    }
  });
  it('a post without a named author cannot go to review, and a blank author in the form is stored as unknown', () => {
    expect(rules(checkPost(good({ status: 'review', author: null })), 'error')).toContain('author');
    expect(rules(checkPost(good({ status: 'draft', author: null })), 'error')).not.toContain('author');
  });
  // Regression: the real rules once made every post impossible to submit, which tests with a fake checker missed.
  it('a complete post can go to review before anyone has given the editorial pass', () => {
    const errors = checkPost(good({ status: 'review', author: 'subhashish-saha', editorialPass: undefined })).filter((c) => c.severity === 'error');
    expect(errors).toEqual([]);
  });
  it('refuses an author who does not exist or whose role is a placeholder', () => {
    expect(rules(checkPost(good({ author: 'nobody-here' })), 'error')).toContain('author');
    expect(authorProblem('a', { '/src/data/authors/a.yaml': "name: A\nrole: '[Role to confirm]'\n" })).toMatch(/placeholder/);
    expect(authorProblem('a', { '/src/data/authors/a.yaml': 'name: A\nrole: Founder\n' })).toBeNull();
  });
  it('a published post still needs the editorial pass', () => {
    expect(rules(checkPost(good({ status: 'published', author: 'subhashish-saha', editorialPass: undefined })), 'error')).toContain('editorial-pass');
  });
  it('checkPost refuses raw HTML and bad links in markdown frontmatter', () => {
    expect(rules(checkPost(good({ openingAnswer: 'Two sentences. <img src=x onerror=alert(1)> [x](javascript:a)' }))))
      .toEqual(expect.arrayContaining(['mdx-jsx', 'mdx-link']));
  });
});

describe('post structure', () => {
  it('passes a sound draft apart from the fields a person must fill', () => {
    const errors = checkPost(good()).filter((c) => c.severity === 'error');
    expect(errors.map((c) => `${c.rule}:${c.path}`).sort()).toEqual(['unknown-fact:author']);
  });
  it('rejects owner /blog/, a missing or doubled CTA and no owner link', () => {
    expect(rules(checkPost(good({ owner: '/blog/' })), 'error')).toContain('owner');
    expect(rules(checkPost(good({}, 'Text only.')), 'error')).toEqual(expect.arrayContaining(['inline-cta', 'owner-link']));
    const two = `${body}\n<InlineCta heading="b" href="/features/billing/" label="c">d</InlineCta>\n`;
    expect(rules(checkPost(good({}, two)), 'error')).toContain('inline-cta');
  });
  it('warns on an opening of one sentence or five', () => {
    expect(rules(checkPost(good({ openingAnswer: 'Only one sentence here.' })))).toContain('opening-answer');
    expect(rules(checkPost(good({ openingAnswer: 'One here. Two here. Three here. Four here. Five here.' })))).toContain('opening-answer');
  });
  it('runs the schema', () => {
    expect(rules(checkPost(good({ topic: 'nonsense' })), 'error')).toContain('schema');
  });
});

describe('slop', () => {
  it('flags stock phrases and em dashes', () => {
    expect(rules(checkSlop("In today's fast-paced clinics, let us delve into this game-changer — it's worth noting."), 'error')).toEqual(expect.arrayContaining(['slop-phrase', 'slop-em-dash']));
  });
  it('flags repeated openings and uniform paragraphs', () => {
    expect(rules(checkSlop('Clinics lose money. Clinics lose time. Clinics lose staff. Clinics lose patients.'))).toContain('slop-openings');
    const para = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    expect(rules(checkSlop(Array(9).fill(para).join('\n\n')))).toContain('slop-paragraphs');
  });
});

describe('numbers', () => {
  const value = (s: string) => extractNumbers(s).map((n) => [n.value, n.unit]);
  it.each([
    ['1,000 visits', [[1000, '']]],
    ['1000 visits', [[1000, '']]],
    ['1 thousand visits', [[1000, '']]],
    ['₹1,00,000', [[100000, 'INR']]],
    ['1 lakh rupees', [[100000, 'INR']]],
    ['Rs. 2.5 crore', [[25000000, 'INR']]],
    ['two lakh rupees', [[200000, 'INR']]],
    ['$79', [[79, 'USD']]],
    ['KES 1,500', [[1500, 'KES']]],
    ['16 per cent', [[16, '%']]],
    ['16%', [[16, '%']]],
  ])('reads %s', (text, expected) => {
    expect(value(text)).toEqual(expected);
  });
  it('reads a date either way round', () => {
    expect(value('23 August 2023')).toEqual(value('August 23, 2023'));
  });
  it('ignores tokens, placeholders, URLs and list markers', () => {
    expect(extractNumbers('{price:inr.premium.annual} [KES price 500] https://a.org/2024\n1. First')).toEqual([]);
  });
});

const source = (over: Partial<Source> = {}): Source => ({ id: 's1', url: 'https://who.int/report', title: 'R', host: 'who.int', tier: 'official', fetchedAt: '2026-11-01', text: 'Clinics reported fees of ₹1,00,000 in the survey published by the ministry last year in the capital region.', publishedAt: '2025-01-01', ...over });
const claim = (over: Partial<Claim> = {}): Claim => ({ id: 'c1', sourceId: 's1', statement: 'Fees were 1 lakh rupees', quote: 'fees of ₹1,00,000 in the survey', ...over });
const withBody = (b: string, fm = {}) => good(fm, `${b}\n`);

describe('checkAgainstLedger', () => {
  it('rejects a link outside the ledger', () => {
    expect(rules(checkAgainstLedger(withBody('See [x](https://evil.example/a).'), [claim()], [source()]), 'error')).toContain('unsourced-link');
    expect(rules(checkAgainstLedger(withBody('See [x](https://who.int/report/#top).'), [claim()], [source()]))).not.toContain('unsourced-link');
  });
  it('catches an invented number and accepts the same number written differently', () => {
    expect(rules(checkAgainstLedger(withBody('Fees reached ₹3,00,000 last year.'), [claim()], [source()]), 'error')).toContain('unsourced-number');
    expect(rules(checkAgainstLedger(withBody('Fees reached 1 lakh rupees.'), [claim()], [source()]))).not.toContain('unsourced-number');
    expect(rules(checkAgainstLedger(withBody('Fees reached $1,00,000.'), [claim()], [source()]), 'error')).toContain('unsourced-number');
  });
  it('checks FAQ numbers and accepts confirmed values and tokens', () => {
    const fm = { faq: [{ question: 'Cost?', answer: 'It is 57% cheaper than {price:inr.premium.annual}.' }] };
    expect(checkAgainstLedger(withBody('Plain.', fm), [], []).filter((c) => c.rule === 'unsourced-number').map((c) => c.path)).toEqual(['faq[0].answer']);
    expect(rules(checkAgainstLedger(withBody('Professional is ₹1,499 and 5,000 doctors use it.'), [], []))).not.toContain('unsourced-number');
  });
  it('rejects compliance status about the product, not a description of the rule', () => {
    expect(checkCompliance('Easy Clinic is HIPAA compliant.', 'body')).toHaveLength(1);
    expect(checkCompliance('Our software is certified by the regulator.', 'body')).toHaveLength(1);
    expect(checkCompliance('A vendor must be certified under this rule. HIPAA applies to covered entities.', 'body')).toEqual([]);
  });
  it('flags copying from a source and from an existing post, but not marked quotation', () => {
    const copied = 'Clinics reported fees of ₹1,00,000 in the survey published by the ministry last year in the capital region.';
    expect(rules(checkAgainstLedger(withBody(copied), [claim()], [source()]), 'error')).toContain('copied-source');
    expect(rules(checkAgainstLedger(withBody(`The ministry wrote "${copied}"`), [claim()], [source()]))).not.toContain('copied-source');
    const words = Array.from({ length: 60 }, (_, i) => `term${i}`).join(' ');
    expect(rules(checkAgainstLedger(withBody(words), [], [], [{ slug: 'old', body: words }]), 'error')).toContain('copied-post');
  });
});

describe('source condition', () => {
  const now = new Date('2026-11-06');
  it('warns on an old source and an undated non-official one, without blocking', () => {
    const old = checkFreshness([source({ publishedAt: '2015-01-01' })], [claim()], now);
    expect(old.map((c) => [c.rule, c.severity])).toEqual([['source-age', 'warning']]);
    expect(checkFreshness([source({ publishedAt: null, tier: 'other' })], [claim()], now)).toHaveLength(1);
    expect(checkFreshness([source({ publishedAt: null, tier: 'official' })], [claim()], now)).toEqual([]);
  });
  it('shows conflicts as warnings', () => {
    expect(checkConflicts([{ claimIds: ['c1', 'c2'], note: '12% against 20%' }])[0]).toMatchObject({ rule: 'source-conflict', severity: 'warning' });
  });
});

describe('medical advice', () => {
  it('refuses dosing and directions to patients', () => {
    expect(checkMedicalAdvice('Take 500 mg twice a day.')).toHaveLength(1);
    expect(checkMedicalAdvice('You should take this and stop taking the other.')).toHaveLength(1);
    expect(checkMedicalAdvice('Dose is 10 mg/kg.')).toHaveLength(1);
  });
  it('allows operations talk', () => {
    expect(checkMedicalAdvice('Record the prescription and refer dosing questions to the treating doctor.')).toEqual([]);
  });
});

describe('calibration against the published posts', () => {
  const posts = published();
  const SLOP = /^slop-/;
  it('finds the 56 published posts', () => {
    expect(posts.length).toBe(56);
  });
  it('reports, and holds, the false positive rates', () => {
    const byRule = new Map<string, { errors: Set<string>; warnings: Set<string> }>();
    const record = (slug: string, c: Check) => {
      const r = byRule.get(c.rule) ?? { errors: new Set(), warnings: new Set() };
      (c.severity === 'error' ? r.errors : r.warnings).add(slug);
      byRule.set(c.rule, r);
    };
    for (const { slug, content } of posts) {
      for (const c of checkSlop(content.body, String(content.frontmatter.openingAnswer ?? ''))) record(slug, c);
      for (const c of checkMdxSafety(content.body)) record(slug, c);
      for (const c of checkMedicalAdvice(content.body)) record(slug, c);
      for (const c of checkCompliance(content.body, 'body')) record(slug, c);
      for (const c of checkPost(content)) if (['inline-cta', 'owner-link', 'owner', 'opening-answer', 'schema'].includes(c.rule)) record(slug, c);
    }
    const table = [...byRule].map(([rule, r]) => `${rule}: errors ${r.errors.size}/${posts.length}, warnings ${r.warnings.size}/${posts.length}${r.errors.size ? ` [${[...r.errors].slice(0, 4).join(', ')}]` : ''}`).sort();
    console.log(`Rule hits on published posts:\n${table.join('\n') || '(none)'}`);
    const flaggedBySlop = new Set([...byRule].filter(([rule]) => SLOP.test(rule)).flatMap(([, r]) => [...r.warnings, ...r.errors]));
    console.log(`Posts with any slop finding: ${flaggedBySlop.size}/${posts.length}`);
    const slopErrors = [...byRule].filter(([rule]) => SLOP.test(rule)).flatMap(([, r]) => [...r.errors]);
    expect(slopErrors).toEqual([]);
    expect(flaggedBySlop.size / posts.length).toBeLessThanOrEqual(0.25);
  });
});
