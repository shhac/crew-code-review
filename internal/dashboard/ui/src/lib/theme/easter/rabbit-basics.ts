import type { Ledge, PageMap, Run } from '../floors';
import { bodyOf, clearOf, spare, type Claim, type Trip, type Walker } from '../ledges';
import { sign } from '../math';
import type { Point } from '../pointer';
import { between, type Rand } from '../seed';
import type { End } from './hunt';
import { HOP_LENGTH, type Pose } from './rabbit-rig';

// What the rabbit's moves are built from: its shape on the ledges, its
// state, and the few changes of state that both stepping it (rabbit.ts) and
// choosing where it goes (rabbit-moves.ts) make.

// The space each pose takes on the page, anchored at its bottom centre on
// the ledge: the box rabbit-rig.ts's drawing stays inside at every moment of
// its hops, strokes and stamps (its tests check this). Sitting up on alert
// is the one pose taller than a first-row card's 27px; a hop the widest,
// its long hind feet streaming out behind it from opened hocks.
export const POSES: Record<Pose, { width: number; height: number }> = {
  sit: { width: 31, height: 26 },
  alert: { width: 31, height: 28 },
  groom: { width: 31, height: 27 },
  hop: { width: 38, height: 27 },
  nudge: { width: 40, height: 19 },
  thump: { width: 31, height: 23 },
};

// Wherever a rabbit sits or hops needs this much clear space above the
// ledge, counting REACH into the empty edge of a card or rule above.
const CLEAR = 27;
const REACH = 6;
export const HALF = POSES.hop.width / 2;
// Rabbits keep at least this far apart, centre to centre.
export const SPACING = 60;

// How long one sits up on alert, and sits before it gets restless, in ms.
const ALERT = { lo: 1200, hi: 2000 };
export const RESTLESS = { lo: 3000, hi: 8000 };

type Mode = 'sit' | 'alert' | 'groom' | 'hop' | 'nudge' | 'thump' | 'bolt' | 'exit' | 'away' | 'enter';
export type Rabbit = {
  id: number;
  seed: number;
  // Page pixels hopped in all, which drives its legs: at rest between hops
  // it stands at AT_REST plus whole hops.
  walked: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When the mode began, and when a timed one ends (sitting: when it gets
  // restless; alert: when it may settle again).
  since: number;
  until: number;
  // Hopping: hops still to make after the one under way; the one under way
  // (where it began, and walked then), or null at rest; and when the pause
  // before the next hop ends.
  hops: number;
  hop: { x: number; walked: number } | null;
  pause: number;
  // Where an entry began.
  from: number;
  // The ledge end it is leaving an egg at, while it goes there and nudges.
  egg: End | null;
  // Where it is going when changing ledge: the end it hops in at, and where
  // it will sit.
  trip: Trip | null;
  // Since when a cursor has been close, or null.
  near: number | null;
  // Where the cursor that made it thump was, to bolt away from.
  scare: Point | null;
  // Sat up tall on alert, where there is room for it.
  tall: boolean;
  // The mode before, which the drawing eases out of.
  was: Mode;
  // An egg it has just left, for the hunt to take.
  left: { floor: number; end: End } | null;
};

export const RABBIT: Walker = { clear: CLEAR, reach: REACH, half: HALF, spacing: SPACING };
export const body = (r: Run): Run => bodyOf(r, HALF);

export const clear = (claimed: readonly Claim[], floor: number, a: number, b: number) => clearOf(claimed, floor, a, b, SPACING);

// Whether the hunt has room for an egg at this end of this ledge.
export type CanLay = (floor: number, end: End) => boolean;

export const become = (r: Rabbit, mode: Mode, now: number, over: Partial<Rabbit> = {}): Rabbit => ({ ...r, was: r.mode, mode, since: now, ...over });

// How much clear space is left above a pose standing at x (negative when it
// does not fit).
export const spareFor = (f: Ledge, scene: PageMap, pose: Pose, x: number) => spare(f, scene, RABBIT, POSES[pose], x);

export const settle = (r: Rabbit, now: number, restless = 3000): Rabbit =>
  become(r, 'sit', now, { until: now + restless, hops: 0, hop: null, trip: null, egg: null, near: null, scare: null });

// Off on a run of whole hops toward x: as many as fit short of it (or the
// nearest number, `round`), at least one.
export function hopToward(r: Rabbit, mode: Mode, now: number, x: number, over: Partial<Rabbit> = {}, round = false): Rabbit {
  const n = Math.abs(x - r.x) / HOP_LENGTH;
  const hops = Math.max(1, round ? Math.round(n) : Math.floor(n + 1e-9));
  return become(r, mode, now, { dir: sign(x - r.x), hops, hop: null, pause: now, ...over });
}

// Sat up on alert (tall where there is room), until a while after the
// cursor has gone.
export function alertAt(r: Rabbit, scene: PageMap, now: number, rand: Rand): Rabbit {
  const f = scene.floors.get(r.floor);
  const roomy = !!f && spareFor(f, scene, 'alert', r.x) >= 0;
  const until = now + between(rand, ALERT.lo, ALERT.hi);
  if (r.mode === 'alert') return { ...r, until };
  return become(r, 'alert', now, { until, tall: roomy });
}
