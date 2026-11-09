import { describe, expect, it } from 'vitest';
import { renderPreview, safeHref } from '../../src/lib/admin/preview';

describe('one-line InlineCta', () => {
  it('shows no stray closing tag', () => {
    expect(renderPreview('<InlineCta heading="H" href="/x/" label="L">Text here.</InlineCta>')).not.toContain('InlineCta');
  });
});

describe('renderPreview', () => {
  it('renders ordinary markdown', () => {
    const html = renderPreview('## Heading\n\nSome **bold** text.\n\n- one\n- two');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it.each([
    '<script>alert(1)</script>',
    'Text <script>alert(1)</script> inline',
    '<img src=x onerror=alert(1)>',
    '<div onclick="alert(1)">x</div>',
    '<iframe src="https://example.com"></iframe>',
    '<style>body{display:none}</style>',
    '<svg onload=alert(1)>',
    '<!-- comment --><b>x</b>',
  ])('escapes raw HTML: %s', (input) => {
    const html = renderPreview(input);
    expect(html).not.toMatch(/<(script|img|div|iframe|style|svg|b|!--)\b/i);
    expect(html).toContain('&lt;');
  });

  it('adds rel noopener to links and opens external ones in a new tab', () => {
    const html = renderPreview('[a](https://example.com/x) and [b](/features/emr/)');
    expect(html).toContain('<a href="https://example.com/x" rel="noopener noreferrer" target="_blank">a</a>');
    expect(html).toContain('<a href="/features/emr/" rel="noopener noreferrer">b</a>');
  });

  it.each(['[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html,hi)', '[x](vbscript:x)', '[x](java&#115;cript:alert(1))', '<javascript:alert(1)>'])(
    'drops unsafe link targets: %s',
    (input) => {
      expect(renderPreview(input)).not.toMatch(/href="[^"]*(script|data):/i);
    },
  );

  it('escapes a quote in a link title or target', () => {
    const html = renderPreview('[x](https://example.com/"onmouseover="alert(1) "a\\"b")');
    expect(html).not.toMatch(/\sonmouseover=/);
  });

  it('names images instead of loading them', () => {
    const html = renderPreview('![A <b>chart</b>](https://tracker.example/p.gif)');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('tracker.example');
    expect(html).toContain('[Image:');
  });

  it('shows an InlineCta as a note with escaped values', () => {
    const html = renderPreview('<InlineCta heading="Setting <up>" href="/kenyademo/" label="Book a demo">\n  One sentence.\n</InlineCta>');
    expect(html).toContain('Call to action');
    expect(html).toContain('Setting &lt;up&gt;');
    expect(html).toContain('/kenyademo/');
    expect(html).toContain('One sentence.');
    expect(html).not.toContain('<InlineCta');
  });

  it('removes MDX imports but keeps them inside code fences', () => {
    expect(renderPreview("import X from './x.astro';\n\nHello")).not.toContain('import X');
    expect(renderPreview('```\nimport Y from "y";\n```')).toContain('import Y');
  });

  it('writes no style attributes for aligned tables, which the CSP would block', () => {
    expect(renderPreview('| a |\n|:-:|\n| b |')).not.toContain('style=');
  });

  it('handles an empty body', () => {
    expect(renderPreview('')).toBe('');
  });
});

describe('safeHref', () => {
  it('allows safe schemes and relative paths', () => {
    for (const href of ['https://a.b', 'http://a.b', 'mailto:a@b.c', 'tel:+1', '/x/', '#y', 'z/']) expect(safeHref(href)).toBe(href);
  });
  it('refuses schemes hidden by entities or control characters', () => {
    for (const href of ['java\tscript:x', 'java&#115;cript:x', 'java&#x73;cript:x', ' javascript:x', 'javascript&colon;x']) expect(safeHref(href)).toBeNull();
  });
});
