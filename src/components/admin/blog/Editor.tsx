import * as React from 'react';
import {
  ArrowLeft, Bold, CalendarClock, Check, ChevronDown, CircleAlert, ExternalLink, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Megaphone,
  Monitor, PanelRight, PenLine, Plus, Quote, Smartphone, Table, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Textarea } from '@/components/admin/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/admin/ui/tooltip';
import { cn } from '@/components/admin/lib/utils';
import { call, Field, StatusPill, timeAgo, ToastProvider, useConfirm, useToast, whenText, type BlogStatus } from './kit';

interface Option {
  value: string;
  label: string;
}
interface Check {
  rule: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}
type Fm = Record<string, any>;

export interface EditorProps {
  slug: string;
  frontmatter: Fm;
  body: string;
  status: BlogStatus;
  live: boolean;
  changes: boolean;
  isNew: boolean;
  scheduledAt: string | null;
  updatedAt: string | null;
  coverUrl: string;
  authors: Option[];
  topics: Option[];
  owners: Option[];
  /** Recorded on the editor's check. */
  editorName: string;
  /** How close to the chosen time the scheduler publishes, in words. */
  precision: string;
}

const FIELD_LABEL: Record<string, string> = {
  title: 'SEO title', metaDescription: 'Meta description', h1: 'Title', linkLabel: 'Link text', headKeyword: 'Main keyword', openingAnswer: 'Opening paragraph',
  summary: 'Excerpt', author: 'Author', topic: 'Topic', owner: 'Landing page', body: 'Content', slug: 'Web address', ctas: 'Call to action', faq: 'FAQ',
  editorialPass: "Editor's check",
};

/** The schema speaks to developers; say it plainly. */
function plain(message: string): string {
  const small = /Too small: expected string to have >=(\d+) characters/.exec(message);
  if (small) return small[1] === '1' ? 'Fill this in.' : `Too short: use at least ${small[1]} characters.`;
  const big = /Too big: expected string to have <=(\d+) characters/.exec(message);
  if (big) return `Too long: keep it under ${big[1]} characters.`;
  if (/two-question pass/.test(message)) return 'Answer the two questions under “Editor’s check”.';
  if (/one InlineCta; this one has 0/.test(message)) return 'Add one call-to-action box (the megaphone button in the toolbar).';
  if (/one InlineCta; this one has/.test(message)) return 'Keep only one call-to-action box.';
  return message.replace(/\s*\(spec [\d.]+\)/g, '').replace(/"Easy Clinic Team"/, '“Easy Clinic Team”');
}
const labelFor = (path: string) => FIELD_LABEL[path.split(/[.[:]/)[0]] ?? path;

/* ---------- Markdown helpers ---------- */

function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

type Edit = { text: string; start: number; end: number };

function surround(value: string, start: number, end: number, before: string, after = before, placeholder = 'text'): Edit {
  const picked = value.slice(start, end) || placeholder;
  const text = value.slice(0, start) + before + picked + after + value.slice(end);
  return { text, start: start + before.length, end: start + before.length + picked.length };
}

function linePrefix(value: string, start: number, end: number, prefix: (i: number) => string): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
  const lines = value.slice(lineStart, lineEnd).split('\n').map((l, i) => prefix(i) + l.replace(/^(#{1,6} |> |- |\d+\. )/, ''));
  const block = lines.join('\n');
  return { text: value.slice(0, lineStart) + block + value.slice(lineEnd), start: lineStart, end: lineStart + block.length };
}

function insertBlock(value: string, at: number, block: string, selectFrom?: string): Edit {
  const before = value.slice(0, at);
  const pad = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const text = before + pad + block + '\n\n' + value.slice(at).replace(/^\n+/, '');
  const base = at + pad.length;
  const offset = selectFrom ? block.indexOf(selectFrom) : -1;
  return offset >= 0 ? { text, start: base + offset, end: base + offset + selectFrom!.length } : { text, start: base + block.length, end: base + block.length };
}

const CTA_BLOCK = '<InlineCta heading="See it in your clinic" label="Book a 20-minute demo" href="/demo/">\nA short line on what the reader gets from the demo.\n</InlineCta>';
const TABLE_BLOCK = '| Column | Column |\n| --- | --- |\n| Cell | Cell |';

/* ---------- Pieces ---------- */

function ToolButton({ label, keys, onClick, children }: { label: string; keys?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} aria-label={label} className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}{keys && <span className="ml-1.5 opacity-60">{keys}</span>}</TooltipContent>
    </Tooltip>
  );
}

function CoverPicker({ slug, url, onChanged }: { slug: string; url: string; onChanged: () => void }) {
  const toast = useToast();
  const [version, setVersion] = React.useState(0);
  const [has, setHas] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const reply = await call('upload', { slug, cover: '1', file });
    setBusy(false);
    if (!reply.ok) return toast('error', reply.message);
    setHas(true);
    setVersion((v) => v + 1);
    onChanged();
    toast('success', 'Featured image added. It goes live when you publish.');
  };
  const remove = async () => {
    const reply = await call('remove-cover', { slug });
    if (!reply.ok) return toast('error', reply.message);
    setVersion((v) => v + 1);
    onChanged();
  };
  const src = `${url}&v=${version}`;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}
      className={cn('group relative overflow-hidden rounded-xl transition-colors', has ? 'bg-muted' : 'border-2 border-dashed', over && 'border-ring bg-accent')}
    >
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {has ? (
        <>
          <img key={src} src={src} alt="Featured image" onLoad={() => setHas(true)} onError={() => setHas(false)} className="aspect-[16/9] w-full object-cover" />
          <div className="absolute top-3 right-3 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button size="sm" variant="secondary" className="shadow-sm" onClick={() => input.current?.click()} disabled={busy}><Upload aria-hidden="true" />Replace</Button>
            <Button size="sm" variant="secondary" className="shadow-sm" onClick={remove} disabled={busy} aria-label="Remove featured image"><Trash2 aria-hidden="true" /></Button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex w-full flex-col items-center justify-center gap-2 px-6 py-10 text-muted-foreground hover:text-foreground">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
          <span className="font-medium">{busy ? 'Uploading…' : 'Add a featured image'}</span>
          <span className="text-xs">Drag an image here or click to choose · JPG, PNG or WebP, up to 4 MB</span>
        </button>
      )}
    </div>
  );
}

