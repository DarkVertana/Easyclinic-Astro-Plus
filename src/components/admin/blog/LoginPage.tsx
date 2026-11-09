import * as React from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Brand } from './kit';

export function LoginPage({ error, back, setupProblem, dev }: { error: string | null; back: string; setupProblem: string | null; dev: boolean }) {
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--sidebar)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Brand /></div>
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-heading">Sign in</h1>
          <p className="mt-1 text-muted-foreground">Write and publish posts on the Easy Clinic blog.</p>
          {(error || setupProblem) && (
            <div role="alert" className="mt-5 flex gap-2.5 rounded-lg bg-danger-bg p-3 text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="leading-snug">{setupProblem ?? error}</p>
            </div>
          )}
          <form method="post" action="/admin/auth/login/" className="mt-6 grid gap-4" onSubmit={() => setBusy(true)}>
            <input type="hidden" name="back" value={back} />
            <div className="grid gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-heading">Email</label>
              <Input id="email" name="email" type="email" autoComplete="username" required autoFocus className="h-10" defaultValue={dev ? 'admin@easyclinic.local' : undefined} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-heading">Password</label>
              <div className="relative">
                <Input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="h-10 pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="mt-2 h-10" disabled={busy || Boolean(setupProblem)}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
          {dev && <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">Local development: the password is <code className="rounded bg-muted px-1">admin</code> unless ADMIN_PASSWORD is set.</p>}
        </div>
      </div>
    </main>
  );
}
