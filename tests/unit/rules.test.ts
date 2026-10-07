import { describe, expect, it } from 'vitest';
import { auditEntry, errorsOf } from '../../src/lib/rules/audit.ts';
import { checkText, looksTitleCase, PLACEHOLDER } from '../../src/lib/rules/text.ts';
import { walk } from '../../src/lib/rules/walk.ts';

const ctx = (key = 'body', extra: Partial<Parameters<typeof checkText>[1]> = {}) => ({
  path: key,
  key,
  verbatim: false,
  isCtaLabel: false,
  ...extra,
});
const rules = (text: string, key = 'body', extra = {}) => checkText(text, ctx(key, extra)).map((i) => i.rule);

describe('placeholders', () => {
  it('finds bracketed facts', () => {
    expect(rules('It costs KES [x] per doctor.')).toContain('placeholder');
    expect(rules('[status as of date]')).toContain('placeholder');
  });
  it('ignores markdown links and references', () => {
    expect(rules('See [the trust page](/trust/) for dates.')).not.toContain('placeholder');
    expect(rules('See [the trust page][trust].')).not.toContain('placeholder');
    expect('[a](b) and [c]'.match(PLACEHOLDER)).toEqual(['[c]']);
  });
  it('applies to verbatim quotes too', () => {
    expect(rules('[Name] said so', 'quote', { verbatim: true })).toEqual(['placeholder']);
  });
});

describe('banned words and patterns (spec 6.2)', () => {
  it('flags banned vocabulary with inflections', () => {
    expect(rules('A seamless handover')).toContain('banned-word');
    expect(rules('It streamlines the desk')).toContain('banned-word');
    expect(rules('Software for modern clinics')).toContain('banned-word');
  });
  it('allows the allowlisted phrases', () => {
    expect(rules('Streamline Health is a Kenyan vendor.')).not.toContain('banned-word');
    expect(rules('Data is protected with end-to-end encryption.')).not.toContain('banned-word');
  });
  it('exempts verbatim quotes', () => {
    expect(rules('Its robust EMR, all the best Easy Clinic!!!', 'quote', { verbatim: true })).toEqual([]);
  });
  it('rejects non-answers', () => {
    expect(rules('SHA claims: confirm in demo.')).toContain('non-answer');
    expect(rules('ABDM is work in progress.')).toContain('non-answer');
  });
  it('rejects the shared stat line', () => {
    expect(rules('5,000+ doctors · 18 countries · Since 2003')).toContain('shared-block');
  });
  it('enforces naming', () => {
    expect(rules('EasyClinic is great')).toContain('naming');
    expect(rules('Includes the AI Assistant')).toContain('naming');
    expect(rules('Easy Clinic with Cura AI and CuraPilot')).not.toContain('naming');
    expect(rules('Novel Medicare Solutions Pvt Ltd, trading as Easy Clinic')).not.toContain('naming');
  });
  it('rejects exclamation marks but not markdown images', () => {
    expect(rules('Book now!')).toContain('exclamation');
    expect(rules('![Screenshot](a.png) shows it.')).not.toContain('exclamation');
  });
  it('treats em dashes as errors in headings and warnings in body', () => {
    const heading = checkText('A heading — with a dash', ctx('heading'));
    const body = checkText('Body text — with a dash', ctx('body'));
    expect(heading.find((i) => i.rule === 'em-dash')?.severity).toBe('error');
    expect(body.find((i) => i.rule === 'em-dash')?.severity).toBe('warning');
  });
  it('rejects weak CTA labels', () => {
    expect(rules('Learn more', 'label', { isCtaLabel: true })).toContain('cta-label');
    expect(rules('Book a 20-minute demo', 'label', { isCtaLabel: true })).toEqual([]);
  });
  it('detects title case headings', () => {
    expect(looksTitleCase('Clinic Management Software For Doctors')).toBe(true);
    expect(looksTitleCase('Clinic software built for one doctor')).toBe(false);
    expect(looksTitleCase('ABDM milestones and GST invoicing in India')).toBe(false);
  });
});

describe('walk', () => {
  it('skips URLs and references, reports nulls and missing media', () => {
    const leaves = [
      ...walk({
        title: 'Hello',
        href: '/x/',
        author: null,
        t: { collection: 'testimonials', id: 'a' },
        heroMedia: { kind: 'screenshot', alt: 'Today view', frame: 'browser', needed: 'Today view' },
      }),
    ];
    expect(leaves.map((l) => l.kind)).toEqual(['string', 'null', 'missing-media', 'string']);
  });
});

describe('auditEntry', () => {
  const base = {
    status: 'published',
    title: 'Clinic Management Software in India, ABDM Ready',
    metaDescription:
      'ABDM-ready EMR, GST billing, UPI and WhatsApp for Indian clinics, from a Kolkata company running clinics since 2003.',
    author: { collection: 'authors', id: 'x' },
    lastUpdated: new Date('2026-09-26'),
    editorialPass: { by: 'x' },
    sections: [{ discriminant: 'proofBlock', value: {} }],
    faq: Array.from({ length: 8 }, (_, i) => ({
      question: `Question ${i}?`,
      answer: 'A complete answer that runs to well over twelve words so it passes the length rule.',
    })),
  };
  it('passes a clean country entry', () => {
    expect(errorsOf(auditEntry(base, 'country'))).toEqual([]);
  });
  it('enforces per-family FAQ bounds', () => {
    expect(errorsOf(auditEntry({ ...base, faq: base.faq.slice(0, 6) }, 'country')).map((i) => i.rule)).toContain('faq');
    expect(errorsOf(auditEntry({ ...base, faq: base.faq.slice(0, 6) }, 'feature'))).toEqual([]);
  });
  it('requires proof, author and an editorial pass', () => {
    const out = errorsOf(auditEntry({ ...base, sections: [], author: null, editorialPass: undefined }, 'feature')).map((i) => i.rule);
    expect(out).toEqual(expect.arrayContaining(['proof', 'unknown-fact', 'editorial-pass']));
  });
  it('caps testimonials at three', () => {
    const t = (id: string) => ({ collection: 'testimonials', id });
    const sections = [
      { discriminant: 'testimonialRow', value: { items: [t('a'), t('b'), t('c')] } },
      { discriminant: 'proofBlock', value: { testimonial: t('d') } },
    ];
    expect(errorsOf(auditEntry({ ...base, sections }, 'feature')).map((i) => i.rule)).toContain('testimonials');
  });
  it('gates study claims written as text', () => {
    const sections = [{ discriminant: 'proofBlock', value: { body: 'Peer reviewed on 39,849 visits' } }];
    expect(errorsOf(auditEntry({ ...base, sections }, 'feature')).map((i) => i.rule)).toContain('claims');
    const tokens = [{ discriminant: 'proofBlock', value: { body: 'Studied on {fig:visits} visits' } }];
    expect(errorsOf(auditEntry({ ...base, sections: tokens }, 'feature'))).toEqual([]);
  });
  it('enforces title and meta lengths', () => {
    const out = errorsOf(auditEntry({ ...base, title: 'x'.repeat(61), metaDescription: 'y'.repeat(156) }, 'feature'));
    expect(out.filter((i) => i.rule === 'length')).toHaveLength(2);
  });
});
