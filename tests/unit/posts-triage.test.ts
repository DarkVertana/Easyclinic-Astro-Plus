import { describe, expect, it } from 'vitest';
import { describe as describeReason, parseHoldNote, resolveTarget, triageRows, type Hold, type Site, type SitePage, type SiteRedirect } from '../../scripts/posts-triage.ts';

const page = (path: string, collection: string, status = 'published', extra: Partial<SitePage> = {}): SitePage => ({ path, collection, status, ...extra });

function site(pages: SitePage[], holds: Array<[string, string]> = [], redirects: SiteRedirect[] = [], gone: Site['gone'] = []): Site {
  return {
    pages: new Map(pages.map((p) => [p.path, p])),
    holds: new Map(holds.map(([path, target]): [string, Hold] => [path, { path, target, reason: `reason for ${path}` }])),
    redirects,
    gone,
  };
}

const hubs = [
  page('/blog/', 'hubs'),
  page('/features/', 'hubs'),
  page('/solutions/', 'hubs'),
  page('/countries/', 'hubs'),
  page('/resources/', 'hubs'),
  page('/start-a-clinic/', 'hubs'),
];

describe('reading the triage hold note', () => {
  it('reads the reason and the last "merge into" path', () => {
    expect(parseHoldNote('Triage 2026-09-26: hold, duplicates the endocrinology post; merge into /clinic-management-system-for-endocrinologists/')).toEqual({
      reason: 'duplicates the endocrinology post',
      target: '/clinic-management-system-for-endocrinologists/',
    });
  });

  it('takes the last "merge into" when the reason mentions another merge', () => {
    const note = 'Triage 2026-09-26: hold, the allergy page was merged into /specialties/ already, so; merge into /features/lab/';
    expect(parseHoldNote(note)?.target).toBe('/features/lab/');
    expect(parseHoldNote(note)?.reason).toBe('the allergy page was merged into /specialties/ already, so');
  });

  it('accepts the wording variants', () => {
    expect(parseHoldNote('Triage 2026-09-26 - hold: too thin once cut. Merge it into `/features/emr`.')).toEqual({ reason: 'too thin once cut', target: '/features/emr/' });
    expect(parseHoldNote('Triage 2026-09-26: HOLD (thin); merge into /Trust/')).toEqual({ reason: 'thin', target: '/trust/' });
  });

  it('ignores other notes and reports a hold with no target', () => {
    expect(parseHoldNote('Triage 2026-09-26: kept. Owner /features/billing/.')).toBeNull();
    expect(parseHoldNote('Fact check 2026-09-26: merge into /x/')).toBeNull();
    expect(parseHoldNote('Triage 2026-09-26: hold, nothing left')).toEqual({ reason: 'nothing left', target: '' });
  });
});

