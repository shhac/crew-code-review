import { describe, expect, it } from 'vitest';
import { around } from '../air';
import { quadratic, samples } from '../curves';
import type { Box } from '../floors';
import type { Cursor } from '../pointer';
import { clearOfContent, seeded } from '../test-scene';
import { cupidView, footprintOf, where } from './cupid';
import { arrowArc, arrowAt, createCupids, dash, reconcileCupids, restingCupids, stepCupids, type Cupids } from './cupids';
import { airFor, page, still } from './fixtures';
import { FOOTPRINTS } from './footprints';

const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// One frame of a run: the group as it is at time t.
type Frame = { t: number; g: Cupids };

// Runs the group in 16ms frames from `from` for `ms`, with a cursor, keeping
// every frame with its own time.
function run(group: Cupids, ms: number, cursor: Cursor | null, from = 0, air = airFor(), rand = seeded(7)) {
  return Array.from({ length: Math.ceil(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce<{ g: Cupids; seen: Frame[] }>(
    ({ g, seen }, t) => {
      const next = stepCupids(g, air, t, 16, rand, cursor);
      return { g: next, seen: [...seen, { t, g: next }] };
    },
    { g: group, seen: [] },
  );
}

// The box an arrow takes with its tip at p, pointing at angle degrees: its
// 12px shaft behind the tip, and 2px round it.
function arrowBox(p: { x: number; y: number }, angle: number): Box {
  const a = (angle * Math.PI) / 180;
  const tail = { x: p.x - Math.cos(a) * 12, y: p.y - Math.sin(a) * 12 };
  return { left: Math.min(p.x, tail.x) - 2, right: Math.max(p.x, tail.x) + 2, top: Math.min(p.y, tail.y) - 2, bottom: Math.max(p.y, tail.y) + 2 };
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
    expect(seen.some((s) => s.g.cupids.some((c) => c.mode === 'draw'))).toBe(true);
    expect(seen.some((s) => s.g.flying)).toBe(true);
    expect(after.stuck).toHaveLength(1);
    expect(seen.some((s) => s.g.bursts.length > 0)).toBe(true);
    // One shot, not one every few seconds, for one still cursor.
    const { g: later } = run(after, 6000, still(620, 230, 0), 4000);
    expect(later.count).toBe(1);
  });

  it('never fly an arrow over text, controls or charts, at any moment of its flight', () => {
    const air = airFor();
    const { seen } = run(createCupids(air, 0, seeded(3)), 4000, still(620, 230, 0));
    const flights = seen.filter((s) => s.g.flying);
    expect(flights.length).toBeGreaterThan(0);
    for (const { t, g } of flights) {
      const a = arrowAt(air.page, g.flying!, t)!;
      expect(clearOfContent([arrowBox(a, a.angle)], air.page), `${t}`).toBe(true);
    }
    // And along the whole of each arc, between the frames too.
    for (const f of new Set(flights.map((s) => s.g.flying!))) {
      const arc = arrowArc(air.page, f)!;
      const tips = samples((u) => quadratic(arc, u)).map(({ t }) => arrowAt(air.page, f, f.start + t * f.duration)!);
      expect(clearOfContent(tips.map((p) => arrowBox(p, p.angle)), air.page)).toBe(true);
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
    const mid = seen.find((s) => s.g.flying)!.g;
    const f = mid.flying!;
    const target = air.page.floors.get(f.floor)!;
    const at = target.left + f.arc.to.x;
    const covered = page([...air.page.obstacles, { left: at - 10, right: at + 10, top: target.y - 20, bottom: target.y - 2 }]);
    expect(reconcileCupids(mid, airFor(covered), f.start + 10, seeded(2)).flying).toBeNull();
    expect(reconcileCupids(mid, air, f.start + 10, seeded(2)).flying).toEqual(f);
  });

  // Each frame is checked at its own moment, so flights are seen mid-way:
  // with a cursor coming to rest here and there to draw shots, and now and
  // then whipping past one to make it dodge.
  it('keep 64px apart and clear of everything, flying or not, over a long run', () => {
    const air = airFor();
    const rand = seeded(9);
    const rests = [{ x: 620, y: 230 }, { x: 1200, y: 150 }, { x: 400, y: 560 }, { x: 900, y: 160 }];
    const cursor = (t: number): Cursor => {
      const k = Math.floor(t / 3500);
      return { ...rests[k % rests.length], at: k * 3500 };
    };
    const whip = (g: Cupids, t: number) => {
      const p = t % 5000 < 16 ? where(g.cupids[0], air.page, t) : null;
      return p ? dash(g, air, t, { x: p.x - 150, y: p.y + 4 }, { x: p.x + 150, y: p.y - 4 }, 2000) : g;
    };
    const frames = Array.from({ length: 3750 }, (_, i) => (i + 1) * 16).reduce<Frame[]>((seen, t) => {
      const g = whip(stepCupids(seen.at(-1)?.g ?? createCupids(air, 0, rand), air, t, 16, rand, cursor(t)), t);
      return [...seen, { t, g }];
    }, []);
    expect(frames.some((s) => s.g.cupids.some((c) => c.flight))).toBe(true);
    expect(frames.some((s) => s.g.flying)).toBe(true);
    expect(frames.some((s) => s.g.cupids.some((c) => c.mode === 'dodge'))).toBe(true);
    const problems = frames.flatMap(({ t, g }) => {
      const views = g.cupids.flatMap((c) => {
        const view = cupidView(c, air.page, t);
        return view ? [{ id: c.id, view, box: around(view, footprintOf(view)) }] : [];
      });
      const crowded = views.flatMap((a, i) => views.slice(i + 1).filter((b) => Math.hypot(a.view.x - b.view.x, a.view.y - b.view.y) < 63.9).map((b) => `${t}: ${a.id} and ${b.id} too close`));
      const covering = views.filter((v) => !clearOfContent([v.box], air.page)).map((v) => `${t}: ${v.id} ${v.view.pose} over content`);
      const carded = views.filter((v) => air.page.obstacles.some((o) => o.block && meets(v.box, o))).map((v) => `${t}: ${v.id} ${v.view.pose} in a card`);
      const flown = g.flying && arrowAt(air.page, g.flying, t);
      const arrow = flown && !clearOfContent([arrowBox(flown, flown.angle)], air.page) ? [`${t}: arrow over content`] : [];
      return [...crowded, ...covering, ...carded, ...arrow];
    });
    expect(problems.slice(0, 5)).toEqual([]);
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
