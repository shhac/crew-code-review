import { describe, expect, it } from 'vitest';
import { auroraRgb, curtains, PEAK, rays, roomy, STILL } from './aurora';

const sky = { width: 220, height: 200 };
const alpha = (now: number) => curtains(sky, now).map((c) => c.opacity);

describe('aurora', () => {
  it('cycles its colour smoothly and comes round again', () => {
    expect(auroraRgb(0)).toEqual(auroraRgb(48000));
    const steps = Array.from({ length: 480 }, (_, i) => auroraRgb(i * 100));
    const jumps = steps.slice(1).map((c, i) => Math.max(...c.map((v, k) => Math.abs(v - steps[i][k]))));
    expect(Math.max(...jumps)).toBeLessThanOrEqual(4);
  });

  it('keeps three curtains, none ever more than PEAK opaque', () => {
    expect(PEAK).toBeLessThanOrEqual(0.45);
    for (const now of Array.from({ length: 200 }, (_, i) => i * 437)) {
      const a = alpha(now);
      expect(a).toHaveLength(3);
      expect(Math.max(...a)).toBeLessThanOrEqual(PEAK);
    }
  });

  it('shimmers its rays slowly and unevenly across the whole sky', () => {
    const a = rays(sky, 0), b = rays(sky, 16);
    expect(Math.max(...a.map((r) => r.x + r.width))).toBeGreaterThan(sky.width - 8);
    expect(new Set(a.map((r) => r.width.toFixed(2))).size).toBeGreaterThan(a.length / 2);
    expect(Math.max(...a.map((r, i) => Math.abs(r.opacity - b[i].opacity)))).toBeLessThan(0.02);
  });

  it('changes brightness gradually, never in a jump', () => {
    const frames = Array.from({ length: 600 }, (_, i) => alpha(i * 16));
    const steps = frames.slice(1).flatMap((a, i) => a.map((o, k) => Math.abs(o - frames[i][k])));
    // Under 0.2 a second at most, at 60 frames a second.
    expect(Math.max(...steps)).toBeLessThan(0.2 / 60);
  });

  it('draws inside the sky', () => {
    for (const c of curtains(sky, STILL)) {
      const ys = [...c.d.matchAll(/[ML]([\d.]+) ([\d.-]+)/g)].map((m) => Number(m[2]));
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(sky.height);
    }
  });

  it('needs room for the curtains', () => {
    expect(roomy({ width: 120, height: 60 })).toBe(true);
    expect(roomy({ width: 119, height: 200 })).toBe(false);
    expect(roomy({ width: 220, height: 59 })).toBe(false);
  });
});
