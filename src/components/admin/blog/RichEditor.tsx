/**
 * The visual editor (Tiptap). Writes Markdown out through markdown.ts, so what is saved is the same MDX the site builds.
 * Only what a post can publish is offered: headings, lists, quotes, links, tables, images from the post folder and one
 * call-to-action box. Code blocks and raw HTML are left out because the site refuses them.
 */
import * as React from 'react';
import { EditorContent, mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold, ChevronDown, ImagePlus, Italic, Link2, Link2Off, List, ListOrdered, Loader2, Megaphone, Minus, Quote, Redo2, Strikethrough, Table as TableIcon, Trash2, Undo2,
} from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/admin/ui/dropdown-menu';
import { Input } from '@/components/admin/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/admin/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/admin/ui/tooltip';
import { cn } from '@/components/admin/lib/utils';
import { htmlToMarkdown, markdownToHtml } from './markdown';

const mediaUrl = (slug: string, src: string) => {
  const name = /^\.\/(.+)$/.exec(src)?.[1];
  return name ? `/admin/api/media/?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(name)}` : src;
};

/* ---------- Nodes ---------- */

/** Images keep their file path (`./name.webp`) for saving and load through the admin for display. */
function postImage(getSlug: () => string) {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        src: { default: null, parseHTML: (el) => el.getAttribute('data-src') || el.getAttribute('src') },
      };
    },
    renderHTML({ HTMLAttributes }) {
      const src = String(HTMLAttributes.src ?? '');
      return ['img', mergeAttributes(HTMLAttributes, { src: mediaUrl(getSlug(), src), 'data-src': src })];
    },
  }).configure({ inline: false, allowBase64: false });
}

function CtaView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as { heading: string; label: string; href: string; text: string };
  const field = 'w-full rounded-md border border-transparent bg-transparent px-2 py-1 outline-none hover:border-border focus:border-ring focus:bg-background';
  return (
    <NodeViewWrapper data-drag-handle="" className={cn('my-6 rounded-xl border-2 border-dashed bg-surface-alt p-4 not-prose', selected ? 'border-ring' : 'border-[color:var(--adm-border)]')} contentEditable={false}>
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Megaphone className="size-3.5" aria-hidden="true" />Call-to-action box</span>
        <Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground" aria-label="Remove call-to-action box" onClick={deleteNode}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
      </div>
      <textarea aria-label="Box heading" placeholder="Heading" rows={1} value={a.heading} onChange={(e) => updateAttributes({ heading: e.target.value.replace(/\n/g, ' ') })} className={cn(field, 'resize-none [field-sizing:content] text-lg leading-snug font-semibold text-heading')} />
      <textarea aria-label="Box text" placeholder="One line on what the reader gets" rows={1} value={a.text} onChange={(e) => updateAttributes({ text: e.target.value })} className={cn(field, 'mt-1 resize-none overflow-hidden [field-sizing:content] text-[15px] leading-relaxed text-foreground')} />
      <div className="mt-2 flex flex-wrap items-center gap-2 px-2">
        <input aria-label="Button text" placeholder="Button text" value={a.label} onChange={(e) => updateAttributes({ label: e.target.value })} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none placeholder:text-primary-foreground/70 focus:ring-[3px] focus:ring-ring/50" />
        <span className="text-xs text-muted-foreground">links to</span>
        <input aria-label="Button link" placeholder="/demo/" value={a.href} onChange={(e) => updateAttributes({ href: e.target.value })} className="h-9 w-40 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring" />
      </div>
    </NodeViewWrapper>
  );
}

const InlineCta = Node.create({
  name: 'inlineCta',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    const data = (name: string) => ({ default: '', parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? '', renderHTML: (attrs: Record<string, string>) => ({ [`data-${name}`]: attrs[name] }) });
    return { heading: data('heading'), label: data('label'), href: data('href'), text: data('text') };
  },
  parseHTML: () => [{ tag: 'div[data-inline-cta]' }],
  // A text child keeps the box from looking empty to the Markdown converter, which drops blank elements.
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-inline-cta': '' }), String(node.attrs.text || node.attrs.heading || 'Call to action')],
  addNodeView: () => ReactNodeViewRenderer(CtaView),
});

