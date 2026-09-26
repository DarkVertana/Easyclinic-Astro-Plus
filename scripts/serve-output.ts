/**
 * Serves `.vercel/output` with a local emulation of Vercel's Build Output API routing, so redirects,
 * 410s, host-conditional headers and on-demand routes can be tested without a deploy.
 *
 * Emulated: routes before `handle: filesystem` (src, has/missing host, headers, status, dest,
 * continue, $n substitution), static file lookup (`/x/` -> `/x/index.html`), then the routes after
 * `handle: filesystem`, with `dest: "_render"` invoking the bundled Astro function's `fetch` handler.
 * Not emulated: edge caching, `check`, `methods`, locale routes. Verify on a real preview with
 * `pnpm smoke` before launch.
 *
 * Usage: node scripts/serve-output.ts [--port 4322]
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Route {
  src?: string;
  dest?: string;
  headers?: Record<string, string>;
  status?: number;
  continue?: boolean;
  handle?: string;
  has?: Array<{ type: string; value: string }>;
  missing?: Array<{ type: string; value: string }>;
}

const root = join(process.cwd(), '.vercel/output');
const portArg = process.argv.indexOf('--port');
const port = portArg > 0 ? Number(process.argv[portArg + 1]) : Number(process.env.PORT ?? 4322);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8')) as { routes: Route[] };
const filesystemIndex = config.routes.findIndex((r) => r.handle === 'filesystem');
const beforeFs = config.routes.slice(0, filesystemIndex);
const afterFs = config.routes.slice(filesystemIndex + 1).filter((r) => !r.handle);

const fn = (await import(pathToFileURL(join(root, 'functions/_render.func/entry.mjs')).href)).default as {
  fetch: (request: Request) => Promise<Response>;
};

function hostMatches(route: Route, host: string): boolean {
  const bare = host.replace(/:\d+$/, '');
  for (const cond of route.has ?? []) if (cond.type === 'host' && cond.value !== bare) return false;
  for (const cond of route.missing ?? []) if (cond.type === 'host' && cond.value === bare) return false;
  return true;
}

function substitute(value: string, match: RegExpMatchArray): string {
  return value.replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? '');
}

async function staticFile(pathname: string): Promise<string | null> {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..')) return null;
  const candidates = decoded.endsWith('/') ? [join(root, 'static', decoded, 'index.html')] : [join(root, 'static', decoded)];
  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // not found
    }
  }
  return null;
}

async function toNodeResponse(res: ServerResponse, response: Response, extraHeaders: Record<string, string>, method: string) {
  const headers: Record<string, string> = { ...extraHeaders };
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  if (method === 'HEAD') return res.end();
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? '/', `http://${host}`);
  let pathname = url.pathname;
  let statusOverride: number | undefined;
  const headers: Record<string, string> = {};

  for (const route of beforeFs) {
    if (!route.src || !hostMatches(route, host)) continue;
    const match = pathname.match(new RegExp(route.src));
    if (!match) continue;
    for (const [key, value] of Object.entries(route.headers ?? {})) headers[key] = substitute(value, match);
    if (route.status && headers.Location && !route.dest) {
      const location = headers.Location + (url.search && !headers.Location.includes('?') ? url.search : '');
      res.writeHead(route.status, { ...headers, Location: location });
      return res.end();
    }
    if (route.dest) pathname = substitute(route.dest, match).split('?')[0];
    if (route.status) statusOverride = route.status;
    if (!route.continue) break;
  }

  const file = await staticFile(pathname);
  if (file && (req.method === 'GET' || req.method === 'HEAD')) {
    const body = await readFile(file);
    res.writeHead(statusOverride ?? 200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', ...headers });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }

  for (const route of afterFs) {
    if (!route.src || !hostMatches(route, host)) continue;
    const match = pathname.match(new RegExp(route.src));
    if (!match) continue;
    if (route.dest === '_render') {
      const body = await readBody(req);
      const request = new Request(new URL(pathname + url.search, url), {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])) as [string, string][],
        body,
      });
      const response = await fn.fetch(request);
      const status = route.status ?? statusOverride;
      const final = status && response.status === 200 ? new Response(response.body, { status, headers: response.headers }) : response;
      return toNodeResponse(res, final, headers, req.method ?? 'GET');
    }
  }

  res.writeHead(404, { 'content-type': 'text/plain', ...headers });
  res.end('Not found');
}

createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    res.writeHead(500);
    res.end('Emulator error');
  });
}).listen(port, () => {
  console.log(`Serving .vercel/output with emulated routing on http://localhost:${port}`);
});
