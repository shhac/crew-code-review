import { describe, expect, it } from 'vitest';
import { apart, clamp, clamp01, degrees, mix, mixPoint, rad, sign, smooth } from './math';

describe('shared maths', () => {
  it('clamps into a range, and into 0 to 1', () => {
    expect([clamp(-3, 0, 10), clamp(4, 0, 10), clamp(12, 0, 10)]).toEqual([0, 4, 10]);
    expect([clamp01(-0.5), clamp01(0.25), clamp01(2)]).toEqual([0, 0.25, 1]);
  });
  it('smooths from 0 to 1, symmetric about the middle and held outside', () => {
    expect([smooth(-1), smooth(0), smooth(0.5), smooth(1), smooth(2)]).toEqual([0, 0, 0.5, 1, 1]);
    expect(smooth(0.25) + smooth(0.75)).toBeCloseTo(1);
    expect(smooth(0.25)).toBeCloseTo(0.15625);
  });
  it('takes standing still as forward', () => {
    expect([sign(-2), sign(0), sign(3)]).toEqual([-1, 1, 1]);
  });
  it('mixes numbers and points', () => {
    expect(mix(10, 20, 0.25)).toBe(12.5);
    expect(mixPoint({ x: 0, y: 10 }, { x: 10, y: 0 }, 0.5)).toEqual({ x: 5, y: 5 });
  });
  it('turns degrees and radians into each other', () => {
    expect(rad(180)).toBeCloseTo(Math.PI);
    expect(degrees(Math.PI / 2)).toBeCloseTo(90);
    expect(degrees(rad(37))).toBeCloseTo(37);
  });
  it('measures how far apart two points are', () => {
    expect(apart({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(apart({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});
