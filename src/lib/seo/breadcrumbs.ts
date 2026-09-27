import type { PageRecord, Registry } from '../content/registry.ts';

export interface Crumb {
  label: string;
  path: string;
}

/**
 * Home > hub > page, from `links.hub` (spec 2.10, 7.7). When the hub is not rendered in this stage (a draft in
 * production), the trail falls back to that hub's own `links.hub`, so a published page under a draft parent still
 * links up (/kenyademo/ shows Home > Countries > demo until /emr-software-in-kenya/ publishes). The YAML keeps the
 * real parent, so the full trail returns by itself once it publishes.
 */
export function breadcrumbTrail(record: PageRecord, registry: Registry): Crumb[] {
  if (record.path === '/') return [];
  const trail: Crumb[] = [{ label: 'Home', path: '/' }];
  const seen = new Set<string>([record.path]);
  let hubPath = record.data.links.hub;
  while (hubPath && hubPath !== '/' && !seen.has(hubPath)) {
    seen.add(hubPath);
    const hub = registry.get(hubPath);
    if (!hub) break;
    const resolved = registry.urlFor(hubPath);
    if (resolved) {
      trail.push({ label: hub.label, path: resolved });
      break;
    }
    hubPath = hub.data.links.hub;
  }
  trail.push({ label: record.label, path: record.path });
  return trail;
}
