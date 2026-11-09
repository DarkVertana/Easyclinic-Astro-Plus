import * as React from 'react';
import { type ColumnDef, type ColumnFiltersState, flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, type RowSelectionState, type SortingState, useReactTable, type VisibilityState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Columns3, Copy, Ellipsis, Info, Plus, RotateCcw, Search, Send, Tags, Trash2, UserRound, X } from 'lucide-react';
import { Badge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/admin/ui/tooltip';
import { BULK_CAP, inTab, POST_TABS, type PostTab } from '../../../lib/admin/lifecycle';
import { goWith, here, send } from './api';
import { AppFrame } from './AppFrame';
import { PostMenuItems, useActions, type ActionsApi } from './actions';
import { Muted, Notice, StatusBadge } from './common';
import { EMPTY_CELL, formatAgo, formatDate, plural, slugFrom } from './format';
import type { FrameData, Option, RowData } from './types';

export interface PostsProps {
  frame: FrameData;
  rows: RowData[];
  topics: Option[];
  authors: Option[];
  initial: Record<string, string>;
  now: string;
  staleDays: number;
  storeError: string | null;
}

const list = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : []);

function healthOf(row: RowData, cutoff: number): string[] {
  const out: string[] = [];
  if (!row.authorId) out.push('no-author');
  if (!row.owner || row.owner === 'No owner') out.push('no-owner');
  if (row.owner === '/blog/') out.push('blog-owner');
  if (row.site === 'live' && row.updated && new Date(row.updated).getTime() < cutoff) out.push('out-of-date');
  return out;
}
const HEALTH: Option[] = [
  { value: 'no-author', label: 'No author' },
  { value: 'no-owner', label: 'No landing page' },
  { value: 'blog-owner', label: 'Owned by the blog index' },
  { value: 'out-of-date', label: 'Out of date' },
];

function SortHead({ column, label, align }: { column: { getIsSorted: () => false | 'asc' | 'desc'; getToggleSortingHandler: () => ((e: unknown) => void) | undefined }; label: string; align?: 'right' }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button variant="ghost" size="sm" className={align === 'right' ? '-mr-2 ml-auto flex' : '-ml-2'} onClick={column.getToggleSortingHandler()}>
      {label}<Icon aria-hidden="true" className={sorted ? '' : 'opacity-50'} />
    </Button>
  );
}

