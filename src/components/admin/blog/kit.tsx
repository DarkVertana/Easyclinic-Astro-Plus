/**
 * Shared pieces of the blog admin: the app frame, toasts, the confirm dialog and the status label.
 * Colours, radii and type come from the site's tokens through admin.css; nothing here defines its own.
 */
import * as React from 'react';
import { CheckCircle2, CircleAlert, FileText, LogOut, Menu, Plus, X } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { cn } from '@/components/admin/lib/utils';

/* ---------- Requests ---------- */

export interface Reply {
  ok: boolean;
  message: string;
  [key: string]: unknown;
}

/** Same-origin POST asking for JSON. Never throws: a dropped connection or ended session comes back as a reply. */
export async function call(action: string, fields: Record<string, string | Blob>): Promise<Reply> {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  try {
    const res = await fetch(`/admin/api/blog/${action}/`, { method: 'POST', body, headers: { accept: 'application/json' } });
    if (res.status === 401) return { ok: false, message: 'Your session has ended. Sign in again in a new tab; nothing here is lost.' };
    const data = (await res.json().catch(() => null)) as Reply | null;
    if (!data) return { ok: false, message: 'Something went wrong on the server. Nothing you typed was lost.' };
    return { ...data, ok: res.ok && data.ok !== false };
  } catch {
    return { ok: false, message: 'The connection dropped. Nothing you typed was lost. Try again.' };
  }
}

/* ---------- Toasts ---------- */

type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastContext = React.createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => React.useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { id, kind, text }]);
    // Errors stay until dismissed: they may need reading twice.
    if (kind !== 'error') setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="adm-toast pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3.5 text-popover-foreground shadow-lg">
            {t.kind === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
            <p className="min-w-0 flex-1 leading-snug">{t.text}</p>
            <button type="button" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Confirm dialog ---------- */

export interface ConfirmOptions {
  title: string;
  body: React.ReactNode;
  confirm: string;
  danger?: boolean;
  run: () => Promise<boolean>;
}

/** A dialog with one clear action. The action button shows progress and the dialog stays until it succeeds. */
export function useConfirm(): [React.ReactNode, (options: ConfirmOptions) => void] {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = React.useState(false);
  const close = () => !busy && setOptions(null);
  const element = (
    <Dialog open={Boolean(options)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{options?.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{options?.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
          <Button
            variant={options?.danger ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async () => {
              if (!options) return;
              setBusy(true);
              const done = await options.run();
              setBusy(false);
              if (done) setOptions(null);
            }}
          >
            {busy ? 'Working…' : options?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return [element, setOptions];
}

/* ---------- Status ---------- */

export type BlogStatus = 'draft' | 'scheduled' | 'published';

const STATUS_STYLE: Record<BlogStatus, { label: string; dot: string; chip: string }> = {
  published: { label: 'Published', dot: 'bg-success', chip: 'bg-success-bg text-success' },
  scheduled: { label: 'Scheduled', dot: 'bg-info', chip: 'bg-info-bg text-info' },
  draft: { label: 'Draft', dot: 'bg-muted-foreground', chip: 'bg-muted text-muted-foreground' },
};

export function StatusPill({ status, changes, className }: { status: BlogStatus; changes?: boolean; className?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', style.chip, className)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {style.label}
      {changes && <span className="font-normal opacity-80">· unpublished changes</span>}
    </span>
  );
}

/* ---------- Dates ---------- */

export function timeAgo(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso);
  const s = Math.round((now.getTime() - then.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function whenText(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Frame ---------- */

export function Brand() {
  return (
    <a href="/admin/posts/" className="flex items-center gap-2.5 font-[family-name:var(--font-varela-round)] text-[15px] text-heading">
      <img src="/favicon-32.png" alt="" width="24" height="24" className="size-6" />
      Easy Clinic
      <span className="rounded-md border px-1.5 py-px font-sans text-[11px] font-medium text-muted-foreground">Blog</span>
    </a>
  );
}

function SignOut({ className }: { className?: string }) {
  return (
    <form method="post" action="/admin/auth/logout/" className={className}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground"><LogOut aria-hidden="true" />Sign out</Button>
    </form>
  );
}

/** The list's frame: a slim sidebar on wide screens, a top bar on narrow ones. */
export function AppFrame({ email, children, onNew }: { email: string; children: React.ReactNode; onNew: () => void }) {
  const [menu, setMenu] = React.useState(false);
  const nav = (
    <nav aria-label="Admin" className="grid gap-1">
      <a href="/admin/posts/" aria-current="page" className="flex h-9 items-center gap-2.5 rounded-md bg-card px-2.5 font-medium text-heading shadow-xs ring-1 ring-border">
        <FileText className="size-4" aria-hidden="true" />Posts
      </a>
    </nav>
  );
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-[var(--sidebar)] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 px-4 py-5 md:flex">
          <Brand />
          <Button onClick={onNew} className="w-full"><Plus aria-hidden="true" />New post</Button>
          {nav}
          <div className="mt-auto border-t pt-3">
            <p className="truncate px-2.5 pb-1 text-xs text-muted-foreground" title={email}>{email}</p>
            <SignOut />
          </div>
        </aside>
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
          <Brand />
          <Button variant="ghost" size="icon" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
        </header>
        {menu && (
          <div className="grid gap-3 border-b bg-background p-4 md:hidden">
            {nav}
            <SignOut />
          </div>
        )}
        <main id="main" className="min-w-0 bg-background md:my-2 md:mr-2 md:rounded-xl md:border md:shadow-xs">{children}</main>
      </div>
    </ToastProvider>
  );
}

/** Field label with an optional hint and character counter. */
export function Field({ label, htmlFor, hint, count, max, children }: { label: string; htmlFor: string; hint?: React.ReactNode; count?: number; max?: number; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5 [&>*]:min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-heading">{label}</label>
        {count !== undefined && max !== undefined && <span className={cn('text-xs tabular-nums', count > max ? 'text-danger' : 'text-muted-foreground')}>{count}/{max}</span>}
      </div>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
