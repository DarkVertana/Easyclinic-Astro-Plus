import type { Registry } from '../content/registry.ts';

export interface SitemapFamily {
  family: string;
  lastmod?: string;
  urls: Array<{ loc: string; lastmod?: string }>;
}

/** Indexable pages grouped by family. Empty until pages are published in a production build. */
export function sitemapFamilies(registry: Registry): SitemapFamily[] {
  const groups = new Map<string, SitemapFamily>();
  for (const record of registry.pages) {
    if (!record.indexable) continue;
    const family = record.family.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const lastmod = record.data.lastUpdated?.toISOString().slice(0, 10);
    const group = groups.get(family) ?? { family, urls: [] };
    group.urls.push({ loc: `https://www.easyclinic.io${record.path}`, lastmod });
    if (lastmod && (!group.lastmod || lastmod > group.lastmod)) group.lastmod = lastmod;
    groups.set(family, group);
  }
  return [...groups.values()];
}
