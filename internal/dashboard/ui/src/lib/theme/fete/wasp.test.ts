import { describe, expect, it } from 'vitest';
import { meets } from '../air';
import type { Box } from '../floors';
import type { Rand } from '../seed';
import { inWaspAir, waspAir, windowEdge, type WaspAir } from './air';
import { FOOTPRINTS } from './footprints';
import { CAKE, JAR } from './table';
import {
  APART, SPACE, bandOf, boxOf, claimsOf, orbitFits, orbitOf, placeWasps, reconcileWasps, spotOf, stepWasps, waspView, where, zoneOf,
  type Mode, type Places, type Pointer, type Wasp, type World,
} from './wasp';

const places: Places = { cake: CAKE, jar: JAR };
// The stage sits 34px in from the window's left edge (the rail's padding and
// the stage centred on the shelf), its top 700px down. The rail's air is the
// shelf's box (200px wide) with the sky above it, up to 240px tall.
const STAGE = { left: 34, top: 700 };
const railAir = (above: number) => ({ left: 18, top: STAGE.top - above, width: 200, height: above + 72 });
// Tall: the whole sky. Medium: 54px above the cake's top, as on a 1024x768
// window, room for the low orbit only. Short: neither.
const TALL = waspAir(railAir(262), STAGE)!;
const MEDIUM = waspAir(railAir(54 - CAKE.y), STAGE)!;
const SHORT = waspAir(railAir(20 - CAKE.y), STAGE)!;

function seeded(seed: number): Rand {
  const state = { n: seed };
  return () => { state.n = (state.n * 1664525 + 1013904223) % 4294967296; return state.n / 4294967296; };
}
const worldOf = (air: WaspAir, now: number, rand: Rand, cursor: Pointer | null = null): World => ({ air, places, now, rand, cursor });

// Runs the pair from `from` to `to`, calling look on each frame.
function run(start: Wasp[], air: (now: number) => WaspAir, from: number, to: number, rand: Rand, cursor: (now: number) => Pointer | null = () => null, look: (w: Wasp[], now: number, air: WaspAir) => void = () => {}): Wasp[] {
  const frames = Math.round((to - from) / 16);
  return Array.from({ length: frames }, (_, i) => from + (i + 1) * 16).reduce((wasps, now) => {
    const a = air(now);
    const before = air(now - 16);
    const settled = a === before ? wasps : reconcileWasps(wasps, worldOf(a, now, rand));
    const next = stepWasps(settled, worldOf(a, now, rand, cursor(now)), 16);
    look(next, now, a);
    return next;
  }, start);
}

const outsideAir = (wasps: Wasp[], now: number, air: WaspAir) => wasps.flatMap((w) => {
  const b = boxOf(w, places, now);
  return b && !inWaspAir(b, air) ? [`${w.id} ${w.mode} at ${now}`] : [];
});
const touching = (wasps: Wasp[], now: number) => {
  const [a, b] = wasps.map((w) => boxOf(w, places, now));
  return a && b && meets(a, b) ? [`${wasps[0].mode}/${wasps[1].mode} at ${now}`] : [];
};

// A cursor sweeping past the cake now and then, fast, and resting
// elsewhere in between.
function restless(seed: number) {
  const rand = seeded(seed);
  const passes = Array.from({ length: 40 }, (_, i) => ({ at: 4000 + i * 7000 + rand() * 3000, y: -60 + rand() * 90, dir: rand() < 0.5 ? 1 : -1 }));
  return (now: number): Pointer | null => {
    const pass = passes.find((p) => now >= p.at && now < p.at + 600);
    if (!pass) return { x: 150, y: 200, at: now - 2000, speed: 0 };
    const t = (now - pass.at) / 600;
    return { x: pass.dir > 0 ? -20 + 200 * t : 180 - 200 * t, y: pass.y, at: now, speed: 333 };
  };
}

