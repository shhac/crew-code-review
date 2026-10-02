import { describe, expect, it } from 'vitest';
import { advance, away, pose, weighted, type Choice, type Floor, type Frame, type Line, type Pose, type Spider, type World } from '.';

const frame: Frame = { width: 1200, height: 800, bottomWeb: false };
const card = (y: number, left = 300, right = 900, base = y + 120): Floor => ({ left, right, y, base });
const fixed = (v: number) => () => v;

// Small and seedable, so a failing run can be replayed exactly.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Run = { world: World; poses: (Pose | null)[] };

type Point = { x: number; y: number };

// Steps one spider at 60fps for `seconds`, recording every world and pose.
// The page and the pointer can be functions of time, to move under it.
function run(
  spider: Spider,
  page: Map<number, Floor> | ((t: number) => Map<number, Floor>),
  seconds: number,
  opts: { rand?: () => number; prefer?: Choice; lines?: Line[]; within?: Frame; pointer?: (t: number, at: Pose | null) => Point | undefined } = {},
): Run[] {
  const within = opts.within ?? frame;
  const rand = opts.rand ?? Math.random;
  const floorsAt = typeof page === 'function' ? page : () => page;
  const trail: Run[] = [{ world: { spiders: [spider], lines: opts.lines ?? [], nextLine: 100 }, poses: [pose(spider, floorsAt(0), within)] }];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const floors = floorsAt(t);
    const last = trail[trail.length - 1];
    const pointer = opts.pointer?.(t, last.poses[0]);
    const world = advance(last.world, { floors, frame: within, dt: 1 / 60, rand, prefer: opts.prefer, pointer });
    trail.push({ world, poses: world.spiders.map((s) => pose(s, floors, within)) });
  }
  return trail;
}

const spiders = (trail: Run[]) => trail.map((r) => r.world.spiders[0]);
const walking = (s: Spider, floor: number) => s.kind === 'walk' && s.floor === floor;

describe('arriving', () => {
  it('lets itself down from the top onto a floor, and leaves its thread there', () => {
    const floors = new Map([[1, card(200)]]);
    const trail = run(away(fixed(0)), floors, 10, { rand: fixed(0.5) });
    const landed = trail.findIndex((r) => r.world.lines.length > 0);
    expect(landed).toBeGreaterThan(0);
    expect(trail[landed].world.lines).toEqual([expect.objectContaining({ top: expect.objectContaining({ floor: null }), bottom: expect.objectContaining({ floor: 1 }) })]);
    expect(spiders(trail).slice(landed).some((s) => walking(s, 1))).toBe(true);
  });

  it('waits rather than arriving when no floor is in view', () => {
    const trail = run(away(fixed(0)), new Map([[1, card(-400)]]), 1, { rand: fixed(0.5) });
    expect(spiders(trail).every((s) => s.kind === 'away')).toBe(true);
  });
});

describe('walking', () => {
  it('rides its floor when the page scrolls', () => {
    const s: Spider = { kind: 'rest', floor: 1, x: 100, dir: 1, left: 5 };
    expect(pose(s, new Map([[1, card(300)]]))).toMatchObject({ x: 400, y: 300 });
    expect(pose(s, new Map([[1, card(150)]]))).toMatchObject({ x: 400, y: 150 });
  });

  it('never walks off the end of its floor', () => {
    const floors = new Map([[1, card(300)]]);
    const trail = run({ kind: 'walk', floor: 1, x: 300, dir: 1, left: 100, goal: null }, floors, 60, { prefer: 'turn' });
    for (const r of trail) {
      const p = r.poses[0];
      if (!p || r.world.spiders[0].kind !== 'walk') continue;
      expect(p.x).toBeGreaterThanOrEqual(300);
      expect(p.x).toBeLessThanOrEqual(900);
    }
  });
});