/* ---------- Toolbar ---------- */

function Tool({ label, keys, active, disabled, onClick, children }: { label: string; keys?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn('grid size-8 place-items-center rounded-md transition-colors disabled:opacity-40 [&_svg]:size-4', active ? 'bg-heading text-background' : 'text-foreground/80 hover:bg-muted hover:text-foreground')}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}{keys && <span className="ml-1.5 opacity-60">{keys}</span>}</TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;

function LinkTool({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const active = editor.isActive('link');
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const href = url.trim();
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setUrl(String(editor.getAttributes('link').href ?? '')); }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" onMouseDown={(e) => e.preventDefault()} aria-label="Link" aria-pressed={active} className={cn('grid size-8 place-items-center rounded-md [&_svg]:size-4', active ? 'bg-heading text-background' : 'text-foreground/80 hover:bg-muted')}><Link2 /></button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Link<span className="ml-1.5 opacity-60">Ctrl K</span></TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <form onSubmit={apply} className="grid gap-2">
          <label htmlFor="link-url" className="text-[13px] font-medium text-heading">Link address</label>
          <Input id="link-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/features/emr/ or https://…" className="h-9" />
          <p className="text-xs text-muted-foreground">Pages on this site start with / and end with /.</p>
          <div className="flex justify-between gap-2 pt-1">
            {active ? <Button type="button" size="sm" variant="ghost" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpen(false); }}><Link2Off aria-hidden="true" />Remove</Button> : <span />}
            <Button type="submit" size="sm">Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