function Facet({ title, options, column, facets }: { title: string; options: Option[]; column: { getFilterValue: () => unknown; setFilterValue: (v: unknown) => void }; facets: Map<string, number> }) {
  const selected = (column.getFilterValue() as string[] | undefined) ?? [];
  const toggle = (value: string, on: boolean) => {
    const next = on ? [...selected, value] : selected.filter((v) => v !== value);
    column.setFilterValue(next.length ? next : undefined);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={selected.length ? '' : 'border-dashed'}>
          <Plus aria-hidden="true" />{title}{selected.length > 0 && <Badge variant="secondary" className="ml-1 tabular-nums">{selected.length}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o.value} checked={selected.includes(o.value)} onSelect={(e) => e.preventDefault()} onCheckedChange={(on) => toggle(o.value, Boolean(on))}>
            <span className="min-w-0 flex-1 truncate">{o.label}</span><span className="ml-2 text-muted-foreground tabular-nums">{facets.get(o.value) ?? 0}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({ row, api, disabled }: { row: RowData; api: ActionsApi; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} aria-label={`Actions for ${row.title}`} title={disabled ? 'Finish the bulk action first' : undefined}><Ellipsis aria-hidden="true" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52"><PostMenuItems target={row} api={api} liveUrl={row.liveUrl} /></DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkFieldDialog({ kind, options, slugs, onClose }: { kind: 'assign-author' | 'set-topic'; options: Option[]; slugs: string[]; onClose: () => void }) {
  const noun = kind === 'assign-author' ? 'author' : 'topic';
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    if (!value) return setError(`Choose a ${noun}.`);
    setBusy(true);
    const reply = await send('/admin/api/posts/bulk/', { op: kind, 'slugs[]': slugs, [noun]: value });
    if (reply.ok) goWith(here(), reply.message);
    else {
      setBusy(false);
      setError(reply.message);
    }
  };
  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change {noun}</DialogTitle><DialogDescription>For {plural(slugs.length, 'selected post')}. Each one stays out of the live site until it is approved.</DialogDescription></DialogHeader>
        <div className="grid gap-1.5">
          <Label id="bulk-field-label">New {noun}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger aria-labelledby="bulk-field-label" className="w-full"><SelectValue placeholder={`Choose a ${noun}`} /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {error && <Notice tone="error" live>{error}</Notice>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={go}>{busy ? 'Working…' : `Change ${noun}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPostDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const shown = touched ? slug : slugFrom(title);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const reply = await send('/admin/api/posts/new/', { title: title.trim(), slug: shown, topic: '', owner: '' });
    if (reply.location) location.assign(reply.location);
    else {
      setBusy(false);
      setError(reply.message || 'The post could not be created.');
    }
  };
  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader><DialogTitle>New post</DialogTitle><DialogDescription>You choose the topic and landing page in the editor.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="new-title">Title</Label><Input id="new-title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="new-slug">Web address</Label><Input id="new-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={shown} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} /><Muted>Lowercase words joined by hyphens.</Muted></div>
          {error && <Notice tone="error" live>{error}</Notice>}
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create draft'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PostsPage({ frame, rows, topics, authors, initial, now, staleDays, storeError }: PostsProps) {
  const nowDate = React.useMemo(() => new Date(now), [now]);
  const cutoff = nowDate.getTime() - staleDays * 86_400_000;
  const startTab = POST_TABS.some((t) => t.id === initial.tab) ? (initial.tab as PostTab) : 'all';
  const [tab, setTab] = React.useState<PostTab>(startTab);
  const [search, setSearch] = React.useState(initial.q ?? '');
  const [sorting, setSorting] = React.useState<SortingState>([{ id: initial.sort ?? 'updated', desc: (initial.dir ?? 'desc') !== 'asc' }]);
  const [filters, setFilters] = React.useState<ColumnFiltersState>(() => (['topic', 'author', 'health'] as const).flatMap((id) => (list(initial[id]).length ? [{ id, value: list(initial[id]) }] : [])));
  const [visibility, setVisibility] = React.useState<VisibilityState>(() => Object.fromEntries(['owner', ...list(initial.hide)].map((id) => [id, list(initial.show).includes(id)])));
  const [pageIndex, setPageIndex] = React.useState(Math.max(0, Number(initial.page ?? 1) - 1));
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [newOpen, setNewOpen] = React.useState('new' in initial);
  const [fieldDialog, setFieldDialog] = React.useState<'assign-author' | 'set-topic' | null>(null);
  const [bulkError, setBulkError] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const api = useActions();
  const nothingSelected = Object.keys(selection).length === 0;

  const columns = React.useMemo<ColumnDef<RowData>[]>(() => [
    {
      id: 'select',
      enableHiding: false,
      enableSorting: false,
      meta: { head: 'w-10' },
      header: ({ table }) => <Checkbox aria-label="Select all on this page" checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')} onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))} />,
      cell: ({ row }) => <Checkbox aria-label={`Select ${row.original.title}`} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} />,
    },
    {
      id: 'title',
      accessorFn: (r) => r.title.toLowerCase(),
      enableHiding: false,
      header: ({ column }) => <SortHead column={column} label="Title" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <a href={`/admin/posts/view/?slug=${encodeURIComponent(row.original.slug)}`} title={row.original.title} className="truncate font-medium text-heading underline-offset-2 hover:underline">{row.original.title}</a>
            {row.original.hint && (
              <Tooltip>
                <TooltipTrigger asChild><button type="button" className="shrink-0 text-muted-foreground" aria-label={row.original.hint}><Info className="size-3.5" aria-hidden="true" /></button></TooltipTrigger>
                <TooltipContent className="max-w-72">{row.original.hint}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-1 sm:hidden"><StatusBadge label={row.original.label} tone={row.original.tone} /></div>
        </div>
      ),
    },
    {
      id: 'status',
      accessorFn: (r) => r.label,
      meta: { head: 'hidden w-56 sm:table-cell', cell: 'hidden sm:table-cell' },
      header: ({ column }) => <SortHead column={column} label="Status" />,
      cell: ({ row }) => <StatusBadge label={row.original.label} tone={row.original.tone} />,
    },
    {
      id: 'topic',
      accessorFn: (r) => r.topicLabel,
      meta: { head: 'hidden w-48 lg:table-cell', cell: 'hidden lg:table-cell' },
      filterFn: (row, _id, value: string[]) => value.includes(row.original.topic),
      header: ({ column }) => <SortHead column={column} label="Topic" />,
      cell: ({ row }) => <div className="truncate" title={row.original.topicLabel}>{row.original.topic ? row.original.topicLabel : EMPTY_CELL}</div>,
    },
    {
      id: 'author',
      accessorFn: (r) => r.author,
      meta: { head: 'hidden w-40 lg:table-cell', cell: 'hidden lg:table-cell' },
      filterFn: (row, _id, value: string[]) => value.includes(row.original.authorId || 'none'),
      header: ({ column }) => <SortHead column={column} label="Author" />,
      cell: ({ row }) => <div className="truncate" title={row.original.author}>{row.original.authorId ? row.original.author : EMPTY_CELL}</div>,
    },
    {
      id: 'owner',
      accessorFn: (r) => r.owner,
      meta: { head: 'hidden w-44 lg:table-cell', cell: 'hidden lg:table-cell', label: 'Landing page' },
      header: ({ column }) => <SortHead column={column} label="Landing page" />,
      cell: ({ row }) => <div className="truncate" title={row.original.owner}>{row.original.owner === 'No owner' ? EMPTY_CELL : row.original.owner}</div>,
    },
    {
      id: 'health',
      accessorFn: (r) => healthOf(r, cutoff).join(','),
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, _id, value: string[]) => value.some((v) => healthOf(row.original, cutoff).includes(v)),
    },
    {
      id: 'updated',
      accessorFn: (r) => (r.updated ? new Date(r.updated).getTime() : 0),
      meta: { head: 'hidden w-32 text-right md:table-cell', cell: 'hidden text-right tabular-nums md:table-cell' },
      header: ({ column }) => <SortHead column={column} label="Updated" align="right" />,
      cell: ({ row }) => <time dateTime={row.original.updated ?? undefined} title={formatDate(row.original.updated)}>{formatAgo(row.original.updated, nowDate)}</time>,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      meta: { head: 'w-12', cell: 'text-right' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row, table }) => <RowMenu row={row.original} api={api} disabled={table.getSelectedRowModel().rows.length > 0} />,
    },
  ], [api, cutoff, nowDate]);

  const needle = search.trim().toLowerCase();
  const textMatched = React.useMemo(() => (needle ? rows.filter((r) => `${r.title} ${r.slug} ${r.author}`.toLowerCase().includes(needle)) : rows), [rows, needle]);
  const inThisTab = React.useMemo(() => textMatched.filter((r) => inTab(tab, r)), [textMatched, tab]);

  const table = useReactTable({
    data: inThisTab,
    columns,
    getRowId: (r) => r.slug,
    state: { sorting, columnFilters: filters, columnVisibility: { ...visibility, health: false }, rowSelection: selection, pagination: { pageIndex, pageSize: 50 } },
    onSortingChange: (u) => { setSorting(u); setPageIndex(0); },
    onColumnFiltersChange: (u) => { setFilters(u); setPageIndex(0); },
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    onPaginationChange: (u) => setPageIndex((old) => (typeof u === 'function' ? u({ pageIndex: old, pageSize: 50 }).pageIndex : u.pageIndex)),
    autoResetPageIndex: false,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // State lives in the URL, so a filtered view can be reloaded and shared.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const url = new URL(location.href);
    const set = (key: string, value: string) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    set('tab', tab === 'all' ? '' : tab);
    set('q', search.trim());
    const s = sorting[0];
    set('sort', s && s.id !== 'updated' ? s.id : '');
    set('dir', s && !s.desc ? 'asc' : '');
    for (const id of ['topic', 'author', 'health']) set(id, ((filters.find((f) => f.id === id)?.value as string[]) ?? []).join(','));
    set('page', pageIndex > 0 ? String(pageIndex + 1) : '');
    const hidden = Object.entries(visibility).filter(([id, on]) => !on && id !== 'owner').map(([id]) => id);
    set('hide', hidden.join(','));
    set('show', visibility.owner ? 'owner' : '');
    ['flash', 'flashKind', 'undo', 'new'].forEach((k) => void k);
    history.replaceState(null, '', url.pathname + url.search);
  }, [tab, search, sorting, filters, pageIndex, visibility]);

  const filtered = table.getFilteredRowModel().rows;
  const selected = rows.filter((r) => selection[r.slug]);
  const allCan = (a: string) => selected.length > 0 && selected.every((r) => (r.actions as string[]).includes(a));
  const totalLive = rows.filter((r) => !r.trashed).length;
  const hasFilters = Boolean(filters.length || needle);
  const clearFilters = () => { setFilters([]); setSearch(''); setPageIndex(0); };
  const pageRows = table.getRowModel().rows;
  const { pageSize } = table.getState().pagination;
  const canEmpty = tab === 'trash' && frame.user.role === 'approver' && rows.some((r) => r.trashed);

  const facet = (id: string) => {
    // Counts inside the current tab and search, ignoring this facet's own selection.
    const counts = new Map<string, number>();
    for (const r of inThisTab) {
      const keys = id === 'topic' ? [r.topic] : id === 'author' ? [r.authorId || 'none'] : healthOf(r, cutoff);
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };

  const bulk = async (op: string) => {
    if (selected.length > BULK_CAP) return setBulkError(`Select at most ${BULK_CAP} posts at a time.`);
    setBulkBusy(true);
    setBulkError(null);
    const slugs = selected.map((r) => r.slug);
    const reply = await send('/admin/api/posts/bulk/', { op, 'slugs[]': slugs });
    if (!reply.ok) {
      setBulkBusy(false);
      return setBulkError(reply.message);
    }
    const results = (reply.results ?? []) as Array<{ slug: string; ok: boolean }>;
    const failed = results.some((r) => !r.ok);
    goWith(here(), reply.message, failed ? 'error' : 'success', op === 'trash' ? results.filter((r) => r.ok).map((r) => r.slug).join(',') : undefined);
  };

  return (
    <AppFrame frame={frame} title="Posts" meta={<span className="tabular-nums">{plural(totalLive, 'post')}</span>} actions={<>
      {canEmpty && <Button variant="outline" className="border-destructive/50 text-destructive" onClick={() => api.open('empty-trash', { slug: '', title: '', submissionId: null, site: 'never', actions: [] })}>Empty trash</Button>}
      <Button onClick={() => setNewOpen(true)}><Plus aria-hidden="true" />New post</Button>
    </>}>
      {storeError && <Notice tone="error" className="mb-4">{storeError}</Notice>}
      {api.error && <Notice tone="error" live className="mb-4">{api.error}</Notice>}
      {bulkError && <Notice tone="error" live className="mb-4">{bulkError}</Notice>}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as PostTab); setSelection({}); setPageIndex(0); }} className="mb-3">
        <TabsList className="w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
          {POST_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-none">{t.label}<span className="text-muted-foreground tabular-nums">{textMatched.filter((r) => inTab(t.id, r)).length}</span></TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card className="gap-0 py-0 [&_[data-slot=table-container]]:overflow-visible" data-panel="posts">
        <div className="flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2">
          {nothingSelected ? (
            <>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="q" className="sr-only">Search posts</Label>
                <Input id="q" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPageIndex(0); }} placeholder={`Search ${totalLive} posts`} className="pl-8" />
              </div>
              <Facet title="Topic" options={topics} column={table.getColumn('topic')!} facets={facet('topic')} />
              <Facet title="Author" options={[{ value: 'none', label: 'No author' }, ...authors]} column={table.getColumn('author')!} facets={facet('author')} />
              <Facet title="Health" options={HEALTH} column={table.getColumn('health')!} facets={facet('health')} />
              {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X aria-hidden="true" />Clear filters</Button>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="sm:ml-auto"><Columns3 aria-hidden="true" />Columns</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table.getAllColumns().filter((c) => c.getCanHide()).map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))}>
                      {(c.columnDef.meta as { label?: string } | undefined)?.label ?? c.id.charAt(0).toUpperCase() + c.id.slice(1)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums" aria-live="polite">{selected.length} selected</span>
              {allCan('restore') && <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => bulk('restore')}><RotateCcw aria-hidden="true" />Restore</Button>}
              {allCan('submit') && <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => bulk('submit')}><Send aria-hidden="true" />Submit for approval</Button>}
              {allCan('trash') && <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => bulk('trash')}><Trash2 aria-hidden="true" />Move to trash</Button>}
              {(allCan('duplicate') || allCan('save')) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">More actions<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {allCan('duplicate') && <DropdownMenuItem onSelect={() => bulk('duplicate')}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem>}
                    {allCan('save') && <DropdownMenuItem onSelect={() => setFieldDialog('assign-author')}><UserRound aria-hidden="true" />Change author</DropdownMenuItem>}
                    {allCan('save') && <DropdownMenuItem onSelect={() => setFieldDialog('set-topic')}><Tags aria-hidden="true" />Change topic</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!allCan('restore') && !allCan('submit') && !allCan('trash') && !allCan('duplicate') && !allCan('save') && <Muted>These posts have no action in common.</Muted>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelection({})}>Cancel</Button>
            </>
          )}
        </div>
        <p role="status" className="sr-only">{plural(filtered.length, 'post')}</p>
        {filtered.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-16 text-center">
            {hasFilters ? (
              <><p className="font-medium text-heading">No posts match{needle ? ` "${search.trim()}"` : ' these filters'}.</p><Button variant="outline" onClick={clearFilters}>Clear filters</Button></>
            ) : tab === 'trash' ? (
              <><p className="font-medium text-heading">Trash is empty.</p><Muted>Moved posts stay here for 30 days, until you restore them or delete them permanently.</Muted></>
            ) : (
              <><p className="font-medium text-heading">No posts here.</p><Muted>Posts in this state appear here.</Muted></>
            )}
          </div>
        ) : (
          <Table className="table-fixed [&_tbody_td:first-child]:pl-4 [&_thead_th:first-child]:pl-4">
            <TableHeader className="md:[&_th]:sticky md:[&_th]:top-14 md:[&_th]:z-10 md:[&_th]:bg-card">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((h) => (
                    <TableHead key={h.id} className={(h.column.columnDef.meta as { head?: string } | undefined)?.head} aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : undefined}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef.meta as { cell?: string } | undefined)?.cell}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > 0 && (
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
            <span className="text-muted-foreground tabular-nums">{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <nav aria-label="Pages" className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button>
              <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
            </nav>
          </div>
        )}
      </Card>
      {api.element}
      {newOpen && <NewPostDialog onClose={() => setNewOpen(false)} />}
      {fieldDialog && <BulkFieldDialog kind={fieldDialog} options={fieldDialog === 'assign-author' ? authors : topics} slugs={selected.map((r) => r.slug)} onClose={() => setFieldDialog(null)} />}
    </AppFrame>
  );
}
