import type { DemoRequest } from './schema.ts';

export interface SendResult {
  ok: boolean;
  delivered: 'webhook' | 'log';
  status?: number;
}

/**
 * Posts a demo request to the CRM webhook (Zapier, Make or a CRM endpoint; the CRM is not chosen yet).
 * Without a webhook URL, non-production builds log the lead so the flow can be tested; production refuses,
 * so a lead is never silently dropped.
 */
export async function sendToCrm(lead: DemoRequest, options: { url?: string; token?: string; production: boolean }): Promise<SendResult> {
  const payload = {
    submittedAt: new Date().toISOString(),
    source: 'easyclinic.io demo form',
    name: lead.name,
    phone: `${lead.dialCode} ${lead.phone}`,
    email: lead.email,
    clinicName: lead.clinic,
    practiceType: lead.practiceType,
    locations: lead.locations,
    country: lead.country,
    page: lead.page,
  };
  if (!options.url) {
    if (options.production) throw new Error('CRM_WEBHOOK_URL is not set in production');
    console.info('[demo form] CRM_WEBHOOK_URL not set; lead logged instead of sent:', payload);
    return { ok: true, delivered: 'log' };
  }
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  return { ok: response.ok, delivered: 'webhook', status: response.status };
}
