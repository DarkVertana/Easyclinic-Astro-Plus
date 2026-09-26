/**
 * Analytics (spec 7.8), under 2 KB. A gtag stub queues events immediately; gtag.js itself loads only on
 * the production host, after the first interaction or about 5 seconds of idle after load, so bounced
 * visits are still counted without putting 100 KB of third-party script on the critical path.
 *
 * Events come from `data-track="<event>"` + `data-label` attributes (cta_click, whatsapp_click,
 * pricing_contact_click, study_download), <details data-faq> toggles (faq_open), and direct calls
 * (currency_switch, demo_form_submitted, page_not_found).
 */
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const body = document.body.dataset;
const context = { page_path: location.pathname, page_family: body.family, page_country: body.country };

window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() {
  // gtag.js reads the arguments object, not an array.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
};
window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
window.gtag('js', new Date());

export function track(event: string, params: Record<string, unknown> = {}) {
  window.gtag('event', event, { ...context, ...params });
}

const id = document.documentElement.dataset.ga;
const host = document.documentElement.dataset.canonicalHost;
let loaded = false;
function load() {
  if (loaded || !id || location.hostname !== host) return;
  loaded = true;
  window.gtag('config', id);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(s);
}

if (document.documentElement.dataset.gaImmediate === 'true') load();
for (const type of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(type, load, { once: true, passive: true });
addEventListener('load', () => setTimeout(load, 5000), { once: true });

document.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-track]');
  if (el) track(el.dataset.track!, { label: el.dataset.label ?? el.textContent?.trim().slice(0, 80) });
});

// `toggle` does not bubble, so listen in the capture phase.
document.addEventListener(
  'toggle',
  (e) => {
    const el = e.target as HTMLDetailsElement;
    if (el.matches('[data-faq]') && el.open) track('faq_open', { question: el.querySelector('summary')?.textContent?.trim().slice(0, 100) });
  },
  true,
);
