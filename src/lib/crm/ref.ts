import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed reference for the confirmation page. The GA4 key event demo_form_submitted fires only when
 * the reference verifies, so the conversion count reflects server-confirmed submissions (spec 7.8).
 */
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 22);
}

export function createRef(country: string, secret: string, now = Date.now()): string {
  const payload = `${now.toString(36)}.${country || 'xx'}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyRef(ref: string | null, secret: string, now = Date.now()): { valid: boolean; country?: string } {
  if (!ref) return { valid: false };
  const parts = ref.split('.');
  if (parts.length !== 3) return { valid: false };
  const [time, country, signature] = parts;
  const expected = sign(`${time}.${country}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  const issued = parseInt(time, 36);
  if (!Number.isFinite(issued) || now - issued > MAX_AGE_MS || issued - now > 60_000) return { valid: false };
  return { valid: true, country: country === 'xx' ? undefined : country };
}
