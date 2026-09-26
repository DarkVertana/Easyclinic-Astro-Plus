import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { buildRoutes, injectRoutes, resolveRules, type GoneRule, type RedirectRule } from './routes-core.ts';

export interface BuildManifest {
  stage: 'preview' | 'production';
  indexingEnabled: boolean;
  canonicalHost: string;
  pages: Array<{ path: string; collection: string; id: string; status: string; indexable: boolean; title: string }>;
  redirects: RedirectRule[];
  gone: GoneRule[];
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
  return {
    name: 'easyclinic:vercel-routes',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
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
        const { active, skipped, errors } = resolveRules(manifest.redirects, manifest.gone, built);
        if (errors.length) {
          throw new Error(`vercel-routes: invalid redirect data\n  - ${errors.join('\n  - ')}`);
        }

        const routes = buildRoutes({
          redirects: active,
          gone: manifest.gone,
          canonicalHost: manifest.canonicalHost,
          indexingEnabled: manifest.indexingEnabled,
        });

        const vercelConfig = JSON.parse(await readFile(configFile, 'utf8'));
        vercelConfig.routes = injectRoutes(vercelConfig.routes, routes);
        await writeFile(configFile, `${JSON.stringify(vercelConfig, null, '\t')}\n`);

        // The manifest is build metadata, not a public file: move it out of the static root so
        // post-build tools can still read it.
        await writeFile(new URL(MANIFEST_FILE, outDir), JSON.stringify({ ...manifest, activeRedirects: active, skippedRedirects: skipped }, null, 2));
        await rm(publicManifest);

        const reportsDir = new URL('reports/', root);
        await mkdir(reportsDir, { recursive: true });
        await writeFile(new URL('redirects-skipped.json', reportsDir), JSON.stringify(skipped, null, 2));

        logger.info(
          `${active.length} redirects, ${manifest.gone.length} gone patterns injected` +
            (skipped.length ? `; ${skipped.length} waiting for unpublished targets (reports/redirects-skipped.json)` : ''),
        );
      },
    },
  };
}
