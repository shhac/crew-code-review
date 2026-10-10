import { describe, expect, it } from 'vitest';
import { dartAt, dartMs, hangAt, hoverBob, pitchAt } from './insect-flight';

describe('pitchAt', () => {
  const pitching = { hover: -40, cruise: -10, speed: 70 };
  it('holds the body nose up hovering, flattening toward level as it speeds up', () => {
    expect(pitchAt(pitching, 0)).toBe(-40);
    expect(pitchAt(pitching, 35)).toBeCloseTo(-25);
    expect(pitchAt(pitching, 70)).toBe(-10);
    expect(pitchAt(pitching, 200)).toBe(-10);
    // Backing off is still flight, not a hover.
    expect(pitchAt(pitching, -70)).toBe(-10);
  });
});

describe('hangAt', () => {
  it('lets the legs hang hovering and draws them up at speed', () => {
    expect(hangAt(0, 60)).toBe(1);
    expect(hangAt(60, 60)).toBe(0);
    expect(hangAt(20, 60)).toBeGreaterThan(hangAt(40, 60));
  });
});

describe('hoverBob', () => {
  it('bobs within its amplitude, out of step with another seed', () => {
    const at = (seed: number) => Array.from({ length: 2000 }, (_, t) => hoverBob(seed, t * 5, 1.5, 1.8));
    const one = at(1);
    expect(Math.max(...one.map(Math.abs))).toBeLessThanOrEqual(1.5);
    expect(Math.max(...one) - Math.min(...one)).toBeGreaterThan(2);
    expect(at(2)).not.toEqual(one);
  });

  it('never jumps between frames', () => {
    const steps = Array.from({ length: 600 }, (_, i) => Math.abs(hoverBob(3, ((i + 1) * 1000) / 60, 1.5, 1.8) - hoverBob(3, (i * 1000) / 60, 1.5, 1.8)));
    expect(Math.max(...steps)).toBeLessThan(0.4);
  });
});

describe('dartAt', () => {
  const from = { x: 0, y: 0 }, to = { x: 30, y: -10 };
  it('starts and ends at rest, at its ends', () => {
    expect(dartAt(from, to, 0, 400)).toMatchObject({ at: from, speed: 0 });
    expect(dartAt(from, to, 1, 400)).toMatchObject({ at: to, speed: 0 });
    expect(dartAt(from, to, 1.5, 400).at).toEqual(to);
  });

  it('peaks halfway at the speed dartMs was asked for, heading where it goes', () => {
    const distance = Math.hypot(30, 10);
    const ms = dartMs(distance, 140);
    const mid = dartAt(from, to, 0.5, ms);
    expect(mid.speed).toBeCloseTo(140);
    expect(mid.at.x).toBeCloseTo(15);
    expect(mid.heading).toBeCloseTo(Math.atan2(-10, 30));
    const speeds = Array.from({ length: 101 }, (_, i) => dartAt(from, to, i / 100, ms).speed);
    expect(Math.max(...speeds)).toBeCloseTo(140);
  });

  it('moves on smoothly, never back', () => {
    const xs = Array.from({ length: 101 }, (_, i) => dartAt(from, to, i / 100, 300).at.x);
    expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true);
  });
});
