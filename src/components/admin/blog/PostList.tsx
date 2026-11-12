import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, CircleAlert, ExternalLink, FileText, Image as ImageIcon, MoreHorizontal, PenLine, Plus, RotateCcw, Search, Send, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
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
type SortKey = 'title' | 'status' | 'author' | 'updated';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'trash', label: 'Trash' },
];
const PAGE_SIZES = [10, 25, 50];
const STATUS_ORDER: Record<BlogStatus, number> = { draft: 0, scheduled: 1, published: 2, trash: 3 };
/** "All" leaves out the trash, as WordPress does. */
const inTabOf = (t: Tab, r: BlogRow) => (t === 'all' ? r.status !== 'trash' : r.status === t);
type Action = 'publish' | 'unpublish' | 'trash' | 'restore' | 'delete';
const DONE: Record<Action, string> = { publish: 'Published', unpublish: 'Unpublished', trash: 'Moved to the trash:', restore: 'Restored', delete: 'Deleted for good:' };

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
            <DialogTitle className="text-base">Create a new post</DialogTitle>
            <DialogDescription>Start with a title. Everything else is set in the editor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-5">
            <Field label="Title" htmlFor="new-title">
              <Input id="new-title" required minLength={3} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to choose clinic software in Kenya" className="h-10" />
            </Field>
            <Field label="Web address" htmlFor="new-slug" hint="Lowercase words joined by hyphens. It cannot change once the post is published.">
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
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
    <div className="relative aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto size-4 text-muted-foreground/60" aria-hidden="true" />}
    </div>
  );
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: { key: SortKey; desc: boolean }; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined} className={cn('h-10 px-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase', className)}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}<Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </th>
  );
}

