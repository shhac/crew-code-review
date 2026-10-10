import { describe, expect, it } from 'vitest';
import { easeGazes, gazeFrom, GAZE_EASE } from './gaze';

// An eye 10 units ahead of and 10 above where it stands, at twice size: on
// the page, 20px ahead and 20px up.
const gaze = gazeFrom({ eye: { x: 15, y: 0 }, anchor: { x: 5, y: 10 }, scale: 2, look: 14, reach: 160 });
const at = { x: 100, y: 100 };

describe('gazeFrom', () => {
  it('looks level at a cursor level with its eye, and not at all with none', () => {
    expect(gaze(1, at, { x: 200, y: 80 })).toBeCloseTo(0);
    expect(gaze(1, at, null)).toBe(0);
  });

  it('turns its nose down toward a cursor below, up toward one above, as far as it may', () => {
    expect(gaze(1, at, { x: 160, y: 120 })).toBeGreaterThan(0);
    expect(gaze(1, at, { x: 160, y: 40 })).toBeLessThan(0);
    expect(gaze(1, at, { x: 121, y: 200 })).toBe(14);
  });

  it('measures from its eye on whichever side it faces, and ignores a cursor out of reach', () => {
    expect(gaze(-1, at, { x: 0, y: 80 })).toBeCloseTo(0);
    expect(gaze(-1, at, { x: 40, y: 120 })).toBeGreaterThan(0);
    expect(gaze(1, at, { x: 400, y: 120 })).toBe(0);
  });
});

describe('easeGazes', () => {
  it('eases each head from where it was toward where it would look, a new one from level', () => {
    const was = new Map([[1, 10]]);
    const next = easeGazes([{ id: 1 }, { id: 2 }], (a) => a.id, () => 0, was, GAZE_EASE);
    expect(next.get(1)).toBeCloseTo(10 / Math.E);
    expect(next.get(2)).toBe(0);
    expect([...easeGazes([{ id: 2 }], (a) => a.id, () => 6, was, 1e6).entries()]).toEqual([[2, 6]]);
  });
});
