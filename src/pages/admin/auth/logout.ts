import type { APIRoute } from 'astro';
import { endSession } from '../../../lib/admin/auth.ts';
import { assertSameOrigin } from '../../../lib/admin/http.ts';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    assertSameOrigin(context.request, context.url);
  } catch (refused) {
    return refused as Response;
  }
  endSession(context);
  return new Response(null, { status: 303, headers: { location: '/admin/login/' } });
};