function PostsBody({ rows, now, onNew }: { rows: BlogRow[]; now: Date; onNew: () => void }) {
  const toast = useToast();
  const [confirmEl, confirm] = useConfirm();
  const [tab, setTab] = React.useState<Tab>('all');
  const [query, setQuery] = React.useState('');
  const [author, setAuthor] = React.useState('all');
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({ key: 'updated', desc: true });
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(25);
  const [list, setList] = React.useState(rows);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const authors = React.useMemo(() => [...new Set(list.map((r) => r.author).filter(Boolean))].sort(), [list]);
  const needle = query.trim().toLowerCase();
  const matched = React.useMemo(
    () => list.filter((r) => (author === 'all' || r.author === author) && (!needle || `${r.title} ${r.slug} ${r.author} ${r.topic}`.toLowerCase().includes(needle))),
    [list, needle, author],
  );
  const inTab = React.useMemo(() => {
    const rowsIn = matched.filter((r) => inTabOf(tab, r));
    const dir = sort.desc ? -1 : 1;
    return [...rowsIn].sort((a, b) => {
      const v = sort.key === 'status' ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status] : sort.key === 'updated' ? (a.updated ?? '').localeCompare(b.updated ?? '') : a[sort.key].localeCompare(b[sort.key]);
      return v * dir;
    });
  }, [matched, tab, sort]);
  const pages = Math.max(1, Math.ceil(inTab.length / size));
  const shown = inTab.slice(page * size, page * size + size);
  const count = (t: Tab) => matched.filter((r) => inTabOf(t, r)).length;
  const onSort = (k: SortKey) => { setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k === 'updated' })); setPage(0); };
  const filtered = Boolean(needle) || author !== 'all';

  const pickedRows = list.filter((r) => picked.has(r.slug));
  const allOnPage = shown.length > 0 && shown.every((r) => picked.has(r.slug));
  const someOnPage = shown.some((r) => picked.has(r.slug));
  const toggle = (slug: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(slug); else n.delete(slug); return n; });
  const togglePage = (on: boolean) => setPicked((p) => { const n = new Set(p); for (const r of shown) { if (on) n.add(r.slug); else n.delete(r.slug); } return n; });

  const after = (action: Action, r: BlogRow): BlogRow | null => {
    if (action === 'delete') return null;
    if (action === 'trash') return { ...r, status: 'trash', scheduledAt: null };
    if (action === 'restore') return { ...r, status: 'draft' };
    return { ...r, status: action === 'publish' ? 'published' : 'draft', changes: false, scheduledAt: null, liveUrl: action === 'publish' ? `/${r.slug}/` : null };
  };
  const runBulk = async (action: Action, targets: BlogRow[]) => {
    setBulkBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of targets) {
      const reply = await call(action, { slug: row.slug });
      if (reply.ok) {
        ok++;
        setList((all) => all.flatMap((r) => (r.slug === row.slug ? (after(action, r) ?? []) : [r])));
      } else failed.push(`${row.title}: ${reply.message}`);
    }
    setBulkBusy(false);
    setPicked(new Set());
    if (ok) toast('success', `${DONE[action]} ${ok} ${ok === 1 ? 'post' : 'posts'}.`);
    if (failed.length) toast('error', `${failed.length} could not be changed. ${failed[0]}`);
    return failed.length === 0;
  };
  const posts = (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`;
  const bulk = (action: Action) => {
    const targets = pickedRows.filter((r) => {
      if (action === 'publish') return r.status !== 'trash' && (r.status !== 'published' || r.changes);
      if (action === 'unpublish') return Boolean(r.liveUrl);
      if (action === 'trash') return !r.liveUrl && r.status !== 'trash';
      return r.status === 'trash';
    });
    if (!targets.length) {
      const why = { publish: 'These posts are already published.', unpublish: 'None of these posts are live.', trash: 'Only posts that are not live can go in the trash. Unpublish live posts first.', restore: 'None of these posts are in the trash.', delete: 'None of these posts are in the trash.' };
      return toast('error', why[action]);
    }
    const n = posts(targets.length);
    const copy = {
      publish: { title: `Publish ${n}?`, body: 'Each post is checked first. Any that are not ready stay as they are, and you will see why.', confirm: 'Publish' },
      unpublish: { title: `Unpublish ${n}?`, body: 'They come off the site in a minute or two and stay here as drafts.', confirm: 'Unpublish' },
      trash: { title: `Move ${n} to the trash?`, body: 'You can restore them from the Trash tab, or delete them for good there.', confirm: 'Move to trash' },
      restore: { title: `Restore ${n}?`, body: 'They come back as drafts.', confirm: 'Restore' },
      delete: { title: `Delete ${n} for good?`, body: 'They and their images are removed permanently. This cannot be undone.', confirm: 'Delete for good' },
    }[action];
    confirm({ ...copy, danger: action === 'delete', run: () => runBulk(action, targets) });
  };
  const one = (action: Action, row: BlogRow) => {
    if (action === 'trash' || action === 'restore') return void runBulk(action, [row]);
    confirm({
      title: action === 'delete' ? 'Delete this post for good?' : 'Unpublish this post?',
      body: action === 'delete'
        ? <>“{row.title}” and its images will be removed permanently. This cannot be undone. If it was ever live, add a redirect for /{row.slug}/ on the <a href="/admin/redirects/" className="text-link underline">Redirects</a> page.</>
        : <>It comes off the site at /{row.slug}/ in a minute or two and stays here as a draft. Old links to it will show “Page not found” unless you add a redirect on the <a href="/admin/redirects/" className="text-link underline">Redirects</a> page.</>,
      confirm: action === 'delete' ? 'Delete for good' : 'Unpublish',
      danger: action === 'delete',
      run: () => runBulk(action, [row]),
    });
  };
  const inTrash = tab === 'trash';

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">Posts</h1>
          <p className="mt-1 text-muted-foreground">{list.length} entries found</p>
        </div>
        <Button onClick={onNew} className="hidden md:inline-flex"><Plus aria-hidden="true" />Create new post</Button>
      </div>

      <div className="px-5 sm:px-8">
        <div role="tablist" aria-label="Filter by status" className="flex gap-5 overflow-x-auto overflow-y-hidden border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setPage(0); }}
              className={cn('-mb-px flex h-10 items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors', tab === t.id ? 'border-heading font-medium text-heading' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {t.label}<span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count(t.id)}</span>
            </button>
          ))}
        </div>

        {/* Toolbar, or the bulk bar when rows are ticked */}
        <div className="flex min-h-14 flex-wrap items-center gap-2 py-3">
          {picked.size === 0 ? (
            <>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="q" className="sr-only">Search posts</label>
                <Input id="q" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={`Search ${list.length} posts`} className="h-9 pl-9" />
              </div>
              <Select value={author} onValueChange={(v) => { setAuthor(v); setPage(0); }}>
                <SelectTrigger aria-label="Filter by author" className="h-9 w-full sm:w-48"><SelectValue placeholder="All authors">{author === 'all' ? 'All authors' : author}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All authors</SelectItem>
                  {authors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              {filtered && <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setAuthor('all'); }}><X aria-hidden="true" />Clear</Button>}
            </>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
              <span className="mr-2 font-medium tabular-nums text-heading" aria-live="polite">{picked.size} selected</span>
              {inTrash ? (
                <>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('restore')}><RotateCcw aria-hidden="true" />Restore</Button>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('delete')} className="text-danger"><Trash2 aria-hidden="true" />Delete for good</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('publish')}><Send aria-hidden="true" />Publish</Button>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('unpublish')}><Undo2 aria-hidden="true" />Unpublish</Button>
                  <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk('trash')} className="text-danger"><Trash2 aria-hidden="true" />Move to trash</Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPicked(new Set())}>Cancel</Button>
            </div>
          )}
        </div>
      </div>

      <p role="status" className="sr-only">{inTab.length} posts</p>
      <div className="px-5 pb-6 sm:px-8">
        <div className="overflow-hidden rounded-xl border bg-card">
          {shown.length === 0 ? (
            <div className="grid justify-items-center gap-3 px-6 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted"><FileText className="size-5 text-muted-foreground" aria-hidden="true" /></div>
              {filtered ? (
                <><p className="font-medium text-heading">No posts match these filters.</p><Button variant="outline" onClick={() => { setQuery(''); setAuthor('all'); }}><X aria-hidden="true" />Clear filters</Button></>
              ) : (
                inTrash ? (
                  <><p className="font-medium text-heading">The trash is empty.</p><p className="text-muted-foreground">Posts you delete wait here. Restore them, or delete them for good.</p></>
                ) : <><p className="font-medium text-heading">{tab === 'scheduled' ? 'Nothing is scheduled.' : tab === 'draft' ? 'No drafts.' : 'No posts yet.'}</p><p className="text-muted-foreground">New posts start as drafts. Publish them now or schedule them for later.</p><Button onClick={onNew}><Plus aria-hidden="true" />Create new post</Button></>
              )}
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className="w-11 pl-4"><Checkbox aria-label="Select all on this page" checked={allOnPage || (someOnPage && 'indeterminate')} onCheckedChange={(v) => togglePage(Boolean(v))} /></th>
                  <SortHeader label="Title" k="title" sort={sort} onSort={onSort} />
                  <SortHeader label="Status" k="status" sort={sort} onSort={onSort} className="hidden w-44 sm:table-cell" />
                  <SortHeader label="Author" k="author" sort={sort} onSort={onSort} className="hidden w-44 lg:table-cell" />
                  <SortHeader label="Updated" k="updated" sort={sort} onSort={onSort} className="hidden w-32 md:table-cell" />
                  <th scope="col" className="w-14"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((row) => {
                  const edit = `/admin/posts/edit/?slug=${encodeURIComponent(row.slug)}`;
                  const on = picked.has(row.slug);
                  return (
                    <tr key={row.slug} data-state={on ? 'selected' : undefined} className="group relative transition-colors hover:bg-muted/40 data-[state=selected]:bg-accent/60">
                      <td className="relative z-[1] pl-4"><Checkbox aria-label={`Select ${row.title}`} checked={on} onCheckedChange={(v) => toggle(row.slug, Boolean(v))} /></td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Thumb src={row.cover} />
                          <div className="min-w-0">
                            {row.status === 'trash' ? (
                              <p className="line-clamp-1 font-medium text-muted-foreground" title={row.title}>{row.title}</p>
                            ) : (
                              <a href={edit} className="line-clamp-1 font-medium text-heading after:absolute after:inset-0 focus-visible:outline-none" title={row.title}>{row.title}</a>
                            )}
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">/{row.slug}/{row.topic && <span className="hidden xl:inline"> · {row.topic}</span>}</p>
                            <div className="mt-1 sm:hidden"><StatusPill status={row.status} changes={row.changes} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 sm:table-cell">
                        <StatusPill status={row.status} changes={row.changes} />
                        {row.status === 'scheduled' && row.scheduledAt && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" aria-hidden="true" />{whenText(row.scheduledAt)}</p>}
                      </td>
                      <td className="hidden truncate px-3 text-muted-foreground lg:table-cell">{row.author || '–'}</td>
                      <td className="hidden px-3 text-[13px] tabular-nums text-muted-foreground md:table-cell"><time dateTime={row.updated ?? undefined}>{timeAgo(row.updated, now)}</time></td>
                      <td className="relative z-[1] pr-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${row.title}`} className="text-muted-foreground"><MoreHorizontal aria-hidden="true" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            {row.status === 'trash' ? (
                              <>
                                <DropdownMenuItem onSelect={() => one('restore', row)}><RotateCcw aria-hidden="true" />Restore</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => one('delete', row)}><Trash2 aria-hidden="true" />Delete for good</DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem asChild><a href={edit}><PenLine aria-hidden="true" />Edit</a></DropdownMenuItem>
                                {row.liveUrl && <DropdownMenuItem asChild><a href={row.liveUrl} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View on site</a></DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {row.liveUrl ? (
                                  <DropdownMenuItem onSelect={() => one('unpublish', row)}><Undo2 aria-hidden="true" />Unpublish</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem variant="destructive" onSelect={() => one('trash', row)}><Trash2 aria-hidden="true" />Move to trash</DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {inTab.length > 0 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2.5 text-[13px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <Select value={String(size)} onValueChange={(v) => { setSize(Number(v)); setPage(0); }}>
                  <SelectTrigger aria-label="Entries per page" className="h-8 w-[4.5rem]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
                <span>Entries per page</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 tabular-nums">{page * size + 1}–{Math.min((page + 1) * size, inTab.length)} of {inTab.length}</span>
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </nav>
          )}
        </div>
      </div>
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
      <PostsBody rows={rows} now={new Date(now)} onNew={() => setNewOpen(true)} />
      <Button onClick={() => setNewOpen(true)} size="icon" aria-label="Create new post" className="fixed right-4 bottom-4 size-12 rounded-full shadow-lg md:hidden"><Plus className="size-5" aria-hidden="true" /></Button>
      <NewPostDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </AppFrame>
  );
}
