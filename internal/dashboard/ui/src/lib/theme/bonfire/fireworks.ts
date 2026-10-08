import { between, pick, type Rand } from '../seed';
import type { SkySize } from '../sky';

// Fireworks in the rail's empty sky above the bonfire, never over the page.
// They are kept deliberately quiet: one burst at a time, many seconds apart,
// a small fixed number of sparks, and no flash; the sparks fade in and out
// rather than popping to full brightness.

export type Burst = { at: number; x: number; y: number; colour: string; sparks: number; reach: number; turn: number };
// A spark and the short trail it draws behind it (tx, ty).
export type Spark = { x: number; y: number; tx: number; ty: number; r: number; opacity: number };

const RISE = 700;
export const LIFE = 1900;
const GAP = { min: 7000, max: 15000 };
const MAX_SPARKS = 26;
const MAX_OPACITY = 0.8;
const GRAVITY = 14;
const COLOURS = ['#f4c25b', '#ff8a4c', '#9fd3ff', '#c9a7ff', '#ffe9a8'];


// A sky too small to hold a burst gets none.
export const roomy = (sky: SkySize) => sky.width >= 120 && sky.height >= 90;

// How far a spark has fallen by the time it has faded to almost nothing;
// below that a spark leaving the sky would be visibly cut off.
const VISIBLE_FALL = GRAVITY * (0.7 * LIFE / 1000) ** 2;
const EDGE = 4;

export function nextBurst(after: number, sky: SkySize, rand: Rand): Burst {
  const x = sky.width * between(rand, 0.25, 0.75);
  const y = sky.height * between(rand, 0.25, 0.5);
  const wanted = Math.min(sky.width, sky.height) * between(rand, 0.22, 0.3);
  // Every spark stays inside the sky while it can still be seen.
  const room = Math.min(x, sky.width - x, y, sky.height - y - VISIBLE_FALL) - EDGE;
  return {
    at: after + between(rand, GAP.min, GAP.max),
    x,
    y,
    colour: pick(rand, COLOURS),
    sparks: Math.round(between(rand, 18, MAX_SPARKS)),
    reach: Math.max(0, Math.min(wanted, room)),
    turn: between(rand, 0, Math.PI * 2),
  };
}

// The rocket's climb from the bottom of the sky to where it bursts, as a
// short fading streak; null outside the climb.
export function rocket(b: Burst, sky: SkySize, now: number): { x: number; y1: number; y2: number; opacity: number } | null {
  const t = (now - (b.at - RISE)) / RISE;
  if (t < 0 || t >= 1) return null;
  const head = sky.height - (sky.height - b.y) * (1 - (1 - t) ** 2);
  return { x: b.x, y1: head, y2: Math.min(sky.height, head + 16), opacity: 0.5 * (1 - t) + 0.2 };
}

// Where a spark thrown at angle, to reach times the burst's reach, is at t
// (0 to 1 through the burst's life).
function at(b: Burst, angle: number, reach: number, t: number) {
  const spread = 1 - Math.exp(-5 * t);
  const fall = GRAVITY * (t * LIFE / 1000) ** 2;
  return { x: b.x + Math.cos(angle) * b.reach * reach * spread, y: b.y + Math.sin(angle) * b.reach * reach * spread + fall };
}

// Two rings, the inner a little slower and offset, for some depth.
export function sparks(b: Burst, now: number): Spark[] {
  const t = (now - b.at) / LIFE;
  if (t < 0 || t >= 1) return [];
  const opacity = MAX_OPACITY * Math.min(1, t / 0.08) * (1 - t) ** 1.5;
  const outer = Math.ceil(b.sparks * 0.65);
  return Array.from({ length: b.sparks }, (_, i) => {
    const ring = i < outer ? { n: outer, k: i, reach: 1, turn: 0 } : { n: b.sparks - outer, k: i - outer, reach: 0.55, turn: Math.PI / (b.sparks - outer) };
    const angle = b.turn + ring.turn + (ring.k / ring.n) * Math.PI * 2;
    const head = at(b, angle, ring.reach, t);
    const tail = at(b, angle, ring.reach, Math.max(0, t - 0.06));
    return { ...head, tx: tail.x, ty: tail.y, r: 1.4 * (1 - 0.5 * t), opacity };
  });
}

// Reduced motion: one burst held at its fullest, dimmed.
export function stillBurst(sky: SkySize): Spark[] {
  const b: Burst = { at: 0, x: sky.width / 2, y: sky.height * 0.4, colour: COLOURS[0], sparks: 20, reach: Math.min(sky.width, sky.height) * 0.25, turn: 0 };
  return sparks(b, LIFE * 0.35).map((s) => ({ ...s, opacity: 0.4 }));
}
