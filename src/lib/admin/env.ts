import { getSecret } from 'astro:env/server';

/** A server secret, trimmed. Blank counts as missing. */
export function env(name: string): string | undefined {
  const value = getSecret(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
