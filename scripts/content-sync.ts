/**
 * Published blog content lives in the Supabase Storage bucket `content`, at the same paths as in the repository:
 *   src/content/posts/<slug>/...            post files and their images
 *   src/assets/images/blog/<slug>.<ext>     featured images
 *   src/data/redirects-admin.yaml, src/data/gone-admin.yaml   rules the admin writes
 *
 *   node scripts/content-sync.ts pull   Before `astro build`: mirror the bucket into the working tree. Post folders and
 *                                       featured images that are not in the bucket are removed, so deletes reach the site.
 *                                       Skips (and keeps the files in Git) when Supabase is not set up or the bucket is empty.
 *   node scripts/content-sync.ts push   One-off seed: upload the files from the working tree to the bucket.
 *
 * Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) from the
 * environment, then from .env.local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const BUCKET = 'content';
const POSTS = 'src/content/posts';
const COVERS = 'src/assets/images/blog';
const RULES = ['src/data/redirects-admin.yaml', 'src/data/gone-admin.yaml'];
const PARALLEL = 24;

function loadEnvFile(): void {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

async function pool<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

const TYPES: Record<string, string> = { mdx: 'text/markdown', md: 'text/markdown', yaml: 'text/yaml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const typeOf = (path: string) => TYPES[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';

async function localFiles(dir: string): Promise<string[]> {
  const entries = await readdir(join(ROOT, dir), { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isFile()).map((e) => relative(ROOT, join(e.parentPath, e.name)).replaceAll('\\', '/'));
}

loadEnvFile();
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const command = process.argv[2];

if (!url || !key) {
  if (command === 'pull') {
    console.log('[content-sync] Supabase is not set up: building from the files in Git.');
    process.exit(0);
  }
  console.error('[content-sync] Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

/** Every object path in the bucket under `prefix`. */
async function remoteFiles(prefix: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(dir, { limit: 1000, offset });
      if (error) throw new Error(`Could not list ${dir}: ${error.message}`);
      const folders = (data ?? []).filter((i) => i.id === null).map((i) => `${dir}/${i.name}`);
      out.push(...(data ?? []).filter((i) => i.id !== null).map((i) => `${dir}/${i.name}`));
      await Promise.all(folders.map(walk));
      if ((data ?? []).length < 1000) break;
    }
  };
  await walk(prefix);
  return out;
}

async function push(): Promise<void> {
  const files = [...(await localFiles(POSTS)), ...(await localFiles(COVERS)), ...RULES.filter((p) => existsSync(join(ROOT, p)))];
  let done = 0;
  await pool(files, async (path) => {
    const { error } = await storage.upload(path, await readFile(join(ROOT, path)), { upsert: true, contentType: typeOf(path), cacheControl: '0' });
    if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
    if (++done % 50 === 0) console.log(`[content-sync] ${done}/${files.length}`);
  });
  console.log(`[content-sync] Uploaded ${files.length} files to the "${BUCKET}" bucket.`);
}

async function pull(): Promise<void> {
  const started = Date.now();
  const [posts, covers] = await Promise.all([remoteFiles(POSTS), remoteFiles(COVERS)]);
  if (!posts.some((p) => p.endsWith('/index.mdx'))) {
    console.log('[content-sync] The bucket has no posts yet: building from the files in Git.');
    return;
  }
  const rules = (await Promise.all(RULES.map(async (p) => ((await storage.download(p)).data ? p : null)))).filter(Boolean) as string[];
  const remote = [...posts, ...covers, ...rules];
  await pool(remote, async (path) => {
    const { data, error } = await storage.download(path);
    if (error || !data) throw new Error(`Download failed for ${path}: ${error?.message}`);
    const target = join(ROOT, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
  });
  // Mirror: anything local that the bucket no longer has was deleted or unpublished in the admin.
  const keep = new Set(remote);
  const stale = [...(await localFiles(POSTS)), ...(await localFiles(COVERS))].filter((p) => !keep.has(p));
  for (const path of stale) await rm(join(ROOT, path), { force: true });
  for (const folder of await readdir(join(ROOT, POSTS)).catch(() => [] as string[])) {
    if ((await localFiles(`${POSTS}/${folder}`)).length === 0) await rm(join(ROOT, POSTS, folder), { recursive: true, force: true });
  }
  console.log(`[content-sync] Pulled ${remote.length} files (${posts.filter((p) => p.endsWith('/index.mdx')).length} posts), removed ${stale.length}, in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}

if (command === 'push') await push();
else if (command === 'pull') await pull();
else {
  console.error('Usage: node scripts/content-sync.ts pull|push');
  process.exit(1);
}
