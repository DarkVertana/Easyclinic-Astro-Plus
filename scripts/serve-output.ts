/**
 * Serves `.vercel/output` with a local emulation of Vercel's Build Output API routing, so redirects,
 * 410s, host-conditional headers and on-demand routes can be tested without a deploy.
 *
 * The routing itself lives in scripts/lib/vercel-router.ts (shared with scripts/check-coverage.ts):
 * routes before `handle: filesystem`, static file lookup (`/x/` -> `/x/index.html`), then the routes after
 * `handle: filesystem`, with `dest: "_render"` invoking the bundled Astro function's `fetch` handler and a
 * static `dest` (the adapter's `/404.html`) served from disk. Not emulated: edge caching, `check`,
 * `methods`, locale routes. Verify on a real preview with `pnpm smoke` before launch.
 *
 * Usage: node scripts/serve-output.ts [--port 4322]
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
import { createRouter, listStaticFiles, staticLookup, type Route } from './lib/vercel-router.ts';

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
// The output does not change while serving, so the static file list is read once.
const router = createRouter(config.routes, staticLookup(listStaticFiles(join(root, 'static'))));

// The handler path is relative to the function directory and depends on dependency tracing.
const fnDir = join(root, 'functions/_render.func');
const vcConfig = JSON.parse(await readFile(join(fnDir, '.vc-config.json'), 'utf8')) as { handler: string };
const fn = (await import(pathToFileURL(join(fnDir, vcConfig.handler)).href)).default as {
  fetch: (request: Request) => Promise<Response>;
};

/**
 * Route headers first, then the function's own headers replace any of the same name, case-insensitively.
 * That is what `vercel dev` does (route headers are set on the response, then the proxied function response
 * overwrites them), so /demo/confirmation/ carries Astro's CSP header rather than the route-level one.
 * Production may differ: scripts/smoke.ts checks which policy a deployed confirmation page really sends.
 */
async function toNodeResponse(res: ServerResponse, response: Response, extraHeaders: Record<string, string>, method: string) {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(extraHeaders)) headers[key.toLowerCase()] = value;
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
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
  const method = req.method ?? 'GET';
  const result = router.resolve({ pathname: url.pathname, host, search: url.search, method });

  if (result.kind === 'redirect') {
    res.writeHead(result.status, { ...result.headers, Location: result.location });
    return res.end();
  }

  if (result.kind === 'static') {
    const file = join(root, 'static', result.file);
    let body = await readFile(file);
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    // Compress text like Vercel's edge does, so Lighthouse numbers are realistic.
    const compress = /text|javascript|json|xml|svg/.test(type) && /\bbr\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (compress) body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
    res.writeHead(result.status, { 'content-type': type, ...(compress ? { 'content-encoding': 'br', vary: 'accept-encoding' } : {}), ...result.headers });
    return res.end(method === 'HEAD' ? undefined : body);
  }

  if (result.kind === 'function') {
    const body = await readBody(req);
    const request = new Request(new URL(result.pathname + url.search, url), {
      method,
      headers: Object.entries(req.headers).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])) as [string, string][],
      body: body ? new Uint8Array(body) : undefined,
    });
    const response = await fn.fetch(request);
    const final = result.status && response.status === 200 ? new Response(response.body, { status: result.status, headers: response.headers }) : response;
    return toNodeResponse(res, final, result.headers, method);
  }

  res.writeHead(404, { 'content-type': 'text/plain', ...result.headers });
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
