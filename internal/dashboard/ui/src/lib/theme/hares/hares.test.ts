import { describe, expect, it } from 'vitest';
import type { Cursor } from '../pointer';
import { CARDS, HEADING, page, seeded } from './fixtures';
import { BOX_GAP, CHASE_GAP, REACHES, SPACING, type Hare } from './hare';
import { createHares, hareViews, reconcileHares, restingHares, stepHares, type HareView, type Hares } from './hares';

const DT = 16;
// Steps the group from `from` for `ms`, the cursor as given at each moment,
// checking every frame; returns the group at the end.
function run(group: Hares, scene = page(), from = 0, ms = 10_000, rand = seeded(3), cursor: (now: number) => Cursor | null = () => null, each: (g: Hares, now: number) => void = () => {}): Hares {
  return Array.from({ length: Math.floor(ms / DT) }, (_, i) => from + (i + 1) * DT).reduce((g, now) => {
    const next = stepHares(g, scene, now, DT, rand, cursor(now));
    each(next, now);
    return next;
  }, group);
}
const byId = (g: Hares, id: number) => g.hares.find((h) => h.id === id)!;

// How far each drawing reaches either side of where it stands, on the page,
// the way it faces.
function extent(v: HareView): { lo: number; hi: number } {
  const { back, front } = REACHES[v.pose];
  return v.dir > 0 ? { lo: v.x - back, hi: v.x + front } : { lo: v.x - front, hi: v.x + back };
}
// Every pair of hares drawn on one ledge whose drawings overlap.
function overlapping(g: Hares, scene = page()): string[] {
  const views = hareViews(g, scene).filter((v) => v.opacity > 0);
  return views.flatMap((a, i) => views.slice(i + 1).flatMap((b) => {
    if (Math.abs(a.y - b.y) > 1) return [];
    const [p, q] = [extent(a), extent(b)];
    return p.lo < q.hi - 0.5 && q.lo < p.hi - 0.5 ? [`${a.hare.id} ${a.pose} at ${a.x.toFixed(1)} and ${b.hare.id} ${b.pose} at ${b.x.toFixed(1)}`] : [];
  }));
}

describe('placing the hares', () => {
  it('puts the jill and a jack face to face where there is room to box, and a third elsewhere', () => {
    const g = createHares(page(), 0, seeded(1));
    expect(g.target).toBe(3);
    const [jill, jack, third] = g.hares;
    expect([jill.floor, jack.floor]).toEqual([1, 1]);
    expect(Math.abs(jill.x - jack.x)).toBeCloseTo(CHASE_GAP);
    expect(jill.dir).toBe(-1);
    expect(jack.dir).toBe(1);
    expect(third.floor).not.toBe(1);
    expect(g.nextBout).toBeLessThan(3000);
  });

  it('sits each apart on the roomiest stretches where there is no room to box', () => {
    // A tall chart over the whole heading rule takes the box spot away.
    const scene = page([{ left: 300, right: 1300, top: 120, bottom: 140 }]);
    const g = createHares(scene, 0, seeded(1));
    expect(g.hares.length).toBeGreaterThanOrEqual(2);
    for (const [i, a] of g.hares.entries()) {
      for (const b of g.hares.slice(i + 1)) if (a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING);
    }
  });

  it('places none where no ledge has room', () => {
    const scene = { ...page(), floors: new Map() };
    expect(createHares(scene, 0, seeded(1)).hares).toEqual([]);
  });
});

describe('a bout', () => {
  it('boxes, then she bolts and he chases her ledge to ledge on one trail', () => {
    const seen = new Set<string>();
    const chased: number[] = [];
    run(createHares(page(), 0, seeded(1)), page(), 0, 14_000, seeded(2), () => null, (g) => {
      const [jill, jack] = [byId(g, 0), byId(g, 1)];
      seen.add(`${jill.mode}/${jack.mode}`);
      const chase = g.runs.find((r) => r.kind === 'chase');
      if (chase) chased.push(chase.members.length);
    });
    expect([...seen]).toContain('box/box');
    expect([...seen].some((s) => s.startsWith('run/'))).toBe(true);
    expect([...seen].some((s) => s === 'run/run')).toBe(true);
    expect(chased.length).toBeGreaterThan(0);
  });

  it('boxes face to face BOX_GAP apart', () => {
    const boxes: number[] = [];
    run(createHares(page(), 0, seeded(1)), page(), 0, 8000, seeded(2), () => null, (g) => {
      const [jill, jack] = [byId(g, 0), byId(g, 1)];
      if (jill.mode === 'box' && jack.mode === 'box') {
        boxes.push(Math.abs(jill.x - jack.x));
        expect(jill.dir).toBe(Math.sign(jack.x - jill.x));
        expect(jack.dir).toBe(Math.sign(jill.x - jack.x));
      }
    });
    expect(boxes.length).toBeGreaterThan(0);
    for (const gap of boxes) expect(gap).toBeCloseTo(BOX_GAP);
  });

  it('without room to box, comes no closer than the chase gap before she bolts', () => {
    const scene = page([{ left: 300, right: 1300, top: 120, bottom: 140 }]);
    const modes = new Set<string>();
    run(createHares(scene, 0, seeded(4)), scene, 0, 40_000, seeded(5), () => null, (g) => g.hares.forEach((h) => modes.add(h.mode)));
    expect(modes.has('box')).toBe(false);
    expect(modes.has('run')).toBe(true);
  });
});

