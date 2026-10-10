import type { Box } from '../floors';
import { clamp01, smooth } from '../math';
import { distance, type Point, type Segment } from '../pointer';

// The scarecrow on the rail's shelf: its arms stir in the wind, and a moving
// cursor passing near makes it flap them, which scares every crow off the
// page. Pure timing here; HarvestShelf.svelte draws it and sends the alarm.

// A stroke passing this close to the scarecrow's box at rest sets it off.
export const NEAR = 32;
// Each flap swings the arms from LOW (below horizontal) up to HIGH and back.
export const FLAP = 500;
export const LOW = -8;
export const HIGH = 40;
// An episode is FIRST flaps; strokes that keep arriving add a flap at a
// time, up to MOST; then it rests REST before it can start again.
export const FIRST = 3;
export const MOST = 8;
export const REST = 1000;
// The hat jolts up this far on each upswing.
export const JOLT = 1.5;
// On its own the arms stir this far, each on its own slow breath.
export const STIR = 2;
// The arms ease from their stir into the flap and back over this long.
const BLEND = 150;

// A flapping episode: when it started and how many flaps it now has. rest is
// when another may start.
export type Scarecrow = { start: number; flaps: number; rest: number };
export const RESTING: Scarecrow = { start: -Infinity, flaps: 0, rest: -Infinity };

export const endOf = (s: Scarecrow) => s.start + s.flaps * FLAP;
export const flapping = (s: Scarecrow, now: number) => now >= s.start && now < endOf(s);

// How near a stroke from a to b comes to a box: nothing if it crosses it.
export function strokeToBox(a: Point, b: Point, box: Box): number {
  const inside = (p: Point) => p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom;
  if (inside(a) || inside(b)) return 0;
  const corners = [{ x: box.left, y: box.top }, { x: box.right, y: box.top }, { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }];
  const edges = corners.map((c, i): [Point, Point] => [c, corners[(i + 1) % 4]]);
  if (edges.some(([c, d]) => crosses(a, b, c, d))) return 0;
  const toPoint = (p: Point) => Math.hypot(Math.max(box.left - p.x, 0, p.x - box.right), Math.max(box.top - p.y, 0, p.y - box.bottom));
  return Math.min(toPoint(a), toPoint(b), ...corners.map((c) => distance(c, a, b)));
}

const turn = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const crosses = (a: Point, b: Point, c: Point, d: Point) => turn(a, b, c) !== turn(a, b, d) && turn(c, d, a) !== turn(c, d, b);

// A moving stroke near the scarecrow: it starts an episode if it is not
// flapping and has rested, or, mid-episode, makes sure there is a flap after
// the one it is on, up to MOST. started says a new episode began, which is
// when the shelf sends the alarm.
export function stir(s: Scarecrow, stroke: Segment, box: Box): { scarecrow: Scarecrow; started: boolean } {
  const now = stroke.at;
  if (strokeToBox(stroke.from, stroke.to, box) > NEAR) return { scarecrow: s, started: false };
  if (flapping(s, now)) {
    const on = Math.floor((now - s.start) / FLAP);
    const flaps = Math.min(MOST, Math.max(s.flaps, on + 2));
    return { scarecrow: { ...s, flaps, rest: s.start + flaps * FLAP + REST }, started: false };
  }
  if (now < s.rest) return { scarecrow: s, started: false };
  return { scarecrow: { start: now, flaps: FIRST, rest: now + FIRST * FLAP + REST }, started: true };
}

// The arms' stir on their own, degrees, each arm on its own breath (4 to 6s).
const breath = (now: number, period: number, phase: number) => STIR * Math.sin((2 * Math.PI * now) / period + phase);
export const ARMS = { left: { period: 4700, phase: 0 }, right: { period: 5600, phase: 1.9 } } as const;

// How far an arm is raised above horizontal at now, degrees: its stir, and
// over an episode the flap, eased in and out of it so it never jumps.
export function armAngle(s: Scarecrow, arm: keyof typeof ARMS, now: number, still: boolean): number {
  if (still) return 0;
  const rest = breath(now, ARMS[arm].period, ARMS[arm].phase);
  if (!flapping(s, now)) return rest;
  const into = now - s.start;
  const flap = LOW + (HIGH - LOW) * (1 - Math.cos((2 * Math.PI * into) / FLAP)) / 2;
  const weight = smooth(Math.min(into, endOf(s) - now) / BLEND);
  return rest + (flap - rest) * weight;
}

// How far the hat has jolted up at now, px: on each upswing, settling as
// the arms come down.
export function hatLift(s: Scarecrow, now: number, still: boolean): number {
  if (still || !flapping(s, now)) return 0;
  const phase = ((now - s.start) % FLAP) / FLAP;
  return JOLT * clamp01(Math.sin(2 * Math.PI * phase));
}
