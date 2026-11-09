import { createHash, timingSafeEqual } from 'node:crypto';
import type { APIContext, APIRoute } from 'astro';

export type FlashKind = 'success' | 'error' | 'info';

const MAX_FLASH = 300;
const MAX_BODY_BYTES = 2_000_000;

/** An error whose message is safe to show the signed-in user. */
export class PublicError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PublicError';
  }
}

/** Every mutating route. A missing Origin is refused too: browsers send it on every POST. */
export function assertSameOrigin(request: Request, url: URL): void {
  if (request.headers.get('origin') !== url.origin) throw new Response('Cross-origin request refused.', { status: 403 });
}

/** Only a path inside /admin/ comes back. Anything else, including //host and /\host, becomes the fallback. */
export function safeBack(value: unknown, fallback = '/admin/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, 'https://admin.invalid');
    if (parsed.origin !== 'https://admin.invalid' || !parsed.pathname.startsWith('/admin/')) return fallback;
    if (/%2f|%5c/i.test(parsed.pathname) || parsed.pathname.includes('//')) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function redirectFlash(path: string, message: string, kind: FlashKind = 'info'): Response {
  const target = new URL(safeBack(path), 'https://admin.invalid');
  target.searchParams.set('flash', message.slice(0, MAX_FLASH));
  target.searchParams.set('flashKind', kind);
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search + target.hash } });
}

/** Query text: anyone can craft a link with it, so pages must show it as plain text and never trust it. */
export function readFlash(from: URL | { url: URL }): { message: string; kind: FlashKind } | null {
  const url = from instanceof URL ? from : from.url;
  const message = url.searchParams.get('flash');
  if (!message) return null;
  const raw = url.searchParams.get('flashKind');
  const kind: FlashKind = raw === 'success' || raw === 'error' ? raw : 'info';
  return { message: message.slice(0, MAX_FLASH), kind };
}

export function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

export async function readForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw new PublicError('That is too large to save.', 413);
  return request.formData();
}

export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Fails closed with no secret set. Hashed first, so the comparison takes the same time whatever the header's length. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/** Turns thrown responses and errors into a reply. Unknown errors never show their text, and only their type is logged. */
export function guarded(fallbackPath: (context: APIContext) => string, handler: (context: APIContext) => Promise<Response>): APIRoute {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      if (error instanceof Response) return error;
      const known = error instanceof PublicError;
      if (!known) console.error('[admin] request failed', error instanceof Error ? error.name : 'unknown');
      const message = known ? error.message : 'Something went wrong. Please check the post before trying again.';
      const status = known ? error.status : 500;
      if (wantsJson(context.request)) return Response.json({ ok: false, message, ...(known ? error.extra : {}) }, { status });
      return redirectFlash(fallbackPath(context), message, 'error');
    }
  };
}
