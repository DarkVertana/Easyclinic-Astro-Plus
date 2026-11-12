/**
 * The post editor, laid out like WordPress's: a quiet top bar with the publish actions, a centred writing canvas with
 * a sticky formatting toolbar, and a right sidebar of collapsible panels for everything that is not the article text.
 */
import * as React from 'react';
import {
  ArrowLeft, CalendarClock, Check, ChevronDown, ChevronUp, CircleAlert, Code2, ExternalLink, Eye, ImagePlus, Loader2, Monitor, PanelRight, PenLine, Plus, Smartphone, Trash2,
  Upload, X,
} from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/admin/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Textarea } from '@/components/admin/ui/textarea';
import { cn } from '@/components/admin/lib/utils';
import { call, Field, StatusPill, timeAgo, ToastProvider, useConfirm, useToast, whenText, type BlogStatus } from './kit';
import { RichEditor, type RichEditorHandle } from './RichEditor';
import { seoReport } from './seo';
import { SeoChecklist, SeoScore } from './SeoChecklist';

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
  categories: Array<{ name: string; count: number }>;
  /** Main keywords other published pages hold, for the SEO checklist. */
  usedKeywords?: Array<{ keyword: string; path: string }>;
}

/* ---------- Wording ---------- */

const FIELD_LABEL: Record<string, string> = {
  title: 'SEO title', metaDescription: 'Meta description', h1: 'Title', linkLabel: 'Link text', headKeyword: 'Main keyword', openingAnswer: 'Opening paragraph',
  summary: 'Excerpt', author: 'Author', topic: 'Topic', owner: 'Landing page', body: 'Content', slug: 'Web address', ctas: 'Button', faq: 'FAQ',
  editorialPass: 'Editor’s check', categories: 'Categories',
};
const labelFor = (path: string) => FIELD_LABEL[path.split(/[.[:]/)[0]] ?? path;

/** The schema speaks to developers; say it plainly. */
function plain(message: string): string {
  const small = /Too small: expected string to have >=(\d+) characters/.exec(message);
  if (small) return small[1] === '1' ? 'Fill this in.' : `Too short: use at least ${small[1]} characters.`;
  const big = /Too big: expected string to have <=(\d+) characters/.exec(message);
  if (big) return `Too long: keep it under ${big[1]} characters.`;
  if (/two-question pass/.test(message)) return 'Answer the two questions in “Editor’s check”.';
  if (/one InlineCta; this one has 0/.test(message)) return 'Add one call-to-action box (megaphone button in the toolbar).';
  if (/one InlineCta; this one has/.test(message)) return 'Keep only one call-to-action box.';
  return message.replace(/\s*\(spec [\d.]+\)/g, '');
}

/** Which sidebar panel holds a field, so a check can open it. */
const PANEL_OF: Record<string, string> = {
  slug: 'summary', author: 'summary', topic: 'topic', owner: 'topic', summary: 'excerpt', title: 'seo', metaDescription: 'seo', headKeyword: 'seo', linkLabel: 'seo',
  ctas: 'button', faq: 'faq', editorialPass: 'pass', categories: 'categories', image: 'image',
};

/* ---------- Small pieces ---------- */

function Panel({ id, title, badge, open, onToggle, children }: { id: string; title: string; badge?: React.ReactNode; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <section className="border-b" aria-labelledby={`panel-${id}`}>
      <h3>
        <button id={`panel-${id}`} type="button" aria-expanded={open} onClick={() => onToggle(id)} className="flex h-12 w-full items-center gap-2 px-4 text-left text-[13px] font-semibold text-heading hover:bg-muted/50">
          <span className="flex-1">{title}</span>
          {badge}
          {open ? <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />}
        </button>
      </h3>
      {open && <div className="grid min-w-0 gap-4 px-4 pt-1 pb-5">{children}</div>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}

function FeaturedImage({ slug, url, onHas }: { slug: string; url: string; onHas: (has: boolean) => void }) {
  const toast = useToast();
  const [version, setVersion] = React.useState(0);
  const [has, setHas] = React.useState(true);
  React.useEffect(() => onHas(has), [has, onHas]);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const reply = await call('upload', { slug, cover: '1', file });
    setBusy(false);
    if (!reply.ok) return toast('error', reply.message);
    setHas(true);
    setVersion((v) => v + 1);
    toast('success', 'Featured image set. It goes live when you publish.');
  };
  const remove = async () => {
    const reply = await call('remove-cover', { slug });
    if (!reply.ok) return toast('error', reply.message);
    setVersion((v) => v + 1);
  };
  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {has ? (
        <>
          <button type="button" onClick={() => input.current?.click()} className="block w-full overflow-hidden rounded-md bg-muted ring-1 ring-border" aria-label="Replace featured image">
            <img key={version} src={`${url}&v=${version}`} alt="Featured image" onLoad={() => setHas(true)} onError={() => setHas(false)} className="aspect-[16/9] w-full object-cover" />
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload aria-hidden="true" />Replace</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={remove} className="text-danger"><Trash2 aria-hidden="true" />Remove</Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}
          disabled={busy}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-muted/40 text-[13px] text-muted-foreground hover:border-ring hover:text-foreground"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
          <span className="font-medium">{busy ? 'Uploading…' : 'Set featured image'}</span>
          <span className="text-xs">JPG, PNG or WebP · up to 4 MB</span>
        </button>
      )}
    </div>
  );
}

