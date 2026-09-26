import type { PageRecord, Registry } from '../content/registry.ts';

export interface Crumb {
  label: string;
  path: string;
}

/** Home > hub > page, from `links.hub` (spec 2.10, 7.7). Hubs that are not rendered are skipped. */
export function breadcrumbTrail(record: PageRecord, registry: Registry): Crumb[] {
  if (record.path === '/') return [];
  const trail: Crumb[] = [{ label: 'Home', path: '/' }];
  const hubPath = record.data.links.hub;
  if (hubPath && hubPath !== '/') {
    const hub = registry.get(hubPath);
    const resolved = registry.urlFor(hubPath);
    if (hub && resolved) trail.push({ label: hub.label, path: resolved });
  }
  trail.push({ label: record.label, path: record.path });
  return trail;
}
