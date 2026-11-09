import type { APIRoute } from 'astro';
import { runDueSchedules } from '../../../../lib/admin/blog.ts';
import { env } from '../../../../lib/admin/env.ts';
import { bearerMatches } from '../../../../lib/admin/http.ts';

export const prerender = false;

/** Vercel Cron sends GET with the secret as a bearer token. Publishes scheduled posts whose time has come. */
export const GET: APIRoute = async ({ request }) => {
  if (!bearerMatches(request.headers.get('authorization'), env('CRON_SECRET'))) return new Response('Unauthorized', { status: 401 });
  try {
    return Response.json({ ok: true, results: await runDueSchedules() });
  } catch (error) {
    console.error('[admin] schedule run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ ok: false }, { status: 500 });
  }
};

export const POST = GET;
