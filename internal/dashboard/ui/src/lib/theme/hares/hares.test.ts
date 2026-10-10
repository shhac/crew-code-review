import { describe, expect, it } from 'vitest';
import type { PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { CARDS, clearOfContent, dashboardPage as page, HEADING, seeded } from '../test-scene';
import { BOX_GAP, CHASE_GAP, POSES, REACHES, SPACING, TALL, type Hare } from './hare';
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

// The box each drawing takes on the page: its reach either side the way it
// faces, and its height above where it stands (in the air too, mid-leap).
function boxOf(v: HareView) {
  const { lo, hi } = extent(v);
  return { left: lo, right: hi, top: v.y - POSES[v.pose].height, bottom: v.y };
}
// Every pair of hares whose drawings overlap, on one ledge or with either
// in the air, and every one over content. (One on a card may reach into the
// empty band under the rule above, where another sits on the rule: those
// two are on different ledges and both grounded, so not counted.)
function trouble(g: Hares, scene: PageMap): string[] {
  const views = hareViews(g, scene).filter((v) => v.opacity > 0);
  const name = (v: HareView) => `${v.hare.id} ${v.pose} at ${v.x.toFixed(1)},${v.y.toFixed(1)}`;
  const pairs = views.flatMap((a, i) => views.slice(i + 1).flatMap((b) => {
    if (a.y !== b.y && a.pose !== 'leap' && b.pose !== 'leap') return [];
    const [p, q] = [boxOf(a), boxOf(b)];
    const meet = p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5;
    return meet ? [`${name(a)} and ${name(b)}`] : [];
  }));
  return [...pairs, ...views.filter((v) => !clearOfContent([boxOf(v)], scene)).map((v) => `${name(v)} over content`)];
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

describe('long runs through layout changes', () => {
  // The page with a chart over the heading rule now and then, so boxes lose
  // their room and trails their ledges mid-run, and a cursor poking in.
  const layouts = [page(), page([{ left: 300, right: 1300, top: 120, bottom: 140 }]), page([], CARDS.slice(0, 2))];
  for (const seed of SEEDS) {
    it(`never overlaps or covers content, leaping or not (seed ${seed})`, () => {
      const rand = seeded(seed);
      const pokes = [9000, 31_000, 52_000];
      const cursor = (now: number): Cursor | null => {
        const poke = pokes.find((p) => now >= p && now < p + 400);
        return poke ? { x: 700 + (poke % 400), y: 170, at: now } : null;
      };
      const problems: string[] = [];
      Array.from({ length: 14 }, (_, k) => k).reduce((g, k) => {
        const scene = layouts[k % layouts.length];
        const placed = reconcileHares(g, scene, k * 5000, rand);
        problems.push(...trouble(placed, scene).map((p) => `${k * 5000} (reconciled): ${p}`));
        return run(placed, scene, k * 5000, 5000, rand, cursor, (next, now) => {
          problems.push(...trouble(next, scene).map((p) => `${now}: ${p}`));
          expect(next.hares.length).toBeLessThanOrEqual(next.target);
        });
      }, createHares(layouts[0], 0, seeded(seed)));
      expect(problems.slice(0, 5)).toEqual([]);
    });
  }
});

describe('a layout change mid-run', () => {
  // The first frame of a long run where `found` holds, and the group then.
  function first(found: (g: Hares, scene: PageMap) => boolean, scene = page(), rand = seeded(2)): { g: Hares; now: number } {
    const hit = { g: null as Hares | null, now: 0 };
    run(createHares(scene, 0, seeded(1)), scene, 0, 40_000, rand, () => null, (g, now) => {
      if (!hit.g && found(g, scene)) Object.assign(hit, { g, now });
    });
    expect(hit.g).not.toBeNull();
    return { g: hit.g!, now: hit.now };
  }

  it('cuts a leap whose landing went, putting the hare down on a ledge clear of the others', () => {
    const { g, now } = first((x, scene) => hareViews(x, scene).some((v) => v.pose === 'leap'));
    const leaper = hareViews(g, page()).find((v) => v.pose === 'leap')!.hare.id;
    const run0 = g.runs.find((r) => r.members.some((m) => m.id === leaper))!;
    const landing = run0.trail.segments.flatMap((s) => (s.kind === 'leap' ? [s.to.floor] : [])).at(-1)!;
    const gone = { ...page(), floors: new Map([...page().floors].filter(([id]) => id !== landing)) };
    const after = reconcileHares(g, gone, now + 1, seeded(9));
    expect(after.runs.some((r) => r.members.some((m) => m.id === leaper))).toBe(false);
    expect(hareViews(after, gone).some((v) => v.pose === 'leap')).toBe(false);
    expect(after.hares.every((h) => h.floor !== landing)).toBe(true);
    expect(trouble(after, gone)).toEqual([]);
    expect(new Set(after.hares.map((h) => h.id)).size).toBe(after.hares.length);
  });

  // Bug: reconcileHares keeps each hare's `tall` from before the change, so
  // the pair, now a stand-off, still sits up 38px tall under a chart 32px
  // above the ledge.
  it('turns a box that lost its tall room into a stand-off, the bout over, clear of the chart', () => {
    const { g, now } = first((x) => x.hares.filter((h) => h.mode === 'box').length === 2);
    const [a, b] = g.hares.filter((h) => h.mode === 'box');
    const f = page().floors.get(a.floor)!;
    const mid = f.left + (a.x + b.x) / 2;
    // A chart low over the box: room left to sit, none to rear up.
    const low = page([{ left: mid - 60, right: mid + 60, top: f.y - 60, bottom: f.y - (TALL - 8) }]);
    const after = reconcileHares(g, low, now + 1, seeded(9));
    expect(after.hares.some((h) => h.mode === 'box')).toBe(false);
    expect(after.bout).toBeNull();
    expect(trouble(after, low)).toEqual([]);
  });

  it('lets a trail that still holds run on, the same hares on it', () => {
    const { g, now } = first((x) => x.runs.length > 0 && x.runs.every((r) => r.at > 40));
    // Something new far from every trail: a control at the far left of the
    // window, over no ledge.
    const moved = page([{ left: 10, right: 60, top: 400, bottom: 430 }]);
    const after = reconcileHares(g, moved, now + 1, seeded(9));
    expect(after.runs).toEqual(g.runs);
    for (const r of g.runs) for (const m of r.members) expect(after.hares.find((h) => h.id === m.id)).toEqual(g.hares.find((h) => h.id === m.id));
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

  // Bug: restingHares places a hare that must move (one of a boxing pair,
  // too close to the other to sit) clear only of those placed before it,
  // so it can land on a later hare's spot and push that one, grazing
  // calmly, somewhere new. The foxes and rabbits place it clear of all.
  it('sits them all still at once when it comes on mid-run, those grazing or sitting where they were', () => {
    const scene = page();
    const moments: Hares[] = [];
    run(createHares(scene, 0, seeded(1)), scene, 0, 40_000, seeded(2), () => null, (g, now) => {
      if (now % 800 === 0) moments.push(g);
    });
    expect(moments.some((g) => g.runs.length > 0)).toBe(true);
    for (const moving of moments) {
      const still = restingHares(scene, moving);
      expect(still.hares.every((h) => h.mode === 'sit' && h.until === Infinity)).toBe(true);
      expect(still.runs).toEqual([]);
      expect(still.bout).toBeNull();
      expect(still.hares.length).toBeLessThanOrEqual(moving.target);
      expect(trouble(still, scene)).toEqual([]);
      for (const h of moving.hares.filter((h) => (h.mode === 'graze' || h.mode === 'sit') && !moving.runs.some((r) => r.members.some((m) => m.id === h.id)))) {
        const kept = still.hares.find((s) => s.id === h.id)!;
        expect([kept.floor, kept.x]).toEqual([h.floor, h.x]);
      }
      expect(restingHares(scene, still)).toEqual(still);
    }
  });
});
