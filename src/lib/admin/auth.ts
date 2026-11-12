import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { devSignInEnabled } from './dev-guard.ts';
import { env } from './env.ts';
import { supabaseConfigured } from './supabase.ts';
import type { AdminUser, Role } from './types.ts';

export const SESSION_COOKIE = 'ec_admin_session';
const SESSION_SECONDS = 12 * 60 * 60;
const MIN_SECRET = 32;

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

/**
 * One admin account for now: ADMIN_EMAIL and ADMIN_PASSWORD. Addresses in ADMIN_APPROVERS and ADMIN_EDITORS are
 * kept for later accounts; whoever is signed in can do everything.
 */
export function roleFor(email: string): Role | null {
  const key = email.trim().toLowerCase();
  if (key === adminEmail()) return 'approver';
  return [...list(env('ADMIN_APPROVERS')), ...list(env('ADMIN_EDITORS'))].includes(key) ? 'approver' : null;
}

export function adminEmail(): string {
  return (env('ADMIN_EMAIL') ?? (devSignInEnabled() ? 'admin@easyclinic.local' : '')).trim().toLowerCase();
}

function adminPassword(): string | null {
  return env('ADMIN_PASSWORD') ?? (devSignInEnabled() ? 'admin' : null);
}

const digest = (value: string) => createHmac('sha256', 'ec-admin-password').update(value).digest();

/** Constant-time comparison of both fields; true when they match the admin account. */
export function checkPassword(email: string, password: string): boolean {
  const wantedEmail = adminEmail();
  const wantedPassword = adminPassword();
  if (!wantedEmail || !wantedPassword) return false;
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(wantedEmail));
  const passwordOk = timingSafeEqual(digest(password), digest(wantedPassword));
  return emailOk && passwordOk;
}

const attempts = new Map<string, { count: number; until: number }>();

/** At most 8 failed sign-ins per address per 15 minutes, per server instance. */
export function signInBlocked(key: string, now = Date.now()): boolean {
  const entry = attempts.get(key);
  return Boolean(entry && entry.until > now && entry.count >= 8);
}

export function noteFailedSignIn(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || entry.until <= now) attempts.set(key, { count: 1, until: now + 15 * 60_000 });
  else entry.count += 1;
}

export function clearFailedSignIns(key: string): void {
  attempts.delete(key);
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
  const missing: string[] = [];
  if (!sessionSecret()) missing.push(`ADMIN_SESSION_SECRET (at least ${MIN_SECRET} characters)`);
  // With Supabase, accounts live in Supabase Auth, so the single env account is optional.
  if (!usesSupabaseAuth()) {
    if (!adminEmail()) missing.push('ADMIN_EMAIL');
    if (!adminPassword()) missing.push('ADMIN_PASSWORD');
  }
  return missing.length ? `Admin sign-in is not set up. Missing: ${missing.join(', ')}.` : null;
}

/** Accounts come from Supabase Auth when Supabase is set up, except in dev with the passwordless sign-in. */
export function usesSupabaseAuth(): boolean {
  return supabaseConfigured() && !devSignInEnabled();
}

interface SessionValue {
  email: string;
  name: string;
  exp: number;
  /** Set at sign-in after Supabase Auth checked the password. The cookie is signed, so it cannot be forged. */
  role?: Role;
  /** Honoured only in dev. */
  devRole?: Role;
}

export function startSession(context: Ctx, user: { email: string; name: string; devRole?: Role; role?: Role }): void {
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
  const role = devSignInEnabled() && session.devRole ? session.devRole : (session.role ?? roleFor(session.email));
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
