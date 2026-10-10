import { describe, expect, it } from 'vitest';
import { cubic, type Curve } from '../curves';
import { arrive, BEYOND, routeLength, departures, done, flightAt, fly, keepsApart, landFrom, leave, PITCH, progress, remaining } from './flight';
import { envelope, OPEN, SHUT } from './fixtures';

const feet = { x: 600, y: 300 };
const end = (r: readonly Curve[]) => r[r.length - 1].to;
const offPage = (p: { x: number; y: number }, width: number) => p.y <= -BEYOND + 0.01 || p.x >= width + BEYOND - 0.01;

describe('a crow’s flight', () => {
  it('tries a climb off the top first, then a skim to the right edge, then a skim breaking into a climb', () => {
    const options = departures(feet, 1440);
    expect(options.length).toBeGreaterThan(5);
    for (const r of options) {
      expect(r[0].from).toEqual(feet);
      expect(offPage(end(r), 1440)).toBe(true);
    }
    expect(end(options[0]).y).toBe(-BEYOND);
    expect(end(options[1]).x).toBe(1440 + BEYOND);
    // Never off the left, where the rail and the scarecrow are.
    for (const r of options) for (let t = 0; t <= 1; t += 0.05) for (const c of r) expect(cubic(c, t).x).toBeGreaterThan(feet.x - 1);
  });

  it('takes the first clear way, and none when the air holds none', () => {
    const climbs = leave(feet, 1440, OPEN, 0, 200)!;
    expect(climbs.curves).toEqual(departures(feet, 1440)[0]);
    const noTop = leave(feet, 1440, (r) => end(r).y > -BEYOND, 0, 200)!;
    expect(end(noTop.curves).x).toBe(1440 + BEYOND);
    expect(leave(feet, 1440, SHUT, 0, 200)).toBeNull();
  });

  it('comes in the way it would leave, flown backwards, down onto its feet', () => {
    const f = arrive(feet, 1440, OPEN, 1000, 200)!;
    expect(f.leg).toBe('arrive');
    expect(offPage(f.curves[0].from, 1440)).toBe(true);
    expect(end(f.curves)).toEqual(feet);
    expect(flightAt(f, f.start + f.duration).at).toEqual(feet);
  });

  it('eases in leaving and out arriving, and pitches no more than 20 degrees', () => {
    const out = leave(feet, 1440, OPEN, 0, 200)!;
    expect(progress(out, out.duration * 0.1)).toBeLessThan(0.05);
    const inn = arrive(feet, 1440, OPEN, 0, 200)!;
    expect(progress(inn, inn.duration * 0.9)).toBeGreaterThan(0.95);
    for (const f of [out, inn]) {
      for (let t = 0; t <= f.duration; t += 20) expect(Math.abs(flightAt(f, t).pitch)).toBeLessThanOrEqual(PITCH);
    }
    expect(done(out, out.duration)).toBe(true);
    expect(done(out, out.duration - 1)).toBe(false);
    // At the speed it was given, on average.
    expect(routeLength(out.curves) / out.duration * 1000).toBeCloseTo(200);
  });

  it('keeps what is left of a route from where the crow is', () => {
    const f = leave(feet, 1440, OPEN, 0, 200)!;
    const half = f.duration / 2;
    const rest = remaining(f, half);
    const at = flightAt(f, half).at;
    expect(rest[0].from.x).toBeCloseTo(at.x, 3);
    expect(rest[0].from.y).toBeCloseTo(at.y, 3);
    expect(end(rest)).toEqual(end(f.curves));
  });

  it('finds a way down from the air to a spot', () => {
    const f = landFrom({ x: 900, y: 120 }, feet, OPEN, 0, 200)!;
    expect(f.curves[0].from).toEqual({ x: 900, y: 120 });
    expect(end(f.curves)).toEqual(feet);
    expect(landFrom({ x: 900, y: 120 }, feet, SHUT, 0, 200)).toBeNull();
  });

  it('keeps 8px between envelopes at every moment, and from crows standing', () => {
    const a = leave(feet, 1440, OPEN, 0, 200)!;
    const same = fly(a.curves, 'depart', 0, 200);
    expect(keepsApart(a, [same], [], envelope)).toBe(false);
    const later = fly(a.curves, 'depart', a.duration + 100, 200);
    expect(keepsApart(a, [later], [], envelope)).toBe(true);
    const far = leave({ x: 1200, y: 600 }, 1440, OPEN, 0, 200)!;
    expect(keepsApart(a, [far], [], envelope)).toBe(true);
    expect(keepsApart(a, [], [{ left: 640, right: 680, top: 200, bottom: 240 }], envelope)).toBe(false);
  });
});
