/**
 * Currency switcher enhancement (spec 7.3). The switcher is CSS radios and works without this file.
 * This adds: the visitor's last choice is remembered, a first-visit default comes from the browser
 * time zone (map from countries data, no geo-IP call), and each change sends currency_switch (7.8).
 */
import { track } from './track';

const KEY = 'ec-currency';

for (const root of document.querySelectorAll<HTMLElement>('[data-currency-switcher]')) {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-cur-input]'));
  const pick = (currency: string | null | undefined) => {
    const input = inputs.find((i) => i.value === currency);
    if (input) input.checked = true;
    return Boolean(input);
  };

  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  if (!pick(saved)) {
    try {
      const zones = JSON.parse(root.dataset.tz ?? '{}') as Record<string, string>;
      pick(zones[Intl.DateTimeFormat().resolvedOptions().timeZone]);
    } catch {}
  }

  for (const input of inputs) {
    input.addEventListener('change', () => {
      try {
        localStorage.setItem(KEY, input.value);
      } catch {}
      track('currency_switch', { currency: input.value });
    });
  }
}
