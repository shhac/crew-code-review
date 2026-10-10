import { describe, expect, it } from 'vitest';
import { cubic, heading, lengthOf, parabola, quadratic, samples } from './curves';

describe('curves', () => {
  it('runs a cubic and an arc from end to end', () => {
    const curve = { from: { x: 0, y: 0 }, c1: { x: 10, y: -20 }, c2: { x: 30, y: -20 }, to: { x: 40, y: 0 } };
    expect(cubic(curve, 0)).toEqual(curve.from);
    expect(cubic(curve, 1)).toEqual(curve.to);
    const arc = { from: { x: 0, y: 0 }, via: { x: 20, y: -40 }, to: { x: 40, y: 0 } };
    expect(quadratic(arc, 0.5)).toEqual({ x: 20, y: -20 });
    expect(heading(arc, 0.5)).toEqual({ x: 40, y: 0 });
  });

  it('lifts a hop by its rise halfway, and lands where it was aimed', () => {
    const p = { x: 0, y: 100 }, q = { x: 80, y: 60 };
    expect(parabola(p, q, 12, 0)).toEqual(p);
    expect(parabola(p, q, 12, 1)).toEqual(q);
    expect(parabola(p, q, 12, 0.5)).toEqual({ x: 40, y: 80 - 12 });
  });

  it('samples a curve no further apart than asked', () => {
    const line = (t: number) => ({ x: 100 * t, y: 0 });
    expect(lengthOf(line)).toBeCloseTo(100, 9);
    const points = samples(line, 4).map((s) => s.p);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 100, y: 0 });
    expect(points.slice(1).every((p, i) => p.x - points[i].x <= 4)).toBe(true);
  });
});
