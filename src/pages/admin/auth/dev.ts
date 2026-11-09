import type { APIRoute } from 'astro';
import { startSession } from '../../../lib/admin/auth.ts';
import { devSignInEnabled } from '../../../lib/admin/dev-guard.ts';
import { assertSameOrigin, formText, safeBack } from '../../../lib/admin/http.ts';
import type { Role } from '../../../lib/admin/types.ts';

export const prerender = false;

/** No password, so dev only, and off when dev is pointed at the real repository or database (dev-guard.ts). */
export const POST: APIRoute = async (context) => {
  if (!devSignInEnabled()) return new Response('Not found', { status: 404 });
  try {
    assertSameOrigin(context.request, context.url);
  } catch (refused) {
    return refused as Response;
  }
  const form = await context.request.formData();
  const email = formText(form, 'email').trim().toLowerCase();
  const role = formText(form, 'role') as Role;
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || (role !== 'editor' && role !== 'approver')) return new Response('Bad request', { status: 400 });
  startSession(context, { email, name: email.split('@')[0], devRole: role });
  return new Response(null, { status: 303, headers: { location: safeBack(formText(form, 'back')) } });
};
