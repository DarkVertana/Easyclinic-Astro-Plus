import type { APIRoute } from 'astro';
import { authSetupProblem, checkPassword, clearFailedSignIns, noteFailedSignIn, signInBlocked, startSession } from '../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, safeBack } from '../../../lib/admin/http.ts';

export const prerender = false;

const back = (to: string, message: string) => new Response(null, { status: 303, headers: { location: `/admin/login/?error=${encodeURIComponent(message)}&back=${encodeURIComponent(to)}` } });

/** Email and password sign-in for the one admin account (ADMIN_EMAIL, ADMIN_PASSWORD). */
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
  if (!checkPassword(email, password)) {
    noteFailedSignIn(key);
    return back(to, 'That email and password do not match.');
  }
  clearFailedSignIns(key);
  startSession(context, { email, name: 'Admin' });
  return new Response(null, { status: 303, headers: { location: to } });
};
