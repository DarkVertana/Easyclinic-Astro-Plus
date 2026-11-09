/** Every mutation goes through here: a same-origin POST asking for JSON. */
export interface Reply {
  ok: boolean;
  message: string;
  /** The server sent a redirect with no JSON (new post, new job): where to go. */
  location?: string;
  sessionEnded?: boolean;
  [key: string]: unknown;
}

export const SESSION_ENDED = 'Your session has ended. Your text is kept in this page. Sign in again in a new tab, then try again.';

export async function send(url: string, fields: Record<string, string | string[]> | FormData = {}): Promise<Reply> {
  const body = fields instanceof FormData ? fields : new FormData();
  if (!(fields instanceof FormData)) {
    for (const [name, value] of Object.entries(fields)) {
      if (Array.isArray(value)) value.forEach((v) => body.append(name, v));
      else body.set(name, value);
    }
  }
  try {
    const res = await fetch(url, { method: 'POST', body, headers: { accept: 'application/json' } });
    if (res.redirected) {
      const to = new URL(res.url);
      if (to.pathname.startsWith('/admin/login')) return { ok: false, sessionEnded: true, message: SESSION_ENDED };
      return { ok: true, message: '', location: to.pathname + to.search };
    }
    if (res.status === 401) return { ok: false, sessionEnded: true, message: SESSION_ENDED };
    const data = (await res.json().catch(() => null)) as Reply | null;
    if (!data) return { ok: false, message: res.ok ? 'The server sent an unreadable reply. Reload to see what happened.' : 'Something went wrong. Nothing you typed was lost.' };
    return { ...data, ok: res.ok && data.ok !== false };
  } catch {
    return { ok: false, message: 'The connection dropped. Nothing you typed was lost. Try again.' };
  }
}

/** Load a page with a result banner. */
export function goWith(path: string, message: string, kind: 'success' | 'error' | 'info' = 'success', undo?: string): void {
  const target = new URL(path, location.origin);
  target.searchParams.set('flash', message.slice(0, 300));
  target.searchParams.set('flashKind', kind);
  if (undo) target.searchParams.set('undo', undo);
  else target.searchParams.delete('undo');
  location.assign(target.pathname + target.search);
}

export const here = () => location.pathname + location.search;
