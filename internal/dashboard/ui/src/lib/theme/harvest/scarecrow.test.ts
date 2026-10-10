import { describe, expect, it } from 'vitest';
import type { Segment } from '../pointer';
import { armAngle, endOf, FIRST, FLAP, flapping, HIGH, hatLift, JOLT, LOW, MOST, NEAR, REST, RESTING, stir, STIR, strokeToBox } from './scarecrow';

const box = { left: 100, right: 167, top: 200, bottom: 264 };
// A short stroke passing gap px to the right of the scarecrow, at time at.
const pass = (gap: number, at: number): Segment => ({ from: { x: box.right + gap, y: 220 }, to: { x: box.right + gap, y: 230 }, at });
const angles = (s: Parameters<typeof armAngle>[0], from: number, to: number) => Array.from({ length: Math.round((to - from) / 5) + 1 }, (_, i) => armAngle(s, 'left', from + i * 5, false));

describe('the scarecrow', () => {
  it('measures a stroke against its box, crossing it or going round it', () => {
    expect(strokeToBox({ x: 50, y: 230 }, { x: 250, y: 230 }, box)).toBe(0);
    expect(strokeToBox({ x: 130, y: 230 }, { x: 131, y: 231 }, box)).toBe(0);
    expect(strokeToBox({ x: 197, y: 210 }, { x: 197, y: 250 }, box)).toBeCloseTo(30);
    expect(strokeToBox({ x: 197, y: 150 }, { x: 260, y: 190 }, box)).toBeGreaterThan(NEAR);
    // A stroke passing a corner diagonally is measured to the corner.
    expect(strokeToBox({ x: 180, y: 160 }, { x: 220, y: 200 }, box)).toBeCloseTo(Math.hypot(167 - 193.5, 200 - 173.5), 0);
  });

  it('flaps three times for a stroke that passes within 32px, and stays still for one beyond', () => {
    expect(stir(RESTING, pass(NEAR + 2, 1000), box)).toEqual({ scarecrow: RESTING, started: false });
    const { scarecrow, started } = stir(RESTING, pass(20, 1000), box);
    expect(started).toBe(true);
    expect(scarecrow.start).toBe(1000);
    expect(endOf(scarecrow)).toBe(1000 + FIRST * FLAP);
    expect(flapping(scarecrow, 1000 + FIRST * FLAP - 1)).toBe(true);
    expect(flapping(scarecrow, 1000 + FIRST * FLAP)).toBe(false);
  });

  it('adds a flap at a time while strokes keep coming, up to eight, then rests a second', () => {
    const steps = Array.from({ length: 220 }, (_, i) => 1000 + i * 20);
    const end = steps.reduce((s, at) => stir(s, pass(10, at), box).scarecrow, RESTING);
    expect(end.flaps).toBe(MOST);
    expect(end.start).toBe(1000);
    // A stroke during the rest starts nothing; one after it starts again.
    const resting = endOf(end) + REST / 2;
    expect(stir(end, pass(10, resting), box).started).toBe(false);
    const again = stir(end, pass(10, endOf(end) + REST), box);
    expect(again.started).toBe(true);
    expect(again.scarecrow.flaps).toBe(FIRST);
    // A single stroke mid-episode adds only the flap after the one it is on.
    const one = stir(RESTING, pass(10, 0), box).scarecrow;
    expect(stir(one, pass(10, 2 * FLAP + 10), box).scarecrow.flaps).toBe(4);
    expect(stir(one, pass(10, 10), box).scarecrow.flaps).toBe(FIRST);
  });

  it('swings the arms from 8 below horizontal to 40 above and back each flap, never jumping', () => {
    const s = stir(RESTING, pass(10, 1000), box).scarecrow;
    const swing = angles(s, 1000 + 150, endOf(s) - 150);
    expect(Math.max(...swing)).toBeCloseTo(HIGH, 0);
    expect(Math.min(...swing)).toBeLessThan(LOW + 2);
    const whole = angles(s, 0, endOf(s) + 500);
    const steps = whole.slice(1).map((a, i) => Math.abs(a - whole[i]));
    expect(Math.max(...steps)).toBeLessThan(5);
    // The top of each flap is halfway through it.
    expect(armAngle(s, 'left', 1000 + FLAP * 1.5, false)).toBeCloseTo(HIGH, 0);
  });

  it('stirs a couple of degrees on its own, and rests straight out under reduced motion', () => {
    const calm = Array.from({ length: 1200 }, (_, i) => armAngle(RESTING, 'right', i * 10, false));
    expect(Math.max(...calm.map(Math.abs))).toBeLessThanOrEqual(STIR);
    expect(Math.max(...calm)).toBeGreaterThan(STIR * 0.9);
    const s = stir(RESTING, pass(10, 1000), box).scarecrow;
    expect(armAngle(s, 'left', 1000 + FLAP / 2, true)).toBe(0);
    expect(hatLift(s, 1000 + FLAP / 4, true)).toBe(0);
  });

  it('jolts the hat up on each upswing and settles it', () => {
    const s = stir(RESTING, pass(10, 1000), box).scarecrow;
    expect(hatLift(s, 1000 + FLAP / 4, false)).toBeCloseTo(JOLT);
    expect(hatLift(s, 1000 + (FLAP * 3) / 4, false)).toBe(0);
    expect(hatLift(s, endOf(s) + 10, false)).toBe(0);
  });
});
