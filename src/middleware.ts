import { defineMiddleware } from 'astro:middleware';
import { markPlaceholders } from './lib/content/placeholders.ts';
import { isProduction } from './lib/content/stage.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  // The Keystatic admin (dev and preview only) is not site content: leave its HTML alone.
  if (context.url.pathname.startsWith('/keystatic/')) return next();
  const response = await next();
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return response;
  const { html, count } = markPlaceholders(await response.text(), !isProduction);
  const body = html.replace('<ec-placeholder-count></ec-placeholder-count>', String(count));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
});
