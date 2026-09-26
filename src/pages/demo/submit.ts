import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CRM_WEBHOOK_TOKEN, CRM_WEBHOOK_URL, DEMO_REF_SECRET } from 'astro:env/server';
import { demoRequest } from '../../lib/crm/schema';
import { createRef } from '../../lib/crm/ref';
import { sendToCrm } from '../../lib/crm/send';
import { isProduction } from '../../lib/content/stage';

export const prerender = false;

const FAILURE = 'We could not send your request just now. Please call us or message us on WhatsApp, and we will book the demo with you directly.';

function page(title: string, body: string, status: number) {
  // Minimal fallback page for browsers without JavaScript; the enhanced form shows errors inline.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#181818}a{color:#0069cc}</style></head><body>${body}</body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
}

export const POST: APIRoute = async ({ request }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const form = await request.formData();
  const parsed = demoRequest.safeParse(Object.fromEntries(form));
  const back = typeof form.get('page') === 'string' && String(form.get('page')).startsWith('/') ? String(form.get('page')) : '/contact-us/';

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    if (wantsJson) return Response.json({ ok: false, errors }, { status: 400 });
    const list = Object.values(errors).map((e) => `<li>${e.replace(/</g, '&lt;')}</li>`).join('');
    return page('Please check the form', `<h1>Please check the form</h1><ul>${list}</ul><p><a href="${back}#book-a-demo">Go back to the form</a></p>`, 400);
  }

  const lead = parsed.data;
  const countries = await getCollection('countries');
  const countryId = lead.pageCountry || countries.find((c) => c.data.name === lead.country)?.id || '';

  // Spam traps: a filled honeypot, or a form submitted within 3 seconds of loading. Bots get the same
  // confirmation page but no signed reference, so no lead is sent and no conversion is counted.
  const spam = Boolean(lead.website) || (lead.startedAt !== undefined && Date.now() - lead.startedAt < 3000);
  const params = new URLSearchParams({ c: countryId, pt: lead.practiceType, l: lead.locations, from: lead.page });
  let location = `/demo/confirmation/?${params}`;

  if (!spam) {
    try {
      const result = await sendToCrm(lead, { url: CRM_WEBHOOK_URL, token: CRM_WEBHOOK_TOKEN, production: isProduction });
      if (!result.ok) throw new Error(`CRM webhook returned ${result.status}`);
    } catch (error) {
      console.error('[demo form] delivery failed', error);
      if (wantsJson) return Response.json({ ok: false, message: FAILURE }, { status: 502 });
      return page('We could not send your request', `<h1>We could not send your request</h1><p>${FAILURE}</p><p><a href="${back}">Go back</a></p>`, 502);
    }
    const secret = DEMO_REF_SECRET ?? (isProduction ? null : 'development-only-secret');
    if (secret) location += `&ref=${encodeURIComponent(createRef(countryId, secret))}`;
  }

  if (wantsJson) return Response.json({ ok: true, redirect: location });
  return new Response(null, { status: 303, headers: { location } });
};
