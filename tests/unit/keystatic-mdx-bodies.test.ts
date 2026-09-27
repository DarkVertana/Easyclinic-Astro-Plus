/**
 * MDX bodies through Keystatic's own editor field (docs/keystatic-design.md 2.8 and 7.4). For every guide, post and
 * legal body:
 *
 * 1. Open: the body field the admin builds from `mdxBody()` (keystatic/fields.ts; the exact config is in FIELD_META)
 *    parses the body as the editor does when an entry opens. The field comes from the browser build of
 *    @keystatic/core, which is the build the admin runs: the Node build replaces the body parser with an empty stub.
 * 2. Save: the same field serialises it as the editor does on save (ProseMirror → mdast → mdast-util-to-markdown).
 * 3. Nothing lost: the saved body has the same words, links (URL and title) and JSX props (InlineCta) as the file,
 *    read with Keystatic's own mdast stack, and read with Astro's MDX parser (satteri, with GFM and smart punctuation
 *    as @astrojs/mdx runs it), so the page shows the same text.
 * 4. Table alignment: a save drops Markdown column alignment (`---:`). That is allowed only where PostTable
 *    right-aligns the column anyway (every body cell an amount: src/lib/content/post-table.ts `numericColumns`).
 *
 * The save also reformats the Markdown (list markers, escapes, table padding, hard breaks, link and mark syntax). That
 * is not compared: docs/keystatic-design.md 2.8 lists each change, and the last test here pins that list against the
 * installed serializer.
 *
 * What it tolerates, and why:
 * - An `<InlineCta>` written on one line (paragraph → text element) cannot be opened by the editor ("mdxJsxTextElement
 *   has unexpected children"). Converting those to the multi-line form is a src/content codemod (design 2.8). Until it
 *   lands, such a body is checked on a copy converted to the multi-line form (whitespace only), compared with the file
 *   as it is, and listed as a todo under its collection. Any other reason a body cannot be opened fails.
 * - Draft posts with uncommitted changes (another workflow may be rewriting them): checked, but a failure is counted
 *   and skipped, as in keystatic-roundtrip. Published posts are never skipped.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReader } from '@keystatic/core/reader';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { mdxjs } from 'micromark-extension-mdxjs';
import { describe, expect, it } from 'vitest';
import keystaticConfig from '../../keystatic.config.ts';
import { numericColumns } from '../../src/lib/content/post-table.ts';
import { KEYSTATIC_CORE_VERIFIED, ROOT, entryFile, installedKeystaticCore, metaOf, postStatus, splitFrontmatter, uncommittedPosts, type KsNode } from './keystatic-harness.ts';

type Collection = { path: string; format: { contentField?: string }; schema: Record<string, KsNode> };
const collections = keystaticConfig.collections as unknown as Record<string, Collection>;
const MDX_COLLECTIONS = Object.keys(collections).filter((key) => collections[key].format.contentField !== undefined);

/* ---------- The editor's body field and Astro's parser ---------- */

type BodyField = {
  parse(value: unknown, context: { content: Uint8Array; other: Map<string, unknown>; external: Map<string, unknown>; slug: string }): unknown;
  serialize(state: unknown, context: { slug: string }): { content: Uint8Array };
};
type FieldsModule = { fields: { mdx(config: unknown): BodyField } };

/** The browser build of @keystatic/core (package.json `exports["."].default`), the one the admin runs. */
async function browserKeystatic(): Promise<FieldsModule> {
  const dir = join(ROOT, 'node_modules/@keystatic/core');
  const entry = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).exports['.'].default as string;
  return import(pathToFileURL(join(dir, entry)).href);
}

type Satteri = { mdxToHast(source: string, options?: { features?: object; position?: boolean }): HastNode };
/** The Markdown engine @astrojs/mdx compiles the bodies with (resolved through @astrojs/mdx, as the build does). */
async function astroMdxParser(): Promise<Satteri> {
  const fromMdx = createRequire(join(ROOT, 'node_modules/@astrojs/mdx/package.json'));
  const processor = fromMdx.resolve('@astrojs/markdown-satteri');
  return import(pathToFileURL(createRequire(processor).resolve('satteri')).href);
}