// A route change swaps every card out from under the spiders, in whatever
// state they happen to be in. None of them may throw or be drawn floating.
describe('when its floor vanishes', () => {
  const gone = new Map<number, Floor>();
  const cases: [string, Spider][] = [
    ['walking', { kind: 'walk', floor: 7, x: 50, dir: 1, left: 3, goal: null }],
    ['resting', { kind: 'rest', floor: 7, x: 50, dir: 1, left: 3 }],
    ['hanging from it', { kind: 'dangle', from: 7, x: 50, dir: 1, drop: 40, to: null, reach: 100, out: false, phase: 'hang', left: 2 }],
    ['climbing it', { kind: 'climb', route: { via: 'side', from: 7, toward: 1 }, along: 10, dir: 1 }],
  ];
  it.each(cases)('a spider %s leaves and is not drawn', (_, s) => {
    expect(pose(s, gone)).toBeNull();
    const [, next] = run(s, gone, 0.02);
    expect(next.world.spiders[0].kind).toBe('away');
  });

  it('a spider dropping toward a vanished floor climbs back up', () => {
    const s: Spider = { kind: 'dangle', from: null, x: 400, dir: 1, drop: 100, to: 9, reach: Infinity, out: false, phase: 'down', left: 0 };
    const [, next] = run(s, new Map(), 0.02);
    expect(next.world.spiders[0]).toMatchObject({ kind: 'dangle', phase: 'up' });
  });
});

describe('the ways down and back up', () => {
  const at = (floor: number, x: number, dir: 1 | -1 = 1): Spider => ({ kind: 'walk', floor, x, dir, left: 100, goal: null });

  it('drops from one floor to the floor below, leaving a dragline between them', () => {
    const floors = new Map([[1, card(200)], [2, card(420)]]);
    const trail = run(at(1, 500), floors, 15, { prefer: 'drop' });
    const landed = trail.find((r) => r.world.lines.length > 0);
    expect(landed?.world.lines).toEqual([expect.objectContaining({ top: expect.objectContaining({ floor: 1 }), bottom: expect.objectContaining({ floor: 2 }) })]);
  });

  it('with nothing below, hangs, climbs back, and pulls itself over onto its floor', () => {
    const floors = new Map([[1, card(300)]]);
    const trail = spiders(run(at(1, 570), floors, 20, { prefer: 'drop' }));
    const phases = trail.flatMap((s) => (s.kind === 'dangle' ? [s.phase] : []));
    expect(phases).toContain('hang');
    expect(phases).toContain('up');
    const up = trail.findIndex((s) => s.kind === 'dangle' && s.phase === 'up');
    expect(trail.slice(up).find((s) => s.kind !== 'dangle')).toMatchObject({ kind: 'act', next: { kind: 'rest', floor: 1 } });
  });

  it('climbs a dragline back up to the floor it hangs from, taking the thread with it', () => {
    const floors = new Map([[1, card(200)], [2, card(420)]]);
    const line: Line = { id: 5, top: { floor: 1, x: 250 }, bottom: { floor: 2, x: 250 }, age: 0 };
    const trail = run(at(2, 120), floors, 30, { prefer: 'line', lines: [line] });
    const climbing = trail.findIndex((r) => r.world.spiders[0].kind === 'climb');
    expect(climbing).toBeGreaterThan(0);
    expect(trail[climbing].world.lines.filter((l) => l.id === 5)).toEqual([]);
    expect(spiders(trail).slice(climbing).some((s) => walking(s, 1))).toBe(true);
  });

  it('climbs the side of a taller card beside it, onto its top', () => {
    const floors = new Map([[1, card(400, 300, 600)], [2, card(250, 615, 800, 600)]]);
    const trail = spiders(run(at(1, 250), floors, 30, { prefer: 'wall' }));
    expect(trail.some((s) => s.kind === 'climb' && s.route.via === 'wall')).toBe(true);
    expect(trail.some((s) => walking(s, 2))).toBe(true);
  });

  it('jumps a narrow gap to the next card, legs drawn in mid-air', () => {
    const floors = new Map([[1, card(300, 300, 600)], [2, card(280, 640, 900)]]);
    const trail = run(at(1, 250), floors, 20, { prefer: 'jump' });
    expect(trail.some((r) => (r.poses[0]?.tuck ?? 0) === 1)).toBe(true);
    expect(spiders(trail).some((s) => walking(s, 2))).toBe(true);
  });

  it('goes home up the top-right web, fading into its corner', () => {
    const floors = new Map([[1, card(150, 700, 1150)]]);
    const trail = run(at(1, 400), floors, 30, { prefer: 'web' });
    const fades = trail.map((r) => r.poses[0]?.fade ?? 1);
    expect(Math.min(...fades)).toBeLessThan(0.2);
    expect(spiders(trail).some((s) => s.kind === 'climb' && s.route.via === 'web')).toBe(true);
  });

  it('climbs down a card that runs off the bottom, and out', () => {
    const floors = new Map([[1, card(500, 300, 600, 1400)]]);
    const trail = spiders(run(at(1, 250), floors, 60, { prefer: 'side' }));
    const down = trail.findIndex((s) => s.kind === 'climb' && s.route.via === 'side');
    expect(down).toBeGreaterThan(0);
    expect(trail.slice(down).some((s) => s.kind === 'away')).toBe(true);
  });

  it('can always lower itself out of view and leave', () => {
    const floors = new Map([[1, card(300)]]);
    const trail = spiders(run(at(1, 570), floors, 30, { prefer: 'leave' }));
    const out = trail.findIndex((s) => s.kind === 'dangle' && s.out);
    expect(out).toBeGreaterThan(0);
    expect(trail.slice(out).some((s) => s.kind === 'away')).toBe(true);
  });
});

