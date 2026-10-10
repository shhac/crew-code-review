import type { Ledge, PageMap, Run } from '../floors';
import { bodyOf, clampTo, roomiest, roomOver, runAt, staysPut, towardTarget, type Claim, type Walker } from '../ledges';
import { sign } from '../math';
import { between, pick, type Rand } from '../seed';
import type { HarePose } from './hare-rig';
import { REACH } from './trail';

// One brown hare's day on the ledges, between the bouts and bolts the group
// runs (hares.ts): grazing, sitting up, loping a little way, freezing at a
// cursor, boxing and facing another down. Everything is in ledge-local x,
// so a hare rides with its card as the page scrolls.
// design-docs/hares/README.md has the full mode table.

// The space each pose takes on the page, anchored at its bottom centre on
// the ledge: the box hare-rig.ts's drawing stays inside at every moment of
// its motion (its tests check this).
export const POSES: Record<HarePose, { width: number; height: number }> = {
  stand: { width: 38, height: 34.5 },
  graze: { width: 44, height: 26 },
  sit: { width: 42, height: 38 },
  alert: { width: 36, height: 27 },
  lope: { width: 37, height: 27 },
  bound: { width: 47, height: 26 },
  leap: { width: 51, height: 25 },
  box: { width: 40, height: 39 },
};
// How far each pose's drawing reaches behind where it stands and ahead of
// it (the footprint's width is twice the larger): reared up, a hare is
// mostly behind its feet; sitting up, its haunches are. Two facing each
// other, or one following another, keep apart by these.
export const REACHES: Record<HarePose, { back: number; front: number }> = {
  stand: { back: 17, front: 19 },
  graze: { back: 18, front: 22 },
  sit: { back: 21, front: 14 },
  alert: { back: 18, front: 18 },
  lope: { back: 18, front: 18.5 },
  bound: { back: 23.5, front: 21 },
  leap: { back: 25.5, front: 18.5 },
  box: { back: 20, front: 8 },
};

// Day to day it needs this much clear above the ledge (counting REACH into
// the empty bottom edge of a card or rule above); sitting up tall and
// boxing need TALL.
export const CLEAR = 27;
export const TALL = 40;
// Hares keep this far apart, centre to centre, except two boxing.
export const SPACING = 64;
// Two boxing face each other this far apart: more than a box's reach ahead
// and a bound's behind, so the one that bolts never overlaps the one left
// standing; and more than a lope's reach ahead and a sitting hare's, so
// the jack coming up to box never overlaps her either.
export const BOX_GAP = 37;
// Without room to box, a jack comes no closer than this before she bolts.
export const CHASE_GAP = 72;
// The stretch of ledge two boxing hares need tall room over.
export const BOX_SPAN = BOX_GAP + POSES.box.width + 2 * 20;
export const LOPE_SPEED = 22;
export const CHASE_SPEED = 85;
export const BOLT_SPEED = 120;
// The widest a hare on a ledge ever is, so its whole body stays on a run.
export const HALF = Math.max(POSES.graze.width, POSES.bound.width) / 2;
const MIN_SPOT = 2 * HALF + 8;
// How a hare stands on the ledges, day to day.
export const HARE: Walker = { clear: CLEAR, reach: REACH, half: HALF, spacing: SPACING };

export type Mode =
  | 'graze' | 'sit' | 'lope'
  // Coming up to another to box or chase her, then there.
  | 'approach' | 'arrived'
  | 'box' | 'boxed' | 'standoff'
  | 'freeze' | 'bolt'
  // On a trail: the group places it.
  | 'run';
export type Hare = {
  id: number;
  // Its own blinks and twitches, so no two keep time.
  seed: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When the current timed mode ends.
  until: number;
  // Where a lope or an approach ends.
  target: number;
  // Distance moved, which drives its steps.
  walked: number;
  // Sitting up tall, where there is room above it; else crouched.
  tall: boolean;
};

// Who a hare is, kept across every change of place.
export type Self = Pick<Hare, 'id' | 'seed' | 'walked'>;
export const fresh = (id: number): Self => ({ id, seed: id + 1, walked: 0 });

// Whether the stretch round x has room to sit up tall (or box) there.
export const tallAt = (f: Ledge, scene: PageMap, x: number, width: number) => roomOver(f, scene, HARE, x - width / 2, x + width / 2) >= TALL;

export function sittingAt(self: Self, f: Ledge, floor: number, x: number, scene: PageMap, now: number, rand: Rand, dir: 1 | -1 = 1): Hare {
  return { ...self, floor, x, dir, mode: 'graze', until: now + between(rand, 2000, 6000), target: x, tall: tallAt(f, scene, x, POSES.sit.width) };
}

// Where the others are and where they are going, as stretches of ledge.
export const claimsOfHares = (others: readonly Hare[]): Claim[] => others.map((o) => ({ floor: o.floor, lo: Math.min(o.x, o.target), hi: Math.max(o.x, o.target) }));

// A hare placed somewhere new: on the roomiest free stretch (on a ledge with
// no hare on it where there is one), sitting there.
export function placeHare(scene: PageMap, now: number, rand: Rand, others: readonly Hare[], self: Self, middle = false): Hare | null {
  const spot = roomiest(scene, claimsOfHares(others), HARE, MIN_SPOT);
  const f = spot && scene.floors.get(spot.floor);
  if (!spot || !f) return null;
  const x = middle ? (spot.room.lo + spot.room.hi) / 2 : between(rand, spot.room.lo, spot.room.hi);
  return sittingAt(self, f, spot.floor, x, scene, now, rand, rand() < 0.5 ? -1 : 1);
}