describe('the wasps\' air', () => {
  it('is the rail\'s air in the stage\'s coordinates, with a lane out past the window\'s left edge over its top half', () => {
    expect(TALL.air).toEqual({ left: -16, right: 184, top: -262, bottom: 72 });
    expect(TALL.lane).toEqual({ left: -58, right: -16, top: -262, bottom: -95 });
    expect(windowEdge(TALL)).toBe(-34);
    expect(waspAir(null, STAGE)).toBeNull();
    expect(waspAir({ left: 18, top: 0, width: 0, height: 0 }, STAGE)).toBeNull();
  });

  it('keeps the two bands a footprint and 6px apart, and wasp 1\'s spot clear of wasp 0\'s band', () => {
    const low = bandOf(orbitOf(0, places)), high = bandOf(orbitOf(1, places));
    expect(low.top - high.bottom).toBeCloseTo(APART);
    const grown = (b: Box, by: number) => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });
    expect(meets(grown(zoneOf(1, places), SPACE), low)).toBe(false);
    const zone0 = zoneOf(0, places);
    expect(zone0.left).toBeGreaterThanOrEqual(low.left);
    expect(zone0.right).toBeLessThanOrEqual(low.right);
    expect(zone0.top).toBeGreaterThanOrEqual(low.top);
    expect(zone0.bottom).toBeLessThanOrEqual(low.bottom);
  });

  it('needs about 30px above the cake for the low orbit and 70 for the high one', () => {
    expect(CAKE.y - bandOf(orbitOf(0, places)).top).toBeCloseTo(28, 0);
    expect(CAKE.y - bandOf(orbitOf(1, places)).top).toBeCloseTo(70, 0);
    expect([0, 1].map((id) => orbitFits(id, { air: TALL, places }))).toEqual([true, true]);
    expect([0, 1].map((id) => orbitFits(id, { air: MEDIUM, places }))).toEqual([true, false]);
    expect([0, 1].map((id) => orbitFits(id, { air: SHORT, places }))).toEqual([false, false]);
  });
});

describe('placing the wasps', () => {
  it('sets both circling where their orbits fit, else resting on their spots', () => {
    const modes = (air: WaspAir) => placeWasps({ air, places, now: 0, rand: seeded(1) }).map((w) => w.mode);
    expect(modes(TALL)).toEqual(['circle', 'circle']);
    expect(modes(MEDIUM)).toEqual(['circle', 'rest']);
    expect(modes(SHORT)).toEqual(['rest', 'rest']);
    const tall = placeWasps({ air: TALL, places, now: 0, rand: seeded(1) });
    tall.forEach((w) => expect(inWaspAir(boxOf(w, places, 0)!, TALL)).toBe(true));
  });

  it('under reduced motion stands each on its spot: wasp 0 on the cake, wasp 1 on the jar', () => {
    const still = placeWasps({ air: TALL, places, now: 0, rand: seeded(1) }, true);
    expect(still.map((w) => w.mode)).toEqual(['rest', 'rest']);
    still.forEach((w) => {
      const view = waspView(w, places, 5000, true)!;
      expect(view.pose).toBe('standing');
      expect(view.x).toBeCloseTo(spotOf(w.id, places).x);
      expect(view.y + FOOTPRINTS.standing.down).toBeCloseTo(spotOf(w.id, places).y);
    });
  });
});

