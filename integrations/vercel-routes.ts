import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { buildRoutes, injectRoutes, resolveRules, yieldingPaths, type GoneRule, type RedirectRule } from './routes-core.ts';

export interface BuildManifest {
  stage: 'preview' | 'production';
  indexingEnabled: boolean;
  canonicalHost: string;
  pages: Array<{ path: string; collection: string; id: string; status: string; indexable: boolean; title: string }>;
  redirects: RedirectRule[];
  gone: GoneRule[];
  /** Entries not rendered in this stage (drafts and review pages in production). */
  hidden?: Array<{ path: string; collection: string; id: string; status: string }>;
}

export const MANIFEST_FILE = 'build-manifest.json';

/**
 * Runs after the Vercel adapter has written `.vercel/output/config.json` (Astro puts the adapter
 * first in the integration list, and `astro:build:done` hooks run in order). Reads the manifest emitted by
 * `src/pages/build-manifest.json.ts`, validates the redirect data against the pages actually built,
 * and prepends redirect, 410, noindex and header routes to config.json.
 */
export default function vercelRoutes(): AstroIntegration {
  let root: URL;
  let keystatic = false;
  return {
    name: 'easyclinic:vercel-routes',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
        // Added by integrations/keystatic-gate.ts only in builds that contain the admin.
        keystatic = config.integrations.some((integration) => integration.name === 'keystatic');
      },
      'astro:build:done': async ({ dir, logger }) => {
        // `dir` is the client build directory. The adapter's own static-copy integration runs after
        // this hook, so the manifest is read (and removed) here before it can reach the static root.
        const outDir = new URL('.vercel/output/', root);
        const publicManifest = new URL(MANIFEST_FILE, dir);
        const configFile = new URL('config.json', outDir);

        let manifest: BuildManifest;
        try {
          manifest = JSON.parse(await readFile(publicManifest, 'utf8'));
        } catch {
          throw new Error(`vercel-routes: ${MANIFEST_FILE} was not emitted; is src/pages/${MANIFEST_FILE}.ts present?`);
        }

        const built = new Set(manifest.pages.map((p) => p.path));
        // Draft posts this build renders (preview only): an exact redirect or 410 on one of their paths, written when
        // marketing confirms a merge or drop, is skipped here and applies in production (routes-core isYieldingPage).
        const { active, skipped, activeGone, skippedGone, errors } = resolveRules(manifest.redirects, manifest.gone, built, yieldingPaths(manifest.pages));
        if (errors.length) {
          throw new Error(`vercel-routes: invalid redirect data\n  - ${errors.join('\n  - ')}`);
        }

        const routes = buildRoutes({
          redirects: active,
          gone: activeGone,
          canonicalHost: manifest.canonicalHost,
          indexingEnabled: manifest.indexingEnabled,
          keystatic,
        });

        const vercelConfig = JSON.parse(await readFile(configFile, 'utf8'));
        vercelConfig.routes = injectRoutes(vercelConfig.routes, routes);
        await writeFile(configFile, `${JSON.stringify(vercelConfig, null, '\t')}\n`);

        // The manifest is build metadata, not a public file: move it out of the static root so
        // post-build tools can still read it. `gone` lists the 410 rules this build serves (scripts/smoke.ts requests
        // each one); `redirects` keeps every input row, with `activeRedirects` the ones served.
        await writeFile(
          new URL(MANIFEST_FILE, outDir),
          JSON.stringify({ ...manifest, gone: activeGone, activeRedirects: active, skippedRedirects: skipped, skippedGone }, null, 2),
        );
        await rm(publicManifest);

        // Redirect entries keep their { rule, reason } shape; gone entries carry kind: 'gone'.
        const reportsDir = new URL('reports/', root);
        await mkdir(reportsDir, { recursive: true });
        await writeFile(
          new URL('redirects-skipped.json', reportsDir),
          JSON.stringify([...skipped, ...skippedGone.map((s) => ({ kind: 'gone', ...s }))], null, 2),
        );

        const onDrafts = skipped.filter((s) => s.draft).length + skippedGone.length;
        const waiting = skipped.length - skipped.filter((s) => s.draft).length;
        const notes = [
          waiting ? `${waiting} waiting for unpublished targets` : '',
          onDrafts ? `${onDrafts} skipped on draft posts this build renders (they apply in production)` : '',
        ].filter(Boolean);
        logger.info(
          `${active.length} redirects, ${activeGone.length} gone patterns injected` +
            (notes.length ? `; ${notes.join('; ')} (reports/redirects-skipped.json)` : ''),
        );
      },
    },
  };
}