// Whether a hare can stay where it is: all of it on a clear run, no other
// hare too close (one it is boxing aside), and a box still with its tall
// room.
export const holds = (hare: Hare, scene: PageMap, others: readonly Hare[], partner: number | null = null) =>
  staysPut(hare, scene, HARE, claimsOfHares(others.filter((o) => o.id !== partner)), 1e-9);

// The stretch a hare may lope in: its run, between its nearest neighbours,
// keeping SPACING from each.
function lane(hare: Hare, f: Ledge, scene: PageMap, others: readonly Hare[], trails: readonly Claim[]): Run | null {
  const run = runAt(f, scene, HARE, hare.x);
  if (!run) return null;
  const room = bodyOf(run, HALF);
  const near = [...claimsOfHares(others), ...trails].filter((c) => c.floor === hare.floor);
  const lo = Math.max(room.lo, ...near.filter((c) => c.hi <= hare.x).map((c) => c.hi + SPACING));
  const hi = Math.min(room.hi, ...near.filter((c) => c.lo > hare.x).map((c) => c.lo - SPACING));
  return { lo: Math.min(lo, hare.x), hi: Math.max(hi, hare.x) };
}

const graze = (hare: Hare, now: number, rand: Rand): Hare => ({ ...hare, mode: 'graze', until: now + between(rand, 2000, 6000), target: hare.x });

// Moving toward its target at speed.
const toward = (hare: Hare, speed: number, dt: number): Hare => towardTarget(hare, (speed * dt) / 1000);

// After grazing a while: sit up, lope a little way clear of the others, or
// graze on.
function next(hare: Hare, f: Ledge, scene: PageMap, others: readonly Hare[], trails: readonly Claim[], now: number, rand: Rand): Hare {
  const choice = rand();
  if (choice < 0.4) return { ...hare, mode: 'sit', until: now + between(rand, 1500, 3000), tall: tallAt(f, scene, hare.x, POSES.sit.width) };
  const room = choice < 0.8 ? lane(hare, f, scene, others, trails) : null;
  const sides = room ? ([-1, 1] as const).filter((d) => (d < 0 ? hare.x - room.lo : room.hi - hare.x) >= 20) : [];
  if (!room || !sides.length) return graze(hare, now, rand);
  const d = pick(rand, sides);
  const far = d < 0 ? hare.x - room.lo : room.hi - hare.x;
  return { ...hare, mode: 'lope', target: hare.x + d * between(rand, 20, Math.min(80, far)), dir: d };
}

// A hare left closer than SPACING to another (a bout broken off by the
// cursor) does not settle down to graze there: it lopes away to make room,
// or, with nowhere to go, sits on facing the other (sitting, a hare reaches
// little ahead of itself). Null when it has room.
function makeRoom(hare: Hare, f: Ledge, scene: PageMap, others: readonly Hare[], now: number, rand: Rand): Hare | null {
  const close = others.filter((o) => o.floor === hare.floor && Math.abs(o.x - hare.x) < SPACING);
  if (!close.length) return null;
  const nearest = close.reduce((a, b) => (Math.abs(b.x - hare.x) < Math.abs(a.x - hare.x) ? b : a));
  const away = sign(hare.x - nearest.x);
  const run = runAt(f, scene, HARE, hare.x);
  const room = run ? bodyOf(run, HALF) : { lo: hare.x, hi: hare.x };
  const target = clampTo(room, nearest.x + away * (SPACING + 2));
  const clear = !others.some((o) => o.id !== nearest.id && o.floor === hare.floor && Math.abs(o.x - target) < SPACING);
  if (Math.abs(target - nearest.x) >= SPACING && clear) return { ...hare, mode: 'lope', target, dir: away };
  return { ...hare, mode: 'sit', until: now + between(rand, 1500, 2500), dir: sign(nearest.x - hare.x) };
}

// One step of a hare's own doings, given the others and the stretches the
// trails being run pass along; the group handles bouts, runs and bolts. dt
// is in ms.
export function stepHare(hare: Hare, scene: PageMap, now: number, dt: number, rand: Rand, others: readonly Hare[], trails: readonly Claim[] = []): Hare {
  const f = scene.floors.get(hare.floor);
  if (!f) return hare;
  switch (hare.mode) {
    case 'graze':
      return now < hare.until ? hare : next(hare, f, scene, others, trails, now, rand);
    case 'sit':
    case 'standoff':
      return now < hare.until ? hare : makeRoom(hare, f, scene, others, now, rand) ?? graze(hare, now, rand);
    case 'lope': {
      const moved = toward(hare, LOPE_SPEED, dt);
      return moved.x === hare.target ? graze(moved, now, rand) : moved;
    }
    case 'approach': {
      const moved = toward(hare, LOPE_SPEED, dt);
      return moved.x === hare.target ? { ...moved, mode: 'arrived' } : moved;
    }
    case 'box':
      return now < hare.until ? hare : { ...hare, mode: 'boxed' };
    default:
      return hare;
  }
}