function Categories({ all, value, onChange }: { all: Array<{ name: string; count: number }>; value: string[]; onChange: (next: string[]) => void }) {
  const toast = useToast();
  const [list, setList] = React.useState(all);
  const [view, setView] = React.useState<'all' | 'used'>('all');
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const picked = new Set(value.map((v) => v.toLowerCase()));
  const shown = view === 'all' ? list : [...list].filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
  const toggle = (cat: string, on: boolean) => onChange(on ? [...value, cat] : value.filter((v) => v.toLowerCase() !== cat.toLowerCase()));
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    const reply = await call('add-category', { name });
    setBusy(false);
    if (!reply.ok) return toast('error', reply.message);
    const added = String(reply.name);
    if (!list.some((c) => c.name.toLowerCase() === added.toLowerCase())) setList((l) => [...l, { name: added, count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    if (!picked.has(added.toLowerCase())) onChange([...value, added]);
    setName('');
    setAdding(false);
    setView('all');
  };
  return (
    <div id="f-categories">
      <div role="tablist" aria-label="Category list" className="flex gap-4 border-b text-[13px]">
        {(['all', 'used'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('-mb-px border-b-2 pb-2 transition-colors', view === v ? 'border-heading font-medium text-heading' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {v === 'all' ? 'All categories' : 'Most used'}
          </button>
        ))}
      </div>
      <div className="mt-2 max-h-52 overflow-y-auto rounded-md border p-1">
        {shown.length === 0 ? (
          <p className="p-3 text-[13px] text-muted-foreground">{view === 'used' ? 'No category is used on a published post yet.' : 'No categories yet.'}</p>
        ) : (
          <ul>
            {shown.map((c) => {
              const id = `cat-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              return (
                <li key={c.name}>
                  <label htmlFor={id} className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded px-2 hover:bg-muted">
                    <Checkbox id={id} checked={picked.has(c.name.toLowerCase())} onCheckedChange={(on) => toggle(c.name, Boolean(on))} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-normal">{c.name}</span>
                    {c.count > 0 && <span className="text-xs tabular-nums text-muted-foreground">{c.count}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {adding ? (
        <form onSubmit={add} className="mt-3 grid gap-2">
          <label htmlFor="new-category" className="text-[13px] font-medium text-heading">New category name</label>
          <Input id="new-category" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-9" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim().length < 2}>{busy ? 'Adding…' : 'Add new category'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-link underline-offset-2 hover:underline"><Plus className="size-3.5" aria-hidden="true" />Add category</button>
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
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-base">Schedule this post</DialogTitle>
          <DialogDescription>It publishes on its own after the time you choose ({precision}). You can keep editing until then.</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <Field label="Publish on" htmlFor="schedule-at" hint={`Time zone: ${zone}`}>
            <Input id="schedule-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="h-10" />
          </Field>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/40 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || !value} onClick={async () => { setBusy(true); const ok = await onSchedule(new Date(value).toISOString()); setBusy(false); if (ok) onClose(); }}>
            <CalendarClock aria-hidden="true" />{busy ? 'Scheduling…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
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
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');
  const [source, setSource] = React.useState<'visual' | 'code'>('visual');
  const [visualKey, setVisualKey] = React.useState(0);
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [sidebar, setSidebar] = React.useState(true);
  const [panels, setPanels] = React.useState<Set<string>>(new Set(['summary', 'checks', 'seochecklist', 'image', 'categories']));
  const [checks, setChecks] = React.useState<Check[] | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [uploading, setUploading] = React.useState(0);
  const [, tick] = React.useState(0);
  const [hasCover, setHasCover] = React.useState(true);
  const richRef = React.useRef<RichEditorHandle>(null);
  const codeRef = React.useRef<HTMLTextAreaElement>(null);
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const openingRef = React.useRef<HTMLTextAreaElement>(null);
  const isNew = !live && props.isNew;
  useAutoGrow(titleRef, String(fm.h1 ?? ''));
  useAutoGrow(openingRef, String(fm.openingAnswer ?? ''));
  useAutoGrow(codeRef, source === 'code' ? body : '');

  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebar(false);
    return () => clearInterval(id);
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
      const next = { ...((old.editorialPass ?? {}) as Record<string, string>), [key]: value, by: props.editorName, on: new Date().toISOString().slice(0, 10) };
      return { ...old, editorialPass: next.onlyUsCouldWrite || next.readsMachineWritten ? next : undefined };
    });
    setDirty(true);
  };
  const faq: Array<{ question: string; answer: string }> = Array.isArray(fm.faq) ? fm.faq : [];
  const setFaq = (next: typeof faq) => set('faq', next.length ? next : undefined);
  const togglePanel = (id: string) => setPanels((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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

  React.useEffect(() => {
    if (!dirty || saving) return;
    const id = setTimeout(() => void save(), 2000);
    return () => clearTimeout(id);
  }, [dirty, saving, save, fm, body]);

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || saving) e.preventDefault(); };
    const keys = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } };
    addEventListener('beforeunload', warn);
    addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', warn); removeEventListener('keydown', keys); };
  }, [dirty, saving, save]);

  /* Checks */
  const runChecks = React.useCallback(async () => {
    const reply = await call('checks', { slug, content: content() });
    const list = reply.ok ? ((reply.checks as Check[]) ?? []) : [{ rule: 'x', severity: 'error' as const, path: 'body', message: reply.message }];
    setChecks(list);
    return list;
  }, [slug, content]);
  React.useEffect(() => {
    if (!sidebar) return;
    const id = setTimeout(() => void runChecks(), 900);
    return () => clearTimeout(id);
  }, [sidebar, fm, body, runChecks]);

  /* Preview */
  React.useEffect(() => {
    if (view !== 'preview') return;
    let gone = false;
    void call('preview', { slug, body }).then((reply) => { if (!gone) setPreviewHtml(reply.ok ? String(reply.html) : ''); });
    return () => { gone = true; };
  }, [view, slug, body]);

  /* Content */
  const onBody = React.useCallback((markdown: string) => { setBody(markdown); setDirty(true); }, []);
  const switchSource = (next: 'visual' | 'code') => {
    if (next === source) return;
    if (next === 'visual') setVisualKey((k) => k + 1);
    setSource(next);
  };
  const uploadImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading((n) => n + images.length);
    let added = 0;
    for (const file of images) {
      const reply = await call('upload', { slug, file });
      setUploading((n) => n - 1);
      if (!reply.ok) { toast('error', reply.message); continue; }
      added++;
      const src = `./${String(reply.name)}`;
      if (source === 'visual') richRef.current?.insertImage(src, '');
      else { setBody((b) => `${b.trimEnd()}\n\n![Describe the image](${src})\n`); setDirty(true); }
    }
    if (added) toast('success', 'Image added. Write its alt text in the bar under the toolbar.');
  };

  /* Publishing */
  const saveFirst = async () => (dirty || saving ? save() : true);
  const publish = async () => {
    if (!(await saveFirst())) return toast('error', 'Save failed, so nothing was published. Try again.');
    const list = await runChecks();
    const errors = list.filter((c) => c.severity === 'error');
    if (errors.length) {
      setSidebar(true);
      setPanels((p) => new Set([...p, 'checks']));
      return toast('error', `Fix ${errors.length === 1 ? 'one thing' : `${errors.length} things`} before publishing. See “Pre-publish checks”.`);
    }
    confirm({
      title: live ? 'Update the live post?' : 'Ready to publish?',
      body: live ? <>The page at /{slug}/ updates in a minute or two.</> : <>It goes live at <strong className="font-medium text-foreground">easyclinic.io/{slug}/</strong> in a minute or two.</>,
      confirm: live ? 'Update' : 'Publish',
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
    if (!(await saveFirst())) { toast('error', 'Save failed, so nothing was scheduled.'); return false; }
    const reply = await call('schedule', { slug, at: iso });
    if (!reply.ok) { setSidebar(true); void runChecks(); toast('error', reply.message); return false; }
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
    title: 'Switch to draft?',
    body: <>The post comes off the site in a minute or two and stays here as a draft.</>,
    confirm: 'Switch to draft',
    run: async () => {
      const reply = await call('unpublish', { slug });
      toast(reply.ok ? 'success' : 'error', reply.message);
      if (reply.ok) { setLive(false); setStatus('draft'); setChanges(false); }
      return reply.ok;
    },
  });
  const discard = () => confirm({
    title: 'Discard unpublished changes?',
    body: <>The editor goes back to the version that is live now. Changes saved since then are lost.</>,
    confirm: 'Discard changes',
    danger: true,
    run: async () => {
      const reply = await call('discard', { slug });
      if (reply.ok) { setDirty(false); location.reload(); } else toast('error', reply.message);
      return reply.ok;
    },
  });
  const remove = () => confirm({
    title: 'Move this post to the trash?',
    body: <>You can restore it from the Trash tab on the posts page, or delete it for good there.</>,
    confirm: 'Move to trash',
    danger: true,
    run: async () => {
      if (dirty && !(await save())) { toast('error', 'Save failed, so the post was not moved. Try again.'); return false; }
      const reply = await call('trash', { slug });
      if (reply.ok) { setDirty(false); location.assign(`/admin/posts/?done=${encodeURIComponent('Moved to the trash. Restore it from the Trash tab.')}`); } else toast('error', reply.message);
      return reply.ok;
    },
  });

  const jump = (path: string) => {
    const key = path.split(/[.[:]/)[0];
    if (view === 'preview') setView('edit');
    const panel = PANEL_OF[key];
    if (panel) { setSidebar(true); setPanels((p) => new Set([...p, panel])); }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = key === 'body' ? document.querySelector<HTMLElement>('.adm-editor') ?? codeRef.current : key === 'openingAnswer' ? openingRef.current : key === 'h1' ? titleRef.current : document.getElementById(`f-${key}`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus?.();
    }));
  };

  const saveText = saveError ? 'Not saved' : saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? `Saved ${timeAgo(savedAt)}` : '';
  const errors = checks?.filter((c) => c.severity === 'error') ?? [];
  const warnings = checks?.filter((c) => c.severity === 'warning') ?? [];
  const authorName = props.authors.find((a) => a.value === fm.author)?.label;
  const topicLabel = props.topics.find((t) => t.value === fm.topic)?.label;
  const words = body.replace(/[#>*_`[\]()!|-]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const coverUrl = props.coverUrl.replace(/slug=[^&]*/, `slug=${encodeURIComponent(slug)}`);
  const primaryLabel = publishing ? 'Publishing…' : live ? 'Update' : 'Publish';
  const deferredBody = React.useDeferredValue(body);
  const seo = React.useMemo(() => seoReport({ slug: slugDraft, frontmatter: fm, body: deferredBody, hasCover, usedKeywords: props.usedKeywords }), [slugDraft, fm, deferredBody, hasCover, props.usedKeywords]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to posts" className="text-muted-foreground"><a href="/admin/posts/"><ArrowLeft aria-hidden="true" /></a></Button>
        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
          <p className="hidden max-w-[22rem] truncate text-[13px] font-medium text-heading md:block" title={fm.h1}>{fm.h1 || 'Untitled post'}</p>
          <StatusPill status={status} changes={changes && status !== 'scheduled'} className="shrink-0" />
          <span aria-live="polite" className={cn('hidden truncate text-[13px] sm:inline', saveError ? 'text-danger' : 'text-muted-foreground')} title={saveError ?? undefined}>{saveText}</span>
        </div>
        <Button variant="ghost" className="hidden text-muted-foreground sm:inline-flex" disabled={saving || (!dirty && !saveError)} onClick={() => void save().then((ok) => ok && toast('success', 'Draft saved.'))}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button variant="outline" onClick={() => setView(view === 'edit' ? 'preview' : 'edit')} aria-pressed={view === 'preview'}>
          {view === 'edit' ? <><Eye aria-hidden="true" /><span className="hidden sm:inline">Preview</span></> : <><PenLine aria-hidden="true" /><span className="hidden sm:inline">Edit</span></>}
        </Button>
        <div className="flex">
          <Button onClick={publish} disabled={publishing} className="rounded-r-none">{primaryLabel}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button aria-label="More publishing options" className="rounded-l-none border-l border-l-primary-foreground/25 px-2"><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {status === 'scheduled' ? <DropdownMenuItem onSelect={unschedule}><CalendarClock aria-hidden="true" />Cancel schedule</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setScheduleOpen(true)}><CalendarClock aria-hidden="true" />Schedule for later…</DropdownMenuItem>}
              {live && <DropdownMenuItem asChild><a href={`/${slug}/`} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View post</a></DropdownMenuItem>}
              {live && changes && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={discard}>Discard unpublished changes</DropdownMenuItem></>}
              {live && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={unpublish}>Switch to draft</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button variant="ghost" size="icon" aria-label="Settings" aria-pressed={sidebar} onClick={() => setSidebar((s) => !s)} className={cn('relative', sidebar && 'bg-muted text-heading')}>
          <PanelRight aria-hidden="true" />
          {errors.length > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger" aria-hidden="true" />}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <main className="min-w-0 flex-1">
          {view === 'edit' ? (
            <div className="mx-auto w-full max-w-[44rem] px-5 pt-10 pb-40 sm:px-8 sm:pt-14">
              <label htmlFor="f-h1" className="sr-only">Title</label>
              <textarea ref={titleRef} id="f-h1" rows={1} value={String(fm.h1 ?? '')} onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))} placeholder="Add title"
                className="w-full resize-none overflow-hidden bg-transparent font-[family-name:var(--font-varela-round)] text-[2.25rem] leading-[1.15] text-heading outline-none placeholder:text-muted-foreground/50 sm:text-[2.75rem]" />
              <div className="mt-5">
                <label htmlFor="f-openingAnswer" className="mb-1 block text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">Opening paragraph</label>
                <textarea ref={openingRef} id="f-openingAnswer" rows={2} value={String(fm.openingAnswer ?? '')} onChange={(e) => set('openingAnswer', e.target.value)} placeholder="Answer the reader's question in two sentences. This shows large, right under the title."
                  className="w-full resize-none overflow-hidden bg-transparent text-[1.2rem] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/50" />
              </div>
              <div className="mt-8">
                {source === 'visual' ? (
                  <RichEditor
                    key={visualKey}
                    ref={richRef}
                    slug={slug}
                    markdown={body}
                    onChange={onBody}
                    onUpload={(f) => void uploadImages(f)}
                    uploading={uploading > 0}
                    toolbarEnd={<SourceSwitch value={source} onChange={switchSource} />}
                  />
                ) : (
                  <>
                    <div className="-mb-px flex justify-end"><SourceSwitch value={source} onChange={switchSource} /></div>
                    <p className="sticky top-14 z-20 -mx-3 mb-6 rounded-lg border bg-background/95 px-3 py-2.5 text-[13px] text-muted-foreground shadow-xs backdrop-blur">Markdown source. Switch to Visual to format with buttons.</p>
                    <label htmlFor="f-body" className="sr-only">Content (Markdown)</label>
                    <textarea ref={codeRef} id="f-body" value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); }} spellCheck
                      className="min-h-[28rem] w-full resize-none overflow-hidden rounded-lg border bg-muted/30 p-4 font-mono text-[14px] leading-[1.75] outline-none focus:border-ring" />
                  </>
                )}
              </div>
              <p className="mt-10 border-t pt-3 text-xs tabular-nums text-muted-foreground">{words} words · about {Math.max(1, Math.round(words / 230))} minute read</p>
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
                  {topicLabel && <p className="eyebrow mb-3">{topicLabel}</p>}
                  <h1 className={cn('font-[family-name:var(--font-varela-round)] leading-tight text-heading', device === 'mobile' ? 'text-[1.75rem]' : 'text-[2.5rem]')}>{fm.h1 || 'Untitled post'}</h1>
                  <p className="mt-4 text-sm text-ink-muted">{authorName ? `By ${authorName} · ` : ''}{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {Math.max(1, Math.round(words / 230))} minute read</p>
                  <CoverPreview url={coverUrl} />
                  {fm.openingAnswer && <p className="mt-8 text-xl leading-relaxed text-ink">{fm.openingAnswer}</p>}
                  {fm.summary && <aside className="mt-8 rounded-card bg-surface-alt p-5"><p className="font-semibold text-heading">In short</p><p className="mt-2 text-ink">{fm.summary}</p></aside>}
                  <div className={cn('adm-article mt-8', device === 'mobile' ? 'text-base' : 'text-lg')} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  {faq.length > 0 && (
                    <section className="mt-12 border-t pt-8">
                      <h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-heading">Frequently asked questions</h2>
                      <div className="mt-4 divide-y rounded-card border">
                        {faq.map((f, i) => <details key={i} className="px-5 py-4"><summary className="cursor-pointer font-medium text-heading">{f.question}</summary><p className="mt-2 text-ink">{f.answer}</p></details>)}
                      </div>
                    </section>
                  )}
                </div>
              </article>
            </div>
          )}
        </main>

        {/* Sidebar */}
        {sidebar && (
          <>
            <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebar(false)} aria-hidden="true" />
            <aside aria-label="Post settings" className="fixed inset-y-0 right-0 z-40 flex w-[min(20rem,100vw)] shrink-0 flex-col border-l bg-background shadow-xl lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:shadow-none">
              <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                <h2 className="text-[13px] font-semibold text-heading">Post settings</h2>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Close settings" onClick={() => setSidebar(false)}><X aria-hidden="true" /></Button>
              </div>
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <Panel id="summary" title="Summary" open={panels.has('summary')} onToggle={togglePanel}>
                  <Row label="Status"><StatusPill status={status} changes={changes && status !== 'scheduled'} /></Row>
                  <Row label="Publish">
                    {status === 'scheduled' && scheduledAt ? (
                      <button type="button" onClick={unschedule} className="text-left text-link underline-offset-2 hover:underline" title="Cancel the schedule">{whenText(scheduledAt)}</button>
                    ) : live ? (
                      <span>{fm.originallyPublished ? String(fm.originallyPublished).slice(0, 10) : 'Published'}</span>
                    ) : (
                      <button type="button" onClick={() => setScheduleOpen(true)} className="text-left text-link underline-offset-2 hover:underline">Immediately</button>
                    )}
                  </Row>
                  <Row label="Last saved"><span>{savedAt ? timeAgo(savedAt) : '–'}</span></Row>
                  <div className="grid gap-1.5">
                    <label htmlFor="f-slug" className="text-[13px] text-muted-foreground">URL</label>
                    <div className="flex h-9 items-center overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                      <span className="border-r bg-muted px-2 py-1.5 text-xs text-muted-foreground">/</span>
                      <input id="f-slug" value={slugDraft} disabled={!isNew} onChange={(e) => { setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setDirty(true); }} className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none disabled:text-muted-foreground" />
                    </div>
                    {live ? <a href={`/${slug}/`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-link underline-offset-2 hover:underline">easyclinic.io/{slug}/<ExternalLink className="size-3" aria-hidden="true" /></a> : <p className="text-xs text-muted-foreground">You can change this until the post is published.</p>}
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="f-author" className="text-[13px] text-muted-foreground">Author</label>
                    <Select value={fm.author ?? ''} onValueChange={(v) => set('author', v)}>
                      <SelectTrigger id="f-author" className="h-9 w-full"><SelectValue placeholder="Choose an author" /></SelectTrigger>
                      <SelectContent>{props.authors.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {!live && <button type="button" onClick={remove} className="justify-self-start text-[13px] text-danger underline-offset-2 hover:underline">Move to trash</button>}
                </Panel>

                <Panel id="checks" title="Pre-publish checks" open={panels.has('checks')} onToggle={togglePanel}
                  badge={checks === null ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" /> : errors.length ? <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white tabular-nums">{errors.length}</span> : <Check className="size-4 text-success" aria-label="All clear" />}>
                  {checks === null ? <p className="text-[13px] text-muted-foreground">Checking…</p> : !checks.length ? (
                    <p className="flex items-center gap-2 text-[13px] text-success"><Check className="size-4" aria-hidden="true" />Everything is ready to publish.</p>
                  ) : (
                    <ul className="-mx-2 grid gap-0.5">
                      {[...errors, ...warnings].map((c, i) => (
                        <li key={i}>
                          <button type="button" onClick={() => jump(c.path)} className="flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug hover:bg-muted">
                            <CircleAlert className={cn('mt-0.5 size-3.5 shrink-0', c.severity === 'error' ? 'text-danger' : 'text-warning')} aria-hidden="true" />
                            <span><span className="font-medium text-heading">{labelFor(c.path)}</span> <span className="text-muted-foreground">{plain(c.message)}</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel id="seochecklist" title="SEO checklist" open={panels.has('seochecklist')} onToggle={togglePanel} badge={<SeoScore score={seo.score} />}>
                  <SeoChecklist report={seo} onJump={jump} />
                </Panel>

                <Panel id="image" title="Featured image" open={panels.has('image')} onToggle={togglePanel}>
                  <FeaturedImage slug={slug} url={coverUrl} onHas={setHasCover} />
                </Panel>

                <Panel id="categories" title="Categories" open={panels.has('categories')} onToggle={togglePanel}>
                  <Categories all={props.categories} value={Array.isArray(fm.categories) ? fm.categories : []} onChange={(next) => set('categories', next)} />
                </Panel>

                <Panel id="topic" title="Topic and landing page" open={panels.has('topic')} onToggle={togglePanel}>
                  <Field label="Topic" htmlFor="f-topic" hint="Sets the label above the title on the site.">
                    <Select value={fm.topic ?? ''} onValueChange={(v) => set('topic', v)}>
                      <SelectTrigger id="f-topic" className="h-9 w-full"><SelectValue placeholder="Choose a topic" /></SelectTrigger>
                      <SelectContent>{props.topics.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Landing page" htmlFor="f-owner" hint="The product page this post supports. Link to it in the content.">
                    <Select value={fm.owner ?? ''} onValueChange={(v) => set('owner', v)}>
                      <SelectTrigger id="f-owner" className="h-9 w-full"><SelectValue placeholder="Choose a page" /></SelectTrigger>
                      <SelectContent className="max-h-80">{props.owners.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </Panel>

                <Panel id="excerpt" title="Excerpt" open={panels.has('excerpt')} onToggle={togglePanel}>
                  <Field label="Write an excerpt" htmlFor="f-summary" count={String(fm.summary ?? '').length} max={220} hint="Shown on blog cards and in the “In short” box.">
                    <Textarea id="f-summary" rows={4} value={fm.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
                  </Field>
                </Panel>

                <Panel id="seo" title="SEO" open={panels.has('seo')} onToggle={togglePanel}>
                  <div className="rounded-md border p-3">
                    <p className="truncate text-xs text-muted-foreground">easyclinic.io › {slugDraft}</p>
                    <p className="mt-0.5 line-clamp-1 text-[15px] text-link">{fm.title || fm.h1 || 'SEO title'}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{fm.metaDescription || 'The meta description appears here.'}</p>
                  </div>
                  <Field label="SEO title" htmlFor="f-title" count={String(fm.title ?? '').length} max={60}>
                    <Input id="f-title" className="h-9" value={fm.title ?? ''} onChange={(e) => set('title', e.target.value)} />
                  </Field>
                  <Field label="Meta description" htmlFor="f-metaDescription" count={String(fm.metaDescription ?? '').length} max={160}>
                    <Textarea id="f-metaDescription" rows={3} value={fm.metaDescription ?? ''} onChange={(e) => set('metaDescription', e.target.value)} />
                  </Field>
                  <Field label="Main keyword" htmlFor="f-headKeyword" hint="No two published pages can share one.">
                    <Input id="f-headKeyword" className="h-9" value={fm.headKeyword ?? ''} onChange={(e) => set('headKeyword', e.target.value)} />
                  </Field>
                  <Field label="Link text" htmlFor="f-linkLabel" count={String(fm.linkLabel ?? '').length} max={48} hint="Used when other pages link here.">
                    <Input id="f-linkLabel" className="h-9" value={fm.linkLabel ?? ''} onChange={(e) => set('linkLabel', e.target.value)} />
                  </Field>
                </Panel>

                <Panel id="button" title="Main button" open={panels.has('button')} onToggle={togglePanel}>
                  <Field label="Button text" htmlFor="f-ctas">
                    <Input id="f-ctas" className="h-9" value={fm.ctas?.primary?.label ?? ''} onChange={(e) => setCta('label', e.target.value)} />
                  </Field>
                  <Field label="Button link" htmlFor="f-cta-href" hint="A page on the site, like /demo/.">
                    <Input id="f-cta-href" className="h-9" value={fm.ctas?.primary?.href ?? ''} onChange={(e) => setCta('href', e.target.value)} />
                  </Field>
                </Panel>

                <Panel id="faq" title="FAQ" badge={faq.length ? <span className="text-xs tabular-nums text-muted-foreground">{faq.length}</span> : undefined} open={panels.has('faq')} onToggle={togglePanel}>
                  {faq.length === 0 && <p className="text-[13px] text-muted-foreground">Questions appear at the end of the post. Posts with an FAQ need 3 to 8.</p>}
                  {faq.map((item, i) => (
                    <div key={i} id={i === 0 ? 'f-faq' : undefined} className="grid gap-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove question ${i + 1}`} onClick={() => setFaq(faq.filter((_, j) => j !== i))}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                      </div>
                      <Input aria-label={`Question ${i + 1}`} placeholder="Question" className="h-9" value={item.question} onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))} />
                      <Textarea aria-label={`Answer ${i + 1}`} placeholder="Answer in at least one full sentence" rows={3} value={item.answer} onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setFaq([...faq, { question: '', answer: '' }])}><Plus aria-hidden="true" />Add question</Button>
                </Panel>

                <Panel id="pass" title="Editor’s check" open={panels.has('pass')} onToggle={togglePanel}>
                  <p className="text-xs leading-snug text-muted-foreground">Two honest one-line answers. Every published post needs them.</p>
                  <Field label="What in this post could only Easy Clinic have written?" htmlFor="f-editorialPass">
                    <Textarea id="f-editorialPass" rows={2} value={pass.onlyUsCouldWrite ?? ''} onChange={(e) => setPass('onlyUsCouldWrite', e.target.value)} />
                  </Field>
                  <Field label="Does any part read as machine-written? Say where." htmlFor="f-machine">
                    <Textarea id="f-machine" rows={2} value={pass.readsMachineWritten ?? ''} onChange={(e) => setPass('readsMachineWritten', e.target.value)} />
                  </Field>
                </Panel>
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

function SourceSwitch({ value, onChange }: { value: 'visual' | 'code'; onChange: (v: 'visual' | 'code') => void }) {
  return (
    <div role="group" aria-label="Editor mode" className="mb-1.5 flex shrink-0 gap-1 text-[12px] font-medium">
      {(['visual', 'code'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={value === v} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(v)} className={cn('flex h-7 items-center gap-1 rounded-md px-2.5 transition-colors', value === v ? 'bg-muted text-heading' : 'text-muted-foreground hover:text-foreground')}>
          {v === 'code' && <Code2 className="size-3.5" aria-hidden="true" />}{v === 'visual' ? 'Visual' : 'Code'}
        </button>
      ))}
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