function ScheduleDialog({ open, onClose, onSchedule, precision }: { open: boolean; onClose: () => void; onSchedule: (iso: string) => Promise<boolean>; precision: string }) {
  const tomorrow = React.useMemo(() => {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [value, setValue] = React.useState(tomorrow);
  const [busy, setBusy] = React.useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Schedule this post</DialogTitle>
          <DialogDescription>It publishes on its own after the time you choose ({precision}). You can keep editing until then.</DialogDescription>
        </DialogHeader>
        <Field label="Publish on" htmlFor="schedule-at" hint={`Your time zone: ${zone}`}>
          <Input id="schedule-at" type="datetime-local" value={value} min={tomorrow.slice(0, 10) + 'T00:00'} onChange={(e) => setValue(e.target.value)} className="h-10" />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || !value} onClick={async () => { setBusy(true); const ok = await onSchedule(new Date(value).toISOString()); setBusy(false); if (ok) onClose(); }}>
            <CalendarClock aria-hidden="true" />{busy ? 'Scheduling…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecksList({ checks, onJump }: { checks: Check[] | null; onJump: (path: string) => void }) {
  if (!checks) return <p className="text-[13px] text-muted-foreground">Checking…</p>;
  const errors = checks.filter((c) => c.severity === 'error');
  const warnings = checks.filter((c) => c.severity === 'warning');
  if (!checks.length) return <p className="flex items-center gap-2 text-[13px] text-success"><Check className="size-4" aria-hidden="true" />Ready to publish.</p>;
  return (
    <ul className="grid gap-2">
      {[...errors, ...warnings].map((c, i) => (
        <li key={i}>
          <button type="button" onClick={() => onJump(c.path)} className={cn('flex w-full gap-2 rounded-md p-2 text-left text-[13px] leading-snug hover:bg-muted', c.severity === 'error' ? 'text-danger' : 'text-warning')}>
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span><span className="font-medium">{labelFor(c.path)}:</span> <span className="text-foreground">{plain(c.message)}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Editor ---------- */

function EditorBody(props: EditorProps) {
  const toast = useToast();
  const [confirmEl, confirm] = useConfirm();
  const [slug, setSlug] = React.useState(props.slug);
  const [slugDraft, setSlugDraft] = React.useState(props.slug);
  const [fm, setFm] = React.useState<Fm>(props.frontmatter);
  const [body, setBody] = React.useState(props.body);
  const [status, setStatus] = React.useState<BlogStatus>(props.status);
  const [live, setLive] = React.useState(props.live);
  const [changes, setChanges] = React.useState(props.changes);
  const [scheduledAt, setScheduledAt] = React.useState(props.scheduledAt);
  const [savedAt, setSavedAt] = React.useState<string | null>(props.updatedAt);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'write' | 'preview'>('write');
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [panel, setPanel] = React.useState(true);
  const [checks, setChecks] = React.useState<Check[] | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [uploading, setUploading] = React.useState(0);
  const [, tick] = React.useState(0);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const openingRef = React.useRef<HTMLTextAreaElement>(null);
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isNew = !live && props.isNew;
  useAutoGrow(bodyRef, body);
  useAutoGrow(openingRef, String(fm.openingAnswer ?? ''));
  useAutoGrow(titleRef, String(fm.h1 ?? ''));

  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setPanel(false);
  }, []);

  const content = React.useCallback(() => JSON.stringify({ frontmatter: fm, body }), [fm, body]);

  const set = (key: string, value: unknown) => { setFm((old) => ({ ...old, [key]: value })); setDirty(true); };
  const setTitle = (value: string) => {
    setFm((old) => {
      const next: Fm = { ...old, h1: value };
      // The SEO title and link text follow the title until someone edits them.
      if (!old.title || old.title === old.h1) next.title = value;
      if (!old.linkLabel || old.linkLabel === String(old.h1 ?? '').slice(0, 48)) next.linkLabel = value.slice(0, 48);
      return next;
    });
    setDirty(true);
  };
  const setCta = (key: 'label' | 'href', value: string) => {
    setFm((old) => ({ ...old, ctas: { ...(old.ctas ?? {}), primary: { ...(old.ctas?.primary ?? {}), [key]: value } } }));
    setDirty(true);
  };
  const pass = (fm.editorialPass ?? {}) as { onlyUsCouldWrite?: string; readsMachineWritten?: string };
  const setPass = (key: 'onlyUsCouldWrite' | 'readsMachineWritten', value: string) => {
    setFm((old) => {
      const current = (old.editorialPass ?? {}) as Record<string, string>;
      const next = { ...current, [key]: value, by: props.editorName, on: new Date().toISOString().slice(0, 10) };
      return { ...old, editorialPass: next.onlyUsCouldWrite || next.readsMachineWritten ? next : undefined };
    });
    setDirty(true);
  };
  const faq: Array<{ question: string; answer: string }> = Array.isArray(fm.faq) ? fm.faq : [];
  const setFaq = (next: typeof faq) => set('faq', next.length ? next : undefined);

  /* Saving */
  const save = React.useCallback(async (): Promise<boolean> => {
    setSaving(true);
    const fields: Record<string, string> = { slug, content: content() };
    if (isNew && slugDraft !== slug) fields.newSlug = slugDraft;
    const reply = await call('save', fields);
    setSaving(false);
    if (!reply.ok) { setSaveError(reply.message); return false; }
    setSaveError(null);
    setDirty(false);
    setSavedAt(String(reply.updatedAt));
    if (live) setChanges(true);
    if (reply.slug && reply.slug !== slug) {
      setSlug(String(reply.slug));
      history.replaceState(null, '', `/admin/posts/edit/?slug=${encodeURIComponent(String(reply.slug))}`);
    }
    return true;
  }, [slug, slugDraft, content, isNew, live]);

  // Autosave two seconds after typing stops.
  React.useEffect(() => {
    if (!dirty || saving) return;
    const id = setTimeout(() => void save(), 2000);
    return () => clearTimeout(id);
  }, [dirty, saving, save, fm, body]);

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || saving) e.preventDefault(); };
    const keys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
    };
    addEventListener('beforeunload', warn);
    addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', warn); removeEventListener('keydown', keys); };
  }, [dirty, saving, save]);

  /* Checks */
  const runChecks = React.useCallback(async () => {
    setChecks(null);
    const reply = await call('checks', { slug, content: content() });
    const list = reply.ok ? ((reply.checks as Check[]) ?? []) : [{ rule: 'x', severity: 'error' as const, path: 'body', message: reply.message }];
    setChecks(list);
    return list;
  }, [slug, content]);
  React.useEffect(() => {
    if (!panel) return;
    const id = setTimeout(() => void runChecks(), 900);
    return () => clearTimeout(id);
  }, [panel, fm, body, runChecks]);

  /* Preview */
  React.useEffect(() => {
    if (mode !== 'preview') return;
    let gone = false;
    void call('preview', { slug, body }).then((reply) => { if (!gone) setPreviewHtml(reply.ok ? String(reply.html) : `<p>${reply.message}</p>`); });
    return () => { gone = true; };
  }, [mode, slug, body]);

  /* Body editing */
  const apply = (edit: Edit) => {
    setBody(edit.text);
    setDirty(true);
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.start, edit.end);
    });
  };
  const sel = () => {
    const el = bodyRef.current;
    return { start: el?.selectionStart ?? body.length, end: el?.selectionEnd ?? body.length };
  };
  const wrap = (before: string, after = before, placeholder?: string) => { const { start, end } = sel(); apply(surround(body, start, end, before, after, placeholder)); };
  const prefix = (fn: (i: number) => string) => { const { start, end } = sel(); apply(linePrefix(body, start, end, fn)); };
  const block = (text: string, pick?: string) => apply(insertBlock(body, sel().end, text, pick));
  const link = () => {
    const { start, end } = sel();
    const picked = body.slice(start, end) || 'link text';
    const text = `${body.slice(0, start)}[${picked}](https://)${body.slice(end)}`;
    const urlAt = start + picked.length + 3;
    apply({ text, start: urlAt, end: urlAt + 8 });
  };

  const uploadImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading((n) => n + images.length);
    for (const file of images) {
      const reply = await call('upload', { slug, file });
      setUploading((n) => n - 1);
      if (!reply.ok) { toast('error', reply.message); continue; }
      const alt = 'Describe the image';
      const { end } = sel();
      apply(insertBlock(bodyRef.current?.value ?? body, end, `![${alt}](./${String(reply.name)})`, alt));
    }
  };

  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); }
    else if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('_'); }
    else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); link(); }
    else if (e.key === 'Enter' && !e.shiftKey) {
      // Continue a list on Enter, end it on an empty item.
      const { start } = sel();
      const lineStart = body.lastIndexOf('\n', start - 1) + 1;
      const line = body.slice(lineStart, start);
      const bullet = /^(\s*)([-*]|\d+\.) (.*)$/.exec(line);
      if (!bullet) return;
      e.preventDefault();
      if (!bullet[3]) { apply({ text: body.slice(0, lineStart) + body.slice(start), start: lineStart, end: lineStart }); return; }
      const nextMark = /\d+\./.test(bullet[2]) ? `${Number.parseInt(bullet[2], 10) + 1}.` : bullet[2];
      const insert = `\n${bullet[1]}${nextMark} `;
      apply({ text: body.slice(0, start) + insert + body.slice(start), start: start + insert.length, end: start + insert.length });
    }
  };

  /* Publishing */
  const afterSaveOrStop = async () => (dirty || saving ? save() : true);

  const publish = async () => {
    if (!(await afterSaveOrStop())) return toast('error', 'Save failed, so nothing was published. Try again.');
    const list = await runChecks();
    const errors = list.filter((c) => c.severity === 'error');
    if (errors.length) {
      setPanel(true);
      return toast('error', `Fix ${errors.length === 1 ? 'one thing' : `${errors.length} things`} before publishing. They are listed in the side panel.`);
    }
    confirm({
      title: live ? 'Publish your changes?' : 'Publish this post?',
      body: live ? <>The live page at /{slug}/ updates in a minute or two.</> : <>It goes live at <strong className="font-medium text-foreground">easyclinic.io/{slug}/</strong> in a minute or two.</>,
      confirm: live ? 'Publish changes' : 'Publish now',
      run: async () => {
        setPublishing(true);
        const reply = await call('publish', { slug });
        setPublishing(false);
        toast(reply.ok ? 'success' : 'error', reply.message);
        if (reply.ok) { setLive(true); setStatus('published'); setChanges(false); setScheduledAt(null); }
        return reply.ok;
      },
    });
  };
  const schedule = async (iso: string) => {
    if (!(await afterSaveOrStop())) { toast('error', 'Save failed, so nothing was scheduled.'); return false; }
    const reply = await call('schedule', { slug, at: iso });
    if (!reply.ok) { setPanel(true); void runChecks(); toast('error', reply.message); return false; }
    setStatus('scheduled');
    setScheduledAt(iso);
    toast('success', `Scheduled for ${whenText(iso)}.`);
    return true;
  };
  const unschedule = async () => {
    const reply = await call('unschedule', { slug });
    toast(reply.ok ? 'success' : 'error', reply.message);
    if (reply.ok) { setScheduledAt(null); setStatus(live ? 'published' : 'draft'); }
  };
  const unpublish = () => confirm({
    title: 'Unpublish this post?',
    body: <>It comes off the site in a minute or two and stays here as a draft.</>,
    confirm: 'Unpublish',
    run: async () => {
      const reply = await call('unpublish', { slug });
      toast(reply.ok ? 'success' : 'error', reply.message);
      if (reply.ok) { setLive(false); setStatus('draft'); setChanges(false); }
      return reply.ok;
    },
  });
  const discard = () => confirm({
    title: 'Discard unpublished changes?',
    body: <>The editor goes back to the version that is live now. Changes you saved since will be lost.</>,
    confirm: 'Discard changes',
    danger: true,
    run: async () => {
      const reply = await call('discard', { slug });
      if (reply.ok) { setDirty(false); location.reload(); }
      else toast('error', reply.message);
      return reply.ok;
    },
  });
  const remove = () => confirm({
    title: 'Delete this post?',
    body: <>The post and its images will be removed for good. This cannot be undone.</>,
    confirm: 'Delete post',
    danger: true,
    run: async () => {
      const reply = await call('delete', { slug });
      if (reply.ok) { setDirty(false); location.assign(`/admin/posts/?done=${encodeURIComponent('Post deleted.')}`); }
      else toast('error', reply.message);
      return reply.ok;
    },
  });

  const jump = (path: string) => {
    const key = path.split(/[.[:]/)[0];
    const target = key === 'body' ? bodyRef.current : key === 'openingAnswer' ? openingRef.current : key === 'h1' ? titleRef.current : document.getElementById(`f-${key}`);
    if (mode === 'preview') setMode('write');
    requestAnimationFrame(() => { target?.scrollIntoView({ block: 'center', behavior: 'smooth' }); (target as HTMLElement | null)?.focus?.(); });
  };

  const saveText = saveError ? 'Not saved' : saving ? 'Saving…' : dirty ? 'Unsaved' : savedAt ? `Saved ${timeAgo(savedAt)}` : '';
  const errorCount = checks?.filter((c) => c.severity === 'error').length ?? 0;
  const authorName = props.authors.find((a) => a.value === fm.author)?.label;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><a href="/admin/posts/"><ArrowLeft aria-hidden="true" /><span className="hidden sm:inline">Posts</span></a></Button>
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusPill status={status} changes={changes && status !== 'scheduled'} className="hidden sm:inline-flex" />
          {status === 'scheduled' && scheduledAt && <span className="hidden text-[13px] text-muted-foreground lg:inline">{whenText(scheduledAt)}</span>}
          <span aria-live="polite" className={cn('truncate text-[13px]', saveError ? 'text-danger' : 'text-muted-foreground')} title={saveError ?? undefined}>{saveText}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div role="group" aria-label="View" className="hidden rounded-lg bg-muted p-0.5 sm:flex">
            {(['write', 'preview'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors', mode === m ? 'bg-background text-heading shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
                {m === 'write' ? <PenLine className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}{m === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label={mode === 'write' ? 'Preview' : 'Write'} onClick={() => setMode(mode === 'write' ? 'preview' : 'write')}>{mode === 'write' ? <Eye aria-hidden="true" /> : <PenLine aria-hidden="true" />}</Button>
          <Button variant="ghost" size="icon" aria-label="Post settings" aria-pressed={panel} onClick={() => setPanel((p) => !p)} className={cn('relative', panel && 'bg-muted')}>
            <PanelRight aria-hidden="true" />
            {errorCount > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger" aria-hidden="true" />}
          </Button>
          <div className="flex">
            <Button onClick={publish} disabled={publishing} className="rounded-r-none">{publishing ? 'Publishing…' : live ? (changes || dirty ? 'Publish changes' : 'Update') : 'Publish'}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button aria-label="More publishing options" className="rounded-l-none border-l border-l-primary-foreground/25 px-2"><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {status === 'scheduled' ? <DropdownMenuItem onSelect={unschedule}><CalendarClock aria-hidden="true" />Cancel schedule</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setScheduleOpen(true)}><CalendarClock aria-hidden="true" />Schedule for later…</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void save().then((ok) => toast(ok ? 'success' : 'error', ok ? 'Draft saved.' : 'Could not save.'))}><Check aria-hidden="true" />Save draft<span className="ml-auto text-xs text-muted-foreground">Ctrl S</span></DropdownMenuItem>
                {live && <DropdownMenuItem asChild><a href={`/${slug}/`} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View on site</a></DropdownMenuItem>}
                <DropdownMenuSeparator />
                {live && changes && <DropdownMenuItem onSelect={discard}>Discard unpublished changes</DropdownMenuItem>}
                {live ? <DropdownMenuItem onSelect={unpublish}>Unpublish</DropdownMenuItem> : <DropdownMenuItem variant="destructive" onSelect={remove}><Trash2 aria-hidden="true" />Delete post</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Main column */}
        <main className="min-w-0 flex-1">
          {mode === 'write' ? (
            <div className="mx-auto w-full max-w-[46rem] px-5 pt-8 pb-32 sm:px-8 sm:pt-12">
              <CoverPicker slug={slug} url={props.coverUrl.replace(/slug=[^&]*/, `slug=${encodeURIComponent(slug)}`)} onChanged={() => setDirty(true)} />
              <label htmlFor="f-h1" className="sr-only">Title</label>
              <textarea ref={titleRef} id="f-h1" rows={1} value={String(fm.h1 ?? '')} onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))} placeholder="Post title"
                className="mt-8 w-full resize-none overflow-hidden bg-transparent font-[family-name:var(--font-varela-round)] text-[2.25rem] leading-tight text-heading outline-none placeholder:text-muted-foreground/50 sm:text-[2.75rem]" />
              <label htmlFor="f-openingAnswer" className="sr-only">Opening paragraph</label>
              <textarea ref={openingRef} id="f-openingAnswer" rows={2} value={String(fm.openingAnswer ?? '')} onChange={(e) => set('openingAnswer', e.target.value)} placeholder="Opening paragraph: answer the reader's question in two sentences."
                className="mt-4 w-full resize-none overflow-hidden bg-transparent text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50" />

              {/* Toolbar */}
              <TooltipProvider delayDuration={300}>
                <div className="sticky top-14 z-20 -mx-2 mt-6 mb-2 flex flex-wrap items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-xs backdrop-blur">
                  <ToolButton label="Heading" onClick={() => prefix(() => '## ')}><Heading2 /></ToolButton>
                  <ToolButton label="Subheading" onClick={() => prefix(() => '### ')}><Heading3 /></ToolButton>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <ToolButton label="Bold" keys="Ctrl B" onClick={() => wrap('**')}><Bold /></ToolButton>
                  <ToolButton label="Italic" keys="Ctrl I" onClick={() => wrap('_')}><Italic /></ToolButton>
                  <ToolButton label="Link" keys="Ctrl K" onClick={link}><Link2 /></ToolButton>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <ToolButton label="Bulleted list" onClick={() => prefix(() => '- ')}><List /></ToolButton>
                  <ToolButton label="Numbered list" onClick={() => prefix((i) => `${i + 1}. `)}><ListOrdered /></ToolButton>
                  <ToolButton label="Quote" onClick={() => prefix(() => '> ')}><Quote /></ToolButton>
                  <ToolButton label="Table" onClick={() => block(TABLE_BLOCK, 'Column')}><Table /></ToolButton>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <ToolButton label="Image" onClick={() => fileRef.current?.click()}><ImagePlus /></ToolButton>
                  <ToolButton label="Call-to-action box" onClick={() => block(CTA_BLOCK, 'See it in your clinic')}><Megaphone /></ToolButton>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void uploadImages([...(e.target.files ?? [])]); e.target.value = ''; }} />
                  <span className="ml-auto pr-2 text-xs text-muted-foreground tabular-nums">{uploading > 0 ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Uploading</span> : `${words} words`}</span>
                </div>
              </TooltipProvider>

              <label htmlFor="f-body" className="sr-only">Content</label>
              <textarea
                ref={bodyRef}
                id="f-body"
                value={body}
                onChange={(e) => { setBody(e.target.value); setDirty(true); }}
                onKeyDown={onBodyKey}
                onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); void uploadImages(files); } }}
                onDrop={(e) => { const files = [...e.dataTransfer.files]; if (files.length) { e.preventDefault(); void uploadImages(files); } }}
                placeholder={'Start writing…\n\nUse ## for a heading, - for a list. Paste or drop images straight in.'}
                spellCheck
                className="min-h-[24rem] w-full resize-none overflow-hidden bg-transparent py-4 text-[17px] leading-[1.8] text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          ) : (
            <div className="min-h-full bg-muted/40 px-3 py-6 sm:px-6 sm:py-8">
              <div className="mx-auto mb-4 flex max-w-[52rem] items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">Preview: how the post reads on the site.</p>
                <div role="group" aria-label="Preview width" className="flex rounded-lg bg-background p-0.5 shadow-xs ring-1 ring-border">
                  <button type="button" aria-pressed={device === 'desktop'} aria-label="Desktop" onClick={() => setDevice('desktop')} className={cn('grid size-8 place-items-center rounded-md', device === 'desktop' ? 'bg-muted text-heading' : 'text-muted-foreground')}><Monitor className="size-4" aria-hidden="true" /></button>
                  <button type="button" aria-pressed={device === 'mobile'} aria-label="Phone" onClick={() => setDevice('mobile')} className={cn('grid size-8 place-items-center rounded-md', device === 'mobile' ? 'bg-muted text-heading' : 'text-muted-foreground')}><Smartphone className="size-4" aria-hidden="true" /></button>
                </div>
              </div>
              <article className={cn('mx-auto overflow-hidden rounded-xl border bg-surface shadow-sm transition-[max-width] duration-200 motion-reduce:transition-none', device === 'mobile' ? 'max-w-[24rem]' : 'max-w-[52rem]')}>
                <div className={cn(device === 'mobile' ? 'px-5 py-7' : 'px-6 py-10 sm:px-12')}>
                  {props.topics.find((t) => t.value === fm.topic) && <p className="eyebrow mb-3">{props.topics.find((t) => t.value === fm.topic)!.label}</p>}
                  <h1 className={cn('font-[family-name:var(--font-varela-round)] leading-tight text-heading', device === 'mobile' ? 'text-[1.75rem]' : 'text-[2.5rem]')}>{fm.h1 || 'Untitled post'}</h1>
                  <p className="mt-4 text-sm text-ink-muted">{authorName ? `By ${authorName} · ` : ''}{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {Math.max(1, Math.round(words / 230))} minute read</p>
                  <CoverPreview url={props.coverUrl.replace(/slug=[^&]*/, `slug=${encodeURIComponent(slug)}`)} />
                  {fm.openingAnswer && <p className="mt-8 text-xl leading-relaxed text-ink">{fm.openingAnswer}</p>}
                  {fm.summary && <aside className="mt-8 rounded-card bg-surface-alt p-5"><p className="font-semibold text-heading">In short</p><p className="mt-2 text-ink">{fm.summary}</p></aside>}
                  <div className={cn('adm-article mt-8', device === 'mobile' ? 'text-base' : 'text-lg')} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  {faq.length > 0 && (
                    <section className="mt-12 border-t pt-8">
                      <h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-heading">Frequently asked questions</h2>
                      <div className="mt-4 divide-y rounded-card border">
                        {faq.map((f, i) => <details key={i} className="group px-5 py-4"><summary className="cursor-pointer font-medium text-heading">{f.question}</summary><p className="mt-2 text-ink">{f.answer}</p></details>)}
                      </div>
                    </section>
                  )}
                </div>
              </article>
            </div>
          )}
        </main>

        {/* Settings panel */}
        {panel && (
          <>
            <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setPanel(false)} aria-hidden="true" />
            <aside aria-label="Post settings" className="fixed inset-y-0 right-0 z-40 flex w-[min(22rem,100vw)] shrink-0 flex-col border-l bg-background shadow-xl lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:shadow-none">
              <div className="flex h-14 shrink-0 items-center justify-between border-b px-5 lg:hidden">
                <h2 className="font-semibold text-heading">Post settings</h2>
                <Button variant="ghost" size="icon" aria-label="Close settings" onClick={() => setPanel(false)}><X aria-hidden="true" /></Button>
              </div>
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [&_section]:min-w-0 [&_.grid]:min-w-0">
                <section className="border-b p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">Before publishing</h3>
                    <button type="button" onClick={() => void runChecks()} className="text-xs text-muted-foreground hover:text-foreground">Check again</button>
                  </div>
                  <ChecksList checks={checks} onJump={jump} />
                </section>

                <section className="grid gap-4 border-b p-5">
                  <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">Post</h3>
                  <Field label="Web address" htmlFor="f-slug" hint={isNew ? 'You can change this until the post is published.' : 'Published posts keep their address.'}>
                    <div className="flex h-9 items-center overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                      <span className="border-r bg-muted px-2 py-1.5 text-xs text-muted-foreground">/</span>
                      <input id="f-slug" value={slugDraft} disabled={!isNew} onChange={(e) => { setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setDirty(true); }} className="h-full min-w-0 flex-1 bg-transparent px-2 outline-none disabled:text-muted-foreground" />
                    </div>
                  </Field>
                  <Field label="Author" htmlFor="f-author">
                    <Select value={fm.author ?? ''} onValueChange={(v) => set('author', v)}>
                      <SelectTrigger id="f-author" className="w-full"><SelectValue placeholder="Choose an author" /></SelectTrigger>
                      <SelectContent>{props.authors.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Topic" htmlFor="f-topic">
                    <Select value={fm.topic ?? ''} onValueChange={(v) => set('topic', v)}>
                      <SelectTrigger id="f-topic" className="w-full"><SelectValue placeholder="Choose a topic" /></SelectTrigger>
                      <SelectContent>{props.topics.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Landing page" htmlFor="f-owner" hint="The product page this post supports. Link to it somewhere in the content.">
                    <Select value={fm.owner ?? ''} onValueChange={(v) => set('owner', v)}>
                      <SelectTrigger id="f-owner" className="w-full"><SelectValue placeholder="Choose a page" /></SelectTrigger>
                      <SelectContent className="max-h-80">{props.owners.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Excerpt" htmlFor="f-summary" count={String(fm.summary ?? '').length} max={220} hint="Shown on blog cards and in the “In short” box.">
                    <Textarea id="f-summary" rows={3} value={fm.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
                  </Field>
                </section>

                <section className="grid gap-4 border-b p-5">
                  <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">Search engines</h3>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="truncate text-xs text-muted-foreground">easyclinic.io › {slugDraft}</p>
                    <p className="mt-0.5 line-clamp-1 text-[15px] text-link">{fm.title || fm.h1 || 'SEO title'}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{fm.metaDescription || 'Meta description appears here.'}</p>
                  </div>
                  <Field label="SEO title" htmlFor="f-title" count={String(fm.title ?? '').length} max={60}>
                    <Input id="f-title" value={fm.title ?? ''} onChange={(e) => set('title', e.target.value)} />
                  </Field>
                  <Field label="Meta description" htmlFor="f-metaDescription" count={String(fm.metaDescription ?? '').length} max={160}>
                    <Textarea id="f-metaDescription" rows={3} value={fm.metaDescription ?? ''} onChange={(e) => set('metaDescription', e.target.value)} />
                  </Field>
                  <Field label="Main keyword" htmlFor="f-headKeyword" hint="The search phrase this post should rank for. No two published pages can share one.">
                    <Input id="f-headKeyword" value={fm.headKeyword ?? ''} onChange={(e) => set('headKeyword', e.target.value)} />
                  </Field>
                  <Field label="Link text" htmlFor="f-linkLabel" count={String(fm.linkLabel ?? '').length} max={48} hint="Used when other pages link here.">
                    <Input id="f-linkLabel" value={fm.linkLabel ?? ''} onChange={(e) => set('linkLabel', e.target.value)} />
                  </Field>
                </section>

                <section className="grid gap-4 border-b p-5">
                  <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">Main button</h3>
                  <Field label="Button text" htmlFor="f-ctas">
                    <Input id="f-ctas" value={fm.ctas?.primary?.label ?? ''} onChange={(e) => setCta('label', e.target.value)} />
                  </Field>
                  <Field label="Button link" htmlFor="f-cta-href" hint="A page on the site, like /demo/.">
                    <Input id="f-cta-href" value={fm.ctas?.primary?.href ?? ''} onChange={(e) => setCta('href', e.target.value)} />
                  </Field>
                </section>

                <section className="grid gap-4 border-b p-5">
                  <div>
                    <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">Editor’s check</h3>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">Two honest one-line answers. The site needs them on every published post.</p>
                  </div>
                  <Field label="What in this post could only Easy Clinic have written?" htmlFor="f-editorialPass">
                    <Textarea id="f-editorialPass" rows={2} value={pass.onlyUsCouldWrite ?? ''} onChange={(e) => setPass('onlyUsCouldWrite', e.target.value)} />
                  </Field>
                  <Field label="Does any part read as machine-written? Say where." htmlFor="f-machine">
                    <Textarea id="f-machine" rows={2} value={pass.readsMachineWritten ?? ''} onChange={(e) => setPass('readsMachineWritten', e.target.value)} />
                  </Field>
                </section>

                <section className="grid gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold tracking-wide text-heading uppercase">FAQ</h3>
                    <Button variant="ghost" size="sm" onClick={() => setFaq([...faq, { question: '', answer: '' }])}><Plus aria-hidden="true" />Add</Button>
                  </div>
                  {faq.length === 0 && <p className="text-[13px] text-muted-foreground">Optional. Questions appear at the end of the post.</p>}
                  {faq.map((item, i) => (
                    <div key={i} id={i === 0 ? 'f-faq' : undefined} className="grid gap-2 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Input aria-label={`Question ${i + 1}`} placeholder="Question" value={item.question} onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))} />
                        <Button variant="ghost" size="icon" aria-label={`Remove question ${i + 1}`} onClick={() => setFaq(faq.filter((_, j) => j !== i))}><X aria-hidden="true" /></Button>
                      </div>
                      <Textarea aria-label={`Answer ${i + 1}`} placeholder="Answer" rows={3} value={item.answer} onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))} />
                    </div>
                  ))}
                </section>
              </div>
            </aside>
          </>
        )}
      </div>
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSchedule={schedule} precision={props.precision} />
      {confirmEl}
    </div>
  );
}

function CoverPreview({ url }: { url: string }) {
  const [ok, setOk] = React.useState(true);
  if (!ok) return null;
  return <img src={`${url}&p=1`} alt="" onError={() => setOk(false)} className="mt-8 aspect-[16/9] w-full rounded-card object-cover" />;
}

export function Editor(props: EditorProps) {
  return (
    <ToastProvider>
      <EditorBody {...props} />
    </ToastProvider>
  );
}
