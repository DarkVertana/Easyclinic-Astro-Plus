import { defineMiddleware } from 'astro:middleware';
import { adminCsp, isAdminPath } from './keystatic-core.ts';

/**
 * Registered only by integrations/keystatic-gate.ts, so it exists only in runs that contain Keystatic (never in
 * production). On the admin page it replaces Astro's Content-Security-Policy header with the admin policy
 * (keystatic-core.ts: Astro's script hashes kept, runtime styles and GitHub calls allowed). `astro dev` sends no
 * policy, so there is nothing to replace there. Public pages and /api/keystatic/ responses pass through untouched.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!isAdminPath(context.url.pathname)) return response;
  const policy = response.headers.get('content-security-policy');
  if (!policy || !(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', adminCsp(policy));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
