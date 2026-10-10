import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { fixed, scene, seeded, steps } from '../test-scene';
import { busy, POSES, type Rabbit } from './rabbit';
import { createRabbits, reconcileRabbits, restingRabbits, stepRabbits, takeEggs, type Rabbits } from './rabbits';

const ledge = (y: number, left = 100, right = 700): Ledge => ({ left, right, y, base: y + 200, room: 40, headroom: Infinity, kind: 'card' });
const roomy = scene([[1, ledge(200)], [2, ledge(400)], [3, ledge(600)]]);
const pointOf = (r: Rabbit, page = roomy) => ({ x: page.floors.get(r.floor)!.left + r.x, y: page.floors.get(r.floor)!.y - 13 });
const shown = (g: Rabbits) => g.rabbits.filter((r) => r.mode !== 'away');

// Every pair on one ledge, drawn, never overlapping: their footprints apart.
function apart(g: Rabbits): boolean {
  const seen = shown(g);
  return seen.every((a, i) => seen.slice(i + 1).every((b) => a.floor !== b.floor || Math.abs(a.x - b.x) >= POSES.nudge.width));
}

const live = (g: Rabbits, from: number, to: number, rand: () => number, cursor: (t: number) => { x: number; y: number } | null = () => null, canLay = () => true) =>
  steps(g, from, to, (s, t) => takeEggs(stepRabbits(s, roomy, t, 50, rand, cursor(t) && { ...cursor(t)!, at: t }, canLay)).group);

describe('the rabbits', () => {
  it('are three where the page has room, else two', () => {
    expect(createRabbits(roomy, 0, fixed(0.5)).rabbits).toHaveLength(3);
    const one = scene([[1, ledge(200, 100, 260)]]);
    expect(createRabbits(one, 0, fixed(0.5)).target).toBe(2);
  });

  it('spread over the ledges first', () => {
    const g = createRabbits(roomy, 0, fixed(0.5));
    expect(new Set(g.rabbits.map((r) => r.floor)).size).toBe(3);
  });

  it('never overlap, and only one is ever up to something big, over long random runs', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rand = seeded(seed);
      const cursorAt = (t: number) => (Math.floor(t / 7000) % 3 === 1 ? { x: 100 + ((t / 10) % 600), y: 200 + 200 * (Math.floor(t / 21000) % 3) - 12 } : null);
      const states = live(createRabbits(roomy, 0, rand), 0, 120000, rand, cursorAt);
      for (const g of states) {
        expect(apart(g)).toBe(true);
        expect(g.rabbits.filter(busy).length).toBeLessThanOrEqual(1);
        expect(g.rabbits).toHaveLength(g.target);
      }
      // They do get about: hops, trips and eggs.
      expect(states.some((g) => g.rabbits.some((r) => r.mode === 'away'))).toBe(true);
      expect(states.some((g) => g.rabbits.some((r) => r.mode === 'hop'))).toBe(true);
    }
  });

  it('leave eggs now and then, which the hunt takes', () => {
    const rand = seeded(9);
    const left = steps({ g: createRabbits(roomy, 0, rand), eggs: 0 }, 0, 120000, (s, t) => {
      const { group, eggs } = takeEggs(stepRabbits(s.g, roomy, t, 50, rand, null, () => true));
      return { g: group, eggs: s.eggs + eggs.length };
    }).at(-1)!;
    expect(left.eggs).toBeGreaterThan(0);
    expect(left.g.rabbits.every((r) => r.left === null)).toBe(true);
  });

  it('sit up when one of them thumps nearby', () => {
    const page = scene([[1, ledge(200, 100, 900)]]);
    const g = createRabbits(page, 0, fixed(0.5));
    const [a, b] = g.rabbits;
    const near: Rabbits = { target: 2, rabbits: [{ ...a, until: Infinity, x: 300 }, { ...b, until: Infinity, x: 450 }] };
    const at = pointOf(near.rabbits[0], page);
    const states = steps(near, 0, 1600, (s, t) => stepRabbits(s, page, t, 50, seeded(1), { ...at, at: t }, () => false));
    const thumped = states.findIndex((s) => s.rabbits[0].mode === 'thump');
    expect(thumped).toBeGreaterThan(0);
    expect(states[thumped].rabbits[1].mode).toBe('alert');
  });

  it('keeps its number over layout changes, never growing past it', () => {
    const g = createRabbits(roomy, 0, fixed(0.5));
    const fewer = scene([[1, ledge(200)]]);
    const squeezed = reconcileRabbits(g, fewer, 0, fixed(0.5));
    expect(squeezed.target).toBe(3);
    expect(squeezed.rabbits.length).toBeLessThanOrEqual(3);
    expect(apart(squeezed)).toBe(true);
    const back = reconcileRabbits(squeezed, roomy, 0, fixed(0.5));
    expect(back.rabbits).toHaveLength(3);
  });

  it('sit still in their places under reduced motion', () => {
    const still = restingRabbits(roomy, null);
    expect(still.rabbits.length).toBe(3);
    expect(still.rabbits.every((r) => r.mode === 'sit' && r.until === Infinity)).toBe(true);
    expect(restingRabbits(roomy, still)).toEqual(still);
  });
});
