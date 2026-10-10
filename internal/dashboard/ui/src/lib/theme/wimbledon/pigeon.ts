import type { Ledge, PageMap, Run } from '../floors';
import { bodyOf, clampTo, clearOf, runAt, towardTarget, type Claim, type Walker } from '../ledges';
import { sign } from '../math';
import type { Point } from '../pointer';
import { between, type Rand } from '../seed';
import { durationOf, flying, trackOf, type Envelopes, type Phase, type Route, type Stretch, type Track, type Way } from './flight';

// One feral pigeon: on the ground a ledge walker, as the fox and the hare
// are, in ledge-local x so it rides with its card; in the air a flier on a
// route planned whole before it leaves (flight.ts). The flock (pigeons.ts)
// decides when one flies and where it comes back to; the hawk's sweep
// (hawk.ts) when they all go. design-docs/wimbledon/README.md has the
// mode table.

export type Mode = 'stand' | 'walk' | 'peck' | 'shy' | 'alert' | 'takeoff' | 'fly' | 'away' | 'land';
export type Pose = 'stand' | 'walk' | 'peck' | 'alert' | Phase;

// The space each grounded pose takes, anchored at its feet on the ledge: the
// note's budget, a little over what the key poses measure at 1.4px a
// drawing unit, until the rig's tests measure the drawing itself.
export const POSES: Record<'stand' | 'walk' | 'peck' | 'alert', { width: number; height: number }> = {
  stand: { width: 30, height: 24 },
  walk: { width: 36, height: 24 },
  peck: { width: 32, height: 22 },
  alert: { width: 28, height: 27 },
};
// In the air, each envelope anchored at its feet under its hip (see
// flight.ts): from the key poses at 1.4px a unit.
export const ENVELOPES: Envelopes = {
  takeoff: { half: 16, up: 34, down: 0 },
  fly: { half: 17, up: 24, down: 8 },
  land: { half: 17, up: 40, down: 0 },
};

// A ledge must have room for the tallest grounded pose (the alert, neck up)
// anywhere a pigeon stands, counting the 6px reach into the empty bottom
// edge of a card or rule above; its whole walking body keeps on the run,
// 6px clear of another's.
export const REACH = 6;
export const HALF = POSES.walk.width / 2;
export const PIGEON: Walker = { clear: POSES.alert.height, reach: REACH, half: HALF, spacing: 2 * HALF + 6 };

// The state table's timings (ms) and speeds (px/s).
export const STAND = [1500, 5000] as const;
export const WALK_SPEED = 18;
export const WALK_RUN = [30, 120] as const;
export const PECK = 450;
export const PECKS = [2, 5] as const;
export const SHY_SPEED = 35;
export const SHY_RUN = [40, 80] as const;
export const ALERT = [1000, 1500] as const;
// A cursor moving within NEAR makes a pigeon shy away; one passing within
// FLUSH_REACH faster than FLUSH_SPEED px/s makes it fly.
export const NEAR = 70;
export const FLUSH_REACH = 40;
export const FLUSH_SPEED = 1500;

// Where a flight is: its route, its points, when it began, whether it ends
// on a ledge (coming in) or past an exit (going out), and the stretches of
// ledge it passes low over, which the others keep out of while it flies.
export type Flight = { route: Route; track: Track; start: number; lands: boolean; over: readonly Stretch[] };

export type Pigeon = {
  id: number;
  // Its own blinks and head turns, so no two keep time.
  seed: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When a timed mode ends.
  until: number;
  // Where a walk or a shy ends.
  target: number;
  // Distance walked, which drives its steps.
  walked: number;
  // Pecks still to come.
  pecks: number;
  flight: Flight | null;
  // Away: the exit it left by, where it stood, and when it comes back.
  way: Way | null;
  home: { floor: number; x: number } | null;
  back: number;
  // When it last touched down, so its wings fold after.
  landed: number;
};

export type Self = Pick<Pigeon, 'id' | 'seed' | 'walked'>;
export const fresh = (id: number): Self => ({ id, seed: id * 7 + 3, walked: 0 });

export const standing = (self: Self, floor: number, x: number, dir: 1 | -1, now: number, rand: Rand): Pigeon => ({
  ...self, floor, x, dir, mode: 'stand', until: now + between(rand, STAND[0], STAND[1]), target: x, pecks: 0, flight: null, way: null, home: null, back: Infinity, landed: -Infinity,
});

