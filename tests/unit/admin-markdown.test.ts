/** The visual editor's Markdown bridge: every existing post must survive a round trip without new build errors. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/admin/env.ts', () => ({ env: () => undefined }));

const { htmlToMarkdown, markdownToHtml } = await import('../../src/components/admin/blog/markdown.ts');
const { checkMdxSafety } = await import('../../src/lib/admin/harness.ts');
const { parsePost } = await import('../../src/lib/admin/mdx-file.ts');

const trip = (md: string) => htmlToMarkdown(markdownToHtml(md));

describe('markdown bridge', () => {
  it('keeps the call-to-action box, post images, tables, links and lists', () => {
    const md = [
      '## Why it matters',
      '',
      'Text with **bold**, _italic_ and a [link](/features/emr/).',
      '',
      '![A chart of wait times](./wait-ab12cd.webp)',
      '',
      '<InlineCta heading="See it in your clinic" label="Book a demo" href="/demo/">',
      'A short line.',
      '</InlineCta>',
      '',
      '| Plan | Price |',
      '| --- | --- |',
      '| Basic | 10 |',
      '',
      '- One',
      '- Two',
      '',
    ].join('\n');
    const out = trip(md);
    expect(out).toContain('## Why it matters');
    expect(out).toContain('**bold**');
    expect(out).toContain('[link](/features/emr/)');
    expect(out).toContain('![A chart of wait times](./wait-ab12cd.webp)');
    expect(out).toContain('<InlineCta heading="See it in your clinic" label="Book a demo" href="/demo/">\nA short line.\n</InlineCta>');
    expect(out).toMatch(/\| Plan \| Price \|\n\| -+ \| -+ \|\n\| Basic \| 10 \|/);
    expect(out).toContain('- One\n- Two');
  });

  it('writes tables and lists from the editor HTML as clean Markdown', () => {
    const html = '<table style="min-width: 50px"><colgroup><col style="min-width: 25px"><col></colgroup><tbody><tr><th><p>Plan</p></th><th><p>Price</p></th></tr><tr><td><p>Basic</p></td><td><p>10</p></td></tr></tbody></table>'
      + '<ul><li><p>One</p></li><li><p>Two</p></li></ul><ol><li><p>First</p></li><li><p>Second</p></li></ol>';
    const out = htmlToMarkdown(html);
    expect(out).toMatch(/\| Plan \| Price \|\n\| -+ \| -+ \|\n\| Basic \| 10 \|/);
    expect(out).toContain('- One\n- Two');
    expect(out).toContain('1. First\n2. Second');
    expect(out).not.toMatch(/<table|<col/);
  });

  it('writes a pasted table without a header row as Markdown, never raw HTML', () => {
    const md = htmlToMarkdown('<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr><tr><td><p>1</p><p>2</p></td><td><p>x<br>y</p></td></tr></tbody></table>');
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 2 | x y |\n');
    expect(checkMdxSafety(md)).toEqual([]);
  });

  it('escapes characters MDX would run as code', () => {
    expect(trip('Costs {about} 5 < 10.')).toContain('\\{about\\} 5 \\< 10');
    expect(trip('Already \\{escaped\\}.')).toContain('\\{escaped\\}');
  });

  it('every post survives a round trip without new MDX errors', () => {
    const dir = join(process.cwd(), 'src/content/posts');
    const broken: string[] = [];
    for (const slug of readdirSync(dir)) {
      let raw: string;
      try {
        raw = readFileSync(join(dir, slug, 'index.mdx'), 'utf8');
      } catch {
        continue;
      }
      const { body } = parsePost(raw);
      const before = new Set(checkMdxSafety(body).filter((c) => c.severity === 'error').map((c) => c.rule));
      const after = checkMdxSafety(trip(body)).filter((c) => c.severity === 'error' && !before.has(c.rule));
      if (after.length) broken.push(`${slug}: ${after.map((c) => `${c.rule} ${c.message} ${c.excerpt ?? ''}`).join(' | ')}`);
    }
    expect(broken).toEqual([]);
  });
});
