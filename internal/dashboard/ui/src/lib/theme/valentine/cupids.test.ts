import { describe, expect, it } from 'vitest';
import { seeded } from '../test-scene';
import { around, type Box } from './air';
import { where } from './cupid';
import { arrowAt, createCupids, reconcileCupids, restingCupids, stepCupids, type Cupids } from './cupids';
import { airFor, page, still } from './fixtures';
import { FOOTPRINTS } from './footprints';

const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Runs the group in 16ms frames from `from` for `ms`, with a cursor.
function run(group: Cupids, ms: number, cursor: ReturnType<typeof still> | null, from = 0, air = airFor(), rand = seeded(7)) {
  return Array.from({ length: Math.ceil(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce<{ g: Cupids; seen: Cupids[] }>(
    ({ g, seen }, t) => {
      const next = stepCupids(g, air, t, 16, rand, cursor);
      return { g: next, seen: [...seen, next] };
    },
    { g: group, seen: [] },
  );
}

describe('the cupids', () => {
  it('are two or three, hovering clear of everything', () => {
    const air = airFor();
    const g = createCupids(air, 0, seeded(1));
    expect(g.cupids.length).toBeGreaterThanOrEqual(2);
    for (const c of g.cupids) {
      const p = where(c, air.page, 0)!;
      expect(air.page.obstacles.some((o) => meets(around(p, FOOTPRINTS.hover), o))).toBe(false);
    }
  });

  it('shoot once at a still cursor, the arrow landing in a ledge and popping hearts', () => {
    const air = airFor();
    const g = createCupids(air, 0, seeded(2));
    const { g: after, seen } = run(g, 4000, still(620, 230, 0));
    expect(seen.some((s) => s.cupids.some((c) => c.mode === 'draw'))).toBe(true);
    expect(seen.some((s) => s.flying)).toBe(true);
    expect(after.stuck).toHaveLength(1);
    expect(seen.some((s) => s.bursts.length > 0)).toBe(true);
    // One shot, not one every few seconds, for one still cursor.
    const { g: later } = run(after, 6000, still(620, 230, 0), 4000);
    expect(later.count).toBe(1);
  });

  it('never fly an arrow over text, controls or charts', () => {
    const air = airFor();
    const { seen } = run(createCupids(air, 0, seeded(3)), 4000, still(620, 230, 0));
    for (const s of seen) {
      const a = s.flying && arrowAt(air.page, s.flying, s.flying.start + s.flying.duration / 2);
      if (!a) continue;
      expect(air.page.obstacles.filter((o) => !o.block).some((o) => meets({ left: a.x - 2, right: a.x + 2, top: a.y - 2, bottom: a.y + 2 }, o))).toBe(false);
    }
  });

  it('lower the bow when the cursor moves before the arrow leaves', () => {
    const air = airFor();
    const g = createCupids(air, 0, seeded(2));
    const { g: drawing } = run(g, 1300, still(620, 230, 0));
    expect(drawing.cupids.some((c) => c.mode === 'turn' || c.mode === 'draw')).toBe(true);
    const { g: moved } = run(drawing, 100, still(700, 300, 1300), 1300);
    expect(moved.cupids.every((c) => c.mode !== 'draw' && c.mode !== 'aim')).toBe(true);
    expect(moved.flying).toBeNull();
  });

  it('drop an arrow in the air when a layout change covers where it lands', () => {
    const air = airFor();
    const { seen } = run(createCupids(air, 0, seeded(2)), 4000, still(620, 230, 0));
    const mid = seen.find((s) => s.flying)!;
    const f = mid.flying!;
    const target = air.page.floors.get(f.floor)!;
    const at = target.left + f.arc.to.x;
    const covered = page([...air.page.obstacles, { left: at - 10, right: at + 10, top: target.y - 20, bottom: target.y - 2 }]);
    expect(reconcileCupids(mid, airFor(covered), f.start + 10, seeded(2)).flying).toBeNull();
    expect(reconcileCupids(mid, air, f.start + 10, seeded(2)).flying).toEqual(f);
  });

  it('keep 64px apart over a long run', () => {
    const air = airFor();
    const rand = seeded(9);
    const { seen } = run(createCupids(air, 0, rand), 60000, null, 0, air, rand);
    for (const s of seen.filter((_, i) => i % 5 === 0)) {
      const ps = s.cupids.map((c) => where(c, air.page, 0)).filter((p) => p !== null);
      for (const [a, b] of ps.flatMap((a, i) => ps.slice(i + 1).map((b) => [a, b] as const))) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(63.9);
    }
  });

  it('keep their spots across a scroll, riding with the page', () => {
    const air = airFor();
    const g = createCupids(air, 0, seeded(4));
    const scrolled = page(air.page.obstacles.map((o) => ({ ...o, top: o.top - 40, bottom: o.bottom - 40 })), [...air.page.floors].map(([id, f]) => [id, { ...f, y: f.y - 40, base: f.base - 40 }]));
    const after = reconcileCupids(g, airFor(scrolled, { left: 236, right: 1440, top: -40, bottom: 1060 }), 100, seeded(4));
    expect(after.cupids.map((c) => c.spot)).toEqual(g.cupids.map((c) => c.spot));
  });

  it('hover still under reduced motion, kept where they were', () => {
    const air = airFor();
    const g = restingCupids(air, null);
    expect(g.cupids.length).toBeGreaterThanOrEqual(2);
    expect(restingCupids(air, g).cupids.map((c) => c.spot)).toEqual(g.cupids.map((c) => c.spot));
    expect(g.cupids.every((c) => c.mode === 'hover' && c.flight === null)).toBe(true);
  });
});
