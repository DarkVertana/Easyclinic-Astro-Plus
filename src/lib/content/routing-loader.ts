/**
 * Content loader for the routing data (redirects, gone): several YAML lists merged into one collection,
 * so every consumer (the route registry's collision check, the build manifest, vercel-routes) sees the
 * hand-written rows and the rows generated from the posts manifest (scripts/posts-redirects.ts) alike.
 *
 * Each row's id is `<match>:<path>`. The same source in two files fails the build, naming both files; a
 * listed file that does not exist is treated as empty.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';

export function routingLists(key: 'from' | 'path', files: string[]): Loader {
  async function sync({ parseData, store }: LoaderContext, paths: string[]) {
    const entries: Array<{ id: string; data: Record<string, unknown>; filePath: string }> = [];
    const seen = new Map<string, string>();
    for (const [i, file] of files.entries()) {
      const path = paths[i];
      if (!existsSync(path)) continue;
      const rows = (parseYaml(await readFile(path, 'utf8')) ?? []) as Array<Record<string, unknown>>;
      if (!Array.isArray(rows)) throw new Error(`${file} must be a YAML list`);
      for (const row of rows) {
        const id = `${String(row.match ?? 'exact')}:${String(row[key])}`;
        const other = seen.get(id);
        if (other) throw new Error(`${file}: ${key} ${String(row[key])} (${String(row.match ?? 'exact')}) is also listed in ${other}; keep one row`);
        seen.set(id, file);
        const data = await parseData({ id, data: { id, ...row }, filePath: path });
        entries.push({ id, data, filePath: file });
      }
    }
    store.clear();
    for (const entry of entries) store.set(entry);
  }

  return {
    name: 'easyclinic:routing-lists',
    load: async (context) => {
      const paths = files.map((file) => fileURLToPath(new URL(file, context.config.root)));
      await sync(context, paths);
      for (const path of paths) context.watcher?.add(path);
      context.watcher?.on('change', async (changed) => {
        if (paths.includes(changed)) await sync(context, paths);
      });
    },
  };
}
