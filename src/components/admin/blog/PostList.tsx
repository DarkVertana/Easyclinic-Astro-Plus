import * as React from 'react';
import { CalendarClock, CircleAlert, ExternalLink, FileText, Image as ImageIcon, MoreHorizontal, PenLine, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { cn } from '@/components/admin/lib/utils';
import { AppFrame, call, Field, StatusPill, timeAgo, useConfirm, useToast, whenText, type BlogStatus } from './kit';

export interface BlogRow {
  slug: string;
  title: string;
  status: BlogStatus;
  changes: boolean;
  scheduledAt: string | null;
  updated: string | null;
  author: string;
  topic: string;
  cover: string | null;
  liveUrl: string | null;
}

type Tab = 'all' | BlogStatus;
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
];
const PAGE = 25;

const slugFrom = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function NewPostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const shown = touched ? slug : slugFrom(title);
  React.useEffect(() => {
    if (!open) { setTitle(''); setSlug(''); setTouched(false); setError(null); }
  }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const reply = await call('create', { title: title.trim(), slug: shown });
    if (reply.ok) location.assign(`/admin/posts/edit/?slug=${encodeURIComponent(String(reply.slug))}`);
    else { setBusy(false); setError(reply.message); }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-base">New post</DialogTitle>
            <DialogDescription>Start with a title. You can change everything else in the editor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-5">
            <Field label="Title" htmlFor="new-title">
              <Input id="new-title" required minLength={3} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to choose clinic software in Kenya" className="h-10" />
            </Field>
            <Field label="Web address" htmlFor="new-slug" hint="Lowercase words joined by hyphens. It cannot change once the post is published.">
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-transparent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <span className="border-r bg-muted px-3 py-2 text-muted-foreground">easyclinic.io/</span>
                <input id="new-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={shown} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none" />
              </div>
            </Field>
            {error && <p role="alert" className="flex gap-2 rounded-md bg-danger-bg p-3 text-danger"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/40 px-6 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || title.trim().length < 3}>{busy ? 'Creating…' : 'Create and start writing'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ src }: { src: string | null }) {
  const [broken, setBroken] = React.useState(false);
  return (
    <div className="relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border sm:w-28">
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto size-5 text-muted-foreground/60" aria-hidden="true" />}
    </div>
  );
}