const BLOCKS = [
  { id: 'p', label: 'Paragraph' },
  { id: 'h2', label: 'Heading' },
  { id: 'h3', label: 'Subheading' },
  { id: 'h4', label: 'Small heading' },
] as const;

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.isActive('heading', { level: 4 }) ? 'h4' : 'p',
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      table: e.isActive('table'), image: e.isActive('image'), alt: String(e.getAttributes('image').alt ?? ''),
      undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const setBlock = (id: string) => {
    const chain = editor.chain().focus();
    if (id === 'p') chain.setParagraph().run();
    else chain.setHeading({ level: Number(id.slice(1)) as 2 | 3 | 4 }).run();
  };
  return (
    <TooltipProvider delayDuration={300}>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onMouseDown={(e) => e.preventDefault()} className="flex h-8 w-32 items-center justify-between rounded-md px-2.5 text-[13px] font-medium text-foreground hover:bg-muted">
              {BLOCKS.find((b) => b.id === state.block)?.label}<ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {BLOCKS.map((b) => (
              <DropdownMenuItem key={b.id} onSelect={() => setBlock(b.id)} className={cn(b.id === 'h2' && 'text-lg font-semibold', b.id === 'h3' && 'text-base font-semibold', b.id === 'h4' && 'font-semibold', state.block === b.id && 'bg-accent')}>{b.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Divider />
        <Tool label="Bold" keys="Ctrl B" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
        <Tool label="Italic" keys="Ctrl I" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
        <Tool label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Tool>
        <LinkTool editor={editor} />
        <Divider />
        <Tool label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
        <Tool label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
        <Tool label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
        <Tool label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></Tool>
        <Divider />
        <Tool label="Image" onClick={onImage}>{uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}</Tool>
        <Tool label="Table" active={state.table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon /></Tool>
        <Tool label="Call-to-action box" onClick={() => editor.chain().focus().insertContent({ type: 'inlineCta', attrs: { heading: 'See it in your clinic', label: 'Book a 20-minute demo', href: '/demo/', text: '' } }).run()}><Megaphone /></Tool>
        <Divider />
        <Tool label="Undo" keys="Ctrl Z" disabled={!state.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Tool>
        <Tool label="Redo" keys="Ctrl Shift Z" disabled={!state.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Tool>
      </div>
      {state.table && (
        <div className="mt-1 flex flex-wrap items-center gap-1 border-t pt-1.5 text-[13px]">
          <span className="px-1 text-xs font-medium text-muted-foreground">Table</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</Button>
          <DropdownMenuSeparator className="mx-1 h-4 w-px" />
          <Button size="sm" variant="ghost" className="h-7 text-danger" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</Button>
        </div>
      )}
      {state.image && (
        <div className="mt-1 border-t pt-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="img-alt" className="shrink-0 px-1 text-xs font-medium text-muted-foreground">Alt text <span className="text-danger" aria-hidden="true">*</span></label>
          <Input id="img-alt" required aria-describedby="img-alt-hint" value={state.alt} onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()} placeholder="What the image shows, e.g. “Doctor writing a prescription in Easy Clinic”" className={cn('h-8', (!state.alt || state.alt === 'Describe the image') && 'border-warning')} />
        </div>
        <p id="img-alt-hint" className={cn('px-1 pt-1 text-xs', !state.alt || state.alt === 'Describe the image' ? 'text-warning' : 'text-muted-foreground')}>
          {!state.alt || state.alt === 'Describe the image' ? 'Required: describe the image. Google and screen readers use it, and the post cannot publish without it.' : 'Good. Use the main keyword here if it fits naturally.'}
        </p>
        </div>
      )}
    </TooltipProvider>
  );
}

/* ---------- Editor ---------- */

export interface RichEditorHandle {
  insertImage: (src: string, alt: string) => void;
  focus: () => void;
}

export const RichEditor = React.forwardRef<RichEditorHandle, {
  slug: string;
  markdown: string;
  onChange: (markdown: string) => void;
  onUpload: (files: File[]) => void;
  uploading: boolean;
  /** Shown at the right end of the toolbar (the Visual / Code switch). */
  toolbarEnd?: React.ReactNode;
}>(function RichEditor({ slug, markdown, onChange, onUpload, uploading, toolbarEnd }, ref) {
  const slugRef = React.useRef(slug);
  slugRef.current = slug;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const uploadRef = React.useRef(onUpload);
  uploadRef.current = onUpload;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false, underline: false, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } } }),
      postImage(() => slugRef.current),
      TableKit.configure({ table: { resizable: false } }),
      InlineCta,
      Placeholder.configure({ placeholder: 'Start writing, or paste text and images…' }),
    ],
    content: markdownToHtml(markdown),
    editorProps: {
      attributes: { class: 'adm-article adm-editor min-h-[28rem] outline-none', 'aria-label': 'Content', role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...((event as DragEvent).dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChangeRef.current(htmlToMarkdown(e.getHTML())), 250);
    },
  });

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  React.useImperativeHandle(ref, () => ({
    insertImage: (src, alt) => {
      if (!editor) return;
      editor.chain().focus().setImage({ src, alt }).run();
      // Select the new image so its alt text box opens, and put the cursor there: every image needs one.
      let at = -1;
      editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image' && node.attrs.src === src) at = pos; });
      if (at >= 0) editor.commands.setNodeSelection(at);
      requestAnimationFrame(() => document.getElementById('img-alt')?.focus());
    },
    focus: () => editor?.commands.focus(),
  }), [editor]);

  const toolbar = editor ? (
    <>
      <Toolbar editor={editor} onImage={() => fileRef.current?.click()} uploading={uploading} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { uploadRef.current([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </>
  ) : <div className="h-8" />;

  return (
    <>
      {toolbarEnd && <div className="-mb-px flex justify-end">{toolbarEnd}</div>}
      <div className="sticky top-14 z-20 -mx-3 mb-6 rounded-lg border bg-background/95 px-2 py-1 shadow-xs backdrop-blur">{toolbar}</div>
      <EditorContent editor={editor} />
    </>
  );
});
