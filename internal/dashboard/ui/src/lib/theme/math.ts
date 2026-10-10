import type { Point } from './pointer';

// The small sums every animal and rig shares, kept in one place so a fix to
// one is a fix to all.

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (t: number) => clamp(t, 0, 1);
// Smoothstep: eases in and out of 0 and 1, held there outside them.
export const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
// Which way a step of d goes; standing still counts as forward.
export const sign = (d: number): 1 | -1 => (d < 0 ? -1 : 1);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixPoint = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const degrees = (r: number) => (r * 180) / Math.PI;
// How far apart two points are (pointer.ts's distance is to a stroke).
export const apart = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
