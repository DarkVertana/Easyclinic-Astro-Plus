/** The action dialogs and runner shared by the posts table, the read view, the editor and the review screen. */
import * as React from 'react';
import { format } from 'date-fns';
import { CalendarClock, CalendarIcon, ClipboardList, Copy, ExternalLink, Eye, EyeOff, GitCompare, Link2, Pencil, Rocket, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/admin/ui/alert-dialog';
import { Button } from '@/components/admin/ui/button';
import { Calendar } from '@/components/admin/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/admin/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/admin/ui/radio-group';
import { Textarea } from '@/components/admin/ui/textarea';
import { goWith, here, send, type Reply } from './api';
import { Muted, Notice } from './common';
import type { RowData } from './types';

export type Target = Pick<RowData, 'slug' | 'title' | 'submissionId' | 'site' | 'actions'>;
export type DialogKind = 'unpublish' | 'delete' | 'rename' | 'discard' | 'publish-now' | 'empty-trash' | 'approve' | 'schedule' | 'request-changes' | 'reject';
type Open = { kind: DialogKind; target: Target } | null;

export interface ActionsApi {
  open: (kind: DialogKind, target: Target) => void;
  run: (action: string, target: Target) => void;
  element: React.ReactNode;
  error: string | null;
  busy: boolean;
}

const LIFE = '/admin/api/posts/lifecycle/';
const postUrl = (id: string | null, action: string) => `/admin/api/posts/${id}/${action}/`;

/** `home`: where to go when this page's post has gone (editor and read view). Otherwise the page reloads. */
export function useActions(options: { home?: string; viewedHash?: string; precision?: string } = {}): ActionsApi {
  const [open, setOpen] = React.useState<Open>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const gone = () => options.home ?? here();

  const run = async (action: string, target: Target) => {
    setBusy(true);
    setError(null);
    const id = target.submissionId;
    let reply: Reply;
    let to = here();
    let undo: string | undefined;
    switch (action) {
      case 'submit': {
        reply = id ? await send(postUrl(id, 'submit')) : await send('/admin/api/posts/bulk/', { op: 'submit', 'slugs[]': [target.slug] });
        const first = (reply.results as Array<{ ok: boolean; message: string }> | undefined)?.[0];
        if (reply.ok && first) reply = { ok: first.ok, message: first.message };
        break;
      }
      case 'withdraw':
      case 'unschedule':
      case 'reopen':
        reply = await send(postUrl(id, action));
        break;
      case 'duplicate':
        reply = await send(LIFE, { op: 'duplicate', slug: target.slug });
        if (reply.ok && reply.id) to = `/admin/posts/${reply.id}/`;
        break;
      case 'restore':
        reply = await send(LIFE, { op: 'restore', slug: target.slug });
        break;
      case 'trash':
        reply = await send(LIFE, { op: 'trash', slug: target.slug });
        to = gone();
        undo = target.slug;
        break;
      default:
        setBusy(false);
        return;
    }
    if (reply.ok) goWith(to, reply.message || 'Done.', 'success', undo);
    else {
      setBusy(false);
      setError(reply.message);
    }
  };

  return {
    open: (kind, target) => {
      setError(null);
      setOpen({ kind, target });
    },
    run: (action, target) => void run(action, target),
    busy,
    error,
    element: open && <ActionDialog key={open.kind + open.target.slug} state={open} onClose={() => setOpen(null)} home={options.home} viewedHash={options.viewedHash} precision={options.precision} />,
  };
}

const zoned = (timeZone: string) => (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).format(d).replace('Sept', 'Sep').toLowerCase();

function ActionDialog({ state, onClose, home, viewedHash, precision }: { state: NonNullable<Open>; onClose: () => void; home?: string; viewedHash?: string; precision?: string }) {
  const { kind, target } = state;
  const { slug, title, submissionId: id } = target;
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState('gone');
  const [text, setText] = React.useState('');
  const [newSlug, setNewSlug] = React.useState(slug);
  const [answers, setAnswers] = React.useState({ onlyUsCouldWrite: '', readsMachineWritten: '' });
  const [note, setNote] = React.useState('');
  const [day, setDay] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState('09:00');
  const typed = ['approve', 'schedule', 'request-changes', 'reject'].includes(kind);
  const draftKey = `admin-draft:decision:${kind}:${id}`;

  // Typed reasons survive a refused request and a closed tab.
  React.useEffect(() => {
    if (!typed) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
      if (saved?.answers) setAnswers(saved.answers);
      if (saved?.note) setNote(saved.note);
    } catch {
      /* Nothing stored. */
    }
  }, [draftKey, typed]);
  React.useEffect(() => {
    if (!typed) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, note }));
    } catch {
      /* The dialog still works. */
    }
  }, [answers, note, draftKey, typed]);

  const moment = React.useMemo(() => {
    if (!day || !/^\d\d:\d\d$/.test(time)) return null;
    const [h, m] = time.split(':').map(Number) as [number, number];
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  }, [day, time]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    let reply: Reply;
    let to = here();
    switch (kind) {
      case 'unpublish':
        reply = await send(LIFE, { op: 'unpublish', slug, mode, target: mode === 'redirect' ? text.trim() : '' });
        break;
      case 'delete':
        reply = await send(LIFE, { op: 'delete', slug, confirm: text });
        to = home ?? here();
        break;
      case 'empty-trash':
        reply = await send(LIFE, { op: 'empty-trash', confirm: text });
        break;
      case 'rename':
        reply = await send(LIFE, { op: 'rename', slug, newSlug: newSlug.trim() });
        if (reply.ok && reply.id) to = `/admin/posts/${reply.id}/`;
        break;
      case 'discard':
        reply = await send(postUrl(id, 'discard'));
        to = home ?? here();
        break;
      case 'publish-now':
        reply = await send(postUrl(id, 'publish-now'));
        break;
      case 'approve':
        reply = await send(postUrl(id, 'approve'), { viewedHash: viewedHash ?? '', ...answers });
        break;
      case 'schedule':
        if (!moment) {
          setBusy(false);
          setError('Choose a date and a time.');
          return;
        }
        reply = await send(postUrl(id, 'schedule'), { viewedHash: viewedHash ?? '', at: moment.toISOString(), ...answers });
        break;
      default:
        reply = await send(postUrl(id, kind), { note });
        break;
    }
    if (reply.ok) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* Nothing stored. */
      }
      goWith(to, reply.message || 'Done.');
    } else {
      setBusy(false);
      setError(reply.message);
    }
  };

  const confirmWord = kind === 'delete' ? slug : kind === 'empty-trash' ? 'empty trash' : null;
  const close = (next: boolean) => {
    if (!next && !busy) onClose();
  };
  const problem = error && <Notice tone="error" live>{error}</Notice>;

  if (kind === 'unpublish' || kind === 'delete' || kind === 'empty-trash' || kind === 'discard' || kind === 'publish-now') {
    const heading = { unpublish: `Unpublish "${title}"?`, delete: `Delete "${title}" permanently?`, 'empty-trash': 'Empty the trash?', discard: `Discard changes to "${title}"?`, 'publish-now': `Publish "${title}" now?` }[kind];
    const copy = {
      unpublish: `The page at /${slug}/ leaves the live site with the next deploy. The text stays in the admin, and it can only return through review.`,
      delete: 'This removes the post and its history. It cannot be restored.',
      'empty-trash': 'Every post in the trash is deleted permanently. This cannot be undone.',
      discard: target.site === 'live' ? 'The working copy is removed. The live post stays exactly as it is.' : 'The working copy is removed and the post goes back to its last committed version.',
      'publish-now': `The reviewed version goes to the live site at /${slug}/ instead of waiting for its scheduled time.`,
    }[kind];
    const label = { unpublish: 'Unpublish post', delete: 'Delete post', 'empty-trash': 'Empty trash', discard: 'Discard changes', 'publish-now': 'Publish now' }[kind];
    const blocked = busy || (confirmWord !== null && text !== confirmWord) || (kind === 'unpublish' && mode === 'redirect' && !text.trim());
    return (
      <AlertDialog open onOpenChange={close}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">{heading}</AlertDialogTitle>
            <AlertDialogDescription>{copy}</AlertDialogDescription>
          </AlertDialogHeader>
          {kind === 'unpublish' && (
            <div className="grid gap-3">
              <fieldset className="grid gap-2">
                <legend className="mb-1 font-medium">What visitors get at the old address</legend>
                <RadioGroup value={mode} onValueChange={setMode}>
                  <div className="flex items-start gap-2"><RadioGroupItem id="u-gone" value="gone" /><Label htmlFor="u-gone">Page is gone (410), so search engines drop it</Label></div>
                  <div className="flex items-start gap-2"><RadioGroupItem id="u-redirect" value="redirect" /><Label htmlFor="u-redirect">Send them to another page (redirect)</Label></div>
                </RadioGroup>
              </fieldset>
              {mode === 'redirect' && <div className="grid gap-1.5"><Label htmlFor="u-target">Page to send them to</Label><Input id="u-target" value={text} onChange={(e) => setText(e.target.value)} placeholder="/features/emr/" /></div>}
            </div>
          )}
          {confirmWord && <div className="grid gap-1.5"><Label htmlFor="confirm-word" className="block">Type <strong className="font-semibold break-all">{confirmWord}</strong> to confirm</Label><Input id="confirm-word" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} /></div>}
          {problem}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{kind === 'discard' ? 'Keep editing' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction variant={kind === 'publish-now' ? 'default' : 'destructive'} disabled={blocked} onClick={(e) => { e.preventDefault(); void submit(); }}>{busy ? 'Working…' : label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const heading = { rename: 'Change the web address', approve: `Publish "${title}" to the live site?`, schedule: `Schedule "${title}"`, 'request-changes': `Send "${title}" back`, reject: `Reject "${title}"?` }[kind];
  const copy = {
    rename: `A live post keeps sending visitors from /${slug}/ to the new address. The change goes through review.`,
    approve: 'This applies to the version on this page. If the post changes, you will be asked to read it again.',
    schedule: 'The version on this page is locked and published at this time. Editing it later means unscheduling, which returns it to review.',
    'request-changes': 'The editor sees your note on the post.',
    reject: 'This closes the submission. It will not be published.',
  }[kind];
  const label = { rename: 'Change address', approve: 'Publish post', schedule: 'Schedule post', 'request-changes': 'Send back', reject: 'Reject post' }[kind];
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="pr-6 break-words">{heading}</DialogTitle>
            <DialogDescription>{copy}</DialogDescription>
          </DialogHeader>
          {kind === 'approve' && <p><span className="text-muted-foreground">Address: </span><span className="break-all">/{slug}/</span></p>}
          {kind === 'rename' && <div className="grid gap-1.5"><Label htmlFor="new-slug">New web address</Label><Input id="new-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} /><Muted>Lowercase words joined by hyphens.</Muted></div>}
          {kind === 'schedule' && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label id="sched-date-label">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" aria-labelledby="sched-date-label" className="w-44 justify-start font-normal"><CalendarIcon aria-hidden="true" />{day ? format(day, 'd MMM yyyy') : 'Choose a date'}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={day} onSelect={setDay} disabled={{ before: new Date() }} /></PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-1.5"><Label htmlFor="sched-time">Time</Label><Input id="sched-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-32" /></div>
              </div>
              <p role="status" className="text-muted-foreground">{moment ? `That is ${zoned('Asia/Kolkata')(moment)} IST and ${zoned('UTC')(moment)} UTC. You are picking in ${Intl.DateTimeFormat().resolvedOptions().timeZone} time.` : 'Pick in your own time zone. IST and UTC appear here.'}</p>
              {precision && <Muted>Expect it to go live {precision} of this time. Publish now stays available once it is due.</Muted>}
            </div>
          )}
          {(kind === 'approve' || kind === 'schedule') && (
            <>
              <div className="grid gap-1.5"><Label htmlFor="only-us">What in this post could only Easy Clinic have written?</Label><Textarea id="only-us" required minLength={10} rows={3} value={answers.onlyUsCouldWrite} onChange={(e) => setAnswers({ ...answers, onlyUsCouldWrite: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="machine">Does any part read as machine-written? Say where.</Label><Textarea id="machine" required minLength={2} rows={3} value={answers.readsMachineWritten} onChange={(e) => setAnswers({ ...answers, readsMachineWritten: e.target.value })} /></div>
            </>
          )}
          {(kind === 'request-changes' || kind === 'reject') && <div className="grid gap-1.5"><Label htmlFor="d-note">{kind === 'reject' ? 'Reason' : 'Note for the editor'}</Label><Textarea id="d-note" required rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          {problem}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={kind === 'reject' ? 'destructive' : 'default'} disabled={busy}>{busy ? 'Working…' : label}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Menu items for one post, from actionsFor only. Rendered inside a DropdownMenuContent. */
export function PostMenuItems({ target, api, liveUrl, inEditor }: { target: Target; api: ActionsApi; liveUrl?: string | null; inEditor?: boolean }) {
  const can = (a: string) => (target.actions as string[]).includes(a);
  const view = `/admin/posts/view/?slug=${encodeURIComponent(target.slug)}`;
  const id = target.submissionId;
  const safe = (!inEditor && can('submit')) || can('withdraw') || can('unschedule') || can('duplicate') || can('restore') || can('reopen') || can('publish-now');
  const danger = (can('discard') && id) || can('unpublish') || can('trash') || can('delete');
  return (
    <>
      {!inEditor && (can('edit')
        ? <DropdownMenuItem asChild><a href={id ? view : `${view}&edit=1`}><Pencil aria-hidden="true" />Edit</a></DropdownMenuItem>
        : <DropdownMenuItem asChild><a href={view}><Eye aria-hidden="true" />View</a></DropdownMenuItem>)}
      {can('approve') && id && <DropdownMenuItem asChild><a href={`/admin/approvals/${id}/`}><ClipboardList aria-hidden="true" />Review</a></DropdownMenuItem>}
      {can('view-live') && liveUrl && <DropdownMenuItem asChild><a href={liveUrl} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View live</a></DropdownMenuItem>}
      {can('compare') && <DropdownMenuItem asChild><a href={`${view}&compare=live`}><GitCompare aria-hidden="true" />Compare with live</a></DropdownMenuItem>}
      {can('rename') && <DropdownMenuItem onSelect={() => api.open('rename', target)}><Link2 aria-hidden="true" />Change web address</DropdownMenuItem>}
      {safe && <DropdownMenuSeparator />}
      {!inEditor && can('submit') && <DropdownMenuItem onSelect={() => api.run('submit', target)}><Send aria-hidden="true" />Submit for approval</DropdownMenuItem>}
      {can('withdraw') && id && <DropdownMenuItem onSelect={() => api.run('withdraw', target)}><Undo2 aria-hidden="true" />Withdraw from review</DropdownMenuItem>}
      {can('unschedule') && id && <DropdownMenuItem onSelect={() => api.run('unschedule', target)}><CalendarClock aria-hidden="true" />Unschedule</DropdownMenuItem>}
      {can('publish-now') && id && <DropdownMenuItem onSelect={() => api.open('publish-now', target)}><Rocket aria-hidden="true" />Publish now</DropdownMenuItem>}
      {can('reopen') && id && <DropdownMenuItem onSelect={() => api.run('reopen', target)}><RotateCcw aria-hidden="true" />Reopen as a draft</DropdownMenuItem>}
      {can('duplicate') && <DropdownMenuItem onSelect={() => api.run('duplicate', target)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem>}
      {can('restore') && <DropdownMenuItem onSelect={() => api.run('restore', target)}><RotateCcw aria-hidden="true" />Restore</DropdownMenuItem>}
      {danger && <DropdownMenuSeparator />}
      {can('discard') && id && <DropdownMenuItem variant="destructive" onSelect={() => api.open('discard', target)}><RotateCcw aria-hidden="true" />Discard changes</DropdownMenuItem>}
      {can('unpublish') && <DropdownMenuItem variant="destructive" onSelect={() => api.open('unpublish', target)}><EyeOff aria-hidden="true" />Unpublish</DropdownMenuItem>}
      {can('trash') && <DropdownMenuItem variant="destructive" onSelect={() => api.run('trash', target)}><Trash2 aria-hidden="true" />Move to trash</DropdownMenuItem>}
      {can('delete') && <DropdownMenuItem variant="destructive" onSelect={() => api.open('delete', target)}><Trash2 aria-hidden="true" />Delete permanently</DropdownMenuItem>}
    </>
  );
}
