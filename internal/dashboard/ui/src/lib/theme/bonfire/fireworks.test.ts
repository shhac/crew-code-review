import { describe, expect, it } from 'vitest';
import { LIFE, nextBurst, rocket, roomy, sparks, stillBurst } from './fireworks';

const sky = { width: 200, height: 220 };
const draws = [0.1, 0.9, 0.4, 0.6, 0.3, 0.7, 0.2];
const counter = { i: 0 };
const rand = () => draws[counter.i++ % draws.length];

describe('fireworks', () => {
  it('spaces bursts many seconds apart, so two are never in the air at once', () => {
    const first = nextBurst(0, sky, rand);
    const second = nextBurst(first.at, sky, rand);
    expect(first.at).toBeGreaterThanOrEqual(7000);
    expect(second.at - first.at).toBeGreaterThan(LIFE + 700);
  });

  it('bursts inside its sky with a capped number of sparks and no flash', () => {
    const b = nextBurst(0, sky, rand);
    expect(b.sparks).toBeLessThanOrEqual(26);
    for (let t = b.at; t < b.at + LIFE; t += 50) {
      for (const s of sparks(b, t)) {
        expect(s.opacity).toBeLessThanOrEqual(0.8);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(sky.width);
        expect(s.y).toBeGreaterThanOrEqual(0);
      }
    }
    expect(sparks(b, b.at + 1)[0].opacity).toBeLessThan(0.2);
    expect(sparks(b, b.at - 1)).toEqual([]);
    expect(sparks(b, b.at + LIFE)).toEqual([]);
  });

  it('climbs as a rocket before it bursts', () => {
    const b = nextBurst(0, sky, rand);
    expect(rocket(b, sky, b.at - 800)).toBeNull();
    const climbing = rocket(b, sky, b.at - 300)!;
    expect(climbing.y1).toBeGreaterThan(b.y);
    expect(climbing.y1).toBeLessThan(sky.height);
    expect(rocket(b, sky, b.at)).toBeNull();
  });

  it('gives a cramped sky nothing and reduced motion one dim, held burst', () => {
    expect(roomy({ width: 200, height: 60 })).toBe(false);
    expect(roomy(sky)).toBe(true);
    const still = stillBurst(sky);
    expect(still.length).toBe(20);
    expect(new Set(still.map((s) => s.opacity))).toEqual(new Set([0.4]));
  });
});
