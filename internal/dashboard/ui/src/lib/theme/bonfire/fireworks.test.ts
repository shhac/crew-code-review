import { describe, expect, it } from 'vitest';
import { LIFE, nextBurst, rocket, roomy, sparks, stillBurst } from './fireworks';

const sky = { width: 200, height: 220 };
// Each call gets its own sequence, so no test depends on another's draws.
const sequence = (draws: number[]) => {
  const counter = { i: 0 };
  return () => draws[counter.i++ % draws.length];
};
const rand = sequence([0.1, 0.9, 0.4, 0.6, 0.3, 0.7, 0.2]);

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

  it('keeps every visible spark and the rocket inside the sky, whatever the draws', () => {
    const skies = [{ width: 120, height: 90 }, { width: 200, height: 150 }, { width: 200, height: 240 }];
    const extremes = Array.from({ length: 2 ** 7 }, (_, n) => Array.from({ length: 7 }, (_, bit) => (n >> bit) & 1));
    for (const s of skies) {
      for (const draws of extremes) {
        const b = nextBurst(0, s, sequence(draws));
        for (let t = b.at - 700; t < b.at + LIFE; t += 40) {
          const trail = rocket(b, s, t);
          if (trail) expect(Math.min(trail.y1, trail.y2) >= 0 && Math.max(trail.y1, trail.y2) <= s.height).toBe(true);
          for (const p of sparks(b, t).filter((p) => p.opacity > 0.1)) {
            for (const [x, y] of [[p.x, p.y], [p.tx, p.ty]]) {
              expect({ x, y, inside: x >= 0 && x <= s.width && y >= 0 && y <= s.height }).toMatchObject({ inside: true });
            }
          }
        }
      }
    }
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
