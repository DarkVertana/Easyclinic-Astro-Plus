import * as React from 'react';
import { Bold, Ellipsis, Heading2, Link2, List, PanelRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/admin/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import { Textarea } from '@/components/admin/ui/textarea';
import { goWith, send } from './api';
import { AppFrame } from './AppFrame';
import { PostMenuItems, useActions, type Target } from './actions';
import { CheckList, CompareView, HistoryList, Muted, Notice, SerpPreview, StatusBadge } from './common';
import { fieldForPath, formatDateTime, formatTime, plural } from './format';
import type { Check, CompareData, EditorFields, FrameData, HistoryEvent, Option, RowData } from './types';

export interface EditorProps {
  frame: FrameData;
  slug: string;
  fields: EditorFields;
  row: RowData | null;
  submission: { id: string; state: string; updatedAt: string; history: HistoryEvent[] } | null;
  isOpenCopy: boolean;
  baseSha: string | null;
  checks: Check[] | null;
  note: { by: string; note: string } | null;
  authors: Option[];
  topics: Option[];
  owners: Option[];
  revisions: Array<{ id: string; updatedAt: string; by: string }>;
  compare: CompareData | null;
  compareError: string | null;
  conflict: { fields: Array<{ field: string; label: string; mine: string; main: string }> } | null;
  jobId: string | null;
  previewHtml?: string;
}

const NONE = '__none';
const SNIPPETS: Record<string, { before: string; after: string; fallback: string }> = {
  heading: { before: '\n## ', after: '\n', fallback: 'Heading' },
  bold: { before: '**', after: '**', fallback: 'bold text' },
  link: { before: '[', after: '](https://)', fallback: 'link text' },
  list: { before: '\n- ', after: '\n', fallback: 'List item' },
  cta: { before: '\n<InlineCta heading="Heading" href="/indiademo/" label="Book a 20-minute demo">\n  ', after: '\n</InlineCta>\n', fallback: 'One or two sentences.' },
};

function toForm(f: EditorFields): Record<string, string> {
  const { faq, ...rest } = f;
  return { ...rest, faq: JSON.stringify(faq.filter((q) => q.question.trim() || q.answer.trim())) };
}
const sameFields = (a: EditorFields, b: EditorFields) => JSON.stringify(toForm(a)) === JSON.stringify(toForm(b));

function shortStamp(iso: string): string {
  const d = new Date(iso);
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d).replace('Sept', 'Sep')}, ${new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d).toLowerCase()}`;
}

function Picker({ id, label, value, onChange, options, placeholder, disabled, help }: { id: string; label: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder: string; disabled?: boolean; help?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label id={`${id}-label`}>{label}</Label>
      <Select value={value || NONE} disabled={disabled} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id} aria-labelledby={`${id}-label`} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {help && <Muted>{help}</Muted>}
    </div>
  );
}

function Counted({ word, max, value }: { word: string; max: number; value: string }) {
  const over = value.length - max;
  return <output className={over > 0 ? 'text-danger tabular-nums' : 'text-muted-foreground tabular-nums'}>{word} {value.length} of {max}{over > 0 ? `, ${over} over` : ''}</output>;
}

function ConflictDialog({ conflict, id, onClose }: { conflict: NonNullable<EditorProps['conflict']>; id: string; onClose: () => void }) {
  const [useMain, setUseMain] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const words = (t: string) => `${t.trim().split(/\s+/).filter(Boolean).length} words`;
  const go = async () => {
    setBusy(true);
    const reply = await send(`/admin/api/posts/${id}/rebase/`, { useMain });
    if (reply.ok) goWith(location.pathname, reply.message);
    else {
      setBusy(false);
      setError(reply.message);
    }
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Choose which version to keep</DialogTitle><DialogDescription>The live post changed after this copy started. Tick the fields that should take the live version. Everything else stays yours.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          {conflict.fields.map((f) => (
            <div key={f.field} className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id={`rb-${f.field}`} checked={useMain.includes(f.field)} onCheckedChange={(on) => setUseMain(on ? [...useMain, f.field] : useMain.filter((x) => x !== f.field))} />
                <Label htmlFor={`rb-${f.field}`}>Use the live {f.label.toLowerCase()}</Label>
              </div>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-muted-foreground">Your version</dt><dd className="break-words">{f.field === 'body' ? words(f.mine) : f.mine || '—'}</dd></div>
                <div className="min-w-0"><dt className="text-muted-foreground">Live version</dt><dd className="break-words">{f.field === 'body' ? words(f.main) : f.main || '—'}</dd></div>
              </dl>
            </div>
          ))}
        </div>
        {error && <Notice tone="error" live>{error}</Notice>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={go}>Update to the current version</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditorPage(props: EditorProps) {
  const { frame, slug, row, submission, isOpenCopy, baseSha, note, authors, topics, owners, revisions, compare, compareError, conflict, jobId, previewHtml } = props;
  const actions = (row?.actions ?? []) as string[];
  const can = (a: string) => actions.includes(a);
  const editable = can('save');
  const id = submission?.id ?? null;
  const live = row?.site === 'live';

  const [fields, setFields] = React.useState<EditorFields>(props.fields);
  const [saved, setSaved] = React.useState<EditorFields>(props.fields);
  const [expected, setExpected] = React.useState(submission?.updatedAt ?? '');
  const [status, setStatus] = React.useState<'clean' | 'saving' | 'failed'>('clean');
  const [savedText, setSavedText] = React.useState(isOpenCopy && submission ? `Saved ${formatTime(submission.updatedAt)}` : editable ? (live ? 'Live version' : 'Not edited yet') : 'Read only');
  const [error, setError] = React.useState<string | null>(null);
  const [checks, setChecks] = React.useState<Check[] | null>(props.checks);
  const [attempted, setAttempted] = React.useState(false);
  const [panel, setPanel] = React.useState('ready');
  const [sheet, setSheet] = React.useState(false);
  const [mode, setMode] = React.useState<'write' | 'preview'>(previewHtml !== undefined ? 'preview' : 'write');
  const [preview, setPreview] = React.useState(previewHtml ?? '');
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ savedAt: string; values: EditorFields; changed: boolean } | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const skipWarn = React.useRef(false);
  const dirty = !sameFields(fields, saved);
  const target: Target | null = row && { slug, title: row.title, submissionId: row.submissionId, site: row.site, actions: row.actions };
  const api = useActions({ home: '/admin/posts/' });

  // Only below the width where the panel sits beside the text: a modal sheet would block the page otherwise.
  const openSheet = () => { if (window.matchMedia('(max-width: 1279px)').matches) setSheet(true); };
  const set = <K extends keyof EditorFields>(name: K, value: EditorFields[K]) => setFields((f) => ({ ...f, [name]: value }));
  const draftKey = `admin-draft:${isOpenCopy && id ? `post:${id}` : `post-slug:${slug}`}`;
  const draftBase = submission?.updatedAt ?? '';

  // Offer back text left in this browser. Runs after hydration, as the server cannot see it.
  React.useEffect(() => {
    if (!editable) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as { base?: string; savedAt: string; values: EditorFields };
      if (sameFields({ ...props.fields, ...stored.values }, props.fields)) localStorage.removeItem(draftKey);
      else setDraft({ savedAt: stored.savedAt, values: { ...props.fields, ...stored.values }, changed: stored.base !== draftBase });
    } catch {
      /* Unreadable or blocked: nothing to offer. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dirty text goes to the browser, and leaving warns. A backstop: browsers do not fire beforeunload reliably.
  React.useEffect(() => {
    if (!dirty || !editable) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ base: draftBase, savedAt: new Date().toISOString(), values: fields }));
      } catch {
        /* Storage full or blocked: the form still works. */
      }
    }, 300);
    const warn = (event: BeforeUnloadEvent) => {
      if (skipWarn.current) return;
      event.preventDefault();
      Reflect.set(event, 'returnValue', true);
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty, editable, fields, draftKey, draftBase]);

  const leave = (path: string, message: string, kind: 'success' | 'error' = 'success') => {
    skipWarn.current = true;
    goWith(path, message, kind);
  };

  const runChecks = React.useCallback(async (current: EditorFields) => {
    if (!isOpenCopy || !id) return;
    const reply = await send(`/admin/api/posts/${id}/check/`, toForm(current));
    if (Array.isArray(reply.checks)) setChecks(reply.checks as Check[]);
  }, [id, isOpenCopy]);

  React.useEffect(() => {
    if (!isOpenCopy || !editable || !dirty) return;
    const timer = window.setTimeout(() => void runChecks(fields), 2500);
    return () => window.clearTimeout(timer);
  }, [fields, dirty, editable, isOpenCopy, runChecks]);

  /** The id of the working copy holding what is on screen, or null if saving failed. */
  const save = async (): Promise<string | null | 'unchanged'> => {
    setStatus('saving');
    setError(null);
    const copy = isOpenCopy && id;
    const url = copy ? `/admin/api/posts/${id}/save/` : '/admin/api/posts/edit/';
    const extra: Record<string, string> = copy ? { expectedUpdatedAt: expected } : { slug, ...(baseSha ? { baseSha } : {}) };
    const reply = await send(url, { ...toForm(fields), ...extra });
    if (!reply.ok) {
      setStatus('failed');
      setError(reply.sessionEnded ? 'Your session has ended. Your text is kept in this browser. Sign in again in a new tab, then save.' : reply.message || "Couldn't save. Your text is kept in this browser.");
      return null;
    }
    const noChange = /no change/i.test(reply.message ?? '');
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* Nothing stored. */
    }
    setSaved(fields);
    setStatus('clean');
    setSavedText(noChange ? 'No changes' : `Saved ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date())}`);
    if (copy) {
      if (typeof reply.updatedAt === 'string') setExpected(reply.updatedAt);
      void runChecks(fields);
      return id;
    }
    return reply.changed && typeof reply.id === 'string' ? reply.id : 'unchanged';
  };

  const onSave = async () => {
    const result = await save();
    // The first real save made the working copy: its editor lives at its own address.
    if (typeof result === 'string' && result !== 'unchanged' && !(isOpenCopy && id)) leave(`/admin/posts/${result}/`, 'Saved.');
  };

  const onSubmit = async () => {
    const errors = (checks ?? []).filter((c) => c.severity === 'error').length;
    if (isOpenCopy && !dirty && errors > 0) {
      setAttempted(true);
      setPanel('ready');
      openSheet();
      setError(`Fix ${plural(errors, 'thing')} to submit.`);
      return;
    }
    const result = dirty || !isOpenCopy ? await save() : id;
    if (result === null) return;
    const copy = result === 'unchanged' ? null : result;
    const reply = copy ? await send(`/admin/api/posts/${copy}/submit/`) : await send('/admin/api/posts/bulk/', { op: 'submit', 'slugs[]': [slug] });
    const first = (reply.results as Array<{ ok: boolean; message: string }> | undefined)?.[0];
    const ok = reply.ok && (!first || first.ok);
    const message = first?.message ?? reply.message;
    if (ok) return leave(copy ? `/admin/posts/${copy}/` : location.pathname + location.search, message || 'Submitted for approval.');
    setAttempted(true);
    if (Array.isArray(reply.checks)) setChecks(reply.checks as Check[]);
    if (copy && !(isOpenCopy && id)) return leave(`/admin/posts/${copy}/`, message, 'error');
    setPanel('ready');
    openSheet();
    setError(message);
  };

  const insert = (name: string) => {
    const snippet = SNIPPETS[name];
    const el = bodyRef.current;
    if (!snippet || !el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const text = value.slice(start, end) || snippet.fallback;
    set('body', value.slice(0, start) + snippet.before + text + snippet.after + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.before.length, start + snippet.before.length + text.length);
    });
  };

  const focusField = (path: string) => {
    const field = fieldForPath(path);
    if (!field) return;
    if (field.panel) openSheet(); else setSheet(false);
    if (field.panel) setPanel(field.panel);
    if (field.id === 'f-body') setMode('write');
    requestAnimationFrame(() => {
      const el = document.getElementById(`${field.id}`) ?? document.getElementById(`m-${field.id}`);
      el?.focus();
      if (field.line && el instanceof HTMLTextAreaElement) {
        const lines = el.value.split('\n');
        const from = lines.slice(0, field.line - 1).join('\n').length + (field.line > 1 ? 1 : 0);
        el.setSelectionRange(from, from + (lines[field.line - 1]?.length ?? 0));
      }
    });
  };

  const showPreview = async () => {
    setMode('preview');
    const res = await fetch('/admin/preview-render/', { method: 'POST', body: (() => { const f = new FormData(); f.set('body', fields.body); return f; })() }).catch(() => null);
    if (!res || !res.ok) {
      setMode('write');
      setError(res?.status === 401 ? 'Your session has ended. Your text is kept in this browser. Sign in again in a new tab, then try again.' : 'The preview could not be rendered. Your text is unchanged.');
      return;
    }
    setPreview(await res.text()); // Escaped by src/lib/admin/preview.ts on the server.
  };

  React.useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editable) {
        event.preventDefault();
        void onSave();
      }
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  });

  const errors = (checks ?? []).filter((c) => c.severity === 'error').length;
  const readyLabel = checks === null ? 'Checks did not run' : errors ? `${errors} to fix` : 'Ready';
  const statusText = status === 'saving' ? 'Saving…' : status === 'failed' ? "Couldn't save" : dirty ? 'Unsaved changes' : savedText;
  const submitLabel = row?.work === 'changes_requested' ? 'Resubmit for approval' : live ? 'Submit update for approval' : 'Submit for approval';
  const bodyHidden = Boolean(compare) || mode === 'preview';

  const panels = (prefix: string) => {
    const fid = (name: string) => `${prefix}${name}`;
    return (
      <Tabs value={panel} onValueChange={setPanel}>
        <TabsList className="w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger value="ready" className="flex-none">Ready{errors > 0 && <span className="text-muted-foreground tabular-nums">{errors}</span>}</TabsTrigger>
          <TabsTrigger value="details" className="flex-none">Details</TabsTrigger>
          <TabsTrigger value="seo" className="flex-none">SEO</TabsTrigger>
          <TabsTrigger value="extra" className="flex-none">FAQs</TabsTrigger>
          <TabsTrigger value="history" className="flex-none">History</TabsTrigger>
        </TabsList>
        <TabsContent value="ready" className="pt-3"><CheckList checks={checks} attempted={attempted} onGo={focusField} /></TabsContent>
        <TabsContent value="details" className="grid gap-4 pt-3">
          <Picker id={fid('f-author')} label="Author" value={fields.author} onChange={(v) => set('author', v)} options={authors} placeholder="No author yet" disabled={!editable} />
          <Picker id={fid('f-topic')} label="Topic" value={fields.topic} onChange={(v) => set('topic', v)} options={topics} placeholder="Choose a topic" disabled={!editable} />
          <Picker id={fid('f-owner')} label="Landing page" value={fields.owner === '/blog/' ? '' : fields.owner} onChange={(v) => set('owner', v)} options={owners} placeholder="Choose a landing page" disabled={!editable} help={fields.owner === '/blog/' ? 'The blog index cannot own a post. Choose a landing page.' : undefined} />
          <div className="grid gap-1.5"><div className="flex flex-wrap justify-between gap-2"><Label htmlFor={fid('f-summary')}>Summary</Label><Counted word="Summary" max={220} value={fields.summary} /></div><Textarea id={fid('f-summary')} disabled={!editable} value={fields.summary} onChange={(e) => set('summary', e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor={fid('f-openingAnswer')}>Short answer</Label><Textarea id={fid('f-openingAnswer')} disabled={!editable} value={fields.openingAnswer} onChange={(e) => set('openingAnswer', e.target.value)} /><Muted>Two sentences that answer the question in the title.</Muted></div>
          <div className="grid gap-1.5"><Label htmlFor={fid('f-linkLabel')}>Link text</Label><Input id={fid('f-linkLabel')} disabled={!editable} value={fields.linkLabel} onChange={(e) => set('linkLabel', e.target.value)} /><Muted>Words other pages use when they link here.</Muted></div>
        </TabsContent>
        <TabsContent value="seo" className="grid gap-4 pt-3">
          <div className="grid gap-1.5"><Label htmlFor={fid('f-headKeyword')}>Main keyword</Label><Input id={fid('f-headKeyword')} disabled={!editable} value={fields.headKeyword} onChange={(e) => set('headKeyword', e.target.value)} /></div>
          <div className="grid gap-1.5"><div className="flex flex-wrap justify-between gap-2"><Label htmlFor={fid('f-title')}>Search title</Label><Counted word="Title" max={60} value={fields.title} /></div><Input id={fid('f-title')} disabled={!editable} value={fields.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="grid gap-1.5"><div className="flex flex-wrap justify-between gap-2"><Label htmlFor={fid('f-metaDescription')}>Search description</Label><Counted word="Description" max={155} value={fields.metaDescription} /></div><Textarea id={fid('f-metaDescription')} disabled={!editable} value={fields.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></div>
          <div className="grid gap-1.5"><p className="font-medium">Search preview</p><SerpPreview slug={slug} title={fields.title} description={fields.metaDescription} /></div>
        </TabsContent>
        <TabsContent value="extra" className="grid gap-6 pt-3">
          <section className="grid gap-3">
            <div><h3 className="font-semibold">FAQs</h3><Muted>Use three to eight real questions, or none.</Muted></div>
            {fields.faq.length === 0 && <Muted>No FAQs yet.</Muted>}
            {fields.faq.map((item, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-3">
                <div className="grid gap-1.5"><Label htmlFor={fid(`q-${i}`)}>Question</Label><Input id={fid(`q-${i}`)} disabled={!editable} value={item.question} onChange={(e) => set('faq', fields.faq.map((f, n) => (n === i ? { ...f, question: e.target.value } : f)))} /></div>
                <div className="grid gap-1.5"><Label htmlFor={fid(`a-${i}`)}>Answer</Label><Textarea id={fid(`a-${i}`)} disabled={!editable} value={item.answer} onChange={(e) => set('faq', fields.faq.map((f, n) => (n === i ? { ...f, answer: e.target.value } : f)))} /></div>
                {editable && <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => set('faq', fields.faq.filter((_, n) => n !== i))}><Trash2 aria-hidden="true" />Remove FAQ</Button>}
              </div>
            ))}
            {editable && <Button variant="outline" onClick={() => set('faq', [...fields.faq, { question: '', answer: '' }])}>Add FAQ</Button>}
          </section>
          <section className="grid gap-3">
            <h3 className="font-semibold">Calls to action</h3>
            {([['ctaPrimaryLabel', 'Main button text'], ['ctaPrimaryHref', 'Main button link'], ['ctaSecondaryLabel', 'Second button text'], ['ctaSecondaryHref', 'Second button link']] as const).map(([name, label]) => (
              <div key={name} className="grid gap-1.5"><Label htmlFor={fid(`f-${name}`)}>{label}</Label><Input id={fid(`f-${name}`)} disabled={!editable} value={fields[name]} onChange={(e) => set(name, e.target.value)} /></div>
            ))}
            <div className="grid gap-1.5"><Label htmlFor={fid('f-whatsapp')}>WhatsApp message</Label><Textarea id={fid('f-whatsapp')} disabled={!editable} value={fields.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
          </section>
        </TabsContent>
        <TabsContent value="history" className="grid gap-5 pt-3">
          {can('compare') && <Button variant="outline" asChild><a href="?compare=live">Compare with live</a></Button>}
          {revisions.length > 0 && (
            <section className="grid gap-2">
              <h3 className="font-semibold">{plural(revisions.length, 'saved version')}</h3>
              <ul className="grid gap-2">
                {revisions.map((rev) => (
                  <li key={rev.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0"><p>{formatDateTime(rev.updatedAt)}</p><Muted className="break-all">{rev.by}</Muted></div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild><a href={`?compare=${encodeURIComponent(rev.id)}`}>Compare</a></Button>
                      {can('restore-revision') && id && <Button variant="ghost" size="sm" onClick={async () => { const r = await send(`/admin/api/posts/${id}/restore-revision/`, { revision: rev.id }); if (r.ok) leave(location.pathname, r.message); else setError(r.message); }}>Restore</Button>}
                    </div>
                  </li>
                ))}
              </ul>
              <Muted>Restoring copies that version into the working copy. It does not change the live post.</Muted>
            </section>
          )}
          <section className="grid gap-2">
            <h3 className="font-semibold">Activity</h3>
            {submission ? <HistoryList history={submission.history} /> : <Muted>Nothing yet. Activity starts with the first saved change.</Muted>}
          </section>
          {jobId && <p>AI wrote the first draft. <a className="text-link underline" href={`/admin/generate/${jobId}/`}>See its sources and evidence</a></p>}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <AppFrame
      frame={frame}
      title={row?.label && <span className="sr-only">Edit post</span>}
      back={{ href: '/admin/posts/', label: 'Posts' }}
      meta={<>
        {row && <StatusBadge label={row.label} tone={row.tone} />}
        <span role="status" className={status === 'failed' ? 'text-danger' : undefined}>{statusText}</span>
      </>}
      actions={<>
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetTrigger asChild><Button variant="outline" className="xl:hidden"><PanelRight aria-hidden="true" />{readyLabel}</Button></SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md xl:hidden">
            <SheetHeader><SheetTitle>Post details</SheetTitle><SheetDescription>Checks, details, search and history.</SheetDescription></SheetHeader>
            <div className="px-4 pb-4">{panels('m-')}</div>
          </SheetContent>
        </Sheet>
        {can('withdraw') && id && <Button variant="outline" disabled={api.busy} onClick={() => target && api.run('withdraw', target)}>Withdraw</Button>}
        {can('approve') && id && <Button asChild><a href={`/admin/approvals/${id}/`}>Open review</a></Button>}
        {can('restore') && <Button disabled={api.busy} onClick={() => target && api.run('restore', target)}>Restore post</Button>}
        {editable && <Button variant={can('submit') ? 'outline' : 'default'} disabled={status === 'saving'} onClick={onSave}>Save</Button>}
        {editable && can('submit') && <Button disabled={status === 'saving'} onClick={onSubmit}>{submitLabel}</Button>}
        {target && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52"><PostMenuItems target={target} api={api} liveUrl={row?.liveUrl} inEditor /></DropdownMenuContent>
          </DropdownMenu>
        )}
      </>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22.5rem]">
        <section aria-label="Post" className="mx-auto w-full max-w-[45rem] min-w-0">
          <div className="mb-4 grid gap-2 empty:hidden">
            {error && <Notice tone="error" live>{error}</Notice>}
            {api.error && <Notice tone="error" live>{api.error}</Notice>}
            {compareError && <Notice tone="warning">{compareError}</Notice>}
            {conflict && id && <Notice tone="warning" actions={<Button size="sm" variant="outline" onClick={() => setConflictOpen(true)}>Compare and choose</Button>}>The live post changed after this copy started.</Notice>}
            {note && <Notice tone="warning"><strong className="font-semibold">{note.by} asked for changes:</strong> {note.note}</Notice>}
            {row?.work === 'in_review' && <Notice>This post is waiting for approval, so it is read-only.{can('withdraw') ? ' Withdraw it to keep editing.' : ''}</Notice>}
            {row?.work === 'scheduled' && <Notice>Scheduled posts are locked to the reviewed version. {can('unschedule') ? 'Unschedule it to make changes. It goes back to review.' : 'Ask an approver to unschedule it to make changes.'}</Notice>}
            {row?.trashed && <Notice tone="warning">This post is in the trash. {can('restore') ? 'Restore it to keep working on it. Restoring never publishes it.' : 'An approver can restore it.'}</Notice>}
            {submission && !isOpenCopy && <Notice>This is a closed {submission.state === 'rejected' ? 'rejected' : 'published'} version, kept for reference.</Notice>}
            {editable && live && !isOpenCopy && <Notice>You are editing a live post. Readers keep seeing the live version until an update is approved.</Notice>}
            {draft && (
              <Notice tone="warning" live actions={<>
                <Button size="sm" variant="outline" onClick={() => { setFields(draft.values); setDraft(null); }}>Restore text</Button>
                <Button size="sm" variant="ghost" onClick={() => { try { localStorage.removeItem(draftKey); } catch { /* Nothing stored. */ } setDraft(null); }}>Discard</Button>
              </>}>Unsaved text from {shortStamp(draft.savedAt)} is in this browser ({draft.values.body.trim().split(/\s+/).filter(Boolean).length.toLocaleString('en-IN')} words).{draft.changed ? ' The post has changed since, so compare before saving.' : ''}</Notice>
            )}
          </div>
          <Label htmlFor="f-h1" className="sr-only">Post title</Label>
          <Textarea id="f-h1" rows={1} disabled={!editable} placeholder="Post title" value={fields.h1} onChange={(e) => set('h1', e.target.value)} className="min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-1 font-[family-name:var(--font-varela-round)] text-[length:var(--text-2xl)] leading-tight font-normal text-heading shadow-none focus-visible:ring-0 disabled:opacity-100 dark:bg-transparent" />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="break-all">easyclinic.io/{slug}/</span>
            {can('rename') && target && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => api.open('rename', target)}>Change</Button>}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y py-1.5">
            <div role="group" aria-label="Formatting" className="flex flex-wrap items-center gap-1">
              {editable && mode === 'write' && !compare && (
                <>
                  <Button variant="ghost" size="icon" title="Heading" aria-label="Heading" onClick={() => insert('heading')}><Heading2 aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" title="Bold (Ctrl B)" aria-label="Bold" onClick={() => insert('bold')}><Bold aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" title="Link (Ctrl K)" aria-label="Link" onClick={() => insert('link')}><Link2 aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" title="List" aria-label="List" onClick={() => insert('list')}><List aria-hidden="true" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => insert('cta')}>Call to action</Button>
                </>
              )}
            </div>
            {compare ? <Button variant="outline" size="sm" asChild><a href="?">Close comparison</a></Button> : (
              <Tabs value={mode} onValueChange={(v) => { if (v === 'write') setMode('write'); else void showPreview(); }}>
                <TabsList><TabsTrigger value="write">{editable ? 'Write' : 'Text'}</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
              </Tabs>
            )}
          </div>
          {compare && <div className="py-5"><CompareView data={compare} /></div>}
          {mode === 'preview' && !compare && <div className="adm-prose py-5" tabIndex={0} aria-label="Preview of the text" dangerouslySetInnerHTML={{ __html: preview }} />}
          <Label htmlFor="f-body" className="sr-only">Text, in Markdown</Label>
          <Textarea
            ref={bodyRef}
            id="f-body"
            hidden={bodyHidden}
            disabled={!editable}
            spellCheck
            placeholder="Start writing"
            value={fields.body}
            onChange={(e) => set('body', e.target.value)}
            onKeyDown={(event) => {
              if (!(event.ctrlKey || event.metaKey) || !editable) return;
              const key = event.key.toLowerCase();
              if (key === 'b' || key === 'k') {
                event.preventDefault();
                insert(key === 'b' ? 'bold' : 'link');
              }
            }}
            className={`min-h-96 resize-none rounded-none border-0 bg-transparent px-0 py-4 text-[length:var(--text-body)] leading-[1.7] shadow-none focus-visible:ring-0 disabled:opacity-100 md:text-[length:var(--text-body)] dark:bg-transparent ${bodyHidden ? 'hidden' : ''}`}
          />
        </section>
        <aside aria-label="Post details" className="hidden min-w-0 xl:block">{panels('')}</aside>
      </div>
      {api.element}
      {conflictOpen && conflict && id && <ConflictDialog conflict={conflict} id={id} onClose={() => setConflictOpen(false)} />}
    </AppFrame>
  );
}
