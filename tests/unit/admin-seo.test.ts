/** The editor's SEO checklist: plain checks on fields and the Markdown body. */
import { describe, expect, it } from 'vitest';
import { hasKeyword, parseBody, seoReport } from '../../src/components/admin/blog/seo.ts';

const state = (r: ReturnType<typeof seoReport>, id: string) => r.groups.flatMap((g) => g.items).find((i) => i.id === id)?.state;

const good = {
  slug: 'clinic-cash-flow',
  hasCover: true,
  frontmatter: {
    headKeyword: 'clinic cash flow',
    title: 'Clinic cash flow: a practical guide for owners',
    metaDescription: 'Clinic cash flow decides whether a busy practice can pay its staff on time. Here is how to read it, forecast it and fix the gaps month by month.',
    h1: 'Clinic cash flow, explained for clinic owners',
    openingAnswer: 'Clinic cash flow is the money that moves in and out of your practice each month.',
    owner: '/features/billing/',
    author: 'subhashish',
    summary: 'How to read and fix clinic cash flow.',
    faq: [{ question: 'a', answer: 'b' }, { question: 'c', answer: 'd' }, { question: 'e', answer: 'f' }],
  },
  body: [
    '## Why clinic cash flow matters', '',
    `${'Revenue arrives late when claims stall. '.repeat(60)}See [billing](/features/billing/) and [reports](/features/reports-and-dashboards/).`, '',
    '![Clinic cash flow chart in the reports screen](./chart.webp)', '',
    '## How to fix it', '',
    `${'Track every bill on the day it is raised and chase it. '.repeat(70)}Source: [WHO](https://www.who.int/).`, '',
    'clinic cash flow clinic cash flow clinic cash flow clinic cash flow',
  ].join('\n'),
};

describe('seo checklist', () => {
  it('matches the keyword as a whole phrase, ignoring case and punctuation', () => {
    expect(hasKeyword('Clinic Cash-Flow: a guide', 'clinic cash flow')).toBe(true);
    expect(hasKeyword('clinical cash flows', 'clinic cash flow')).toBe(false);
  });

  it('reads headings, links and images from Markdown', () => {
    const p = parseBody(good.body);
    expect(p.headings.map((h) => h.level)).toEqual([2, 2]);
    expect(p.links).toHaveLength(3);
    expect(p.images).toEqual([{ alt: 'Clinic cash flow chart in the reports screen', src: './chart.webp' }]);
  });

  it('passes a well-built post', () => {
    const r = seoReport(good);
    expect(r.counts.fail).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('flags images without alt text, vague links and a missing keyword', () => {
    const r = seoReport({ ...good, frontmatter: { ...good.frontmatter, headKeyword: '' }, body: `${good.body}\n\n![](./x.webp)\n\n[click here](/pricing/)` });
    expect(state(r, 'img-alt')).toBe('fail');
    expect(state(r, 'anchors')).toBe('fail');
    expect(state(r, 'kw-set')).toBe('fail');
    expect(r.score).toBeLessThan(seoReport(good).score);
  });

  it('groups the Rank Math style extras and catches a keyword another page holds', () => {
    const r = seoReport({ ...good, usedKeywords: [{ keyword: 'Clinic Cash Flow', path: '/other/' }] });
    const extra = r.groups.find((g) => g.id === 'additional')!.items.map((i) => i.id);
    expect(extra).toEqual(expect.arrayContaining(['kw-subhead', 'img-kw', 'kw-density', 'url-chars', 'external', 'internal', 'kw-unique']));
    expect(state(r, 'kw-unique')).toBe('fail');
    expect(state(seoReport({ ...good, usedKeywords: [] }), 'kw-unique')).toBe('pass');
  });

  it('flags a missing featured image and a short title', () => {
    const r = seoReport({ ...good, hasCover: false, frontmatter: { ...good.frontmatter, title: 'Cash flow' } });
    expect(state(r, 'cover')).toBe('fail');
    expect(state(r, 'title-len')).toBe('warn');
    expect(state(r, 'kw-title')).toBe('fail');
  });
});
