import type { APIRoute } from 'astro';
import { authSetupProblem, consumeOAuthState, exchangeCode, roleFor, startSession } from '../../../lib/admin/auth.ts';
import { redirectFlash } from '../../../lib/admin/http.ts';

export const prerender = false;

const LOGIN = '/admin/login/';

export const GET: APIRoute = async (context) => {
  const problem = authSetupProblem();
  if (problem) return new Response(problem, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const params = context.url.searchParams;
  const oauth = consumeOAuthState(context, params.get('state'));
  if (!oauth) return redirectFlash(LOGIN, 'That sign-in timed out. Please try again.', 'error');
  const code = params.get('code');
  if (params.get('error') || !code) return redirectFlash(LOGIN, 'Google sign-in was cancelled.', 'info');
  let identity: { email: string; name: string } | null = null;
  try {
    identity = await exchangeCode(code, context.url, oauth.nonce);
  } catch {
    console.error('[admin] token exchange failed');
  }
  if (!identity) return redirectFlash(LOGIN, 'Google could not confirm your account. Please try again.', 'error');
  if (!roleFor(identity.email)) return redirectFlash(LOGIN, 'This account does not have access to the admin.', 'error');
  startSession(context, identity);
  return new Response(null, { status: 303, headers: { location: oauth.back } });
};
