import { defineMiddleware } from 'astro:middleware';
import { markPlaceholders } from './lib/content/placeholders.ts';
import { isProduction } from './lib/content/stage.ts';

/** Astro's policy with style-src swapped. A hash in style-src would switch 'unsafe-inline' off, so they all go. */
function adminPanelCsp(astroPolicy: string): string {
  const kept = astroPolicy.split(';').map((d) => d.trim()).filter((d) => d && !/^(style-src|img-src|frame-ancestors)\s/i.test(d));
  return [...kept, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "frame-ancestors 'none'"].join('; ');
}

export const onRequest = defineMiddleware(async (context, next) => {
  // The Keystatic admin (dev and preview only) is not site content: leave its HTML alone.
  if (context.url.pathname.startsWith('/keystatic/')) return next();
  // The blog admin is not site content either. Its pages must never show placeholder marks or be indexed.
  if (context.url.pathname.startsWith('/admin/')) {
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('x-robots-tag', 'noindex, nofollow');
    headers.set('cache-control', 'private, no-store');
    // Radix injects style elements at runtime. On /admin/ only: script hashes kept, inline styles allowed, no framing.
    const policy = headers.get('content-security-policy');
    if (policy) headers.set('content-security-policy', adminPanelCsp(policy));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  const response = await next();
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return response;
  const { html, count } = markPlaceholders(await response.text(), !isProduction);
  const body = html.replace('<ec-placeholder-count></ec-placeholder-count>', String(count));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
});
