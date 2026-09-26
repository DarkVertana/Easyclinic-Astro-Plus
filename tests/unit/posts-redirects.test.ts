import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { resolveRules } from '../../integrations/routes-core.ts';
import { parseCsv, parseCsvRecords, stringifyCsv } from '../../scripts/lib/csv.ts';
import { generatePostRules, isConfirmed, renderGoneYaml, renderRedirectsYaml, type ManifestRow } from '../../scripts/lib/posts-rules.ts';

const row = (path: string, decision: string, target: string, confirmed = ''): ManifestRow => ({
  path,
  research_class: 'X',
  proposed_decision: decision,
  target,
  owner_page: '',
  reason: '',
  confirmed,
});
const none = { redirects: [], gone: [] };

describe('posts manifest gating', () => {
  it('generates nothing until marketing confirms a row', () => {
    const out = generatePostRules([row('/ai-in-ivf/', 'merge', '/ai/'), row('/humanoid-robots/', 'drop', '410')], none);
    expect(out.redirects).toEqual([]);
    expect(out.gone).toEqual([]);
    expect(out.errors).toEqual([]);
  });

  it('turns confirmed merge rows into 301s and confirmed drop rows into 410s', () => {
    const out = generatePostRules([row('/ai-in-ivf/', 'merge', '/ai/', 'yes'), row('/humanoid-robots/', 'drop', '410', 'yes')], none);
    expect(out.redirects).toEqual([{ from: '/ai-in-ivf/', to: '/ai/', note: 'posts manifest: merge (confirmed)' }]);
    expect(out.gone).toEqual([{ path: '/humanoid-robots/', note: 'posts manifest: drop (confirmed)' }]);
  });

  it('never generates rules for keep or review rows, even when confirmed', () => {
    const out = generatePostRules([row('/clinic-cash-flow/', 'keep', '/clinic-cash-flow/', 'yes'), row('/staff-scheduling/', 'review', '/staff-scheduling/', 'yes')], none);
    expect(out.redirects).toEqual([]);
    expect(out.gone).toEqual([]);
    expect(out.skipped.map((s) => s.path)).toEqual(['/clinic-cash-flow/', '/staff-scheduling/']);
  });

  it('accepts only "yes" (any case), and warns about other values', () => {
    expect(isConfirmed(' Yes ')).toBe(true);
    expect(isConfirmed('y')).toBe(false);
    expect(isConfirmed('TRUE')).toBe(false);
    const out = generatePostRules([row('/a/', 'merge', '/ai/', 'y'), row('/b/', 'merge', '/ai/', 'no')], none);
    expect(out.redirects).toEqual([]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/\/a\/.*only "yes"/);
  });

  it('normalises paths and sorts output', () => {
    const out = generatePostRules([row('/z-post', 'merge', 'ai', 'yes'), row('/a-post/', 'merge', '/ai/', 'yes')], none);
    expect(out.errors).toEqual(['/z-post/: merge target "ai" is not a path']);
    expect(out.redirects.map((r) => r.from)).toEqual(['/a-post/']);
  });

  it('rejects merge rows that point at themselves, unknown decisions and duplicates', () => {
    const out = generatePostRules(
      [row('/physio/', 'merge', '/physio/', 'yes'), row('/x/', 'archive', '', 'yes'), row('/y/', 'drop', '410', 'yes'), row('/y', 'drop', '410', 'yes')],
      none,
    );
    expect(out.errors).toEqual(['/physio/: merge target is the post itself', '/x/: unknown decision "archive" (expected keep, merge, drop or review)', '/y/: listed twice in the manifest']);
  });

  it('leaves posts already covered by hand-written rows to those rows, warning on disagreement', () => {
    const existing = {
      redirects: [{ from: '/payor-management-system/', to: '/features/insurance-claims/' }],
      gone: [{ path: '/wp-admin/', match: 'prefix' as const }],
    };
    const out = generatePostRules(
      [row('/payor-management-system/', 'merge', '/ent-emr-software/', 'yes'), row('/wp-admin/old-post/', 'drop', '410', 'yes')],
      existing,
    );
    expect(out.redirects).toEqual([]);
    expect(out.gone).toEqual([]);
    expect(out.skipped).toHaveLength(2);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/ent-emr-software.*redirects\.yaml/);
  });
});

describe('generated rows go through the same validation as hand-written ones', () => {
  const built = new Set(['/', '/ai/', '/features/emr/']);
  it('a generated redirect that loops with a hand-written one fails', () => {
    const generated = generatePostRules([row('/smart-emr-for-clinics/', 'merge', '/emr-landing-page/', 'yes')], none);
    const { errors } = resolveRules([{ from: '/emr-landing-page/', to: '/smart-emr-for-clinics/' }, ...generated.redirects], [], built);
    expect(errors.join()).toMatch(/Redirect loop/);
  });
  it('a generated 410 or redirect on a built page fails', () => {
    const generated = generatePostRules([row('/ai/', 'drop', '410', 'yes'), row('/features/emr/', 'merge', '/', 'yes')], none);
    const { errors } = resolveRules(generated.redirects, generated.gone, built);
    expect(errors.filter((e) => /matches built page/.test(e))).toHaveLength(2);
  });
  it('generated chains collapse to one hop', () => {
    const generated = generatePostRules([row('/ai-medical-scribes/', 'merge', '/emr-landing-page/', 'yes')], none);
    const { active } = resolveRules([{ from: '/emr-landing-page/', to: '/features/emr/' }, ...generated.redirects], [], built);
    expect(active.find((r) => r.from === '/ai-medical-scribes/')?.to).toBe('/features/emr/');
  });
});

describe('generated YAML', () => {
  it('carries the generated header and parses back to the same rows', () => {
    const redirects = [{ from: '/ai-in-ivf/', to: '/ai/', note: 'posts manifest: merge (confirmed)' }];
    const gone = [{ path: '/humanoid-robots/', note: 'posts manifest: drop (confirmed)' }];
    const r = renderRedirectsYaml(redirects);
    const g = renderGoneYaml(gone);
    expect(r).toMatch(/^# GENERATED by scripts\/posts-redirects\.ts/);
    expect(r).toMatch(/Do not edit by hand/);
    expect(parseYaml(r)).toEqual(redirects);
    expect(parseYaml(g)).toEqual(gone);
  });
  it('writes an explicit empty list when nothing is confirmed', () => {
    expect(parseYaml(renderRedirectsYaml([]))).toEqual([]);
    expect(parseYaml(renderGoneYaml([]))).toEqual([]);
  });
});

describe('csv', () => {
  it('round-trips quoted fields with commas, quotes and newlines', () => {
    const rows = [
      ['path', 'reason'],
      ['/a/', 'plain'],
      ['/b/', 'has, comma and "quotes"\nand a newline'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
  it('reads records with a trailing empty column', () => {
    const { header, records } = parseCsvRecords('path,decision,confirmed\n/a/,merge,\n/b/,drop,yes\n');
    expect(header).toEqual(['path', 'decision', 'confirmed']);
    expect(records).toEqual([
      { path: '/a/', decision: 'merge', confirmed: '' },
      { path: '/b/', decision: 'drop', confirmed: 'yes' },
    ]);
  });
});