describe('the cursor', () => {
  // The jill's middle on the page, where a cursor would come near her.
  const middle = (g: Hares, scene = page()) => {
    const v = hareViews(g, scene).find((h) => h.hare.id === 0)!;
    return { x: v.x, y: v.y - 12 };
  };

  it('freezes them as it comes near, then they bolt while it stays', () => {
    const scene = page();
    const g0 = run(createHares(scene, 0, seeded(1)), scene, 0, 500);
    const at = middle(g0, scene);
    const near = (now: number): Cursor => ({ x: at.x + 30, y: at.y, at: now });
    const frozen = run(g0, scene, 500, 200, seeded(3), near);
    expect(byId(frozen, 0).mode).toBe('freeze');
    expect(byId(frozen, 1).mode).toBe('freeze');
    // Still there, but no longer moving: they bolt.
    const still = (): Cursor => ({ x: at.x + 30, y: at.y, at: 700 });
    const bolted = run(frozen, scene, 700, 1300, seeded(3), still);
    expect(bolted.runs.some((r) => r.kind === 'bolt')).toBe(true);
    expect(bolted.bout).toBeNull();
  });

  it('lets them sit up and go back to grazing if it goes away before they bolt', () => {
    const scene = page();
    const g0 = run(createHares(scene, 0, seeded(1)), scene, 0, 500);
    const at = middle(g0, scene);
    const frozen = run(g0, scene, 500, 200, seeded(3), (now) => ({ x: at.x + 30, y: at.y, at: now }));
    const gone = run(frozen, scene, 700, 1300, seeded(3), () => null);
    expect(gone.runs).toEqual([]);
    expect(byId(gone, 0).mode).toBe('sit');
  });

  it('bolts away from the cursor', () => {
    const scene = page();
    const g0 = run(createHares(scene, 0, seeded(1)), scene, 0, 500);
    const at = middle(g0, scene);
    const x0 = byId(g0, 0).x;
    const after = run(g0, scene, 500, 1700, seeded(3), (now) => ({ x: at.x + 30, y: at.y, at: Math.min(now, 600) }));
    const v = hareViews(after, scene).find((h) => h.hare.id === 0);
    expect(byId(after, 0).floor !== 1 || byId(after, 0).x < x0 || !v).toBe(true);
  });
});

const SEEDS = (process.env.HARE_SEEDS ?? '11,12,13').split(',').map(Number);

describe('keeping apart', () => {
  // Long runs with a cursor now and then: no two drawn hares ever overlap
  // on a ledge, boxing face to face included.
  // The page as it is, and with a chart over the heading rule, so there is
  // no room to box and the bouts are chases from the first.
  const pages = { boxing: page(), 'no boxing': page([{ left: 300, right: 1300, top: 120, bottom: 140 }]) };
  for (const [name, scene] of Object.entries(pages)) for (const seed of SEEDS) {
    it(`never overlaps over a long run (${name}, seed ${seed})`, () => {
      const rand = seeded(seed);
      const pokes = [9000, 31_000, 52_000];
      const cursor = (now: number): Cursor | null => {
        const poke = pokes.find((p) => now >= p && now < p + 400);
        return poke ? { x: 700 + (poke % 400), y: 170, at: now } : null;
      };
      const problems: string[] = [];
      run(createHares(scene, 0, seeded(seed)), scene, 0, 70_000, rand, cursor, (g, now) => {
        problems.push(...overlapping(g, scene).map((p) => `${now}: ${p}`));
        expect(g.hares.length).toBeLessThanOrEqual(g.target);
      });
      expect(problems.slice(0, 5)).toEqual([]);
    });
  }
});

describe('a layout change', () => {
  it('keeps every hare where it is when the page has not moved them', () => {
    const scene = page();
    const g = run(createHares(scene, 0, seeded(1)), scene, 0, 3000);
    const again = reconcileHares(g, scene, 3000, seeded(9));
    expect(again.hares.map((h) => [h.floor, h.x])).toEqual(g.hares.map((h) => [h.floor, h.x]));
  });

  it('places afresh one whose ledge went, and never adds beyond the target', () => {
    const scene = page();
    const g = createHares(scene, 0, seeded(1));
    const third: Hare = g.hares[2];
    const without = page([], CARDS.filter((_, i) => i + 2 !== third.floor));
    const after = reconcileHares(g, { ...without, floors: new Map([...without.floors].filter(([id]) => id !== third.floor)) }, 100, seeded(9));
    expect(after.hares.length).toBeLessThanOrEqual(g.target);
    expect(after.hares.every((h) => h.floor !== third.floor)).toBe(true);
  });
});

describe('reduced motion', () => {
  it('sits them up, still, apart, and keeps them where they sat', () => {
    const scene = page();
    const g = restingHares(scene, null);
    expect(g.hares.length).toBeGreaterThanOrEqual(2);
    expect(new Set(g.hares.map((h) => h.mode))).toEqual(new Set(['sit']));
    expect(restingHares(scene, g).hares).toEqual(g.hares);
    // Tall where the heading rule has room, crouched on a card.
    const views = hareViews(g, scene);
    for (const v of views) expect(v.pose).toBe(v.y === HEADING.y ? 'sit' : 'alert');
  });
});
