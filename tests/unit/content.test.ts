import { describe, expect, it } from 'vitest';
import { markPlaceholders } from '../../src/lib/content/placeholders.ts';
import { resolveDeep, resolveTokens, type TokenData } from '../../src/lib/content/tokens.ts';
import { annualSaving, formatMoney } from '../../src/lib/format/money.ts';

const data: TokenData = {
  prices: {
    usd: { currency: 'USD', plans: { professional: { annual: 79, quarterly: 99 }, premium: { annual: 99, quarterly: 129 } }, asOf: new Date('2026-09-26') },
    inr: { currency: 'INR', plans: { professional: { annual: 1499, quarterly: null }, premium: { annual: 1999, quarterly: 2499 } }, asOf: null },
  },
  facts: {
    doctors: { label: 'doctors', value: '5,000+', asOf: null },
    founded: { label: 'founded', value: '2003', asOf: new Date('2026-09-26') },
    noShows: { label: 'fewer no-shows', value: null, asOf: null },
  },
  figures: {
    visits: { value: '39,849', label: 'visits', source: 'korom', internalSource: null },
    claims: { value: '34%', label: 'denied claims', source: null, internalSource: null },
  },
  publications: { korom: { verifiedOn: null } },
  contacts: { ke: { name: 'Walter', publishName: null, phone: '+254 750 184 357', hours: null } },
};

describe('tokens', () => {
  it('formats confirmed prices', () => {
    const r = resolveTokens('From {price:usd.professional.annual} a month', data, 'x');
    expect(r.text).toBe('From $79 a month');
    expect(r.issues).toEqual([]);
  });
  it('marks unconfirmed prices, facts, figures and contact names as publish blockers', () => {
    for (const token of ['{price:inr.premium.annual}', '{fact:doctors}', '{fig:visits}', '{fig:claims}', '{contact:ke.name}']) {
      const r = resolveTokens(token, data, 'x');
      expect(r.text).toMatch(/^⟦.+⟧$/);
      expect(r.issues.map((i) => i.rule)).toEqual(['unknown-fact']);
    }
  });
  it('renders placeholders for unknown values', () => {
    expect(resolveTokens('{price:inr.professional.quarterly}', data, 'x').text).toBe('⟦[INR professional quarterly price]⟧');
    expect(resolveTokens('{fact:noShows}', data, 'x').text).toBe('⟦[fewer no-shows]⟧');
    expect(resolveTokens('{contact:ke.hours}', data, 'x').text).toBe('⟦[KE contact hours]⟧');
  });
  it('fails on unknown token names', () => {
    const r = resolveTokens('{fact:nope} {price:gbp.professional.annual} {contact:ke.fax}', data, 'x');
    expect(r.issues.filter((i) => i.rule === 'token')).toHaveLength(3);
  });
  it('passes confirmed contact fields straight through', () => {
    expect(resolveTokens('{contact:ke.phone}', data, 'x').text).toBe('+254 750 184 357');
    expect(resolveTokens('{fact:founded}', data, 'x').text).toBe('2003');
  });
  it('resolves deeply and keeps dates and references intact', () => {
    const date = new Date('2026-01-01');
    const { value } = resolveDeep({ a: ['{fact:founded}'], d: date, ref: { collection: 'x', id: 'y' } }, data);
    expect(value.a[0]).toBe('2003');
    expect(value.d).toBe(date);
    expect(value.ref).toEqual({ collection: 'x', id: 'y' });
  });
});

describe('money', () => {
  it('formats per market', () => {
    expect(formatMoney(79, 'USD')).toBe('$79');
    expect(formatMoney(1499, 'INR')).toBe('₹1,499');
    expect(formatMoney(2400, 'KES')).toMatch(/^KES\s2,400$/);
    expect(formatMoney(45000, 'NGN')).toBe('₦45,000');
  });
  it('rounds the annual saving down so it is never overstated', () => {
    expect(annualSaving(99, 129)).toBe(23);
    expect(annualSaving(1499, 1899)).toBe(21);
    expect(annualSaving(79, null)).toBeNull();
  });
});

describe('markPlaceholders', () => {
  const O = '⟦';
  const C = '⟧';
  it('highlights sentinels and brackets in text, strips them in attributes and scripts', () => {
    const html = `<title>Price ${O}$79${C}</title><img alt="${O}[x]${C}"><p>Costs ${O}$79${C} or [KES price].</p><script type="application/ld+json">{"a":"${O}1${C}"}</script>`;
    const { html: out, count } = markPlaceholders(html, true);
    expect(out).toContain('<title>Price $79</title>');
    expect(out).toContain('<img alt="[x]">');
    expect(out).toContain('<mark data-placeholder');
    expect(out).toContain('{"a":"1"}');
    expect(count).toBe(2);
    expect(out).not.toMatch(/[⟦⟧]/);
  });
  it('marks a need() placeholder once, not twice', () => {
    const { html, count } = markPlaceholders(`<p>${O}[KES price]${C} and [x]</p>`, true);
    expect(count).toBe(2);
    expect(html.match(/<mark/g)).toHaveLength(2);
  });
  it('only strips in production', () => {
    const { html, count } = markPlaceholders(`<p>${O}$79${C}</p>`, false);
    expect(html).toBe('<p>$79</p>');
    expect(count).toBe(0);
  });
});
