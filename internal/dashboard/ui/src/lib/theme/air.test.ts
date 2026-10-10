import { describe, expect, it } from 'vitest';
import { airOf, around, fits, inAir, meets, sweeps } from './air';
import type { Box } from './floors';
import { airFor, MAIN, page } from './valentine/fixtures';
import { SPOT } from './valentine/footprints';

describe('the air', () => {
  it('has hover spots only where a whole footprint is clear, inside main and the window', () => {
    const air = airFor();
    expect(air.spots.length).toBeGreaterThan(0);
    for (const p of air.spots) {
      const box = around(p, SPOT);
      expect(air.page.obstacles.some((o) => meets(box, o))).toBe(false);
      expect(box.left).toBeGreaterThanOrEqual(MAIN.left);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(900);
    }
  });

  it('is nowhere without main', () => {
    expect(airOf(page(), SPOT).spots).toEqual([]);
  });

  it('keeps a gap round every obstacle', () => {
    const air = airFor(page([{ left: 600, right: 700, top: 300, bottom: 320 }], []));
    expect(fits(air, { left: 560, right: 598, top: 300, bottom: 320 })).toBe(false);
    expect(fits(air, { left: 560, right: 595, top: 300, bottom: 320 })).toBe(true);
  });

  it('sweeps a footprint along a path without missing what lies between samples', () => {
    const thin = { left: 500, right: 501, top: 290, bottom: 310 };
    const air = airFor(page([thin], []));
    const box = (p: { x: number; y: number }): Box => ({ left: p.x - 1, right: p.x + 1, top: p.y - 1, bottom: p.y + 1 });
    // Two samples either side of a 1px obstacle: each alone is clear.
    expect(fits(air, box({ x: 480, y: 300 }))).toBe(true);
    expect(fits(air, box({ x: 520, y: 300 }))).toBe(true);
    expect(sweeps(air, [box({ x: 480, y: 300 }), box({ x: 520, y: 300 })])).toBe(false);
  });

  it('counts a point on the edge of the view as in view', () => {
    const view = { left: 10, right: 20, top: 10, bottom: 20 };
    expect(inAir(view, { x: 10, y: 20 })).toBe(true);
    expect(inAir(view, { x: 9.5, y: 15 })).toBe(false);
  });
});