function PostsBody({ rows, now }: { rows: BlogRow[]; now: Date }) {
  const toast = useToast();
  const [confirmEl, confirm] = useConfirm();
  const [tab, setTab] = React.useState<Tab>('all');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [list, setList] = React.useState(rows);

  const needle = query.trim().toLowerCase();
  const matched = React.useMemo(() => (needle ? list.filter((r) => `${r.title} ${r.slug} ${r.author} ${r.topic}`.toLowerCase().includes(needle)) : list), [list, needle]);
  const inTab = matched.filter((r) => tab === 'all' || r.status === tab);
  const pages = Math.max(1, Math.ceil(inTab.length / PAGE));
  const shown = inTab.slice(page * PAGE, page * PAGE + PAGE);
  const count = (t: Tab) => matched.filter((r) => t === 'all' || r.status === t).length;

  const remove = (row: BlogRow) =>
    confirm({
      title: 'Delete this post?',
      body: <>“{row.title}” and its images will be removed for good. This cannot be undone.</>,
      confirm: 'Delete post',
      danger: true,
      run: async () => {
        const reply = await call('delete', { slug: row.slug });
        toast(reply.ok ? 'success' : 'error', reply.message);
        if (reply.ok) setList((all) => all.filter((r) => r.slug !== row.slug));
        return reply.ok;
      },
    });
  const unpublish = (row: BlogRow) =>
    confirm({
      title: 'Unpublish this post?',
      body: <>It comes off the site at /{row.slug}/ in a minute or two and stays here as a draft. You can publish it again any time.</>,
      confirm: 'Unpublish',
      run: async () => {
        const reply = await call('unpublish', { slug: row.slug });
        toast(reply.ok ? 'success' : 'error', reply.message);
        if (reply.ok) setList((all) => all.map((r) => (r.slug === row.slug ? { ...r, status: 'draft', liveUrl: null, changes: false } : r)));
        return reply.ok;
      },
    });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">Posts</h1>
          <p className="mt-1 text-muted-foreground">{list.filter((r) => r.status === 'published').length} published · {list.filter((r) => r.status === 'draft').length} drafts{list.some((r) => r.status === 'scheduled') ? ` · ${list.filter((r) => r.status === 'scheduled').length} scheduled` : ''}</p>
        </div>
      </div>

      <div className="sticky top-0 z-10 border-b bg-background/95 px-5 backdrop-blur sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div role="tablist" aria-label="Filter posts" className="-mb-px flex gap-5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setPage(0); }}
                className={cn('flex h-11 items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors', tab === t.id ? 'border-heading font-medium text-heading' : 'border-transparent text-muted-foreground hover:text-foreground')}
              >
                {t.label}<span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count(t.id)}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full py-2 sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="q" className="sr-only">Search posts</label>
            <Input id="q" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={`Search ${list.length} posts`} className="h-9 pl-9" />
          </div>
        </div>
      </div>

      <p role="status" className="sr-only">{inTab.length} posts</p>
      {shown.length === 0 ? (
        <div className="grid justify-items-center gap-3 px-6 py-24 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted"><FileText className="size-5 text-muted-foreground" aria-hidden="true" /></div>
          {needle ? (
            <><p className="font-medium text-heading">No posts match “{query.trim()}”.</p><Button variant="outline" onClick={() => setQuery('')}><X aria-hidden="true" />Clear search</Button></>
          ) : (
            <><p className="font-medium text-heading">{tab === 'scheduled' ? 'Nothing is scheduled.' : tab === 'draft' ? 'No drafts.' : 'No posts yet.'}</p><p className="text-muted-foreground">New posts start as drafts. Publish them now or schedule them for later.</p></>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((row) => {
            const edit = `/admin/posts/edit/?slug=${encodeURIComponent(row.slug)}`;
            return (
              <li key={row.slug} className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50 sm:px-8">
                <Thumb src={row.cover} />
                <div className="min-w-0 flex-1">
                  <a href={edit} className="line-clamp-2 font-medium leading-snug text-heading after:absolute after:inset-0 focus-visible:outline-none">{row.title}</a>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                    <StatusPill status={row.status} changes={row.changes} />
                    {row.status === 'scheduled' && row.scheduledAt && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden="true" />{whenText(row.scheduledAt)}</span>}
                    <span className="truncate">/{row.slug}/</span>
                    {row.author && <><span aria-hidden="true">·</span><span>{row.author}</span></>}
                    {row.topic && <span className="hidden lg:inline"><span aria-hidden="true">· </span>{row.topic}</span>}
                  </p>
                </div>
                <time dateTime={row.updated ?? undefined} className="hidden shrink-0 text-[13px] tabular-nums text-muted-foreground md:block">{timeAgo(row.updated, now)}</time>
                <div className="relative z-[1] shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${row.title}`} className="text-muted-foreground"><MoreHorizontal aria-hidden="true" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                      <DropdownMenuItem asChild><a href={edit}><PenLine aria-hidden="true" />Edit</a></DropdownMenuItem>
                      {row.liveUrl && <DropdownMenuItem asChild><a href={row.liveUrl} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View on site</a></DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      {row.liveUrl ? (
                        <DropdownMenuItem onSelect={() => unpublish(row)}>Unpublish</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem variant="destructive" onSelect={() => remove(row)}><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t px-5 py-3 text-[13px] text-muted-foreground sm:px-8">
          <span className="tabular-nums">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, inTab.length)} of {inTab.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => { setPage(page - 1); scrollTo({ top: 0 }); }}>Previous</Button>
            <span className="px-2 tabular-nums">Page {page + 1} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => { setPage(page + 1); scrollTo({ top: 0 }); }}>Next</Button>
          </div>
        </nav>
      )}
      {confirmEl}
    </>
  );
}

export function PostList({ rows, email, now, storeError, flash }: { rows: BlogRow[]; email: string; now: string; storeError: string | null; flash: string | null }) {
  const [newOpen, setNewOpen] = React.useState(false);
  return (
    <AppFrame email={email} onNew={() => setNewOpen(true)}>
      {(storeError || flash) && (
        <div className="px-5 pt-5 sm:px-8">
          <p role="alert" className={cn('flex gap-2 rounded-lg p-3', storeError ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success')}>{storeError ?? flash}</p>
        </div>
      )}
      <PostsBody rows={rows} now={new Date(now)} />
      <Button onClick={() => setNewOpen(true)} size="icon" aria-label="New post" className="fixed right-4 bottom-4 size-12 rounded-full shadow-lg md:hidden"><Plus className="size-5" aria-hidden="true" /></Button>
      <NewPostDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </AppFrame>
  );
}
