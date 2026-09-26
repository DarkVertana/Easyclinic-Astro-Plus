/**
 * Legacy URL coverage: follows each legacy URL through the emulated Vercel routing of a build and
 * classifies the result (plan Phase 4: every legacy URL returns 200, a one-hop 301 or a 410).
 * Pure functions; scripts/check-coverage.ts does the I/O.
 */
import { hasExtension, isExternal, matchesRule, normalizePath, type RedirectRule } from '../../integrations/routes-core.ts';
import type { LegacyRow } from './legacy.ts';
import { isConfirmed, type ManifestRow } from './posts-rules.ts';
import type { Resolution, Router } from './vercel-router.ts';

export const PASS_CLASSES = ['200', '301', '410', 'expected-404'] as const;
export const FAIL_CLASSES = ['404', 'temporary', 'chain', 'redirect-to-missing', 'loop'] as const;
export type CoverageClass = (typeof PASS_CLASSES)[number] | (typeof FAIL_CLASSES)[number];

const SEVERITY: Record<CoverageClass, number> = {
  '200': 0,
  '301': 0,
  '410': 0,
  'expected-404': 0,
  temporary: 1,
  chain: 2,
  'redirect-to-missing': 3,
  '404': 4,
  loop: 5,
};

/** Permanent redirect statuses: 301 from our rules, 308 from the adapter's trailing-slash route. */
const PERMANENT = new Set([301, 308]);

export const isFailure = (cls: CoverageClass) => (FAIL_CLASSES as readonly string[]).includes(cls);

export interface Hop {
  from: string;
  status: number;
  to: string;
}

export interface Trace {
  request: string;
  hops: Hop[];
  /** The last response: a status plus what served it. */
  final: { status: number; path: string; kind: Resolution['kind'] | 'external' };
  loop: boolean;
}

/** Follows redirects the way a crawler would, up to `maxHops`. */
export function traceUrl(router: Router, host: string, request: string, maxHops = 10): Trace {
  const hops: Hop[] = [];
  const seen = new Set<string>();
  let path = request;
  for (;;) {
    seen.add(path);
    const res = router.resolve({ pathname: path, host });
    if (res.kind !== 'redirect') return { request, hops, final: { status: res.status ?? 200, path, kind: res.kind }, loop: false };
    const location = res.location;
    hops.push({ from: path, status: res.status, to: location });
    if (isExternal(location)) {
      const url = new URL(location);
      // An absolute URL back to this host is followed like a path.
      if (url.hostname !== host) return { request, hops, final: { status: 0, path: location, kind: 'external' }, loop: false };
      path = url.pathname;
    } else {
      path = location.split('?')[0].split('#')[0];
    }
    if (seen.has(path) || hops.length >= maxHops) return { request, hops, final: { status: 0, path, kind: 'redirect' }, loop: true };
  }
}

export function classifyTrace(trace: Trace, expected: '' | '404'): { cls: CoverageClass; detail: string } {
  const { hops, final } = trace;
  const via = hops.map((h) => `${h.status} ${h.to}`).join(' -> ');
  if (trace.loop) return { cls: 'loop', detail: `${trace.request} -> ${via}` };
  // The no-slash form of any path gets the adapter's 308 first; for an intended 404 that is still a 404.
  if (expected === '404' && final.status === 404) return { cls: 'expected-404', detail: hops.length ? via : '' };
  if (!hops.length) {
    if (final.status === 410) return { cls: '410', detail: '' };
    if (final.status === 404) return { cls: '404', detail: '' };
    if (final.status >= 200 && final.status < 300) return { cls: '200', detail: final.kind === 'function' ? 'on-demand route' : '' };
    return { cls: '404', detail: `returns ${final.status}` };
  }
  const reached = final.kind === 'external' || (final.status >= 200 && final.status < 300);
  if (!reached) return { cls: 'redirect-to-missing', detail: `${via} (returns ${final.status})` };
  if (hops.length > 1) return { cls: 'chain', detail: `${hops.length} hops: ${via}` };
  const hop = hops[0];
  const note = final.kind === 'external' ? ' (external target, not checked)' : '';
  // A 302 or 307 keeps the old URL in the index and passes no ranking: the launch gate wants a 301.
  if (!PERMANENT.has(hop.status)) return { cls: 'temporary', detail: `${hop.status} ${hop.to}${note}` };
  return { cls: '301', detail: `${hop.status} ${hop.to}${note}` };
}

