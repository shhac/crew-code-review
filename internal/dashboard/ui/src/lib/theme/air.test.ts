import { describe, expect, it } from 'vitest';
import { airOf, around, exitsOf, fits, fitsAir, inAir, inSight, laneOf, meets, pastExit, rowsOf, sweeps, sweptPath } from './air';
import type { Box, Reach } from './floors';
import { airFor, board, MAIN, page, side } from './valentine/fixtures';
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

describe('exits', () => {
  const desktop = { ...page(), main: MAIN };
  const phone = { ...page(), width: 390, main: { left: 0, right: 390, top: 300, bottom: 2000 } };

  it('are the right edge, the top where main reaches it, and the rail where it is a column', () => {
    expect(exitsOf(desktop)).toEqual({ right: 1440, top: 0, rail: 236 });
    expect(exitsOf(desktop, ['top', 'right'])).toEqual({ right: 1440, top: 0, rail: undefined });
    expect(exitsOf(phone)).toEqual({ right: 390, top: undefined, rail: undefined });
    expect(exitsOf({ ...phone, main: { ...phone.main, top: -50 } })).toMatchObject({ top: 0 });
    expect(exitsOf(page())).toEqual({});
  });

  it('leave the air as it was unless asked for', () => {
    const plain = airOf(desktop, SPOT);
    expect(plain.exits).toBeUndefined();
    expect(plain.room).toEqual({ left: 242, right: 1434, top: 6, bottom: 1094 });
    const open = airOf(desktop, SPOT, { exits: ['right', 'top', 'rail'] });
    expect(open.room).toEqual({ left: -Infinity, right: Infinity, top: -Infinity, bottom: 1094 });
    expect(open.view).toEqual(plain.view);
    expect(open.spots).toEqual(plain.spots);
  });

  it('let a box past an exit count only for what is still in sight', () => {
    const open = airOf(desktop, SPOT, { exits: ['right', 'top', 'rail'] });
    const plain = airOf(desktop, SPOT);
    const straddling = { left: 1420, right: 1460, top: 600, bottom: 620 };
    expect(fits(plain, straddling)).toBe(false);
    expect(fits(open, straddling)).toBe(true);
    expect(fits(open, { left: 1440, right: 1480, top: 50, bottom: 110 })).toBe(true);
    expect(fits(open, { left: 1370, right: 1460, top: 100, bottom: 120 })).toBe(false);
    expect(fits(open, { left: 220, right: 260, top: 600, bottom: 620 })).toBe(true);
    expect(fits(open, { left: 100, right: 200, top: 50, bottom: 110 })).toBe(true);
    expect(fits(open, { left: 700, right: 740, top: -10, bottom: 10 })).toBe(true);
    expect(fits(open, { left: 700, right: 740, top: 1090, bottom: 1110 })).toBe(false);
  });

  it('still keep the rail out where only the top is open', () => {
    const top = airOf(desktop, SPOT, { exits: ['top'] });
    expect(fits(top, { left: 100, right: 200, top: -10, bottom: 10 })).toBe(false);
    expect(fits(top, { left: 700, right: 740, top: -10, bottom: 10 })).toBe(true);
    expect(fits(top, { left: 1420, right: 1460, top: 600, bottom: 620 })).toBe(false);
  });

  it('give the point where a footprint is wholly past each, if the page has it', () => {
    const open = airOf(desktop, SPOT, { exits: ['right', 'top', 'rail'] });
    const reach: Reach = { half: 20, up: 30, down: 10 };
    const right = pastExit(open, 'right', reach, 300);
    expect(right).toEqual({ x: 1460, y: 300 });
    expect(inSight(open.exits, around(right!, reach))).toBeNull();
    expect(inSight(open.exits, around({ x: 1459, y: 300 }, reach))).not.toBeNull();
    expect(pastExit(open, 'top', reach, 700)).toEqual({ x: 700, y: -10 });
    expect(pastExit(open, 'rail', reach, 300)).toEqual({ x: 216, y: 300 });
    expect(pastExit(airOf(phone, SPOT, { exits: ['right', 'top', 'rail'] }), 'rail', reach, 300)).toBeNull();
    expect(pastExit(airOf(desktop, SPOT), 'right', reach, 300)).toBeNull();
  });

  it('let a route sweep out through one', () => {
    const reach: Reach = { half: 10, up: 8, down: 0 };
    const route = [around({ x: 600, y: 178 }, reach), around({ x: 1450, y: 178 }, reach)];
    expect(sweeps(airOf(desktop, SPOT), route)).toBe(false);
    expect(sweeps(airOf(desktop, SPOT, { exits: ['right'] }), route)).toBe(true);
    const curve = { from: { x: 600, y: 178 }, control1: { x: 900, y: 178 }, control2: { x: 1200, y: 178 }, to: { x: 1450, y: 178 } };
    const path = [{ curve, envelope: { left: 10, right: 10, up: 8, down: 0 } }];
    expect(sweptPath(path, fitsAir(airOf(desktop, SPOT))).clear).toBe(false);
    expect(sweptPath(path, fitsAir(airOf(desktop, SPOT, { exits: ['right'] }))).clear).toBe(true);
  });
});

describe('rows and lanes', () => {
  const desktop = { ...page(), main: MAIN };
  const open = airOf(desktop, SPOT, { exits: ['right', 'top', 'rail'] });
  const glide: Reach = { half: 28, up: 20, down: 0 };

  it('group level ledges side by side, named by the leftmost', () => {
    expect(rowsOf(desktop)).toEqual([
      { id: 1, ledges: [1], y: 160, left: 290, right: 1386 },
      { id: 2, ledges: [2, 3], y: 182, left: 290, right: 1386 },
    ]);
    const stepped = (y: number) => rowsOf(page(undefined, [[2, board], [3, { ...side, y }]])).map((r) => r.ledges);
    expect(stepped(184)).toEqual([[2, 3]]);
    expect(stepped(185)).toEqual([[2], [3]]);
  });

  it('cross the page above a row from behind the rail to past the right edge', () => {
    const row = rowsOf(desktop)[1];
    expect(laneOf(open, row, 4, glide)).toEqual({ id: '2+4', row: 2, above: 4, y: 178, from: 208, to: 1468 });
    expect(laneOf(open, row, 2, glide)).toBeNull();
    expect(laneOf(open, row, 4, { ...glide, up: 50 })).toBeNull();
    expect(laneOf(airOf(desktop, SPOT), row, 4, glide)).toMatchObject({ from: 270, to: 1406 });
  });

  it('are only where the whole band is in view', () => {
    const row = rowsOf(desktop)[1];
    expect(laneOf(open, { ...row, y: 20 }, 4, glide)).toBeNull();
  });
});
