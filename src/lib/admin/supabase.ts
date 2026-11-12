import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

/** The project URL. NEXT_PUBLIC_ is only the name the Supabase dashboard suggested; it is read on the server here. */
export const supabaseUrl = () => env('SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL');
/** Server-only key that passes row level security. Never sent to a browser. */
const secretKey = () => env('SUPABASE_SECRET_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY');
const publishableKey = () => env('SUPABASE_PUBLISHABLE_KEY') ?? env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const supabaseConfigured = (): boolean => Boolean(supabaseUrl() && secretKey());

let admin: SupabaseClient | null = null;

/** One client per server instance: reused across requests, so no handshake per call. */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = supabaseUrl();
  const key = secretKey();
  if (!url || !key) throw new Error('Supabase is not set up: SUPABASE_URL and SUPABASE_SECRET_KEY are needed.');
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Checks an email and password against Supabase Auth. Returns the user's email and name, or null. */
export async function supabaseSignIn(email: string, password: string): Promise<{ email: string; name: string } | null> {
  const url = supabaseUrl();
  const key = publishableKey() ?? secretKey();
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) return null;
  const meta = data.user.user_metadata as { name?: unknown; full_name?: unknown } | undefined;
  const name = typeof meta?.name === 'string' ? meta.name : typeof meta?.full_name === 'string' ? meta.full_name : '';
  return { email: data.user.email.toLowerCase(), name };
}

export const CONTENT_BUCKET = 'content';