/** Both forms of a directory-style URL; file-like paths (/xmlrpc.php) were only ever served one way. */
export function requestForms(path: string): string[] {
  const p = normalizePath(path);
  if (p === '/' || hasExtension(p)) return [p];
  return [p, p.replace(/\/$/, '')];
}

export function worstClass(classes: CoverageClass[]): CoverageClass {
  return classes.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a));
}

/** Everything that can explain a legacy URL's result, read from the build and the migration files. */
export interface ReasonContext {
  /** Redirects the build left out because their target is not built (build manifest skippedRedirects). */
  skippedRedirects: Array<{ rule: RedirectRule; reason?: string }>;
  /** Content entries not rendered in this stage (build manifest `hidden`). */
  hidden: Array<{ path: string; status: string; collection: string }>;
  /** Pages built in this stage (a preview build renders drafts too). */
  pages: Array<{ path: string; status: string }>;
  manifest: Map<string, ManifestRow>;
  /** Paths the generated post files already cover (so a stale generated file can be told apart). */
  generatedPostPaths: Set<string>;
}

export interface Reason {
  /** Short, groupable cause. */
  key: string;
  detail?: string;
}

export function reasonFor(row: LegacyRow, cls: CoverageClass, ctx: ReasonContext): Reason | undefined {
  const path = row.path;
  if (cls === 'expected-404') return { key: 'owner decision: directory pages are skipped and fall through to the 404' };
  if (cls === '200') {
    const page = ctx.pages.find((p) => p.path === path);
    if (page && page.status !== 'published') return { key: `renders in preview only (status: ${page.status})` };
    return undefined;
  }
  if (!isFailure(cls)) return undefined;
  if (cls === 'temporary') return { key: 'temporary redirect: set status 301 on the rule (or drop the status to get the default)' };

  const skipped = ctx.skippedRedirects.find((s) => matchesRule(path, s.rule.from, s.rule.match));
  if (skipped) return { key: 'redirect waiting for unpublished target (reports/redirects-skipped.json)', detail: `-> ${skipped.rule.to}` };

  const hidden = ctx.hidden.find((h) => h.path === path);
  if (hidden) return { key: `page is a ${hidden.status} (not rendered in this stage)`, detail: hidden.collection };

  const post = ctx.manifest.get(path);
  if (post) {
    const decision = post.proposed_decision.trim().toLowerCase();
    const target = decision === 'merge' ? ` to ${post.target}` : '';
    if ((decision === 'merge' || decision === 'drop') && isConfirmed(post.confirmed) && !ctx.generatedPostPaths.has(path)) {
      return { key: 'confirmed in the posts manifest but not generated: run node scripts/posts-redirects.ts', detail: `${decision}${target}` };
    }
    if (decision === 'keep') return { key: 'post to keep: not imported or not published yet', detail: post.owner_page ? `owner ${post.owner_page}` : undefined };
    return { key: `post awaiting marketing decision: manifest says ${decision}`, detail: target.trim() || undefined };
  }

  if (row.sources.includes('known:sitemap-file')) return { key: 'legacy sitemap file: no redirect or 410 decided' };
  if (row.sources.length && row.sources.every((s) => s === 'staging-sitemap')) return { key: 'staging-only URL: no page, redirect or 410' };
  if (row.sources.some((s) => s.startsWith('known:'))) return { key: `known legacy path (${row.sources.filter((s) => s.startsWith('known:')).map((s) => s.slice(6)).join(', ')}): no page, redirect or 410` };
  return { key: 'no page, redirect or 410 for this URL' };
}

export interface CoverageRow {
  path: string;
  sources: string[];
  expected: '' | '404';
  cls: CoverageClass;
  reason?: Reason;
  forms: Array<{ request: string; cls: CoverageClass; detail: string; hops: Hop[]; final: Trace['final'] }>;
}