describe('resolving a held post to a published page', () => {
  it('keeps a target that is already published', () => {
    const s = site([...hubs, page('/features/lab/', 'features'), page('/a/', 'posts', 'draft')], [['/a/', '/features/lab/']]);
    expect(resolveTarget('/a/', '/features/lab/', s)).toEqual({ finalTarget: '/features/lab/', steps: [] });
  });

  it('follows a held post to its own merge target, through several holds', () => {
    const s = site(
      [...hubs, page('/a/', 'posts', 'draft'), page('/b/', 'posts', 'draft'), page('/c/', 'posts', 'draft'), page('/features/emr/', 'features')],
      [
        ['/a/', '/b/'],
        ['/b/', '/c/'],
        ['/c/', '/features/emr/'],
      ],
    );
    const r = resolveTarget('/a/', '/b/', s);
    expect(r.finalTarget).toBe('/features/emr/');
    expect(r.steps).toEqual(['/b/ is held too and merges into /c/', '/c/ is held too and merges into /features/emr/']);
    expect(describeReason('too thin', r)).toBe('too thin. Merge target: /b/ is held too and merges into /c/; /c/ is held too and merges into /features/emr/');
  });

  it('stops on a cycle between held posts', () => {
    const s = site(
      [...hubs, page('/a/', 'posts', 'draft'), page('/b/', 'posts', 'draft'), page('/c/', 'posts', 'draft')],
      [
        ['/a/', '/b/'],
        ['/b/', '/c/'],
        ['/c/', '/b/'],
      ],
    );
    expect(() => resolveTarget('/a/', '/b/', s)).toThrow('/a/: the merge chain loops (/a/ -> /b/ -> /c/ -> /b/)');
  });

  it('never resolves to the post itself, directly or through a chain', () => {
    const s = site([...hubs, page('/a/', 'posts', 'draft'), page('/b/', 'posts', 'draft')], [
      ['/a/', '/b/'],
      ['/b/', '/a/'],
    ]);
    expect(() => resolveTarget('/a/', '/a/', s)).toThrow('/a/: the merge target is the post itself');
    expect(() => resolveTarget('/a/', '/b/', s)).toThrow('/a/: the merge chain returns to the post (/a/ -> /b/ -> /a/)');
  });

  it('falls back from a draft page to its hub', () => {
    const s = site([...hubs, page('/solutions/ngo-clinics/', 'solutions', 'draft', { hub: '/solutions/' })]);
    const r = resolveTarget('/a/', '/solutions/ngo-clinics/', s);
    expect(r.finalTarget).toBe('/solutions/');
    expect(r.steps).toEqual(['/solutions/ngo-clinics/ is a draft, so this uses its hub /solutions/ until it publishes']);
  });

  it('prefers the fallback redirects.yaml already gives a draft page over its hub', () => {
    const s = site(
      [...hubs, page('/pricing/india/', 'pricing'), page('/clinic-management-software-india/', 'country-pages', 'draft', { hub: '/countries/' })],
      [],
      [{ from: '/emr-software-in-india/', to: '/clinic-management-software-india/', fallback: '/pricing/india/' }],
    );
    expect(resolveTarget('/a/', '/clinic-management-software-india/', s).finalTarget).toBe('/pricing/india/');
  });

  it('uses the family hub for a draft page with no hub, and skips an unpublished hub', () => {
    const noHub = site([...hubs, page('/trust/', 'trust', 'draft')]);
    const r = resolveTarget('/a/', '/trust/', noHub);
    expect(r.finalTarget).toBe('/resources/');
    expect(r.steps[0]).toMatch(/\/trust\/ is a draft with no hub, so this uses \/resources\/, the hub for trust pages/);

    const draftHub = site([page('/features/', 'hubs', 'draft'), page('/features/lab/', 'features', 'draft', { hub: '/features/' })]);
    expect(() => resolveTarget('/a/', '/features/lab/', draftHub)).toThrow(/\/features\/ is draft and has no published page/);
  });

  it('follows a draft post that is not held to its owner, and a held post into a draft page', () => {
    const s = site(
      [
        ...hubs,
        page('/a/', 'posts', 'draft'),
        page('/b/', 'posts', 'draft'),
        page('/waiting-room/', 'posts', 'draft', { owner: '/features/appointment-scheduling/', hub: '/blog/' }),
        page('/features/appointment-scheduling/', 'features'),
        page('/integrations/', 'trust', 'draft'),
      ],
      [
        ['/a/', '/b/'],
        ['/b/', '/integrations/'],
      ],
      [{ from: '/custom-healthcare-software-development/', to: '/integrations/', fallback: '/features/' }],
    );
    expect(resolveTarget('/c/', '/waiting-room/', s)).toEqual({
      finalTarget: '/features/appointment-scheduling/',
      steps: ['/waiting-room/ is a draft post with no merge target, so this follows its owner /features/appointment-scheduling/'],
    });
    expect(resolveTarget('/a/', '/b/', s).finalTarget).toBe('/features/');
  });

  it('follows a redirect source and rejects unknown or gone targets', () => {
    const s = site([...hubs], [], [{ from: '/nephrology-emr/', to: '/specialties/' }, { from: '/x/', to: '/features/' }], [{ path: '/humanoid-robots/' }]);
    expect(() => resolveTarget('/a/', '/nephrology-emr/', s)).toThrow('/a/: merge target /specialties/ is not a page in src/content or a redirect source');
    expect(resolveTarget('/a/', '/x', s)).toEqual({ finalTarget: '/features/', steps: ['/x/ is not a page and redirects to /features/'] });
    expect(() => resolveTarget('/a/', '/humanoid-robots/', s)).toThrow(/gone \(410\)/);
    expect(() => resolveTarget('/a/', '/nowhere/', s)).toThrow('/a/: merge target /nowhere/ is not a page in src/content or a redirect source');
  });
});

describe('the triage rows', () => {
  it('lists every held post with its resolved target, and collects errors instead of writing a bad row', () => {
    const s = site(
      [...hubs, page('/a/', 'posts', 'draft'), page('/b/', 'posts', 'draft'), page('/c/', 'posts', 'draft'), page('/d/', 'posts', 'draft'), page('/features/lab/', 'features')],
      [
        ['/b/', '/features/lab/'],
        ['/a/', '/b/'],
        ['/c/', '/d/'],
        ['/d/', '/c/'],
      ],
    );
    const out = triageRows(s);
    expect(out.rows.map((r) => [r.path, r.target, r.final_target])).toEqual([
      ['/a/', '/b/', '/features/lab/'],
      ['/b/', '/features/lab/', '/features/lab/'],
    ]);
    expect(out.resolved.map((r) => r.path)).toEqual(['/a/']);
    expect(out.errors).toEqual(['/c/: the merge chain returns to the post (/c/ -> /d/ -> /c/)', '/d/: the merge chain returns to the post (/d/ -> /c/ -> /d/)']);
  });
});
