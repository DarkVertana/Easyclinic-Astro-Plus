import { describe, expect, it } from 'vitest';
import { refreshQueue, type RefreshPost } from '../../src/lib/admin/refresh';

const TODAY = '2026-11-06';
const base: RefreshPost = { slug: 'a', title: 'A', status: 'published', lastUpdated: '2026-10-01', owner: '/features/emr/', notes: [] };
const kinds = (post: Partial<RefreshPost>, insights: Parameters<typeof refreshQueue>[1] = null) =>
  refreshQueue([{ ...base, ...post }], insights, TODAY)[0]?.findings.map((f) => f.kind) ?? [];
const clicks = (now: number | null, before: number | null) => ({ rows: [{ slug: 'a', clicks: now, clicksPrevious: before }] });

describe('refreshQueue', () => {
  it('leaves a healthy published post out, with or without analytics', () => {
    expect(refreshQueue([base], null, TODAY)).toEqual([]);
    expect(refreshQueue([base], clicks(100, 100), TODAY)).toEqual([]);
  });

  it('flags staleness just past the threshold only, and accepts a Date', () => {
    expect(kinds({ lastUpdated: '2025-11-06' })).toEqual([]); // 365 days
    expect(kinds({ lastUpdated: '2025-11-05' })).toEqual(['stale']); // 366 days
    expect(kinds({ lastUpdated: new Date('2020-01-01') })).toEqual(['stale']);
  });

  it('treats a missing or invalid date as needing attention, and a future one as fine', () => {
    expect(kinds({ lastUpdated: null })).toEqual(['stale']);
    expect(kinds({ lastUpdated: 'soon' })).toEqual(['stale']);
    expect(kinds({ lastUpdated: '2027-01-01' })).toEqual([]);
  });

  it('flags a click loss of 30% or more, at the boundary', () => {
    expect(kinds({}, clicks(70, 100))).toEqual(['losing_clicks']);
    expect(kinds({}, clicks(71, 100))).toEqual([]);
    expect(kinds({}, clicks(0, 10))).toEqual(['losing_clicks']);
  });

  it('never flags new posts, small numbers or a failed source', () => {
    expect(kinds({}, clicks(5, 0))).toEqual([]);
    expect(kinds({}, clicks(0, 0))).toEqual([]);
    expect(kinds({}, clicks(1, 9))).toEqual([]);
    expect(kinds({}, clicks(null, null))).toEqual([]);
  });

  it('states the drop in words', () => {
    const [item] = refreshQueue([base], clicks(40, 100), TODAY);
    expect(item.findings[0].reason).toBe('Search clicks fell 60%, from 100 to 40, against the previous 28 days.');
  });

  it('flags a published post owned by /blog/, but not a draft for that', () => {
    expect(kinds({ owner: '/blog/' })).toEqual(['no_owner']);
    expect(kinds({ owner: '/blog/', status: 'draft' })).toEqual(['draft_other']);
  });

  it('gives drafts their reason from the notes', () => {
    const held = refreshQueue(
      [{ ...base, status: 'draft', notes: ['Imported. Needs the spec 5.18 pass.', 'Triage 2026-09-26: hold, an invented case study; merge into /features/emr/'] }],
      null,
      TODAY,
    )[0];
    expect(held.findings[0]).toEqual({ kind: 'draft_held', reason: 'Held back: an invented case study' });
    expect(kinds({ status: 'draft', notes: ['Imported. Needs the spec 5.18 pass.'] })).toEqual(['draft_not_rewritten']);
    expect(kinds({ status: 'draft' })).toEqual(['draft_other']);
    expect(kinds({ status: 'review' })).toEqual(['in_review']);
  });

  it('shortens a long reason at a word', () => {
    const long = 'word '.repeat(80).trim();
    const reason = refreshQueue([{ ...base, status: 'draft', notes: [`Triage 2026-09-26: hold, ${long}`] }], null, TODAY)[0].findings[0].reason;
    expect(reason.length).toBeLessThanOrEqual(161);
    expect(reason.endsWith('word…')).toBe(true);
  });

  it('puts the biggest loss first, drafts last, and keeps several reasons on one item', () => {
    const queue = refreshQueue(
      [
        { ...base, slug: 'd', title: 'D', status: 'draft' },
        { ...base, slug: 's', title: 'S', lastUpdated: '2020-01-01' },
        { ...base, slug: 'small', title: 'Small' },
        { ...base, slug: 'big', title: 'Big', owner: '/blog/' },
      ],
      { rows: [{ slug: 'small', clicks: 60, clicksPrevious: 100 }, { slug: 'big', clicks: 10, clicksPrevious: 100 }] },
      TODAY,
    );
    expect(queue.map((i) => i.slug)).toEqual(['big', 'small', 's', 'd']);
    expect(queue[0].findings.map((f) => f.kind)).toEqual(['losing_clicks', 'no_owner']);
  });
});
