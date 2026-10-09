import { describe, expect, it } from 'vitest';
import type { PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { fixed, scene, seeded, steps } from '../test-scene';
import { foxView, type Fox } from './fox';
import { asleep, card, rule, still } from './fox-fixtures';
import { createFoxes, reconcileFoxes, restingFoxes, stepFoxes, type Foxes } from './foxes';

describe('foxes together', () => {
  const wide = { ...rule, left: 100, right: 900 };
  const lower = { ...card, left: 100, right: 700, y: 400, headroom: 60 };
  const SPACING = 120;
  const pair = (a: Partial<Fox>, b: Partial<Fox>): Foxes => ({ target: 2, foxes: [asleep(1, 150, { id: 0, seed: 1, ...a }), asleep(1, 500, { id: 1, seed: 2, ...b })] });
  const cursorAt = (s: PageMap, fox: Fox) => still(s.floors.get(fox.floor)!.left + fox.x + 40, s.floors.get(fox.floor)!.y - 8);
  const groupTrace = (g: Foxes, s: PageMap, from: number, to: number, cursor: (t: number) => Cursor | null = () => null, rand: () => number = fixed(0.5)) =>
    steps(g, from, to, (x, t) => stepFoxes(x, s, t, 50, rand, cursor(t)));

  it('places three where there is room for three apart, else two', () => {
    expect(createFoxes(scene([[1, wide], [2, lower]]), 0, fixed(0.5)).foxes).toHaveLength(3);
    const g = createFoxes(scene([[1, { ...rule, right: 250 }]]), 0, fixed(0.5));
    expect(g.target).toBe(2);
    expect(g.foxes.length).toBeLessThanOrEqual(2);
    expect(createFoxes(scene([]), 0, fixed(0.5)).foxes).toEqual([]);
  });

  it('spreads them over different ledges first, and keeps those sharing one well apart', () => {
    const { foxes } = createFoxes(scene([[1, wide], [2, lower]]), 0, fixed(0.5));
    expect(new Set(foxes.map((f) => f.floor))).toEqual(new Set([1, 2]));
    const shared = foxes.filter((f) => f.floor === foxes[0].floor).map((f) => f.x);
    shared.slice(1).forEach((x, i) => expect(Math.abs(x - shared[i])).toBeGreaterThanOrEqual(SPACING));
    expect(new Set(foxes.map((f) => f.id)).size).toBe(foxes.length);
    expect(new Set(foxes.map((f) => f.seed)).size).toBe(foxes.length);
  });

  it('lets only one be up at a time: another the cursor lingers by just looks up', () => {
    const s = scene([[1, wide]]);
    const g = pair({ mode: 'trot', target: 300, until: 0 }, {});
    const states = groupTrace(g, s, 0, 2500, () => cursorAt(s, g.foxes[1]));
    expect(states.every((x) => x.foxes[1].mode === 'asleep')).toBe(true);
    expect(states.some((x) => foxView(x.foxes[1], s, 2000)?.pose === 'alert')).toBe(true);
  });

  it('puts off waking on its own while another is up', () => {
    const s = scene([[1, wide]]);
    const later = groupTrace(pair({ mode: 'trot', target: 300 }, { until: 100 }), s, 0, 1000).at(-1)!;
    expect(later.foxes[1].mode).toBe('asleep');
    expect(later.foxes[1].until).toBeGreaterThan(1000);
  });

  it('makes the others nearby look up when one is startled awake', () => {
    const s = scene([[1, wide], [2, { ...lower, y: 700, left: 600, right: 900 }]]);
    const g: Foxes = { target: 3, foxes: [asleep(1, 150, { id: 0 }), asleep(1, 320, { id: 1, seed: 2 }), asleep(2, 200, { id: 2, seed: 3, floor: 2 })] };
    const states = groupTrace(g, s, 0, 2000, () => cursorAt(s, g.foxes[0]));
    const woke = states.findIndex((x) => x.foxes[0].mode === 'waking');
    expect(woke).toBeGreaterThan(0);
    expect(states[woke].foxes[1].look).toBeGreaterThan(woke * 50);
    expect(states[woke].foxes[2].look).toBe(0);
    expect(states[woke].foxes[1].mode).toBe('asleep');
  });

  it('trots no nearer another fox than the spacing, and never past one', () => {
    const s = scene([[1, wide]]);
    const g = pair({}, {});
    const cursor = (t: number) => (t < 2000 ? still(wide.left + 150 - 40, wide.y - 8) : null);
    const states = groupTrace(g, s, 0, 20000, cursor, fixed(1));
    expect(states.some((x) => x.foxes[0].mode === 'trot')).toBe(true);
    states.forEach((x) => expect(Math.abs(x.foxes[0].x - x.foxes[1].x)).toBeGreaterThanOrEqual(SPACING - 1e-6));
  });

  it('never trots in to lie down near a fox on the ledge it changes to', () => {
    const s = scene([[1, rule], [2, lower]]);
    const g: Foxes = { target: 2, foxes: [asleep(1, 300, { id: 0 }), asleep(2, 520, { id: 1, seed: 2, floor: 2 })] };
    const states = groupTrace(g, s, 0, 30000, () => cursorAt(s, g.foxes[0]));
    const trip = states.find((x) => x.foxes[0].trip)?.foxes[0].trip;
    expect(trip?.floor).toBe(2);
    expect(Math.abs(trip!.x - 520)).toBeGreaterThanOrEqual(SPACING);
    expect(Math.abs(trip!.entry - 520)).toBeGreaterThanOrEqual(SPACING);
    expect(states.at(-1)!.foxes[0]).toMatchObject({ floor: 2, mode: 'asleep' });
    states.forEach((x) => {
      const [a, b] = x.foxes;
      if (a.mode !== 'away' && a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING - 1e-6);
    });
  });

  it('keeps them apart, whatever the cursor and the draws', () => {
    const s = scene([[1, wide], [2, lower], [3, { ...lower, y: 600 }]]);
    for (const seed of [1, 2, 3, 5]) {
      const rand = seeded(seed);
      const g = createFoxes(s, 0, rand);
      const states = groupTrace(g, s, 0, 120000, (t) => still(wide.left + 400 + 300 * Math.sin(t / 3000), wide.y - 8 + 200 * Math.sin(t / 7000), t), rand);
      for (const x of states) {
        const shown = x.foxes.filter((f) => f.mode !== 'away');
        shown.forEach((a, i) => shown.slice(i + 1).forEach((b) => {
          if (a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING - 1e-6);
        }));
        expect(x.foxes.filter((f) => f.mode !== 'asleep').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('re-places one crowded by a layout change, and never grows past its target', () => {
    const s = scene([[1, wide]]);
    const g = pair({}, {});
    const squeezed = reconcileFoxes({ ...g, foxes: [g.foxes[0], { ...g.foxes[1], x: 200 }] }, s, 0, fixed(0.5));
    expect(squeezed.foxes).toHaveLength(2);
    expect(Math.abs(squeezed.foxes[0].x - squeezed.foxes[1].x)).toBeGreaterThanOrEqual(SPACING);
    expect(squeezed.foxes[0]).toEqual(g.foxes[0]);
    const roomier = reconcileFoxes(g, scene([[1, wide], [2, lower], [3, { ...lower, y: 600 }]]), 0, fixed(0.5));
    expect(roomier.foxes).toHaveLength(2);
  });

  it('puts back one it lost, up to its target, once there is room again', () => {
    const s = scene([[1, wide]]);
    const g = pair({}, {});
    const cramped = reconcileFoxes(g, scene([[1, { ...rule, right: 250 }]]), 0, fixed(0.5));
    expect(cramped.foxes).toHaveLength(1);
    expect(reconcileFoxes(cramped, s, 10, fixed(0.5)).foxes.map((f) => f.id)).toEqual([0, 1]);
  });

  it('sleeps them all through reduced motion at their own spots, kept across a scroll', () => {
    const s = scene([[1, wide], [2, lower]]);
    const g = restingFoxes(s, null);
    expect(g.foxes.length).toBe(3);
    expect(g.foxes.every((f) => f.mode === 'asleep' && f.until === Infinity)).toBe(true);
    const scrolled = scene([[1, { ...wide, y: 180 }], [2, { ...lower, y: 380 }]]);
    expect(restingFoxes(scrolled, g).foxes.map((f) => [f.floor, f.x])).toEqual(g.foxes.map((f) => [f.floor, f.x]));
  });

  it('never trots through one placed afresh by a layout change, nor lies down by it', () => {
    // Fox 1 is trotting toward fox 0 when text covers fox 0's spot.
    const g: Foxes = { target: 2, foxes: [asleep(1, 150, { id: 0 }), asleep(1, 600, { id: 1, seed: 2, mode: 'trot', target: 270, dir: -1 })] };
    const s = scene([[1, wide]], [{ left: 230, right: 270, top: 185, bottom: 195 }]);
    const later = reconcileFoxes(g, s, 0, fixed(0.2));
    const states = groupTrace(later, s, 0, 20000);
    states.forEach((x) => {
      const [a, b] = x.foxes;
      if (a.floor === b.floor && a.mode !== 'away' && b.mode !== 'away') expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING - 1e-6);
    });
    const order = (x: Foxes) => Math.sign(x.foxes[0].x - x.foxes[1].x);
    expect(new Set(states.map(order)).size).toBe(1);
  });

  it('keeps them apart through layout changes too, whatever the draws', () => {
    const layouts = [scene([[1, wide], [2, lower]]), scene([[1, wide], [2, lower]], [{ left: 300, right: 500, top: 185, bottom: 195 }]), scene([[1, { ...wide, right: 600 }], [2, lower]])];
    for (const seed of [1, 2, 3]) {
      const rand = seeded(seed);
      const run = Array.from({ length: 24 }, (_, k) => k).reduce<{ g: Foxes; all: Foxes[] }>(({ g, all }, k) => {
        const s = layouts[k % layouts.length];
        const placed = reconcileFoxes(g, s, k * 5000, rand);
        const states = groupTrace(placed, s, k * 5000, k * 5000 + 4950, (t) => still(wide.left + 400 + 300 * Math.sin(t / 3000), wide.y - 8, t), rand);
        return { g: states.at(-1)!, all: [...all, ...states] };
      }, { g: createFoxes(layouts[0], 0, rand), all: [] });
      for (const x of run.all) {
        const shown = x.foxes.filter((f) => f.mode !== 'away');
        shown.forEach((a, i) => shown.slice(i + 1).forEach((b) => {
          if (a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING - 1e-6);
        }));
      }
    }
  });
});
