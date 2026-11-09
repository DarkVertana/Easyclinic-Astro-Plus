import type { APIRoute } from 'astro';
import { currentUser } from '../../lib/admin/auth';
import { assertSameOrigin } from '../../lib/admin/http';
import { renderPreview } from '../../lib/admin/preview';

export const prerender = false;

/** The editor's Preview tab: renders unsaved text on the server. It changes nothing. 401 tells the script to keep the text. */
export const POST: APIRoute = async (context) => {
  try {
    assertSameOrigin(context.request, context.url);
  } catch (refused) {
    return refused as Response;
  }
  const user = await currentUser(context);
  if (!user) return new Response('Sign in again', { status: 401 });
  const form = await context.request.formData();
  const body = form.get('body');
  return new Response(renderPreview(typeof body === 'string' ? body : ''), { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
