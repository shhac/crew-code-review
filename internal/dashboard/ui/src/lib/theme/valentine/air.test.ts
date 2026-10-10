import { describe, expect, it } from 'vitest';
import { airOf, anchor, around, fits, placed, sweeps, type Box } from './air';
import { clearRoute, routes } from './cupid';
import { airFor, MAIN, page } from './fixtures';
import { SPOT } from './footprints';

const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

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
    expect(airOf(page(), null, SPOT).spots).toEqual([]);
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
    expect(sweeps(air, [{ x: 480, y: 300 }, { x: 520, y: 300 }], box)).toBe(false);
  });

  it('tries a route over or under what is in the way, and refuses one through it', () => {
    const wall = { left: 640, right: 660, top: 250, bottom: 350 };
    const air = airFor(page([wall], []));
    const from = { x: 500, y: 300 }, to = { x: 800, y: 300 };
    const tried = routes(from, to);
    const straight = tried.find((r) => r.c1.y === from.y && r.c2.y === to.y)!;
    expect(clearRoute(air, straight, [])).toBe(false);
    expect(tried.some((r) => clearRoute(air, r, []))).toBe(true);
  });

  it('holds a point against its nearest ledge, so it rides with the page', () => {
    const p = page();
    const a = anchor(p, { x: 700, y: 120 })!;
    expect(a.floor).toBe(1);
    const scrolled = page(p.obstacles, [...p.floors].map(([id, f]) => [id, { ...f, y: f.y - 50 }]));
    expect(placed(scrolled, a)).toEqual({ x: 700, y: 70 });
  });
});
