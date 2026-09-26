import type { Currency } from '../../schemas/constants';

const LOCALES: Record<Currency, string> = { USD: 'en-US', INR: 'en-IN', KES: 'en-KE', AED: 'en-AE', NGN: 'en-NG' };
/** Symbol for currencies buyers read by symbol; ISO code for KES and AED, as local invoices do. */
const DISPLAY: Record<Currency, 'narrowSymbol' | 'code'> = { USD: 'narrowSymbol', INR: 'narrowSymbol', NGN: 'narrowSymbol', KES: 'code', AED: 'code' };

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    currencyDisplay: DISPLAY[currency],
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/ /g, ' ');
}

/** Percentage saved by paying annually rather than quarterly, rounded down so it is never overstated. */
export function annualSaving(annual: number | null, quarterly: number | null): number | null {
  if (!annual || !quarterly || quarterly <= annual) return null;
  return Math.floor(((quarterly - annual) / quarterly) * 100);
}