describe('draglines', () => {
  it('go when their lower floor leaves view or they no longer hang a real distance', () => {
    const line: Line = { id: 1, top: { floor: 1, x: 100 }, bottom: { floor: 2, x: 100 }, age: 0 };
    const world: World = { spiders: [], lines: [line], nextLine: 2 };
    const step = (floors: Map<number, Floor>) => advance(world, { floors, frame, dt: 1 / 60, rand: fixed(0.5) }).lines;
    expect(step(new Map([[1, card(200)], [2, card(420)]]))).toHaveLength(1);
    expect(step(new Map([[1, card(200)], [2, card(900)]]))).toHaveLength(0);
    expect(step(new Map([[1, card(200)], [2, card(230)]]))).toHaveLength(0);
    expect(step(new Map([[2, card(420)]]))).toHaveLength(0);
  });
});

// The properties every run must keep, whatever the page: poses are finite
// numbers, a spider never jumps between frames except where its drawing
// changes (and a tween is there to make even that read as a turn), and tweens
// finish on time.
describe('fuzzed pages', () => {
  const layouts: Record<string, Map<number, Floor>> = {
    'a single short card': new Map([[1, card(400, 300, 700, 520)]]),
    'a stacked column': new Map([[1, card(150)], [2, card(320)], [3, card(490)], [4, card(660)]]),
    'a grid with gaps': new Map([
      [1, card(150, 100, 480)],
      [2, card(150, 500, 880)],
      [3, card(360, 100, 480)],
      [4, card(330, 500, 880)],
      [5, card(560, 100, 880, 1200)],
    ]),
    'a taller neighbour': new Map([[1, card(500, 200, 600, 800)], [2, card(300, 620, 1000, 800)]]),
    'everything near the top right': new Map([[1, card(150, 600, 1150)], [2, card(400, 600, 1150, 1000)]]),
  };

  for (const [name, floors] of Object.entries(layouts)) {
    it(`${name}: no spider stays stuck on the lowest floor`, () => {
      const [lowest, low] = [...floors].sort(([, a], [, b]) => b.y - a.y)[0];
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const trail = spiders(run({ kind: 'walk', floor: lowest, x: 60, dir: 1, left: 2, goal: null }, floors, 240, { rand: mulberry32(seed) }));
        const escaped = trail.some((s) => s.kind === 'away' || (s.kind === 'walk' && (floors.get(s.floor)?.y ?? Infinity) < low.y));
        expect(escaped, `seed ${seed}`).toBe(true);
      }
    });

    // The page drifts up and down as if scrolled, and a floor vanishes for a
    // while and comes back, as a re-render would do: whatever a spider is in
    // the middle of when that happens.
    const shifting = (seed: number) => {
      const ids = [...floors.keys()];
      const gone = ids[seed % ids.length];
      return (t: number) => {
        const drift = 30 * Math.sin(t / 2.5);
        const missing = t % 20 > 8 && t % 20 < 11;
        return new Map([...floors].filter(([id]) => !(missing && id === gone)).map(([id, f]) => [id, { ...f, y: f.y + drift, base: f.base + drift }]));
      };
    };

    it(`${name}: poses stay finite and continuous, tweens end on time`, () => {
      const pages = [floors, shifting(1), shifting(2)];
      for (const [k, seed] of [11, 12, 13].entries()) {
        // The pointer sometimes circles close round the spider, startling it.
        const pointer = (t: number, at: Pose | null) => (at && t % 15 < 4 ? { x: at.x + 60 * Math.cos(t * 3), y: at.y + 60 * Math.sin(t * 3) } : undefined);
        const trail = run(away(fixed(0)), pages[k], 180, { rand: mulberry32(seed), within: { ...frame, bottomWeb: true }, pointer });
        // Collected rather than asserted frame by frame: an expect per
        // frame makes a three-minute run take longer than the test may.
        const faults = trail.flatMap((r, i) => {
          const s = r.world.spiders[0];
          const p = r.poses[0];
          const before = trail[i - 1]?.poses[0];
          const where = `seed ${seed} frame ${i} ${s.kind}`;
          if (s.kind === 'act' && s.t > s.tween.dur + 1 / 60) return [`${where}: tween overran`];
          if (!p) return [];
          if (![p.x, p.y, p.rotate, p.crouch, p.tuck, p.fade].every(Number.isFinite)) return [`${where}: not finite`];
          if (!before || before.drawing !== p.drawing) return [];
          // A page that scrolls carries its spiders with it; only the
          // spider's own movement must be smooth, so the scroll is allowed for.
          if (Math.hypot(p.x - before.x, p.y - before.y) >= 12 + 2) return [`${where}: jumped ${Math.hypot(p.x - before.x, p.y - before.y).toFixed(1)}px`];
          if (Math.abs(p.rotate - before.rotate) >= 20) return [`${where}: turned ${Math.abs(p.rotate - before.rotate).toFixed(0)}deg`];
          return [];
        });
        expect(faults).toEqual([]);
      }
    });
  }
});

