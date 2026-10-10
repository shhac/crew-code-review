import { describe, expect, it } from 'vitest';
import { antennaLayer, antennaPoints, flicking, turnedBy, type Antenna } from './antennae';

const near: Antenna = { base: { x: 19, y: 6.2 }, scape: 1.1, flagellum: 3.8, angle: -15, elbow: 70, curve: 25 };
const length = (points: { x: number; y: number }[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

describe('antennaPoints', () => {
  it('runs the scape from the face to the elbow, then the flagellum, each its length', () => {
    const points = antennaPoints(near);
    expect(points[0]).toEqual(near.base);
    expect(length(points.slice(0, 2))).toBeCloseTo(near.scape);
    expect(length(points.slice(1))).toBeCloseTo(near.flagellum);
  });

  it('bends at the elbow, then curves on down to the tip', () => {
    const points = antennaPoints(near);
    const heading = (i: number) => (Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x) * 180) / Math.PI;
    expect(heading(0)).toBeCloseTo(-15);
    expect(heading(1)).toBeGreaterThan(heading(0) + 50);
    expect(heading(points.length - 2)).toBeGreaterThan(heading(1));
  });

  it('turns about its base as a whole', () => {
    const raised = antennaPoints(turnedBy(near, -20));
    expect(raised[0]).toEqual(near.base);
    expect(raised.at(-1)!.y).toBeLessThan(antennaPoints(near).at(-1)!.y);
    expect(antennaLayer('near antenna', near, 0.35, '#222')).toMatchObject({ kind: 'stroke', name: 'near antenna', width: 0.35 });
  });
});

describe('flicking', () => {
  it('flicks for about 120ms at a time, 1.5 to 4s apart', () => {
    const moving = Array.from({ length: 30000 }, (_, t) => flicking(4, t) > 0);
    const starts = moving.flatMap((m, t) => (m && !moving[t - 1] ? [t] : []));
    expect(starts.length).toBeGreaterThan(6);
    const gaps = starts.slice(1).map((s, i) => s - starts[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1500);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(4000);
    const lengths = starts.map((s) => moving.slice(s).indexOf(false));
    expect(Math.max(...lengths)).toBeLessThanOrEqual(121);
  });

  it('is still between flicks, peaking mid-flick', () => {
    const peak = Math.max(...Array.from({ length: 4000 }, (_, t) => flicking(2, t)));
    expect(peak).toBeGreaterThan(0.99);
    expect(flicking(2, -1)).toBe(0);
  });
});
