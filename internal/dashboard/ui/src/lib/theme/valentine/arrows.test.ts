import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { BURST, HEART_SPREAD, LANDING_CLEAR, MAX_SLANT, MAX_STUCK, STUCK_LENGTH, hearts, land, landable, opacity, prune, reconcileStuck, slantOf, wobble, type Stuck } from './arrows';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
const stuck = (at: number, over: Partial<Stuck> = {}): Stuck => ({ key: `a${at}`, floor: 1, x: 200, slant: 20, at, fading: Infinity, ...over });

describe('spent arrows', () => {
  it('lean back along the way they flew, never lying flat', () => {
    expect(slantOf(0, 1)).toBeCloseTo(0);
    // Flying right and down, it stands leaning back to the left.
    expect(slantOf(1, 1)).toBeCloseTo(-45);
    expect(slantOf(-1, 1)).toBeCloseTo(45);
    expect(Math.abs(slantOf(1, 0))).toBe(MAX_SLANT);
    expect(Math.abs(slantOf(1, -1))).toBe(MAX_SLANT);
  });

  it('quiver as they land, then stand still', () => {
    const a = stuck(1000);
    const angles = Array.from({ length: 60 }, (_, i) => wobble(a, 1000 + i * 20));
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(8);
    expect(Math.max(...angles.map((x) => Math.abs(x - a.slant)))).toBeLessThanOrEqual(9);
    // Damped: the second half quivers less than the first.
    const swing = (xs: number[]) => Math.max(...xs.map((x) => Math.abs(x - a.slant)));
    expect(swing(angles.slice(30))).toBeLessThan(swing(angles.slice(0, 30)) / 3);
    expect(wobble(a, 2300)).toBe(a.slant);
  });

  it('hold, then fade, then go', () => {
    const a = stuck(0);
    expect(opacity(a, 5000)).toBe(1);
    expect(opacity(a, 6750)).toBeCloseTo(0.5);
    expect(opacity(a, 7600)).toBe(0);
    expect(prune([a], 7600)).toEqual([]);
    expect(prune([a], 5000)).toEqual([a]);
  });

  it(`keep at most ${MAX_STUCK} standing: a newer one fades the oldest out`, () => {
    const arrows = [0, 100, 200].reduce<Stuck[]>((all, at) => land(all, stuck(at), at), []);
    expect(arrows.every((a) => a.fading === Infinity)).toBe(true);
    const more = land(arrows, stuck(300), 300);
    expect(more.map((a) => a.fading)).toEqual([300, Infinity, Infinity, Infinity]);
    expect(opacity(more[0], 450)).toBeCloseTo(0.5);
    expect(prune(more, 700)).toHaveLength(3);
  });

  it('land only with room for themselves and their hearts', () => {
    expect(landable(card, [], 200)).toBe(true);
    expect(landable(card, [], 10)).toBe(false);
    const text = { left: 250, right: 400, top: 270, bottom: 290 };
    expect(landable(card, [text], 240)).toBe(false);
    expect(landable(card, [text], 250 - 100 - HEART_SPREAD - 1)).toBe(true);
    expect(STUCK_LENGTH).toBeLessThan(LANDING_CLEAR);
  });

  it('go when their ledge goes or the stretch round them is covered', () => {
    const a = stuck(0, { x: 200 });
    expect(reconcileStuck([a], new Map([[1, card]]), [])).toEqual([a]);
    expect(reconcileStuck([a], new Map(), [])).toEqual([]);
    expect(reconcileStuck([a], new Map([[1, card]]), [{ left: 290, right: 320, top: 280, bottom: 295 }])).toEqual([]);
  });
});

describe('hearts', () => {
  const burst = { key: 'b', floor: 1, x: 200, at: 1000, seed: 3 };

  it('pop four, rising and spreading, then are gone', () => {
    expect(hearts(burst, 999)).toEqual([]);
    expect(hearts(burst, 1000)).toHaveLength(4);
    expect(hearts(burst, 1000 + BURST)).toEqual([]);
    const late = hearts(burst, 1000 + BURST * 0.95);
    expect(late.every((h) => h.opacity < 0.2)).toBe(true);
  });

  it('stay inside the landing clearance', () => {
    for (const t of Array.from({ length: BURST / 10 }, (_, i) => i * 10)) {
      for (const h of hearts(burst, 1000 + t)) {
        // A heart is 6px across at full size.
        expect(Math.abs(h.dx) + 3 * h.scale).toBeLessThanOrEqual(HEART_SPREAD);
        expect(-h.dy + 3 * h.scale).toBeLessThanOrEqual(LANDING_CLEAR);
        expect(h.dy).toBeLessThanOrEqual(0);
      }
    }
  });
});