describe('a moving pointer nearby', () => {
  const floors = new Map([[1, card(300)]]);
  const ctx = (pointer?: { x: number; y: number }) => ({ floors, frame, dt: 1 / 60, rand: fixed(0.9), pointer });
  const advanceOne = (s: Spider, pointer?: { x: number; y: number }) => advance({ spiders: [s], lines: [], nextLine: 1 }, ctx(pointer)).spiders[0];

  it('sends a walking spider dashing away from it', () => {
    const s: Spider = { kind: 'walk', floor: 1, x: 300, dir: 1, left: 5, goal: null };
    // The spider stands at x 600; the pointer is just to its right.
    const fled = advanceOne(s, { x: 640, y: 285 });
    expect(fled).toMatchObject({ kind: 'walk', dir: -1 });
    const calm = advanceOne(s);
    const moved = (n: Spider) => (n.kind === 'walk' ? Math.abs(n.x - 300) : 0);
    expect(moved(fled)).toBeGreaterThan(moved(calm) * 2);
  });

  it('gets a resting spider moving', () => {
    const s: Spider = { kind: 'rest', floor: 1, x: 300, dir: 1, left: 5 };
    expect(advanceOne(s, { x: 560, y: 285 })).toMatchObject({ kind: 'walk', dir: 1 });
  });

  it('sends a hanging spider back up its thread', () => {
    const s: Spider = { kind: 'dangle', from: 1, x: 300, dir: 1, drop: 60, to: null, reach: 100, out: false, phase: 'hang', left: 3 };
    expect(advanceOne(s, { x: 600, y: 380 })).toMatchObject({ kind: 'dangle', phase: 'up' });
  });

  it('is ignored when it is far away, and mid-tween', () => {
    const s: Spider = { kind: 'walk', floor: 1, x: 300, dir: 1, left: 5, goal: null };
    expect(advanceOne(s, { x: 100, y: 100 })).toMatchObject({ kind: 'walk', dir: 1 });
    const turning: Spider = { kind: 'act', t: 0, next: s, tween: { name: 'settle', dur: 0.42, ease: 'overshoot', dx: 0, dy: -10, rotate: 80, drawing: 'walk' } };
    expect(advanceOne(turning, { x: 600, y: 285 })).toMatchObject({ kind: 'act' });
  });
});