const keystatic = await browserKeystatic();
const satteri = await astroMdxParser();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The editor's field for a collection's body, built from the exact config keystatic/fields.ts passed to `fields.mdx`. */
function editorBodyField(key: string): BodyField {
  const meta = metaOf(collections[key].schema.body);
  if (meta?.kind !== 'mdx') throw new Error(`${key}.body is not an mdxBody() field`);
  return keystatic.fields.mdx(meta.config);
}

/**
 * Opens the body in the editor and saves it without edits: the Markdown the admin writes after the frontmatter.
 * When the body opens with a table, the editor's first selection sits in a table cell, and Keystatic's table-cell
 * menu plugin creates a `document.createElement('div')` for its widget while the state is built. Node has no
 * `document`, so an element stub stands in for that call only; the widget never reaches the Markdown.
 */
function editorSave(field: BodyField, body: string, slug = 'entry'): string {
  const scope = globalThis as { document?: unknown };
  const stubbed = scope.document === undefined;
  if (stubbed) scope.document = { createElement: () => ({}) };
  try {
    const state = field.parse(undefined, { content: encoder.encode(body), other: new Map(), external: new Map(), slug });
    return decoder.decode(field.serialize(state, { slug }).content);
  } finally {
    if (stubbed) delete scope.document;
  }
}

/* ---------- Reading a body: words, links, JSX props ---------- */

type MdNode = { type: string; value?: string; children?: MdNode[]; [key: string]: any };
type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[]; [key: string]: any };

/** Keystatic's parser set (the same micromark and mdast extensions its editor uses to open a body). */
const parseMdx = (source: string): MdNode =>
  fromMarkdown(source, {
    extensions: [mdxjs(), gfmAutolinkLiteral(), gfmStrikethrough(), gfmTable()],
    mdastExtensions: [mdxFromMarkdown(), gfmAutolinkLiteralFromMarkdown(), gfmStrikethroughFromMarkdown(), gfmTableFromMarkdown()],
  }) as MdNode;

const visit = <T extends { children?: T[] }>(node: T, fn: (node: T) => void): void => {
  fn(node);
  node.children?.forEach((child) => visit(child, fn));
};

/** A block is set off by spaces; inline pieces are joined as they are, so a word split across marks stays one word. */
const MD_BLOCKS = new Set(['root', 'blockquote', 'code', 'heading', 'html', 'list', 'listItem', 'paragraph', 'table', 'tableRow', 'tableCell', 'thematicBreak', 'mdxJsxFlowElement', 'mdxFlowExpression']);
function mdText(node: MdNode): string {
  if (['text', 'inlineCode', 'code', 'html'].includes(node.type)) return node.value ?? '';
  if (node.type === 'break') return ' ';
  if (node.type === 'image' || node.type === 'imageReference') return ` ${node.alt ?? ''} `;
  if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') return ` {${node.value}} `;
  const inner = (node.children ?? []).map(mdText).join('');
  return MD_BLOCKS.has(node.type) ? ` ${inner} ` : inner;
}

