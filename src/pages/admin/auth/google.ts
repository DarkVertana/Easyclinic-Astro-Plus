import type { APIRoute } from 'astro';
import { authSetupProblem, beginGoogle } from '../../../lib/admin/auth.ts';
import { redirectFlash, safeBack } from '../../../lib/admin/http.ts';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const problem = authSetupProblem();
  if (problem) return new Response(problem, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  try {
    const target = beginGoogle(context, safeBack(context.url.searchParams.get('back')));
    return new Response(null, { status: 303, headers: { location: target } });
  } catch {
    return redirectFlash('/admin/login/', 'Google sign-in is not set up here.', 'error');
  }
};