describe('a cornered spider', () => {
  it('takes a way off the end rather than turning back toward the pointer', () => {
    const floors = new Map([[1, card(300)]]);
    const s: Spider = { kind: 'walk', floor: 1, x: 20, dir: -1, left: 5, goal: null };
    // Startled from the right, at the left end: the next thing is a grab
    // (letting down a thread), never a rest facing back.
    const world = advance({ spiders: [s], lines: [], nextLine: 1 }, { floors, frame, dt: 0.3, rand: fixed(0.99), pointer: { x: 350, y: 285 } });
    expect(world.spiders[0]).toMatchObject({ kind: 'act', tween: { name: 'grab' } });
  });
});

describe('weighted', () => {
  const options = [
    { item: 'a', weight: 1 },
    { item: 'b', weight: 0 },
    { item: 'c', weight: 3 },
  ];
  it('gives each option its share of the roll, skipping the weightless', () => {
    expect(weighted(options, 0)).toBe('a');
    expect(weighted(options, 0.24)).toBe('a');
    expect(weighted(options, 0.25)).toBe('c');
    expect(weighted(options, 0.99)).toBe('c');
  });
  it('has nothing to give with nothing to choose', () => {
    expect(weighted([], 0.5)).toBeUndefined();
  });
});

describe('startled mid-way', () => {
  const floors = new Map([[1, card(300, 300, 600, 1400)]]);
  const ctx = (pointer?: { x: number; y: number }) => ({ floors, frame, dt: 1 / 60, rand: fixed(0.9), pointer });

  it('a tween under the pointer still finishes exactly on time', () => {
    const walk: Spider = { kind: 'walk', floor: 1, x: 100, dir: 1, left: 5, goal: null };
    const start: Spider = { kind: 'act', t: 0, next: walk, tween: { name: 'settle', dur: 0.42, ease: 'overshoot', dx: 0, dy: -10, rotate: 80, drawing: 'walk' } };
    const frames = Array.from({ length: 30 }).reduce<Spider[]>(
      (acc) => [...acc, advance({ spiders: [acc[acc.length - 1]], lines: [], nextLine: 1 }, ctx({ x: 400, y: 290 })).spiders[0]],
      [start],
    );
    const ended = frames.findIndex((s) => s.kind !== 'act');
    expect(ended).toBe(Math.ceil(0.42 * 60));
  });

  it('a climbing spider hurries on', () => {
    const climbing: Spider = { kind: 'climb', route: { via: 'side', from: 1, toward: 1 }, along: 10, dir: 1 };
    const calm = advance({ spiders: [climbing], lines: [], nextLine: 1 }, ctx()).spiders[0];
    const hurried = advance({ spiders: [climbing], lines: [], nextLine: 1 }, ctx({ x: 640, y: 300 })).spiders[0];
    const along = (s: Spider) => (s.kind === 'climb' ? s.along : 0);
    expect(along(hurried) - 10).toBeGreaterThan((along(calm) - 10) * 2);
  });

  it('a spider lowering itself out of the frame carries on regardless', () => {
    const leaving: Spider = { kind: 'dangle', from: 1, x: 100, dir: 1, drop: 40, to: null, reach: Infinity, out: true, phase: 'down', left: 0 };
    expect(advance({ spiders: [leaving], lines: [], nextLine: 1 }, ctx({ x: 400, y: 365 })).spiders[0]).toMatchObject({ phase: 'down', out: true });
  });
});
