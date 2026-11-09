import type { APIRoute } from 'astro';
import { env } from '../../../../lib/admin/env.ts';
import { bearerMatches } from '../../../../lib/admin/http.ts';
import { runDueSchedules } from '../../../../lib/admin/workflow.ts';

export const prerender = false;

/** Vercel Cron sends GET with the secret as a bearer token. No session: it can only execute approvals already frozen. */
export const GET: APIRoute = async ({ request }) => {
  if (!bearerMatches(request.headers.get('authorization'), env('CRON_SECRET'))) return new Response('Unauthorized', { status: 401 });
  try {
    const run = await runDueSchedules();
    return Response.json({ ok: true, results: run.results });
  } catch (error) {
    console.error('[admin] schedule run failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ ok: false }, { status: 500 });
  }
};

export const POST = GET;
