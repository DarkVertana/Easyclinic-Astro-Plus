/** The Redirects page: add 301 (or temporary) redirects, fix deleted and unpublished posts, see every rule. */
import * as React from 'react';
import { ArrowRight, CircleAlert, CornerDownRight, Search, Trash2, Waypoints, X } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { cn } from '@/components/admin/lib/utils';
import { AppFrame, call, Field, timeAgo, useConfirm, useToast } from './kit';

export interface RedirectRow {
  from: string;
  to: string;
  status: number;
  match: 'exact' | 'prefix' | 'children';
  note: string;
  editable: boolean;
}
export interface RedirectSuggestion {
  path: string;
  title: string;
  why: 'deleted' | 'unpublished';
  at: string;
}

const TYPES = [
  { value: '301', label: '301 Permanent', hint: 'Recommended. The old page is gone for good, and its search ranking passes to the new page.' },
  { value: '302', label: '302 Temporary', hint: 'The old page comes back later. Search engines keep the old address.' },
  { value: '307', label: '307 Temporary (strict)', hint: 'Like 302, and keeps form submissions as they are.' },
  { value: '308', label: '308 Permanent (strict)', hint: 'Like 301, and keeps form submissions as they are.' },
];

function Body({ rows: initial, suggestions: initialSuggestions, targets, error }: { rows: RedirectRow[]; suggestions: RedirectSuggestion[]; targets: string[]; error: string | null }) {
  const toast = useToast();
  const [confirmEl, confirm] = useConfirm();
  const [rows, setRows] = React.useState(initial);
  const [suggestions, setSuggestions] = React.useState(initialSuggestions);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [status, setStatus] = React.useState('301');
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'mine' | 'all'>('mine');
  const [query, setQuery] = React.useState('');
  const toRef = React.useRef<HTMLInputElement>(null);
  const fromRef = React.useRef<HTMLInputElement>(null);

  const norm = (p: string) => {
    let v = p.trim().replace(/^https?:\/\/(www\.)?easyclinic\.io/i, '');
    if (!v || /^https?:\/\//i.test(v)) return v;
    if (!v.startsWith('/')) v = `/${v}`;
    return /\.[a-z0-9]+$/i.test(v) || v.endsWith('/') ? v : `${v}/`;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const reply = await call('redirect-add', { from, to, status });
    setBusy(false);
    if (!reply.ok) return setFormError(reply.message);
    const f = norm(from);
    const t = norm(to);
    setRows((all) => [...all.map((r) => (r.editable && r.to === f ? { ...r, to: t } : r)), { from: f, to: t, status: Number(status), match: 'exact', note: 'Added just now', editable: true }]);
    setSuggestions((all) => all.filter((s) => s.path !== f));
    setFrom('');
    setTo('');
    setStatus('301');
    toast('success', reply.message);
    fromRef.current?.focus();
  };

  const remove = (row: RedirectRow) => confirm({
    title: 'Remove this redirect?',
    body: <>Visitors to <strong className="font-medium text-foreground">{row.from}</strong> will no longer be sent to {row.to}. If that page no longer exists they will see “Page not found”.</>,
    confirm: 'Remove redirect',
    danger: true,
    run: async () => {
      const reply = await call('redirect-remove', { from: row.from });
      toast(reply.ok ? 'success' : 'error', reply.message);
      if (reply.ok) setRows((all) => all.filter((r) => r !== row));
      return reply.ok;
    },
  });

  const pick = (s: RedirectSuggestion) => {
    setFrom(s.path);
    setFormError(null);
    requestAnimationFrame(() => { toRef.current?.focus(); toRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  };

  const mine = rows.filter((r) => r.editable);
  const needle = query.trim().toLowerCase();
  const shown = (view === 'mine' ? mine : rows).filter((r) => !needle || `${r.from} ${r.to} ${r.note}`.toLowerCase().includes(needle)).slice().reverse();
  const hint = TYPES.find((t) => t.value === status)?.hint;

  return (
    <>
      <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-heading">Redirects</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">Send visitors and Google from an old address to a new one, so links to deleted or moved posts keep working.</p>
      </div>

      <div className="grid gap-6 px-5 pb-10 sm:px-8">
        {error && <p role="alert" className="flex gap-2 rounded-lg bg-danger-bg p-3 text-danger"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}

        {/* Add */}
        <form onSubmit={add} className="rounded-xl border bg-card p-5" aria-labelledby="add-heading">
          <h2 id="add-heading" className="font-semibold text-heading">Add a redirect</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_14rem] lg:items-start">
            <Field label="Old address" htmlFor="r-from" hint="The link people still use.">
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <span className="border-r bg-muted px-2.5 py-2 text-[13px] text-muted-foreground">easyclinic.io</span>
                <input ref={fromRef} id="r-from" required value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/old-post/" className="h-full min-w-0 flex-1 bg-transparent px-2.5 outline-none" />
              </div>
            </Field>
            <ArrowRight className="mx-auto hidden size-4 text-muted-foreground lg:mt-9 lg:block" aria-hidden="true" />
            <Field label="New address" htmlFor="r-to" hint="A page on this site, or a full https:// link.">
              <Input ref={toRef} id="r-to" required list="r-targets" value={to} onChange={(e) => setTo(e.target.value)} placeholder="/new-post/" className="h-10" />
              <datalist id="r-targets">{targets.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Type" htmlFor="r-type">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="r-type" className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
          {formError && <p role="alert" className="mt-3 flex gap-2 rounded-md bg-danger-bg p-3 text-[13px] text-danger"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{formError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" disabled={busy || !from.trim() || !to.trim()}>{busy ? 'Checking and saving…' : 'Add redirect'}</Button>
            <p className="text-xs text-muted-foreground">Each redirect is checked against the site’s rules before it is saved.</p>
          </div>
        </form>

        {/* Needs a redirect */}
        {suggestions.length > 0 && (
          <section aria-labelledby="needs-heading" className="rounded-xl border border-warning/40 bg-warning-bg/40 p-5">
            <h2 id="needs-heading" className="flex items-center gap-2 font-semibold text-heading"><CircleAlert className="size-4 text-warning" aria-hidden="true" />Old links that now go nowhere</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">These posts were deleted or taken off the site. Anyone following an old link to them sees “Page not found”. Redirect each one to the closest page.</p>
            <ul className="mt-4 divide-y rounded-lg border bg-card">
              {suggestions.map((s) => (
                <li key={s.path} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-heading">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.path} · {s.why === 'deleted' ? 'deleted' : 'unpublished'} {timeAgo(s.at)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => pick(s)}><CornerDownRight aria-hidden="true" />Redirect it</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* List */}
        <section aria-labelledby="list-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="list-heading" className="font-semibold text-heading">Active redirects</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Show" className="flex rounded-lg bg-muted p-0.5 text-[13px]">
                {(['mine', 'all'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-md px-3', view === v ? 'bg-background font-medium text-heading shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
                    {v === 'mine' ? `Added here (${mine.length})` : `All (${rows.length})`}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="r-q" className="sr-only">Search redirects</label>
                <Input id="r-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search addresses" className="h-9 pl-9" />
              </div>
            </div>
          </div>
          <p role="status" className="sr-only">{shown.length} redirects</p>
          <div className="mt-3 overflow-hidden rounded-xl border bg-card">
            {shown.length === 0 ? (
              <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
                <div className="grid size-11 place-items-center rounded-full bg-muted"><Waypoints className="size-5 text-muted-foreground" aria-hidden="true" /></div>
                {needle ? (
                  <><p className="font-medium text-heading">No redirects match “{query}”.</p><Button variant="outline" size="sm" onClick={() => setQuery('')}><X aria-hidden="true" />Clear search</Button></>
                ) : (
                  <><p className="font-medium text-heading">{view === 'mine' ? 'No redirects added here yet.' : 'No redirects.'}</p><p className="text-[13px] text-muted-foreground">Add one above when you delete, move or rename a page.</p></>
                )}
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse text-[13px]">
                <thead className="border-b bg-muted/40 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="h-10 px-4">From</th>
                    <th scope="col" className="h-10 px-4">To</th>
                    <th scope="col" className="hidden h-10 w-24 px-3 sm:table-cell">Type</th>
                    <th scope="col" className="hidden h-10 px-3 lg:table-cell">Note</th>
                    <th scope="col" className="h-10 w-28 px-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shown.map((r) => (
                    <tr key={`${r.from}|${r.match}`} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5"><span className="block truncate font-medium text-heading" title={r.from}>{r.from}{r.match !== 'exact' && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.match === 'prefix' ? 'and below' : 'pages below'}</span>}</span></td>
                      <td className="px-4 py-2.5"><span className="block truncate text-muted-foreground" title={r.to}>{r.to}</span></td>
                      <td className="hidden px-3 sm:table-cell"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', r.status === 301 || r.status === 308 ? 'bg-success-bg text-success' : 'bg-info-bg text-info')}>{r.status}</span></td>
                      <td className="hidden px-3 text-muted-foreground lg:table-cell"><span className="line-clamp-1" title={r.note}>{r.note || '–'}</span></td>
                      <td className="px-3 text-right">
                        {r.editable ? (
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(r)} aria-label={`Remove redirect from ${r.from}`}><Trash2 aria-hidden="true" />Remove</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground" title="Part of the site’s built-in rules. Change it in the code.">Built-in</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
      {confirmEl}
    </>
  );
}

export function Redirects(props: { rows: RedirectRow[]; suggestions: RedirectSuggestion[]; targets: string[]; error: string | null; email: string }) {
  return (
    <AppFrame email={props.email} current="/admin/redirects/">
      <Body {...props} />
    </AppFrame>
  );
}