export const grounded = (p: Pigeon) => !['takeoff', 'fly', 'away', 'land'].includes(p.mode);
export const flyingNow = (p: Pigeon) => p.mode === 'takeoff' || p.mode === 'fly' || p.mode === 'land';

// Where the others are and where they are heading, as stretches of ledge;
// those in the air or away take none.
export const claimsOf = (others: readonly Pigeon[]): Claim[] => others.filter(grounded).map((o) => ({ floor: o.floor, lo: Math.min(o.x, o.target), hi: Math.max(o.x, o.target) }));

// The stretch a pigeon may walk: its run, short of its neighbours.
export function stretchOf(p: Pigeon, f: Ledge, scene: PageMap, taken: readonly Claim[]): Run | null {
  const run = runAt(f, scene, PIGEON, p.x);
  if (!run) return null;
  const room = bodyOf(run, HALF);
  const near = taken.filter((c) => c.floor === p.floor);
  const lo = Math.max(room.lo, ...near.filter((c) => c.hi <= p.x).map((c) => c.hi + PIGEON.spacing));
  const hi = Math.min(room.hi, ...near.filter((c) => c.lo > p.x).map((c) => c.lo - PIGEON.spacing));
  return { lo: Math.min(lo, p.x), hi: Math.max(hi, p.x) };
}

const stand = (p: Pigeon, now: number, rand: Rand): Pigeon => ({ ...p, mode: 'stand', until: now + between(rand, STAND[0], STAND[1]), target: p.x });
const peck = (p: Pigeon, now: number, rand: Rand): Pigeon => {
  const pecks = Math.round(between(rand, PECKS[0], PECKS[1]));
  return { ...p, mode: 'peck', pecks, until: now + pecks * PECK, target: p.x };
};

// A walk to a target 30 to 120px along its stretch, one way or the other;
// standing on where there is no room.
function walk(p: Pigeon, f: Ledge, scene: PageMap, taken: readonly Claim[], now: number, rand: Rand): Pigeon {
  const room = stretchOf(p, f, scene, taken);
  const ways = room ? ([-1, 1] as const).filter((d) => (d < 0 ? p.x - room.lo : room.hi - p.x) >= WALK_RUN[0]) : [];
  if (!room || !ways.length) return stand(p, now, rand);
  const d = ways[Math.floor(between(rand, 0, ways.length - 0.001))];
  const far = d < 0 ? p.x - room.lo : room.hi - p.x;
  return { ...p, mode: 'walk', target: p.x + d * between(rand, WALK_RUN[0], Math.min(WALK_RUN[1], far)), dir: d };
}

// Shying away from a point (page x) along its stretch, briskly: 40 to 80px
// that way, as far as there is room; alert where there is none.
export function shy(p: Pigeon, f: Ledge, scene: PageMap, taken: readonly Claim[], from: number, now: number, rand: Rand): Pigeon {
  const room = stretchOf(p, f, scene, taken);
  const away = sign(f.left + p.x - from);
  const far = room ? (away < 0 ? p.x - room.lo : room.hi - p.x) : 0;
  if (far < 10) return alert(p, now, rand);
  return { ...p, mode: 'shy', target: p.x + away * Math.min(far, between(rand, SHY_RUN[0], SHY_RUN[1])), dir: away };
}

export const alert = (p: Pigeon, now: number, rand: Rand, until = now + between(rand, ALERT[0], ALERT[1])): Pigeon =>
  ({ ...p, mode: 'alert', until, target: p.x });

// Off along a route planned before it leaves: the wings clap as the feet
// leave, it climbs and flies out.
export const takeOff = (p: Pigeon, route: Route, now: number, over: readonly Stretch[] = []): Pigeon => ({
  ...p, mode: 'takeoff', flight: { route, track: trackOf(route), start: now, lands: false, over }, way: route.way, home: { floor: p.floor, x: p.x }, target: p.x, dir: route.way === 'left' ? -1 : route.way === 'right' ? 1 : p.dir,
});

// Back in by a route that lands at x on its ledge.
export const flyIn = (p: Pigeon, route: Route, now: number, over: readonly Stretch[] = []): Pigeon => {
  const track = trackOf(route);
  const end = track[track.length - 1].at;
  return { ...p, mode: 'fly', flight: { route, track, start: now, lands: true, over }, floor: route.floor, x: end.x, target: end.x, dir: sign(end.x - track[0].at.x) };
};

