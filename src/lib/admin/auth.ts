import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { devSignInEnabled } from './dev-guard.ts';
import { env } from './env.ts';
import type { AdminUser, Role } from './types.ts';

export const SESSION_COOKIE = 'ec_admin_session';
export const OAUTH_COOKIE = 'ec_admin_oauth';
const SESSION_SECONDS = 12 * 60 * 60;
const OAUTH_SECONDS = 10 * 60;
const MIN_SECRET = 32;
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

type Ctx = Pick<APIContext, 'request' | 'cookies' | 'url'>;

function mac(purpose: string, payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${purpose}.${payload}`).digest('base64url');
}

/** `purpose` is in the signature, so a sign-in state cookie can never pass as a session. */
export function signValue(purpose: string, value: object, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${mac(purpose, payload, secret)}`;
}

export function verifyValue<T extends { exp: number }>(purpose: string, token: string | undefined, secret: string, nowSeconds = Date.now() / 1000): T | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature);
  const wanted = Buffer.from(mac(purpose, payload, secret));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
    return typeof value.exp === 'number' && value.exp > nowSeconds ? value : null;
  } catch {
    return null;
  }
}

function list(value: string | undefined): string[] {
  return (value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/** Read from the lists on every call. Being on both lists means approver. */
export function roleFor(email: string): Role | null {
  const key = email.trim().toLowerCase();
  if (list(env('ADMIN_APPROVERS')).includes(key)) return 'approver';
  return list(env('ADMIN_EDITORS')).includes(key) ? 'editor' : null;
}

function isDev(): boolean {
  return import.meta.env.DEV === true;
}

function sessionSecret(): string | null {
  const secret = env('ADMIN_SESSION_SECRET');
  if (secret && secret.length >= MIN_SECRET) return secret;
  return devSignInEnabled() ? 'development-only-admin-session-secret' : null;
}

/** What is missing on a deployment. Names only, never values. Null when sign-in can work. */
export function authSetupProblem(): string | null {
  if (devSignInEnabled()) return null;
  const missing: string[] = [];
  if (!sessionSecret()) missing.push(`ADMIN_SESSION_SECRET (at least ${MIN_SECRET} characters)`);
  if (!env('GOOGLE_CLIENT_ID')) missing.push('GOOGLE_CLIENT_ID');
  if (!env('GOOGLE_CLIENT_SECRET')) missing.push('GOOGLE_CLIENT_SECRET');
  if (!list(env('ADMIN_APPROVERS')).length) missing.push('ADMIN_APPROVERS');
  return missing.length ? `Admin sign-in is not set up. Missing: ${missing.join(', ')}.` : null;
}

interface SessionValue {
  email: string;
  name: string;
  exp: number;
  /** Honoured only in dev. */
  devRole?: Role;
}

export function startSession(context: Ctx, user: { email: string; name: string; devRole?: Role }): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('No session secret');
  const value: SessionValue = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  context.cookies.set(SESSION_COOKIE, signValue('session', value, secret), {
    path: '/admin/',
    httpOnly: true,
    secure: !isDev(),
    sameSite: 'lax',
    maxAge: SESSION_SECONDS,
  });
}

export function endSession(context: Ctx): void {
  context.cookies.delete(SESSION_COOKIE, { path: '/admin/' });
}

export async function currentUser(context: Ctx): Promise<AdminUser | null> {
  if (authSetupProblem()) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const session = verifyValue<SessionValue>('session', context.cookies.get(SESSION_COOKIE)?.value, secret);
  if (!session || typeof session.email !== 'string') return null;
  const role = devSignInEnabled() && session.devRole ? session.devRole : roleFor(session.email);
  return role ? { email: session.email, name: session.name || session.email, role } : null;
}

const isApi = (context: Ctx) => context.url.pathname.startsWith('/admin/api/');

function refererPath(context: Ctx): string {
  try {
    const referer = new URL(context.request.headers.get('referer') ?? '');
    if (referer.origin === context.url.origin && referer.pathname.startsWith('/admin/')) return referer.pathname;
  } catch {
    // No usable referer.
  }
  return '/admin/';
}

/**
 * Throws a Response when refused. Astro does not turn a thrown Response into a reply by itself:
 * routes go through guarded() in http.ts, and pages must catch it and return it.
 */
export async function requireUser(context: Ctx): Promise<AdminUser> {
  const user = await currentUser(context);
  if (user) return user;
  const wantsJson = (context.request.headers.get('accept') ?? '').includes('application/json');
  if (isApi(context) && wantsJson) throw Response.json({ ok: false, message: 'Please sign in.' }, { status: 401 });
  // A plain form post whose session ran out: back to sign-in, returning to the page the form was on, never the API URL.
  const back = encodeURIComponent(isApi(context) ? refererPath(context) : context.url.pathname + context.url.search);
  throw new Response(null, { status: 303, headers: { location: `/admin/login/?back=${back}` } });
}

export async function requireApprover(context: Ctx): Promise<AdminUser> {
  const user = await requireUser(context);
  if (user.role === 'approver') return user;
  throw Response.json({ ok: false, message: 'Only an approver can do this.' }, { status: 403 });
}

/* ---------- Google sign-in ---------- */

interface OAuthValue {
  state: string;
  nonce: string;
  back: string;
  exp: number;
}

export function redirectUri(url: URL): string {
  return `${url.origin}/admin/auth/callback/`;
}

/** Sets the signed state cookie and returns the Google URL. */
export function beginGoogle(context: Ctx, back: string): string {
  const secret = sessionSecret();
  const clientId = env('GOOGLE_CLIENT_ID');
  if (!secret || !clientId) throw new Error('Sign-in is not set up');
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const value: OAuthValue = { state, nonce, back, exp: Math.floor(Date.now() / 1000) + OAUTH_SECONDS };
  context.cookies.set(OAUTH_COOKIE, signValue('oauth', value, secret), {
    path: '/admin/auth/',
    httpOnly: true,
    secure: !isDev(),
    sameSite: 'lax',
    maxAge: OAUTH_SECONDS,
  });
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', scope: 'openid email profile', redirect_uri: redirectUri(context.url), state, nonce });
  return `${AUTHORIZE_URL}?${params}`;
}

/** One use: the cookie is cleared whatever the result. Null when missing, expired, forged or the state differs. */
export function consumeOAuthState(context: Ctx, state: string | null): OAuthValue | null {
  const secret = sessionSecret();
  const raw = context.cookies.get(OAUTH_COOKIE)?.value;
  context.cookies.delete(OAUTH_COOKIE, { path: '/admin/auth/' });
  if (!secret || !state) return null;
  const value = verifyValue<OAuthValue>('oauth', raw, secret);
  if (!value) return null;
  const a = Buffer.from(value.state);
  const b = Buffer.from(state);
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}

/**
 * Checks the claims of an id_token read straight from Google's token endpoint over TLS, where Google's guide says
 * the signature check is not needed. Never call this with a token from any other route.
 */
export function validateClaims(idToken: string, expected: { clientId: string; nonce: string }, nowSeconds = Date.now() / 1000): { email: string; name: string } | null {
  const part = idToken.split('.')[1];
  if (!part) return null;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) return null;
  if (claims.aud !== expected.clientId) return null;
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return null;
  if (claims.nonce !== expected.nonce) return null;
  if (claims.email_verified !== true) return null;
  if (typeof claims.email !== 'string' || !claims.email.includes('@')) return null;
  const name = typeof claims.name === 'string' ? claims.name.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 100).trim() : '';
  return { email: claims.email.trim().toLowerCase(), name: name || claims.email };
}

export async function exchangeCode(code: string, url: URL, nonce: string, fetchFn: typeof fetch = fetch): Promise<{ email: string; name: string } | null> {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(url), grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id_token?: unknown };
  return typeof data.id_token === 'string' ? validateClaims(data.id_token, { clientId, nonce }) : null;
}