export function checkRow(router: Router, host: string, row: LegacyRow, ctx: ReasonContext): CoverageRow {
  const forms = requestForms(row.path).map((request) => {
    const trace = traceUrl(router, host, request);
    const { cls, detail } = classifyTrace(trace, row.expected);
    return { request, cls, detail, hops: trace.hops, final: trace.final };
  });
  // The canonical (slash) form sets the class unless another form fails worse.
  const worst = worstClass(forms.map((f) => f.cls));
  const cls = isFailure(worst) ? worst : forms[0].cls;
  return { path: row.path, sources: row.sources, expected: row.expected, cls, reason: reasonFor(row, cls, ctx), forms };
}

export function summarise(rows: CoverageRow[]): Record<CoverageClass, number> {
  const counts = Object.fromEntries([...PASS_CLASSES, ...FAIL_CLASSES].map((c) => [c, 0])) as Record<CoverageClass, number>;
  for (const row of rows) counts[row.cls]++;
  return counts;
}

export interface CoverageReport {
  generatedAt: string;
  stage: string;
  host: string;
  total: number;
  failures: number;
  summary: Record<CoverageClass, number>;
  rows: CoverageRow[];
}

const DESCRIBE: Record<CoverageClass, string> = {
  '200': 'Served by a built page',
  '301': 'One permanent redirect to a page that returns 200',
  '410': 'Gone, with a body',
  'expected-404': '404 by owner decision (/doctors/, /clinics/)',
  '404': 'Not found',
  temporary: 'One temporary redirect (302 or 307) instead of a 301',
  chain: 'More than one redirect before a 200',
  'redirect-to-missing': 'Redirects to something that does not return 200',
  loop: 'Redirect loop',
};

export function renderMarkdown(report: CoverageReport): string {
  const lines: string[] = [];
  const pct = (n: number) => (report.total ? `${((n / report.total) * 100).toFixed(1)}%` : '0%');
  lines.push('# Legacy URL coverage', '');
  lines.push(
    `Generated ${report.generatedAt} by \`pnpm coverage\` from \`migration/legacy-urls.csv\` against the **${report.stage}** build in \`.vercel/output\`, routed as \`${report.host}\`. Each URL is checked with and without its trailing slash (file-like paths only as written).`,
    '',
  );
  lines.push(
    report.failures
      ? `**${report.failures} of ${report.total} legacy URLs fail** (${pct(report.failures)}). Launch needs 0: \`pnpm coverage --strict\`.`
      : `**All ${report.total} legacy URLs pass.**`,
    '',
  );
  lines.push('| Result | URLs | Share | Meaning |', '| --- | ---: | ---: | --- |');
  for (const cls of [...PASS_CLASSES, ...FAIL_CLASSES]) {
    lines.push(`| ${isFailure(cls) ? `**${cls}**` : cls} | ${report.summary[cls]} | ${pct(report.summary[cls])} | ${DESCRIBE[cls]} |`);
  }
  lines.push('');

  const failing = report.rows.filter((r) => isFailure(r.cls));
  if (failing.length) {
    lines.push('## Failures by reason', '');
    const groups = new Map<string, CoverageRow[]>();
    for (const row of failing) {
      const key = `${row.cls}: ${row.reason?.key ?? 'unknown'}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const [key, rows] of [...groups].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
      lines.push(`### ${key} (${rows.length})`, '');
      for (const row of rows) {
        const worst = row.forms.filter((f) => f.cls === row.cls);
        const passing = row.forms.filter((f) => !isFailure(f.cls));
        const formNote = passing.length ? ` (fails as \`${worst.map((f) => f.request).join('`, `')}\`)` : '';
        const detail = [row.reason?.detail, ...worst.map((f) => f.detail)].filter(Boolean).join('; ');
        lines.push(`- \`${row.path}\`${formNote}${detail ? `: ${detail}` : ''}`);
      }
      lines.push('');
    }
  }

  const notes = report.rows.filter((r) => !isFailure(r.cls) && r.reason && r.cls !== 'expected-404');
  if (notes.length) {
    lines.push('## Passing now, but only in this stage', '');
    for (const row of notes) lines.push(`- \`${row.path}\` (${row.cls}): ${row.reason!.key}`);
    lines.push('');
  }
  return lines.join('\n');
}
