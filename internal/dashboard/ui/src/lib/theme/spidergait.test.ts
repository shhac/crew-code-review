import { describe, expect, it } from 'vitest';
import { cycleLength, footAt, kneeFor, legsAt, restingLeg, type LegSpec } from './spidergait';

const leg: LegSpec = { hip: { x: 20, y: 18 }, reach: 8, thigh: 12, shin: 14, beat: 0 };
const GROUND = 30;
const STRIDE = 6;
const LIFT = 3;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('footAt', () => {
  it('keeps a planted foot fixed on the floor while the body walks over it', () => {
    // The body moves forward by d; a planted foot moves back by d relative to
    // the body, so in floor coordinates it does not move at all.
    const cycle = cycleLength(STRIDE);
    const floorX = (walked: number) => footAt(leg, walked / cycle, GROUND, STRIDE, LIFT).x + walked;
    expect(floorX(0)).toBeCloseTo(floorX(1));
    expect(floorX(1)).toBeCloseTo(floorX(3));
    expect(footAt(leg, 0.3, GROUND, STRIDE, LIFT).y).toBe(GROUND);
  });

  it('lifts the foot off the floor while it swings forward', () => {
    const swing = footAt(leg, 0.82, GROUND, STRIDE, LIFT);
    expect(swing.y).toBeLessThan(GROUND);
    expect(footAt(leg, 0.7, GROUND, STRIDE, LIFT).x).toBeLessThan(footAt(leg, 0.95, GROUND, STRIDE, LIFT).x);
  });

  it('repeats every cycle and puts alternate legs half a cycle apart', () => {
    expect(footAt(leg, 1.3, GROUND, STRIDE, LIFT)).toEqual(footAt(leg, 0.3, GROUND, STRIDE, LIFT));
    const other = { ...leg, beat: 0.5 as const };
    expect(footAt(other, 0, GROUND, STRIDE, LIFT)).toEqual(footAt(leg, 0.5, GROUND, STRIDE, LIFT));
  });
});

describe('kneeFor', () => {
  it('joins thigh and shin at their true lengths, arched above the hip', () => {
    const foot = { x: 30, y: GROUND };
    const knee = kneeFor(leg.hip, foot, leg.thigh, leg.shin);
    expect(dist(leg.hip, knee)).toBeCloseTo(leg.thigh);
    expect(dist(knee, foot)).toBeCloseTo(leg.shin);
    expect(knee.y).toBeLessThan(leg.hip.y);
  });

  it('straightens toward a foot that is out of reach instead of failing', () => {
    const knee = kneeFor({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10);
    expect(knee.x).toBeCloseTo(10);
    expect(Number.isFinite(knee.y)).toBe(true);
  });
});

describe('legsAt', () => {
  it('half the feet are always on the floor', () => {
    const specs: LegSpec[] = [leg, { ...leg, beat: 0.5 }, { ...leg, reach: -6 }, { ...leg, reach: -6, beat: 0.5 }];
    for (const phase of [0, 0.2, 0.4, 0.6, 0.8]) {
      const planted = legsAt(specs, phase, GROUND, STRIDE, LIFT).filter((l) => l.foot.y === GROUND);
      expect(planted.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('restingLeg', () => {
  it('stands the foot at its rest point on the floor, the knee joining both bones', () => {
    const rest = restingLeg(leg, GROUND);
    expect(rest.foot).toEqual({ x: leg.hip.x + leg.reach, y: GROUND });
    expect(dist(leg.hip, rest.knee)).toBeCloseTo(leg.thigh);
    expect(dist(rest.knee, rest.foot)).toBeCloseTo(leg.shin);
  });
});