const HAST_BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'pre', 'div', 'section']);
function hastText(node: HastNode): string {
  if (node.type === 'text' || node.type === 'raw') return node.value ?? '';
  if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') return ` {${node.value}} `;
  if (node.type === 'element' && node.tagName === 'br') return ' ';
  if (node.type === 'element' && node.tagName === 'img') return ` ${node.properties?.alt ?? ''} `;
  const inner = (node.children ?? []).map(hastText).join('');
  const block = node.type === 'root' || node.type === 'mdxJsxFlowElement' || (node.type === 'element' && HAST_BLOCKS.has(node.tagName!));
  return block ? ` ${inner} ` : inner;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

type JsxNode = { type: string; name?: string | null; attributes?: { type: string; name?: string; value?: unknown }[] };
/** A JSX element as `Name {"prop":"value",…}` with props sorted (the editor writes them in its schema order). */
function jsxProps(node: JsxNode): string {
  const props = (node.attributes ?? [])
    .map((a) => {
      if (a.type !== 'mdxJsxAttribute') return ['{…}', String((a as { value?: unknown }).value)];
      const value = a.value === null || a.value === undefined ? true : typeof a.value === 'string' ? a.value : `{${(a.value as { value: string }).value}}`;
      return [a.name!, value];
    })
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  return `${node.name ?? '<>'} ${JSON.stringify(Object.fromEntries(props))}`;
}

type Reading = { words: string[]; links: string[]; jsx: string[] };
const link = (url: unknown, title: unknown) => (title ? `${url} "${title}"` : String(url));

/** What Keystatic's parser reads in a body. Reference links are resolved as the editor resolves them. */
function readWithKeystatic(source: string): Reading {
  const tree = parseMdx(source);
  const definitions = new Map<string, MdNode>();
  visit(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(String(node.identifier).toUpperCase())) definitions.set(String(node.identifier).toUpperCase(), node);
  });
  const links: string[] = [];
  const jsx: string[] = [];
  visit(tree, (node) => {
    if (node.type === 'link') links.push(link(node.url, node.title));
    if (node.type === 'linkReference' || node.type === 'imageReference') {
      const target = definitions.get(String(node.identifier).toUpperCase());
      links.push(`${node.type === 'imageReference' ? 'image ' : ''}${link(target?.url, target?.title)}`);
    }
    if (node.type === 'image') links.push(`image ${link(node.url, node.title)}`);
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') jsx.push(jsxProps(node));
  });
  return { words: words(mdText(tree)), links, jsx };
}

/** What Astro's MDX compiler reads in a body (the hast it renders the page from). */
function readWithAstro(source: string): Reading {
  const tree = satteri.mdxToHast(source, { features: { gfm: true, smartPunctuation: true }, position: false });
  const links: string[] = [];
  const jsx: string[] = [];
  visit(tree, (node) => {
    if (node.type === 'element' && node.tagName === 'a') links.push(link(node.properties?.href, node.properties?.title));
    if (node.type === 'element' && node.tagName === 'img') links.push(`image ${link(node.properties?.src, node.properties?.title)}`);
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') jsx.push(jsxProps(node));
  });
  return { words: words(hastText(tree)), links, jsx };
}

/** The first difference between two readings, as short lines (empty when they match). */
function lost(before: Reading, after: Reading, reader: string): string[] {
  const out: string[] = [];
  const firstDiff = (a: string[], b: string[]) => {
    const i = a.findIndex((item, n) => item !== b[n]);
    return i === -1 ? a.length : i;
  };
  for (const part of ['words', 'links', 'jsx'] as const) {
    const a = before[part];
    const b = after[part];
    if (a.length === b.length && a.every((item, i) => item === b[i])) continue;
    const i = firstDiff(a, b);
    const around = (list: string[]) => JSON.stringify(list.slice(Math.max(0, i - 3), i + 4).join(' ')).slice(0, 160);
    out.push(`${reader}: ${part} differ at ${part === 'words' ? 'word' : 'item'} ${i + 1} (${a.length} before, ${b.length} after): ${around(a)} → ${around(b)}`);
  }
  return out;
}

/* ---------- One-line InlineCta (waiting for the codemod) ---------- */

/** The editor's error for a one-line `<InlineCta>`: a block component inside a paragraph. */
const ONE_LINE_ERROR = 'mdxJsxTextElement has unexpected children';

/**
 * Rewrites every paragraph that holds only a one-line `<InlineCta …>text</InlineCta>` into the multi-line form the
 * editor opens (and writes). Whitespace only: the tag, its props and its text are copied byte for byte.
 */