// One step of its own doings on the ground or along its flight; the flock
// handles the cursor's flushes, the hawk and coming back. `taken` is where
// the others are and are heading; `cursor` the cursor's page point while
// it moves near. dt is in ms.
export function stepPigeon(p: Pigeon, scene: PageMap, now: number, dt: number, rand: Rand, taken: readonly Claim[], cursor: Point | null = null): Pigeon {
  if (p.flight) return stepFlight(p, now, rand);
  if (p.mode === 'away') return p;
  const f = scene.floors.get(p.floor);
  if (!f) return p;
  const near = cursor && Math.hypot(cursor.x - (f.left + p.x), cursor.y - f.y) < NEAR;
  if (near && p.mode !== 'shy' && p.mode !== 'alert') return shy(p, f, scene, taken, cursor.x, now, rand);
  switch (p.mode) {
    case 'stand':
      if (now < p.until) return p;
      return rand() < 0.6 ? walk(p, f, scene, taken, now, rand) : peck(p, now, rand);
    case 'walk':
    case 'shy': {
      const speed = p.mode === 'walk' ? WALK_SPEED : SHY_SPEED;
      const moved = towardTarget(p, (speed * dt) / 1000);
      if (moved.x !== p.target) return moved;
      return p.mode === 'walk' && rand() < 0.3 ? peck(moved, now, rand) : stand(moved, now, rand);
    }
    case 'peck':
    case 'alert':
      return now < p.until ? p : stand(p, now, rand);
    default:
      return p;
  }
}

// Along its flight: taking off, flying, landing; out past its exit it is
// away (the flock sets when it comes back); landed, it stands.
function stepFlight(p: Pigeon, now: number, rand: Rand): Pigeon {
  const flight = p.flight;
  if (!flight) return p;
  const where = flying(flight.track, now - flight.start, flight.lands);
  if (!where.done) return { ...p, mode: where.pose };
  if (!flight.lands) return { ...p, mode: 'away', flight: null };
  return { ...stand({ ...p, flight: null }, now, rand), landed: now };
}

// When a flight in progress ends.
export const flightEnds = (fl: Flight) => fl.start + durationOf(fl.track, fl.lands);

// Where a pigeon is drawn: its feet's page point, facing, pose; null while
// away or when its ledge is gone.
export type View = { pigeon: Pigeon; x: number; y: number; dir: 1 | -1; pose: Pose };
export function viewOf(p: Pigeon, scene: PageMap, now: number): View | null {
  if (p.mode === 'away') return null;
  const floor = p.flight ? p.flight.route.floor : p.floor;
  const f = scene.floors.get(floor);
  if (!f) return null;
  if (p.flight) {
    const where = flying(p.flight.track, now - p.flight.start, p.flight.lands);
    return { pigeon: p, x: f.left + where.at.x, y: f.y + where.at.y, dir: p.dir, pose: where.pose };
  }
  const pose: Pose = p.mode === 'shy' ? 'walk' : p.mode === 'walk' || p.mode === 'peck' || p.mode === 'alert' ? p.mode : 'stand';
  return { pigeon: p, x: f.left + p.x, y: f.y, dir: p.dir, pose };
}

// Whether a pigeon on the ground can stay where it is: its body on a clear
// run, clear of the others.
export function holds(p: Pigeon, scene: PageMap, taken: readonly Claim[]): boolean {
  const f = scene.floors.get(p.floor);
  const run = f && runAt(f, scene, PIGEON, p.x);
  return !!run && p.x >= run.lo + HALF - 1e-9 && p.x <= run.hi - HALF + 1e-9 && clearOf(taken, p.floor, p.x, p.target, PIGEON.spacing);
}

// Kept where it is on a layout change, pulled back inside its stretch if
// that shrank, its walk cut short there; null when it must be placed again.
export function kept(p: Pigeon, scene: PageMap, taken: readonly Claim[]): Pigeon | null {
  const f = scene.floors.get(p.floor);
  const run = f && runAt(f, scene, PIGEON, Math.max(0, Math.min(f.right - f.left, p.x)));
  if (!f || !run) return null;
  const body = bodyOf(run, HALF);
  if (body.hi < body.lo) return null;
  const x = clampTo(body, p.x);
  const moved = { ...p, x, target: clampTo(body, p.target) };
  return clearOf(taken, p.floor, Math.min(moved.x, moved.target), Math.max(moved.x, moved.target), PIGEON.spacing) ? moved : null;
}
