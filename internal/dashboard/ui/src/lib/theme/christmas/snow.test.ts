import { describe, expect, it } from 'vitest';
import { choosePerch, ROBIN, snowProfile } from './snow';
import type { Ledge } from '../floors';

const ledge: Ledge = { left: 100, right: 400, y: 150, base: 300, room: 80, headroom: Infinity, kind: 'card' };
describe('still Christmas geometry', () => {
  it('clips, tapers, leaves gaps and stays above the edge within clearance', () => {
    const samples = snowProfile(7, ledge);
    expect(samples[0]).toEqual({ x: 8, depth: 0 });
    expect(samples.at(-1)).toEqual({ x: 292, depth: 0 });
    expect(samples.some((s) => s.x > 30 && s.x < 270 && s.depth === 0)).toBe(true);
    expect(samples.some((s) => s.depth > 3)).toBe(true);
    for (const s of samples) expect(s.depth).toBeGreaterThanOrEqual(0);
    for (const room of [5, 8, 20, Infinity]) {
      for (const s of snowProfile(7, { ...ledge, room })) expect(s.depth).toBeLessThanOrEqual(Math.min(9, room - 4));
    }
    expect(snowProfile(7, { ...ledge, room: 4 })).toEqual([]);
    expect(Math.max(...snowProfile(7, { ...ledge, kind: 'heading' }).map((s) => s.depth))).toBeLessThanOrEqual(3);
  });
  it('preserves local profiles on scroll and overlapping samples on resize', () => {
    const samples = snowProfile(3, ledge);
    expect(snowProfile(3, { ...ledge, left: 120, right: 420, y: 50 })).toEqual(samples);
    const wider = snowProfile(3, { ...ledge, right: 500 });
    expect(wider.filter((s) => s.x < 270)).toEqual(samples.filter((s) => s.x < 270));
    expect(snowProfile(4, ledge)).not.toEqual(samples);
  });
  it('reserves a twenty-pixel patch at the feet', () => {
    expect(snowProfile(7, ledge, 60).filter((s) => Math.abs(s.x - 60) <= 10).every((s) => s.depth === 0)).toBe(true);
  });
  it('retains a safe local perch, relocates invalid ones and hides without a perch', () => {
    const floors = new Map([[1, ledge]]);
    const perch = choosePerch(floors, 800, 600);
    expect(perch).toEqual({ floor: 1, x: 24, dir: 1 });
    expect(choosePerch(new Map([[1, { ...ledge, y: 80 }]]), 800, 600, perch)).toEqual(perch);
    expect(choosePerch(new Map([[2, ledge]]), 800, 600, perch)?.floor).toBe(2);
    expect(choosePerch(new Map([[1, { ...ledge, room: 24 }]]), 800, 600, perch)).toBe(perch);
    for (const f of [{ ...ledge, headroom: 20 }, { ...ledge, y: 30 }, { ...ledge, left: 900, right: 1200 }]) {
      expect(choosePerch(new Map([[1, f]]), 800, 600)).toBeNull();
    }
    expect(choosePerch(new Map(), 800, 600, perch)).toBeNull();
  });
  it('keeps the untrimmed cell and mirrored foot anchor', () => {
    expect(ROBIN.width).toBeCloseTo(44.8);
    expect(ROBIN.height).toBeCloseTo(39.2);
    expect(ROBIN.anchorX).toBeCloseTo(22.4);
    expect(ROBIN.anchorY).toBeCloseTo(35.735);
    expect(ROBIN.width - ROBIN.anchorX).toBe(ROBIN.anchorX);
  });
});
