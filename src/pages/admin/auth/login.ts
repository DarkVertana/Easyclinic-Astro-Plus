import type { APIRoute } from 'astro';
import { authSetupProblem, checkPassword, clearFailedSignIns, noteFailedSignIn, signInBlocked, startSession, usesSupabaseAuth } from '../../../lib/admin/auth.ts';
import { supabaseSignIn } from '../../../lib/admin/supabase.ts';
import { assertSameOrigin, formText, safeBack } from '../../../lib/admin/http.ts';

export const prerender = false;

const back = (to: string, message: string) => new Response(null, { status: 303, headers: { location: `/admin/login/?error=${encodeURIComponent(message)}&back=${encodeURIComponent(to)}` } });

/** Email and password sign-in: Supabase Auth users when Supabase is set up, else the one env account (ADMIN_EMAIL, ADMIN_PASSWORD). */
export const POST: APIRoute = async (context) => {
  try {
    assertSameOrigin(context.request, context.url);
  } catch (refused) {
    return refused as Response;
  }
  const form = await context.request.formData();
  const to = safeBack(formText(form, 'back'));
  if (authSetupProblem()) return back(to, 'Sign-in is not set up on this server yet.');
  const email = formText(form, 'email').trim().toLowerCase();
  const password = formText(form, 'password');
  const key = `${context.clientAddress ?? 'unknown'}|${email}`;
  if (signInBlocked(key)) return back(to, 'Too many attempts. Wait 15 minutes and try again.');
  const user = usesSupabaseAuth()
    ? await supabaseSignIn(email, password).then((u) => (u ? { ...u, role: 'approver' as const } : null))
    : checkPassword(email, password) ? { email, name: 'Admin' } : null;
  if (!user) {
    noteFailedSignIn(key);
    return back(to, 'That email and password do not match.');
  }
  clearFailedSignIns(key);
  startSession(context, { email: user.email, name: user.name || 'Admin', ...('role' in user ? { role: user.role } : {}) });
  return new Response(null, { status: 303, headers: { location: to } });
};