function toMultiLineInlineCta(body: string): { body: string; count: number } {
  const edits: [number, number, string][] = [];
  visit(parseMdx(body), (node) => {
    const [only] = node.children ?? [];
    if (node.type !== 'paragraph' || node.children!.length !== 1 || only.type !== 'mdxJsxTextElement' || only.name !== 'InlineCta') return;
    const kids = only.children ?? [];
    if (!kids.length) return;
    const start = only.position.start.offset as number;
    const end = only.position.end.offset as number;
    const first = kids[0].position.start.offset as number;
    const last = kids.at(-1)!.position.end.offset as number;
    edits.push([start, end, `${body.slice(start, first)}\n${body.slice(first, last)}\n${body.slice(last, end)}`]);
  });
  let out = body;
  for (const [start, end, text] of edits.reverse()) out = out.slice(0, start) + text + out.slice(end);
  return { body: out, count: edits.length };
}

/* ---------- One body ---------- */

type Report = {
  id: string;
  file: string;
  /** Failures here are counted, not failed (uncommitted draft posts). */
  tolerated: boolean;
  /** One-line InlineCtas the editor cannot open; the body was checked on a multi-line copy. */
  oneLine: number;
  open: string[];
  keystatic: string[];
  astro: string[];
  alignment: string[];
  /** Right-aligned numeric columns whose Markdown alignment a save drops (PostTable keeps them right-aligned). */
  numericAligned: number;
};

const reader = createReader(ROOT, keystaticConfig) as unknown as { collections: Record<string, { list(): Promise<string[]> }> };
const MID_EDIT_DRAFTS = new Set([...uncommittedPosts()].filter((slug) => (postStatus(slug) ?? 'draft') === 'draft'));

function analyse(key: string, slug: string): Report {
  const file = entryFile(collections[key].path, slug);
  const report: Report = { id: `${key}/${slug}`, file, tolerated: key === 'posts' && MID_EDIT_DRAFTS.has(slug), oneLine: 0, open: [], keystatic: [], astro: [], alignment: [], numericAligned: 0 };
  try {
    check(key, slug, report);
  } catch (error) {
    // A body that is not valid MDX at all (the build fails on it too), or a half-written draft.
    report.open.push(`the body could not be checked: ${(error as Error).message.split('\n')[0]}`);
  }
  return report;
}

function check(key: string, slug: string, report: Report): void {
  const { file } = report;
  const split = splitFrontmatter(readFileSync(join(ROOT, file), 'utf8'));
  if (!split) {
    report.open.push('no frontmatter block, so Keystatic cannot split the file');
    return;
  }
  const { body } = split;
  const field = editorBodyField(key);

  let saved: string;
  try {
    saved = editorSave(field, body, slug);
  } catch (error) {
    const message = (error as Error).message;
    const converted = toMultiLineInlineCta(body);
    if (message.split('\n').every((line) => line === ONE_LINE_ERROR) && converted.count) {
      report.oneLine = converted.count;
      try {
        saved = editorSave(field, converted.body, slug);
      } catch (again) {
        report.open.push(`the editor cannot open it even with the InlineCta on several lines: ${(again as Error).message.split('\n').join('; ')}`);
        return;
      }
    } else {
      report.open.push(`the editor cannot open it: ${message.split('\n').join('; ')}`);
      return;
    }
  }

  // Nothing lost, as Keystatic reads it and as Astro renders it. The file as it is (not the converted copy) is the reference.
  report.keystatic.push(...lost(readWithKeystatic(body), readWithKeystatic(saved), 'Keystatic reads'));
  report.astro.push(...lost(readWithAstro(body), readWithAstro(saved), 'Astro renders'));

  // Table alignment: dropped by every save; fine only where PostTable right-aligns the column anyway.
  const tables: MdNode[] = [];
  visit(parseMdx(body), (node) => {
    if (node.type === 'table') tables.push(node);
  });
  tables.forEach((table, t) => {
    const rows = (table.children ?? []).slice(1).map((row) => (row.children ?? []).map((cell) => mdText(cell).replace(/\s+/g, ' ').trim()));
    const numeric = numericColumns(rows);
    (table.align as (string | null)[] | undefined)?.forEach((align, column) => {
      if (!align) return;
      const header = mdText(table.children![0].children![column] ?? { type: 'text', value: '' }).trim();
      if (align === 'right' && numeric[column]) report.numericAligned++;
      else report.alignment.push(`table ${t + 1}, column "${header}": a save drops its ${align} alignment, and PostTable does not ${align === 'right' ? 'right-align it (not every cell is an amount)' : `${align}-align columns`}`);
    });
  });
}

