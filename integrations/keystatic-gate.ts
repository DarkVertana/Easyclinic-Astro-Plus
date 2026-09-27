import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import type { AstroIntegration } from 'astro';
import { keystaticDecision, rewriteKeystaticDevUrl } from './keystatic-core.ts';

/**
 * Adds the Keystatic editing screen (/keystatic/) and its React renderer, but never to production.
 *
 * - `astro dev`: on, local storage (edits the files in this checkout). Open http://127.0.0.1:4321/keystatic/.
 * - A build with KEYSTATIC_STORAGE=github and KEYSTATIC_GITHUB_REPO=owner/name (a preview deployment): on, GitHub
 *   storage. Any other build, the production stage, a Vercel production deployment and Vitest: off. Neither
 *   integration is added, so no React renderer, /keystatic/ route or admin middleware exists in the www build.
 *   (Both packages are imported statically: the config's Vite module runner is closed by the time hooks run, so a
 *   dynamic import here fails. Importing them only defines the integration functions.)
 *
 * When on, it also rewrites admin URLs in dev (see rewriteKeystaticDevUrl) and registers the admin CSP middleware
 * (integrations/keystatic-middleware.ts). Design: docs/keystatic-design.md section 3.
 */
export default function keystaticGate(): AstroIntegration {
  return {
    name: 'easyclinic:keystatic-gate',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig, addMiddleware, logger }) => {
        const env = { ...loadDotEnv(config.root, command === 'dev' ? 'development' : 'production'), ...process.env };
        const decision = keystaticDecision(env, command);
        if (!decision.enabled) {
          logger.debug(`Keystatic off: ${decision.reason}`);
          return;
        }

        updateConfig({
          integrations: [react(), keystatic()],
          vite: {
            // keystatic.config.ts runs in the browser, where only PUBLIC_* variables exist.
            define: {
              'import.meta.env.KEYSTATIC_STORAGE': JSON.stringify(decision.storage),
              'import.meta.env.KEYSTATIC_GITHUB_REPO': JSON.stringify(decision.repo ?? ''),
            },
            plugins: [
              {
                // Runs ahead of Astro's dev trailing-slash check: this plugin's post hook runs after Astro's (integration
                // plugins come after Astro's core plugins), so its unshift lands in front. No `enforce: 'pre'`.
                name: 'easyclinic:keystatic-dev-urls',
                configureServer(server) {
                  return () => {
                    server.middlewares.stack.unshift({
                      route: '',
                      handle: (req: { url?: string }, _res: unknown, next: () => void) => {
                        if (req.url) req.url = rewriteKeystaticDevUrl(req.url);
                        next();
                      },
                    });
                  };
                },
              },
            ],
          },
        });
        addMiddleware({ order: 'pre', entrypoint: new URL('./keystatic-middleware.ts', import.meta.url) });
        logger.info(`Keystatic on (${decision.reason}): /keystatic/`);
      },
    },
  };
}

/**
 * The .env files Vite would load for this mode (Astro does not put them in process.env at config time). Later
 * files win, and process.env wins over all of them.
 */
function loadDotEnv(root: URL, mode: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const file = new URL(name, root);
    if (existsSync(file)) Object.assign(out, parseEnv(readFileSync(file, 'utf8')));
  }
  return out;
}
