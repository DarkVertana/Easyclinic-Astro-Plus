/**
 * Node module hooks that let plain `node` load the content schemas outside Vite: `astro:content` resolves to a
 * small stub, and extensionless relative imports resolve to their `.ts` file. Used by scripts/lint-content.ts.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STUB = new URL('./astro-content-stub.ts', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'astro:content') return { url: STUB, shortCircuit: true };
  if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.startsWith('file:')) {
    for (const suffix of ['.ts', '/index.ts']) {
      const url = new URL(specifier + suffix, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
