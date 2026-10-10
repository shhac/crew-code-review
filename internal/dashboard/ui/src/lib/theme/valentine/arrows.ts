import { clearance, type Ledge, type Obstacle } from '../floors';
import { clamp, degrees, rad } from '../math';
import { hash } from '../seed';

// Arrows the cupids have shot, stuck in the ledges they hit, and the hearts
// each one pops into as it lands. Everything is in ledge-local x, so a spent
// arrow rides with its card as the page scrolls, and worked out from the
// time it landed, so nothing is stepped per frame.

// How far a spent arrow stands out of the ledge along its shaft, and the
// steepest it may lean from upright.
export const STUCK_LENGTH = 11;
export const MAX_SLANT = 55;
// Its quiver: 9 degrees at first, halving every 170ms, 7 times a second,
// stopped after 1.2s.
const WOBBLE = 9;
const HALF_LIFE = 170;
const QUIVER = 7;
const WOBBLING = 1200;
// It holds until HOLD, then fades over FADE; one pushed out by a newer one
// fades over BUMPED.
const HOLD = 6000;
const FADE = 1500;
const BUMPED = 300;
export const MAX_STUCK = 3;
// Where a spent arrow or its hearts stand needs this much clear above the
// ledge, counting the walkers' reach into the empty edge of a card above.
export const LANDING_CLEAR = 24;
export const LANDING_REACH = 6;
export const HEART_SPREAD = 17;

// One spent arrow: where its tip is in the ledge, the way its shaft leans
// (degrees from upright, positive leaning right: it came from the right),
// when it landed, and when it started fading (Infinity until then).
export type Stuck = { key: string; floor: number; x: number; slant: number; at: number; fading: number };

// The way a shaft leans, from the way the arrow was flying when it landed
// (dx, dy, down positive): it stands back along its flight, kept short of
// lying flat.
export function slantOf(dx: number, dy: number): number {
  return clamp(degrees(Math.atan2(-dx, Math.max(0.001, dy))), -MAX_SLANT, MAX_SLANT);
}

// The angle a spent arrow is drawn at: its slant, quivering about its tip
// while it is fresh.
export function wobble(a: Stuck, now: number): number {
  const t = now - a.at;
  if (t < 0 || t >= WOBBLING) return a.slant;
  return a.slant + WOBBLE * 2 ** (-t / HALF_LIFE) * Math.sin((2 * Math.PI * QUIVER * t) / 1000);
}

// How visible it is: whole until it holds no longer, then fading out.
export function opacity(a: Stuck, now: number): number {
  const bumped = Math.max(0, 1 - (now - a.fading) / BUMPED);
  const held = Math.max(0, Math.min(1, 1 - (now - a.at - HOLD) / FADE));
  return Math.min(a.fading === Infinity ? 1 : bumped, held);
}

const gone = (a: Stuck, now: number) => opacity(a, now) <= 0 && now > a.at;

// A newly landed arrow, keeping at most MAX_STUCK that are not fading: the
// oldest of the others starts fading at once. Those gone are dropped.
export function land(arrows: readonly Stuck[], arrow: Stuck, now: number): Stuck[] {
  const live = [...arrows.filter((a) => !gone(a, now)), arrow];
  const standing = live.filter((a) => a.fading === Infinity && now - a.at < HOLD);
  const over = new Set(standing.slice(0, Math.max(0, standing.length - MAX_STUCK)));
  return live.map((a) => (over.has(a) ? { ...a, fading: now } : a));
}

export const prune = (arrows: readonly Stuck[], now: number): Stuck[] => arrows.filter((a) => !gone(a, now));

// Whether x on f has room for a spent arrow and its hearts.
export const landable = (f: Ledge, obstacles: readonly Obstacle[], x: number) =>
  x >= 16 && x <= f.right - f.left - 16 && clearance(f, obstacles, x - HEART_SPREAD, x + HEART_SPREAD, LANDING_REACH) >= LANDING_CLEAR;

// After a layout change: each kept while its ledge is there and the
// stretch round it is still clear.
export function reconcileStuck(arrows: readonly Stuck[], floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[]): Stuck[] {
  return arrows.filter((a) => {
    const f = floors.get(a.floor);
    return !!f && landable(f, obstacles, a.x);
  });
}

// The hearts a landing pops into: four, each flung out from the tip at its
// own angle within 50 degrees of upright, rising 10 to 18px and easing to a
// stop as they grow from half size and fade, over 0.9s.
export const BURST = 900;
const HEARTS = 4;
export const HEART_COLOURS = ['#e8436b', '#ff8fb3'] as const;
export type Burst = { key: string; floor: number; x: number; at: number; seed: number };
export type Heart = { dx: number; dy: number; scale: number; opacity: number; fill: string };

export function hearts(b: Burst, now: number): Heart[] {
  const t = (now - b.at) / BURST;
  if (t < 0 || t >= 1) return [];
  const out = 1 - (1 - t) ** 3;
  return Array.from({ length: HEARTS }, (_, i) => {
    const spread = ((i + 0.5) / HEARTS - 0.5) * 2;
    const angle = rad(spread * 40 + (hash(b.seed * 13 + i) - 0.5) * 20);
    const reach = 10 + 8 * hash(b.seed * 29 + i);
    return {
      dx: Math.sin(angle) * reach * out,
      dy: -Math.cos(angle) * reach * out,
      scale: 0.5 + 0.5 * out,
      opacity: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4,
      fill: HEART_COLOURS[i % HEART_COLOURS.length],
    };
  });
}

export const burstsLeft = (bursts: readonly Burst[], now: number) => bursts.filter((b) => now - b.at < BURST);

// A heart about 6px across, its point at (0, 2.6) and its lobes above, so
// drawn at a heart's place it sits centred there.
export const HEART_PATH = 'M0 2.6C-1.2 1.6-3 .4-3-1.1-3-2.3-2-3-1.1-3-.5-3-.1-2.7 0-2.2.1-2.7.5-3 1.1-3 2-3 3-2.3 3-1.1 3 .4 1.2 1.6 0 2.6Z';
