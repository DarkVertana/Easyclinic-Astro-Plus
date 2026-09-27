import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { resolveRules, yieldingPaths } from '../../integrations/routes-core.ts';
import { parseCsv, parseCsvRecords, stringifyCsv } from '../../scripts/lib/csv.ts';
import {
  generatePostRules,
  isConfirmed,
  leftoverPosts,
  parsePostFile,
  renderGoneYaml,
  renderRedirectsYaml,
  type ManifestRow,
  type PostFile,
} from '../../scripts/lib/posts-rules.ts';

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

describe('confirmed rows whose post is still in src/content/posts', () => {
  const post = (id: string, status: string): PostFile => parsePostFile(id, `src/content/posts/${id}/index.mdx`, `---\nstatus: ${status}\ntitle: x\n---\n\nBody.\n`);
  const posts = (...files: PostFile[]) => new Map(files.map((f) => [f.path, f]));
  const rows = [
    row('/ai-allergy-clinic-software/', 'merge', '/specialties/', 'yes'),
    row('/old-robot-post/', 'drop', '410', 'yes'),
    row('/clinic-cash-flow/', 'keep', '/clinic-cash-flow/', 'yes'),
    row('/unconfirmed-post/', 'merge', '/specialties/', ''),
  ];

  it('reads a post file as the registry does: status from frontmatter, path from `path` or the folder name', () => {
    expect(post('ai-allergy-clinic-software', 'draft')).toEqual({ path: '/ai-allergy-clinic-software/', file: 'src/content/posts/ai-allergy-clinic-software/index.mdx', status: 'draft' });
    expect(parsePostFile('x', 'f', '---\npath: /blog/x\nstatus: published\n---\n').path).toBe('/blog/x/');
    expect(parsePostFile('x', 'f', 'no frontmatter')).toEqual({ path: '/x/', file: 'f', status: '' });
  });

  it('says a draft can be deleted once its redirect or 410 is live, for each confirmed merge or drop', () => {
    const out = generatePostRules(rows, none);
    expect(out.removals.map((r) => [r.path, r.rule])).toEqual([
      ['/ai-allergy-clinic-software/', '301 to /specialties/'],
      ['/old-robot-post/', '410'],
    ]);
    const leftovers = leftoverPosts(out.removals, posts(post('ai-allergy-clinic-software', 'draft'), post('old-robot-post', 'draft'), post('clinic-cash-flow', 'published'), post('unconfirmed-post', 'draft')));
    expect(leftovers.map((l) => [l.path, l.ok])).toEqual([
      ['/ai-allergy-clinic-software/', true],
      ['/old-robot-post/', true],
    ]);
    expect(leftovers[0].message).toMatch(/draft src\/content\/posts\/ai-allergy-clinic-software\/index\.mdx can be deleted once the redirect \(301 to \/specialties\/\) is live/);
    expect(leftovers[1].message).toMatch(/can be deleted once the 410 is live/);
  });

  it('prints nothing for a confirmed row whose post was already deleted', () => {
    expect(leftoverPosts(generatePostRules(rows, none).removals, posts())).toEqual([]);
  });

  it('warns that the build fails when the post is published or in review', () => {
    const out = generatePostRules(rows, none);
    const leftovers = leftoverPosts(out.removals, posts(post('ai-allergy-clinic-software', 'published'), post('old-robot-post', 'review')));
    expect(leftovers.map((l) => l.ok)).toEqual([false, false]);
    expect(leftovers[0].message).toMatch(/status published, so the build fails on the redirect.*status: draft or delete it/);
    expect(leftovers[1].message).toMatch(/status review, so the build fails on the 410/);
  });

  it('covers posts left to hand-written rows too, and a draft under a prefix rule is not accepted', () => {
    const existing = {
      redirects: [{ from: '/payor-management-system/', to: '/features/insurance-claims/' }],
      gone: [{ path: '/wp-admin/', match: 'prefix' as const }],
    };
    const out = generatePostRules([row('/payor-management-system/', 'merge', '/features/insurance-claims/', 'yes'), row('/wp-admin/old-post/', 'drop', '410', 'yes')], existing);
    const leftovers = leftoverPosts(out.removals, posts(post('payor-management-system', 'draft'), { path: '/wp-admin/old-post/', file: 'f', status: 'draft' }));
    expect(leftovers.map((l) => [l.path, l.ok])).toEqual([
      ['/payor-management-system/', true],
      ['/wp-admin/old-post/', false],
    ]);
    expect(leftovers[0].message).toMatch(/redirect \(301 to \/features\/insurance-claims\/\)/);
    expect(leftovers[1].message).toMatch(/prefix rule.*delete the draft/);
  });

  it('the generated rules then pass the build: skipped on the draft in preview, served in production', () => {
    const out = generatePostRules(rows, none);
    const pages = [
      { path: '/specialties/', collection: 'hubs', status: 'published' },
      { path: '/ai-allergy-clinic-software/', collection: 'posts', status: 'draft' },
      { path: '/old-robot-post/', collection: 'posts', status: 'draft' },
    ];
    const preview = resolveRules(out.redirects, out.gone, new Set(pages.map((p) => p.path)), yieldingPaths(pages));
    expect(preview.errors).toEqual([]);
    expect(preview.active).toEqual([]);
    expect(preview.activeGone).toEqual([]);
    expect(preview.skipped.map((s) => s.draft)).toEqual(['/ai-allergy-clinic-software/']);
    expect(preview.skippedGone.map((s) => s.draft)).toEqual(['/old-robot-post/']);
    const published = pages.filter((p) => p.status === 'published');
    const production = resolveRules(out.redirects, out.gone, new Set(published.map((p) => p.path)), yieldingPaths(published));
    expect(production.errors).toEqual([]);
    expect(production.active.map((r) => r.from)).toEqual(['/ai-allergy-clinic-software/']);
    expect(production.activeGone.map((g) => g.path)).toEqual(['/old-robot-post/']);
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
