/**
 * Tokens let copy reference facts that live in one place:
 *   {price:inr.professional.annual}  ->  ₹1,499
 *   {fact:doctors}                   ->  5,000+
 *   {fig:diagnostic-errors}          ->  16%
 *   {contact:ke.phone}               ->  +254 750 184 357
 * A token whose fact is unknown renders a placeholder; one whose fact is not yet confirmed renders the
 * value wrapped in sentinels. Both are publish blockers. An unknown token name is a build error.
 */
import type { Issue } from '../rules/audit.ts';
import { formatMoney } from '../format/money.ts';
import type { Currency } from '../../schemas/constants';
import { wrap } from './sentinel.ts';

export const TOKEN = /\{(price|fact|fig|contact):([a-z0-9._-]+)\}/gi;

export interface TokenData {
  prices: Record<string, { currency: Currency; plans: Record<string, { annual: number | null; quarterly: number | null }>; asOf: Date | null }>;
  facts: Record<string, { label: string; value: string | null; asOf: Date | null }>;
  figures: Record<string, { value: string; label: string; source: string | null; internalSource: unknown }>;
  publications: Record<string, { verifiedOn: Date | null }>;
  contacts: Record<string, Record<string, unknown>>;
}

export interface Resolution {
  text: string;
  issues: Issue[];
}

export function resolveTokens(input: string, data: TokenData, path: string): Resolution {
  const issues: Issue[] = [];
  const text = input.replace(TOKEN, (whole, kind: string, ref: string) => {
    const fail = (message: string) => {
      issues.push({ rule: 'token', severity: 'error', path, message: `${whole}: ${message}` });
      return wrap(`[${ref}]`);
    };
    const pending = (value: string, why: string) => {
      issues.push({ rule: 'unknown-fact', severity: 'error', path, message: `${whole} renders "${value}" but ${why}` });
      return wrap(value);
    };
    const unknown = (label: string) => {
      issues.push({ rule: 'unknown-fact', severity: 'error', path, message: `${whole}: ${label} is not known yet` });
      return wrap(`[${label}]`);
    };

    switch (kind.toLowerCase()) {
      case 'price': {
        const [currencyId, plan, period] = ref.split('.');
        const price = data.prices[currencyId];
        if (!price) return fail(`no prices/${currencyId}.yaml`);
        const planPrice = price.plans[plan];
        if (!planPrice || (period !== 'annual' && period !== 'quarterly')) return fail('use price:<currency>.<professional|premium>.<annual|quarterly>');
        const amount = planPrice[period];
        if (amount == null) return unknown(`${price.currency} ${plan} ${period} price`);
        const formatted = formatMoney(amount, price.currency);
        return price.asOf ? formatted : pending(formatted, `prices/${currencyId}.yaml has no asOf date`);
      }
      case 'fact': {
        const fact = data.facts[ref];
        if (!fact) return fail('not in facts.yaml');
        if (fact.value == null) return unknown(fact.label);
        return fact.asOf ? fact.value : pending(fact.value, 'facts.yaml has no asOf date for it');
      }
      case 'fig': {
        const figure = data.figures[ref];
        if (!figure) return fail('not in study.yaml figures');
        if (figure.source) {
          const publication = data.publications[figure.source];
          if (!publication) return fail(`publication ${figure.source} is not in study.yaml`);
          return publication.verifiedOn ? figure.value : pending(figure.value, `publication ${figure.source} has not been verified`);
        }
        return figure.internalSource ? figure.value : pending(figure.value, 'it has no public or internal source');
      }
      case 'contact': {
        const [countryId, field] = ref.split('.');
        const contact = data.contacts[countryId];
        if (!contact) return fail(`no countries/${countryId}.yaml`);
        if (!(field in contact)) return fail(`countries/${countryId}.yaml contact has no "${field}"`);
        const value = contact[field];
        if (value == null) return unknown(`${countryId.toUpperCase()} contact ${field}`);
        if (field === 'name' && contact.publishName !== true) return pending(String(value), 'publishName is not confirmed');
        return String(value);
      }
    }
    return fail('unknown token type');
  });
  return { text, issues };
}

/** Editor-only fields: never rendered, so tokens written there (to discuss a fact) are left as text. */
const UNRENDERED = new Set(['notes']);

/** Resolves tokens in every string of an entry's data, returning a copy and the issues found. */
export function resolveDeep<T>(value: T, data: TokenData, path = ''): { value: T; issues: Issue[] } {
  const issues: Issue[] = [];
  const visit = (v: unknown, p: string): unknown => {
    if (typeof v === 'string') {
      if (!v.includes('{')) return v;
      const r = resolveTokens(v, data, p);
      issues.push(...r.issues);
      return r.text;
    }
    if (Array.isArray(v)) return v.map((item, i) => visit(item, `${p}[${i}]`));
    if (v && typeof v === 'object' && !(v instanceof Date) && Object.getPrototypeOf(v) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [k, item] of Object.entries(v)) out[k] = UNRENDERED.has(k) ? item : visit(item, p ? `${p}.${k}` : k);
      return out;
    }
    return v;
  };
  return { value: visit(value, path) as T, issues };
}
