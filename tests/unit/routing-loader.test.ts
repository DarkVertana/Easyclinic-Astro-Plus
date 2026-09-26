import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { LoaderContext } from 'astro/loaders';
import { routingLists } from '../../src/lib/content/routing-loader.ts';

const root = mkdtempSync(join(tmpdir(), 'routing-loader-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Just enough of Astro's loader context: a store, identity parsing and the project root. */
function context() {
  const entries = new Map<string, { id: string; data: Record<string, unknown>; filePath?: string }>();
  const ctx = {
    config: { root: pathToFileURL(`${root}/`) },
    parseData: async ({ data }: { data: Record<string, unknown> }) => data,
    store: {
      clear: () => entries.clear(),
      set: (entry: { id: string; data: Record<string, unknown>; filePath?: string }) => {
        entries.set(entry.id, entry);
        return true;
      },
    },
  } as unknown as LoaderContext;
  return { ctx, entries };
}

describe('routing data loader', () => {
  it('merges the hand-written and generated lists into one collection', async () => {
    writeFileSync(join(root, 'a.yaml'), '- { from: /old/, to: /new/ }\n- { from: /category/, match: prefix, to: /blog/ }\n');
    writeFileSync(join(root, 'b.yaml'), '# generated\n- { from: /ai-in-ivf/, to: /ai/ }\n');
    const { ctx, entries } = context();
    await routingLists('from', ['a.yaml', 'b.yaml']).load(ctx);
    expect([...entries.keys()]).toEqual(['exact:/old/', 'prefix:/category/', 'exact:/ai-in-ivf/']);
    expect(entries.get('exact:/ai-in-ivf/')).toMatchObject({ filePath: 'b.yaml', data: { id: 'exact:/ai-in-ivf/', from: '/ai-in-ivf/', to: '/ai/' } });
  });

  it('treats a missing or empty generated file as no rows', async () => {
    writeFileSync(join(root, 'empty.yaml'), '# generated\n[]\n');
    const { ctx, entries } = context();
    await routingLists('path', ['a-gone.yaml', 'empty.yaml', 'missing.yaml']).load(ctx);
    expect(entries.size).toBe(0);
  });

  it('fails when the same source is listed in two files, naming both', async () => {
    writeFileSync(join(root, 'dup.yaml'), '- { from: /old/, to: /elsewhere/ }\n');
    const { ctx } = context();
    await expect(routingLists('from', ['a.yaml', 'dup.yaml']).load(ctx)).rejects.toThrow(/dup\.yaml: from \/old\/ \(exact\) is also listed in a\.yaml/);
  });
});