const REPORTS = new Map<string, Report[]>();
for (const key of MDX_COLLECTIONS) {
  const slugs = [...(await reader.collections[key].list())].sort();
  REPORTS.set(key, slugs.map((slug) => analyse(key, slug)));
}

type Step = 'open' | 'keystatic' | 'astro' | 'alignment';
async function failures(key: string, step: Step, annotate: (message: string) => Promise<unknown>): Promise<string[]> {
  const reports = REPORTS.get(key)!;
  expect(reports.length, `${key} has entries`).toBeGreaterThan(0);
  const skipped = reports.filter((r) => r.tolerated && r[step].length);
  if (skipped.length) await annotate(`${skipped.length} uncommitted draft post(s) skipped: ${skipped.map((r) => r.id).join(', ')}`);
  const oneLine = reports.filter((r) => r.oneLine);
  if (oneLine.length && step !== 'alignment') await annotate(`${oneLine.length} bodies with a one-line InlineCta checked on a multi-line copy: ${oneLine.map((r) => r.id).join(', ')}`);
  return reports.filter((r) => !r.tolerated).flatMap((r) => r[step].map((line) => `${r.id}: ${line}`));
}

/* ---------- Tests ---------- */

describe('Keystatic MDX bodies: set-up', () => {
  it(`the documented save behaviour was checked against the installed @keystatic/core (${KEYSTATIC_CORE_VERIFIED})`, () => {
    expect(installedKeystaticCore(), 'Re-run this test file and re-check docs/keystatic-design.md 2.8 against the new serializer, then update KEYSTATIC_CORE_VERIFIED').toBe(KEYSTATIC_CORE_VERIFIED);
  });

  it('guides, posts and legal are the MDX collections, each with an mdxBody() body field', () => {
    expect([...MDX_COLLECTIONS].sort()).toEqual(['guides', 'legal', 'posts']);
    for (const key of MDX_COLLECTIONS) expect(metaOf(collections[key].schema.body)?.kind, key).toBe('mdx');
  });

  it('the editor field is the browser build\'s: it parses and writes Markdown, which the Node build cannot', () => {
    expect(editorSave(editorBodyField('guides'), 'Hello *there*.\n')).toBe('Hello *there*.\n');
    expect(() => editorSave(collections.guides.schema.body as unknown as BodyField, 'Hello.\n')).toThrow(/shouldn't be called/);
  });

  it('the readers catch a lost word, link, link title and InlineCta prop', () => {
    const base = 'One [two](/a/ "T") three.\n\n<InlineCta heading="H" href="/b/" label="L">\n  Four.\n</InlineCta>\n';
    const variants = [
      base.replace('three', ''),
      base.replace('/a/', '/c/'),
      base.replace(' "T"', ''),
      base.replace(' label="L"', ''),
    ];
    for (const variant of variants) {
      expect(lost(readWithKeystatic(base), readWithKeystatic(variant), 'k'), variant).not.toEqual([]);
      expect(lost(readWithAstro(base), readWithAstro(variant), 'a'), variant).not.toEqual([]);
    }
    // Markup-only differences are not losses.
    const same = 'One [two](/a/ "T") three.\n\n<InlineCta label="L" href="/b/" heading="H">Four.</InlineCta>\n';
    expect(lost(readWithKeystatic(base), readWithKeystatic(same), 'k')).toEqual([]);
    expect(lost(readWithAstro(base), readWithAstro(same), 'a')).toEqual([]);
  });

  it('opens a body whose first block is a table, as it does one with a paragraph first', () => {
    const table = '| Item | Cost (₹) |\n| --- | --- |\n| Rent | 1,00,000 |\n\nAfter the table, [a link](/x/).\n';
    const saved = editorSave(editorBodyField('posts'), table);
    expect(editorSave(editorBodyField('posts'), `Intro.\n\n${table}`)).toBe(`Intro.\n\n${saved}`);
    expect(lost(readWithKeystatic(table), readWithKeystatic(saved), 'k')).toEqual([]);
    expect((globalThis as { document?: unknown }).document, 'the stub is removed after the save').toBeUndefined();
  });

  it('the multi-line copy of a one-line InlineCta changes whitespace only, and the editor opens it', () => {
    const body = 'Intro.\n\n<InlineCta heading="H" href="/b/" label="L">One *or* two sentences.</InlineCta>\n\nEnd.\n';
    expect(() => editorSave(editorBodyField('posts'), body)).toThrow(ONE_LINE_ERROR);
    const { body: copy, count } = toMultiLineInlineCta(body);
    expect(count).toBe(1);
    expect(copy.replace(/\s+/g, '')).toBe(body.replace(/\s+/g, ''));
    expect(editorSave(editorBodyField('posts'), copy)).toBe('Intro.\n\n<InlineCta heading="H" href="/b/" label="L">\n  One *or* two sentences.\n</InlineCta>\n\nEnd.\n');
  });
});

for (const key of MDX_COLLECTIONS) {
  const reports = REPORTS.get(key)!;
  const note = key === 'posts' && MID_EDIT_DRAFTS.size ? ` (${MID_EDIT_DRAFTS.size} uncommitted drafts: failures counted and skipped)` : '';
  describe(`Keystatic MDX bodies: ${key}${note}`, () => {
    it('the editor opens every body (one-line InlineCta aside, see the todos)', async ({ annotate }) => {
      expect(await failures(key, 'open', annotate)).toEqual([]);
    });
    it('a save without edits keeps every word, link and InlineCta prop, as Keystatic reads the body', async ({ annotate }) => {
      expect(await failures(key, 'keystatic', annotate)).toEqual([]);
    });
    it('Astro renders the saved body with the same words, links and InlineCta props', async ({ annotate }) => {
      expect(await failures(key, 'astro', annotate)).toEqual([]);
    });
    it('a save drops table alignment only where PostTable right-aligns the column anyway', async ({ annotate }) => {
      const kept = reports.filter((r) => r.numericAligned);
      if (kept.length) await annotate(`Markdown right-alignment dropped by a save, still right-aligned by PostTable: ${kept.map((r) => r.id).join(', ')}`);
      expect(await failures(key, 'alignment', annotate)).toEqual([]);
    });
    for (const report of reports.filter((r) => r.oneLine && !r.tolerated)) {
      it.todo(`the editor cannot open ${report.file} until its one-line InlineCta is rewritten on several lines`);
    }
  });
}

/* ---------- What a save changes (docs/keystatic-design.md 2.8) ---------- */

describe('Keystatic MDX bodies: the changes a save makes, as documented', () => {
  const save = (body: string) => editorSave(editorBodyField('posts'), body);

  it('reformats without losing anything, and a second save changes nothing', () => {
    const body = [
      '',
      '## 1\\. A numbered heading',
      '',
      'Setext heading',
      '--------------',
      '',
      '| Item | Cost (₹) |',
      '| :--- | ---: |',
      '| Rent | 1,00,000 |',
      '',
      '- one',
      '',
      '- two',
      '    - nested',
      '',
      'A line with a hard break  ',
      'and the next line.',
      '',
      'Braces \\{like this\\}, a \\<tag, 5 \\* 3, snake_case, [brackets] and &lt;entities&gt;.',
      '',
      'See www.example.com, hello@example.com and [a link](https://example.com/?a=1&b=2).',
      '',
      'A [reference link][ref] and **[bold link](/x/) (after)**.',
      '',
      '[ref]: https://example.com/ref/',
      '',
      '<InlineCta heading="H" href="/pricing/" label="L">',
      'Child text.',
      '</InlineCta>',
      '',
    ].join('\n');
    const saved = save(body);
    expect(save(saved), 'a second save').toBe(saved);
    expect(lost(readWithKeystatic(body), readWithKeystatic(saved), 'Keystatic reads')).toEqual([]);
    expect(lost(readWithAstro(body), readWithAstro(saved), 'Astro renders')).toEqual([]);

    const lines = saved.split('\n');
    expect(lines[0], 'leading blank lines are dropped').toBe('## 1. A numbered heading');
    expect(saved, 'setext headings become ATX').toContain('\n## Setext heading\n');
    expect(saved, 'table alignment is dropped and cells are padded').toContain('| Item | Cost (₹) |\n| ---- | -------- |\n| Rent | 1,00,000 |');
    expect(saved, 'lists use "*", loose lists become tight, nesting is two spaces').toContain('* one\n* two\n  * nested\n');
    expect(saved, 'a trailing-space hard break becomes a backslash').toContain('A line with a hard break\\\nand the next line.');
    expect(saved, 'escapes are rewritten').toContain('Braces \\{like this}, a \\<tag, 5 \\* 3, snake\\_case, \\[brackets] and \\<entities>.');
    expect(saved, 'bare URLs and emails become explicit links; & in a URL is escaped').toContain(
      'See [www.example.com](http://www.example.com), [hello@example.com](mailto:hello@example.com) and [a link](https://example.com/?a=1\\&b=2).',
    );
    expect(saved, 'reference links become inline links; a link inside bold is written bold inside the link').toContain(
      'A [reference link](https://example.com/ref/) and [**bold link**](/x/)**&#x20;(after)**.',
    );
    expect(saved, 'the definition itself is gone').not.toContain('[ref]:');
    expect(saved, 'InlineCta is written on several lines, its text indented two spaces').toContain(
      '<InlineCta heading="H" href="/pricing/" label="L">\n  Child text.\n</InlineCta>',
    );
  });

  it('loses a link title, and turns an image or a footnote into something else (none in the content; the tests above would fail)', () => {
    expect(save('A [link](/a/ "Title").\n')).toBe('A [link](/a/).\n');
    expect(save('![Alt](/a.png)\n')).toBe('!\\[Alt]\\(/a.png)\n');
    expect(save('A[^1].\n\n[^1]: Note.\n')).toBe('A[^1](Note.).\n');
    // …and the comparison over the real bodies reports each one (Keystatic's parser has no footnotes; Astro's does).
    for (const body of ['A [link](/a/ "Title").\n', '![Alt](/a.png)\n']) {
      expect(lost(readWithKeystatic(body), readWithKeystatic(save(body)), 'k'), body).not.toEqual([]);
    }
    for (const body of ['A [link](/a/ "Title").\n', '![Alt](/a.png)\n', 'A[^1].\n\n[^1]: Note.\n']) {
      expect(lost(readWithAstro(body), readWithAstro(save(body)), 'a'), body).not.toEqual([]);
    }
  });

  it('refuses to open HTML, {expressions}, code and a one-line InlineCta', () => {
    expect(() => save('A <br /> tag.\n')).toThrow('Missing component definition for br');
    expect(() => save('Sum {1 + 1}.\n')).toThrow('Unhandled type mdxTextExpression');
    expect(() => save('Some `code`.\n')).toThrow('inlineCode is not allowed');
    expect(() => save('<InlineCta heading="H" href="/b/" label="L">One line.</InlineCta>\n')).toThrow(ONE_LINE_ERROR);
  });
});
