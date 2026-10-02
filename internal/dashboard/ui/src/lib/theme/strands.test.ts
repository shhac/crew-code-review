import { describe, expect, it } from 'vitest';
import { lineOpacity, movingPointer, stepped, strandPath, strands } from './strands';
import { LINE_FADE, LINE_LIFE, USED_LINE_FADE, type Floor, type Line, type Pose } from './spiderwalk';

const floor = (y: number, left = 100): Floor => ({ left, right: left + 500, y, base: y + 100 });
const walking = (x: number, y: number): Pose => ({ drawing: 'walk', x, y, dir: 1, rotate: 0, moving: true, crouch: 0, tuck: 0, fade: 1, silk: null });

describe('strands', () => {
  const floors = new Map([[1, floor(200)], [2, floor(400)]]);
  const line = (age: number): Line => ({ id: 3, top: { floor: 1, x: 50 }, bottom: { floor: 2, x: 50 }, age });

  it('draws a dragline between its ties, wherever its floors are now', () => {
    expect(strands([line(0)], [], floors, 0)[0]).toMatchObject({ key: 'line-3', x1: 150, y1: 200, x2: 150, y2: 400, opacity: 1 });
    const scrolled = new Map([[1, floor(120)], [2, floor(320)]]);
    expect(strands([line(0)], [], scrolled, 0)[0]).toMatchObject({ y1: 120, y2: 320 });
  });

  it('lets an idle dragline stir, its middle drifting either side over time', () => {
    const bends = [0, 1, 2, 3, 4].map((t) => strands([line(5)], [], floors, t)[0].bend);
    expect(Math.max(...bends)).toBeGreaterThan(1);
    expect(Math.min(...bends)).toBeLessThan(-1);
    expect(bends.every((b) => Math.abs(b) <= 4)).toBe(true);
  });

  it('drops a dragline whose floor has gone', () => {
    expect(strands([line(0)], [], new Map([[1, floor(200)]]), 0)).toEqual([]);
  });

  it('draws the thread a spider is on taut, from its tie to the spider', () => {
    const hanging: Pose = { ...walking(150, 260), drawing: 'hang', silk: { x: 150, y: 200 } };
    expect(strands([], [null, hanging], floors, 3)).toEqual([{ key: 'held-1', x1: 150, y1: 200, x2: 150, y2: 260, opacity: 1, bend: 0 }]);
  });

  it('keeps used silk below the climber, joined to its taut upper segment', () => {
    const climbing: Pose = { ...walking(157, 280), silk: { x: 150, y: 200 }, dragline: 3 };
    const parts = strands([{ ...line(20), claimed: true }], [climbing], floors, 3);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ key: 'line-3', x1: 157, y1: 280, x2: 150, y2: 400, opacity: 1 });
    expect(parts[0].bend).not.toBe(0);
    expect(parts[1]).toMatchObject({ x1: 150, y1: 200, x2: 157, y2: 280, bend: 0 });
    const moved = strands([{ ...line(20), claimed: true }], [{ ...climbing, x: 154, y: 240 }], floors, 4);
    expect(moved[0]).toMatchObject({ x1: 154, y1: 240, x2: 150, y2: 400 });
  });

  it('lets the complete used thread settle and fade after the spider steps off', () => {
    const released = (seconds: number) => strands([{ ...line(70), claimed: true, released: seconds }], [], floors, 0)[0];
    expect(released(0)).toMatchObject({ y1: 200, y2: 400, opacity: 1 });
    expect(released(USED_LINE_FADE / 2).opacity).toBeCloseTo(0.5);
    expect(released(USED_LINE_FADE).opacity).toBe(0);
  });
});

describe('lineOpacity', () => {
  it('is clear just after the drop, barely there while idle, and gone at the end', () => {
    expect(lineOpacity(0)).toBe(1);
    expect(lineOpacity(10)).toBeCloseTo(0.16);
    expect(lineOpacity(LINE_LIFE - LINE_FADE / 2)).toBeCloseTo(0.08);
    expect(lineOpacity(LINE_LIFE + 1)).toBe(0);
  });
});

describe('strandPath', () => {
  it('runs straight when taut, and bows its middle out by the bend when slack', () => {
    const base = { key: 'k', x1: 0, y1: 0, x2: 0, y2: 100, opacity: 1 };
    expect(strandPath({ ...base, bend: 0 })).toBe('M0 0 Q0 50 0 100');
    // The control point sits twice the bend out, so the curve's own middle
    // lands at the bend.
    expect(strandPath({ ...base, bend: 3 })).toBe('M0 0 Q-6 50 0 100');
  });
});

describe('stepped', () => {
  it('counts ground covered on foot in any direction, capped', () => {
    expect(stepped(walking(0, 0), walking(3, 4))).toBe(4);
    expect(stepped(walking(0, 0), walking(0, 2))).toBe(2);
    expect(stepped(walking(0, 0), walking(100, 0))).toBe(4);
  });

  it('counts nothing hanging, or with nowhere to count from', () => {
    expect(stepped(null, walking(1, 1))).toBe(0);
    expect(stepped({ ...walking(0, 0), drawing: 'hang' }, walking(1, 0))).toBe(0);
  });
});

describe('movingPointer', () => {
  it('is the pointer while it moves, and nothing once it has been still', () => {
    const p = { x: 10, y: 20, at: 1000 };
    expect(movingPointer(p, 1100)).toEqual({ x: 10, y: 20 });
    expect(movingPointer(p, 1400)).toBeUndefined();
    expect(movingPointer({ x: 0, y: 0, at: -Infinity }, 0)).toBeUndefined();
  });
});
