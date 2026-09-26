import { readFileSync } from 'node:fs';

/** Every content page in the last build, from the build manifest. */
export function builtPages(): Array<{ path: string; family: string; status: string }> {
  const manifest = JSON.parse(readFileSync('.vercel/output/build-manifest.json', 'utf8'));
  return manifest.pages.filter((p: { collection: string }) => p.collection !== 'static');
}
