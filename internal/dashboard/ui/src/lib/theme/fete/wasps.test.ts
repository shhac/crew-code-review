import { describe, expect, it } from 'vitest';
import { seeded } from '../test-scene';
import { inWaspAir, type WaspAir } from './air';
import { MEDIUM, SHORT, TALL, outsideAir, places, run, touching } from './fixtures';
import { STAND } from './footprints';
import { boxOf, spotOf, waspView, where, type Mode, type Pointer } from './wasp';
import { placeWasps } from './wasps';

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
      expect(view.y + STAND).toBeCloseTo(spotOf(w.id, places).y);
    });
  });
});

describe('the pair together', () => {
  it('lands when the air shrinks under its orbit, and takes off again once there is room, never meeting or leaving the air', () => {
    const air = (now: number) => (now < 3000 ? TALL : now < 12000 ? SHORT : TALL);
    const modes: Mode[][] = [[], []];
    const problems: string[] = [];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.9 }), air, 0, 20000, () => 0.9, () => null, (w, now, a) => {
      problems.push(...outsideAir(w, now, a), ...touching(w, now));
      w.forEach((x, i) => { if (modes[i].at(-1) !== x.mode) modes[i].push(x.mode); });
    });
    expect(problems.slice(0, 5)).toEqual([]);
    for (const m of modes) {
      const down = m.findIndex((x) => x === 'land' || x === 'rest');
      expect(down).toBeGreaterThan(0);
      expect(m.lastIndexOf('takeoff')).toBeGreaterThan(down);
      expect(m.lastIndexOf('circle')).toBeGreaterThan(m.lastIndexOf('takeoff'));
    }
  });

  it('sends a wasp shrunk out of its flight back to its orbit or down to its spot, never leaving the new air', () => {
    for (const small of [MEDIUM, SHORT]) {
      for (const shrinkAt of [200, 400, 600]) {
        const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
        const at = where(start[0], places, 16)!;
        const cursor = (now: number): Pointer | null => (now < 100 ? { x: at.x + 20, y: at.y + 5, at: now, speed: 400 } : null);
        const problems: string[] = [];
        const after: Mode[] = [];
        run(start, (now) => (now < shrinkAt ? TALL : small), 0, 4000, seeded(3), cursor, (w, now, a) => {
          problems.push(...outsideAir(w, now, a), ...touching(w, now));
          if (now === 16 || (now >= shrinkAt && now < shrinkAt + 16)) after.push(w[0].mode);
        });
        expect(after[0]).toBe('flee');
        expect(['circle', 'land', 'rest']).toContain(after[1]);
        expect(problems.slice(0, 5)).toEqual([]);
      }
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
});