describe('how the wasps behave', () => {
  it('circle, inspect, land, feed, take off, back away and circle again', () => {
    const seen: Mode[] = [];
    const start = placeWasps({ air: TALL, places, now: 0, rand: () => 0.1 });
    run(start, () => TALL, 0, 30000, () => 0.1, () => null, (w) => { if (seen.at(-1) !== w[0].mode) seen.push(w[0].mode); });
    expect(seen.slice(0, 7)).toEqual(['circle', 'inspect', 'land', 'feed', 'takeoff', 'depart', 'circle']);
  });

  it('face the cake as they circle, turning about as they pass in front of it', () => {
    const faces: { side: number; face: number }[] = [];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.9 }), () => TALL, 0, 6000, () => 0.9, () => null, (w, now) => {
      if (w[0].mode !== 'circle') return;
      const p = where(w[0], places, now)!;
      faces.push({ side: Math.sign(p.x - CAKE.x), face: w[0].face });
    });
    const settledFaces = faces.filter((f, i) => i > 10 && faces.slice(i - 10, i).every((g) => g.side === f.side));
    expect(settledFaces.length).toBeGreaterThan(50);
    settledFaces.forEach((f) => expect(f.face).toBe(-f.side));
  });

  it('a fast cursor near a wasp chases it out past the window\'s edge, and it comes back later to circle', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const cursor = (now: number): Pointer | null => (now < 200 ? { x: at.x + 20, y: at.y + 5, at: now, speed: 400 } : null);
    const modes: Mode[] = [];
    const exits: number[] = [];
    run(start, () => TALL, 0, 25000, seeded(3), cursor, (w, now) => {
      if (modes.at(-1) !== w[0].mode) modes.push(w[0].mode);
      if (w[0].mode === 'flee') exits.push(boxOf(w[0], places, now)!.right);
    });
    expect(modes.slice(0, 4)).toEqual(['flee', 'away', 'return', 'circle']);
    expect(Math.min(...exits)).toBeLessThan(windowEdge(TALL));
  });

  it('stays away while a cursor rests near the cake, and lands nowhere near one', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const parked: Pointer = { x: CAKE.x, y: CAKE.y - 10, at: 0, speed: 0 };
    const cursor = (now: number): Pointer => (now < 200 ? { x: at.x + 20, y: at.y + 5, at: now, speed: 400 } : { ...parked, at: 200 });
    const after = run(start, () => TALL, 0, 30000, seeded(3), cursor);
    expect(after[0].mode).toBe('away');
    // Wasp 1 kept on, but never landed on the cake's side.
    const landed: number[] = [];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.1 }), () => TALL, 0, 20000, () => 0.1, () => parked, (w) => { if (w[0].mode === 'land') landed.push(0); });
    expect(landed).toEqual([]);
  });

  it('ignores a cursor that is still, however near', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const after = run(start, () => TALL, 0, 1000, seeded(3), () => ({ x: at.x, y: at.y, at: 0, speed: 0 }));
    expect(after.map((w) => w.mode)).toEqual(['circle', 'circle']);
  });

  it('with no clear way out, dodges to the far side of its orbit', () => {
    // A lane too thin for a wasp to fly along.
    const air: WaspAir = { ...TALL, lane: { ...TALL.lane, bottom: TALL.lane.top + 8 } };
    const start = placeWasps({ air, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const after = run(start, () => air, 0, 32, seeded(3), (now) => ({ x: at.x + 15, y: at.y, at: now, speed: 400 }));
    expect(after[0].mode).toBe('dodge');
  });

  it('lands when the air shrinks under its orbit, and takes off again once there is room', () => {
    const air = (now: number) => (now < 3000 ? TALL : now < 12000 ? SHORT : TALL);
    const modes: Mode[][] = [[], []];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.9 }), air, 0, 20000, () => 0.9, () => null, (w) => w.forEach((x, i) => { if (modes[i].at(-1) !== x.mode) modes[i].push(x.mode); }));
    for (const m of modes) {
      const down = m.findIndex((x) => x === 'land' || x === 'rest');
      expect(down).toBeGreaterThan(0);
      expect(m.lastIndexOf('takeoff')).toBeGreaterThan(down);
      expect(m.lastIndexOf('circle')).toBeGreaterThan(m.lastIndexOf('takeoff'));
    }
  });

  for (const [name, air] of [['tall', TALL], ['medium', MEDIUM]] as const) {
    it(`over long ${name} runs with a restless cursor never meet, and never leave the air or the lane`, () => {
      const problems: string[] = [];
      const seen = new Set<Mode>();
      for (const seed of [1, 2, 3]) {
        run(placeWasps({ air, places, now: 0, rand: seeded(seed) }), () => air, 0, 120000, seeded(seed + 10), restless(seed), (w, now, a) => {
          problems.push(...outsideAir(w, now, a), ...touching(w, now));
          w.forEach((x) => seen.add(x.mode));
        });
      }
      expect(problems.slice(0, 5)).toEqual([]);
      const modes: Mode[] = name === 'tall' ? ['circle', 'inspect', 'land', 'feed', 'takeoff', 'depart', 'flee', 'away', 'return'] : ['circle', 'inspect', 'feed', 'rest', 'flee', 'away', 'return'];
      expect([...seen].filter((m) => modes.includes(m)).sort()).toEqual([...modes].sort());
    }, 60_000);
  }

  it('keep clear of what the other has claimed, wherever it is going', () => {
    const wasps = placeWasps({ air: TALL, places, now: 0, rand: seeded(5) });
    const claims = claimsOf(wasps[1], places, 0);
    expect(claims.some((c) => meets(c, boxOf(wasps[0], places, 0)!))).toBe(false);
  });
});
