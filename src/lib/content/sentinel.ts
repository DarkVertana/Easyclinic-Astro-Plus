/**
 * Unconfirmed or unknown facts are wrapped in these sentinel characters while rendering.
 * src/middleware.ts turns them into <mark data-placeholder> in preview and strips them in attributes,
 * scripts and production output. A published page can never contain one (the registry and `need()`
 * fail the build first).
 */
export const OPEN = '⟦';
export const CLOSE = '⟧';

export function wrap(text: string): string {
  return `${OPEN}${text}${CLOSE}`;
}

export function hasSentinel(text: string): boolean {
  return text.includes(OPEN);
}

export function stripSentinels(text: string): string {
  return text.replaceAll(OPEN, '').replaceAll(CLOSE, '');
}
