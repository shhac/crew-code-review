import { describe, expect, it } from 'vitest';
import { after, chainAt, chainFrom, chainHeading, chainOf, cubic, halves, heading, lengthOf, parabola, quadratic, reversedCurves, samples, splitAt, straight } from './curves';

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

  const curve = { from: { x: 0, y: 0 }, c1: { x: 10, y: -20 }, c2: { x: 30, y: -20 }, to: { x: 40, y: 0 } };

  it('runs straight at an even pace, its controls on the line', () => {
    const line = straight({ x: 3, y: 9 }, { x: 33, y: -21 });
    expect(line.c1).toEqual({ x: 13, y: -1 });
    expect(line.c2).toEqual({ x: 23, y: -11 });
    expect(cubic(line, 0.5).x).toBeCloseTo(18, 9);
    // The thirds as d / 3, which d * (1 / 3) does not always match.
    expect(straight({ x: 0, y: 0 }, { x: 0.7, y: 0 }).c1.x).toBe(0.7 / 3);
  });

  it('splits a curve into two that trace the same points', () => {
    const [before, rest] = splitAt(curve, 0.3);
    expect(before.from).toEqual(curve.from);
    expect(rest.to).toEqual(curve.to);
    expect(before.to).toEqual(rest.from);
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const p = cubic(before, u), q = cubic(curve, 0.3 * u);
      expect(p.x).toBeCloseTo(q.x, 9);
      expect(p.y).toBeCloseTo(q.y, 9);
      const r = cubic(rest, u), s = cubic(curve, 0.3 + 0.7 * u);
      expect(r.x).toBeCloseTo(s.x, 9);
      expect(r.y).toBeCloseTo(s.y, 9);
    }
    expect(after(curve, 0.3)).toEqual(rest);
    expect(halves(curve)).toEqual(splitAt(curve, 0.5));
  });

  it('reverses a chain, last curve first, each from its end', () => {
    const next = { from: curve.to, c1: { x: 50, y: 10 }, c2: { x: 60, y: 10 }, to: { x: 70, y: 0 } };
    const back = reversedCurves([curve, next]);
    expect(back[0]).toEqual({ from: next.to, c1: next.c2, c2: next.c1, to: next.from });
    expect(back[1].to).toEqual(curve.from);
    expect(cubic(back[1], 0.25)).toEqual(cubic(curve, 0.75));
  });

  describe('a chain', () => {
    const first = straight({ x: 0, y: 0 }, { x: 30, y: 0 });
    const second = straight({ x: 30, y: 0 }, { x: 30, y: 10 });
    const curves = [first, second];

    it('measures each curve once, as finely as asked', () => {
      const chain = chainOf(curves);
      expect(chainOf(curves)).toBe(chain);
      expect(chain.lengths[0]).toBeCloseTo(30, 9);
      expect(chain.length).toBeCloseTo(40, 9);
      const bent = [curve];
      expect(chainOf(bent, 32).length).toBe(lengthOf((t) => cubic(curve, t), 32));
      expect(chainOf(bent, 32).length).not.toBe(chainOf(bent).length);
    });

    it('finds a distance on the curve that reaches it, linearly within it', () => {
      const chain = chainOf(curves);
      expect(chainAt(chain, 15)).toMatchObject({ i: 0, curve: first, t: 0.5 });
      const on = chainAt(chain, 35);
      expect(on?.i).toBe(1);
      expect(on?.t).toBeCloseTo(0.5, 9);
      expect(on?.p.y).toBeCloseTo(5, 9);
      expect(chainAt(chain, chain.lengths[0])?.i).toBe(0);
      expect(chainAt(chain, -5)?.p).toEqual(first.from);
      expect(chainAt(chain, 99)?.p).toEqual(second.to);
      expect(chainAt(chainOf([]), 3)).toBeNull();
    });

    it('puts a curve of no length at its end', () => {
      const still = straight({ x: 30, y: 0 }, { x: 30, y: 0 });
      expect(chainAt(chainOf([first, still, second]), 30)).toMatchObject({ i: 0, t: 1 });
      expect(chainAt(chainOf([still]), 0)).toMatchObject({ i: 0, t: 1 });
    });

    it('heads the way the curve it is on goes', () => {
      const chain = chainOf(curves);
      expect(chainHeading(chain, 10, 0.02).x).toBeCloseTo(1.2, 9);
      expect(chainHeading(chain, 35, 0.01).y).toBeCloseTo(0.2, 9);
      expect(chainHeading(chainOf([]), 0, 0.02)).toEqual({ x: 0, y: 0 });
    });

    it('splits off what is left from a distance on', () => {
      const chain = chainOf(curves);
      const rest = chainFrom(chain, 15);
      expect(rest).toEqual([after(first, 0.5), second]);
      expect(chainOf(rest).length).toBeCloseTo(25, 9);
      expect(chainFrom(chainOf([]), 0)).toEqual([]);
    });
  });
});
