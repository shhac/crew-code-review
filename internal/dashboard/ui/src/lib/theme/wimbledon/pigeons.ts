import { inView, type PageMap } from '../floors';
import { inTurn, placeIds, regroup, troupeSize } from '../group';
import { clearOf, spots, type Claim, type Walker } from '../ledges';
import type { Point } from '../pointer';
import { between, type Rand } from '../seed';
import { corridor, escape, escapeFrom, routeClear, routeIn, type Route, type Sky, type Stretch, type Way } from './flight';
import { createHawk, GAP, hawkRemeasured, stepHawk, type Hawk } from './hawk';
import {
  alert, claimsOf, ENVELOPES, FLUSH_REACH, FLUSH_SPEED, flyIn, flyingNow, fresh, grounded, HALF, kept, PIGEON, POSES, standing, stepPigeon, takeOff, type Pigeon, type Self,
} from './pigeon';

// The flock and its hawk: two pigeons, or three where the page has room,
// placed once and never grown by scrolling, stepped in a fixed order with
// the hawk first, each seeing the others as they now are. What the flock
// decides, on top of each bird's own doings in pigeon.ts: where they stand,
// which one a fast cursor flushes (at most one every 8s, the others near it
// looking up), the hawk's sweep and everyone's reaction to it, and coming
// back. design-docs/wimbledon/README.md ("Pigeons").

// Pigeons are placed this far apart, centre to centre, on spots they could
// fly away from again, and land this far from the others too.
export const APART = 70;
export const PLACED: Walker = { ...PIGEON, spacing: APART };
// At most one flush for the cursor in this long; the others within LOOK of
// one flushing look up for a moment.
export const FLUSH_EVERY = 8000;
export const LOOK = 200;
// Flushed by the cursor, back 6 to 12s later; a bird that finds no way back
// in tries again this often.
export const FLUSH_BACK = [6000, 12000] as const;
export const RETRY = 5000;
// Spots are sampled this far apart, and at most this many tried for each.
const SAMPLE = 12;
const TRIES = 16;

export type Flock = { target: number; pigeons: Pigeon[]; lastFlush: number; hawk: Hawk };

const pageOf = (scene: PageMap, floor: number, x: number): Point | null => {
  const f = scene.floors.get(floor);
  return f ? { x: f.left + x, y: f.y } : null;
};

// Where a bird could stand: on a card's top in view, its walking body on a
// clear run, APART from the others and where they are heading (and any
// stretch the rally takes), and with a way out from there. Not on a
// heading's rule: it runs through the band of air the others fly out
// along, so a bird standing there would be in their way. Placed afresh, ledges
// with no bird come first, in no order; coming back, nearest `near` first,
// on any ledge.
export function standingSpots(scene: PageMap, sky: Sky, taken: readonly Claim[], near: Point | null, rand: Rand, keep: (c: { floor: number; x: number }) => boolean = () => true): { floor: number; x: number }[] {
  const all = spots(scene, [], PLACED, 2 * PLACED.half).flatMap((s) => {
    const count = Math.max(1, Math.floor((s.room.hi - s.room.lo) / SAMPLE) + 1);
    return Array.from({ length: count }, (_, i) => ({ floor: s.floor, x: count === 1 ? (s.room.lo + s.room.hi) / 2 : s.room.lo + ((s.room.hi - s.room.lo) * i) / (count - 1) }));
  }).filter((c) => scene.floors.get(c.floor)?.kind !== 'heading' && clearOf(taken, c.floor, c.x, c.x, APART));
  // Placed afresh, ledges with no bird on them first, so they spread out.
  const crowded = (c: { floor: number }) => (taken.some((t) => t.floor === c.floor) ? 1 : 0);
  const order = near
    ? nearest(all.filter(keep), scene, near)
    : fewPerLedge(all.filter(keep).map((c) => ({ c, k: crowded(c) + rand() })).sort((a, b) => a.k - b.k).map((a) => a.c));
  return order.slice(0, TRIES * 2).filter((c) => {
    const f = scene.floors.get(c.floor);
    return !!f && escapeFrom(c.floor, f, c.x, null, ENVELOPES, sky) !== null;
  }).slice(0, TRIES);
}
// The few nearest spots on each ledge, nearest first: so one ledge's many
// spots that no route reaches cannot crowd out the others.
const PER_LEDGE = 3;
function nearest(all: readonly { floor: number; x: number }[], scene: PageMap, near: Point): { floor: number; x: number }[] {
  return fewPerLedge(all.map((c) => ({ c, d: distanceTo(scene, c, near) })).sort((a, b) => a.d - b.d).map((a) => a.c));
}
// The first few of each ledge's spots, in the order given.
const fewPerLedge = <T extends { floor: number }>(order: readonly T[]): T[] =>
  order.filter((c, i) => order.slice(0, i).filter((b) => b.floor === c.floor).length < PER_LEDGE);
const distanceTo = (scene: PageMap, c: { floor: number; x: number }, p: Point) => {
  const at = pageOf(scene, c.floor, c.x);
  return at ? Math.hypot(at.x - p.x, at.y - p.y) : Infinity;
};

// A pigeon placed on a spot it could fly away from, standing.
export function placePigeon(scene: PageMap, sky: Sky, others: readonly Pigeon[], self: Self, now: number, rand: Rand, extra: readonly Claim[] = []): Pigeon | null {
  const spot = standingSpots(scene, sky, [...landingClaims(others), ...extra], null, rand)[0];
  return spot ? standing(self, spot.floor, spot.x, rand() < 0.5 ? -1 : 1, now, rand) : null;
}

// Where the others stand, are heading and will land, and the stretches the
// ones in the air are passing low over.
export const landingClaims = (others: readonly Pigeon[]): Claim[] => [
  ...claimsOf(others),
  ...others.filter((o) => o.flight?.lands).map((o) => ({ floor: o.floor, lo: o.x, hi: o.x })),
  ...others.flatMap((o) => o.flight?.over ?? []),
];

// The stretches of ledge a route passes low over, and whether any bird on
// the ground is in one (it would be flown over), its whole walk included.
const overOf = (route: Route, scene: PageMap, lands: boolean): Stretch[] => {
  const f = scene.floors.get(route.floor);
  return f ? corridor(route, f, ENVELOPES, lands, scene.floors, POSES.alert.height, GAP) : [];
};
const flownOver = (over: readonly Stretch[], others: readonly Pigeon[]) =>
  others.filter(grounded).some((o) => over.some((c) => c.floor === o.floor && c.hi > Math.min(o.x, o.target) - HALF && c.lo < Math.max(o.x, o.target) + HALF));
// A way out for a flushed bird: away from what flushed it first, else the
// other way, over no bird on the ground; null (it shies instead) for none.
function wayOut(p: Pigeon, from: number, others: readonly Pigeon[], scene: PageMap, sky: Sky): { route: Route; over: Stretch[] } | null {
  const f = scene.floors.get(p.floor);
  if (!f) return null;
  const away: 'left' | 'right' = from <= f.left + p.x ? 'right' : 'left';
  const ways: ('left' | 'right')[] = away === 'right' ? ['right', 'left'] : ['left', 'right'];
  return ways.reduce<{ route: Route; over: Stretch[] } | null>((found, way) => {
    if (found) return found;
    const route = escape(p.floor, f, p.x, way, ENVELOPES, sky);
    const over = route ? overOf(route, scene, false) : [];
    return route && !flownOver(over, others) ? { route, over } : null;
  }, null);
}

// A bird already in the air, which another flight must wait for.
const airborne = (others: readonly Pigeon[]) => others.some((o) => o.flight !== null);

export function createFlock(scene: PageMap, sky: Sky, now: number, rand: Rand): Flock {
  const three = placeIds<Pigeon>([0, 1, 2], (others, id) => placePigeon(scene, sky, others, fresh(id), now, rand));
  const target = troupeSize(three);
  return { target, pigeons: three.slice(0, target), lastFlush: -Infinity, hawk: createHawk(now, rand) };
}

// What the cursor is doing near the birds: where it is, and how fast it was
// last moving (px/s).
export type Pass = { cursor: Point; speed: number } | null;

// A frame on. The hawk first: a sweep sends the pigeons on its row off on
// their planned routes at their planned times and has the rest look up.
// Then each bird in turn: its own doings, a flush when the cursor passes
// fast and close, and coming back when its time comes. `taken` is what the
// rally holds; `ball` whether one is in play.
export function stepFlock(flock: Flock, scene: PageMap, sky: Sky, now: number, dt: number, rand: Rand, pass: Pass, taken: readonly Claim[] = [], ball = false): Flock {
  const calm = !ball && flock.pigeons.every(grounded);
  const hawk = stepHawk(flock.hawk, flock.pigeons, scene, sky, now, rand, calm);
  const swept = hawk.plan ? flock.pigeons.map((p) => reactToHawk(p, hawk, scene, now, rand)) : flock.pigeons;
  const flushing = pass && pass.speed > FLUSH_SPEED && now - flock.lastFlush >= FLUSH_EVERY ? pass.cursor : null;
  // Flushed by the cursor this frame: off just now, and not by the hawk.
  const flushedNow = (o: Pigeon) => !hawk.plan && o.mode === 'takeoff' && o.flight?.start === now;
  const step = (p: Pigeon, others: Pigeon[]): Pigeon => {
    const claims = [...landingClaims(others), ...taken];
    if (p.mode === 'away') return now < p.back ? p : comeBack(p, others, scene, sky, claims, now, rand);
    const out = flushing && grounded(p) && !airborne(others) && closeTo(p, scene, flushing) ? wayOut(p, flushing.x, others, scene, sky) : null;
    if (out) return { ...takeOff(p, out.route, now, out.over), back: now + between(rand, FLUSH_BACK[0], FLUSH_BACK[1]) };
    return stepPigeon(p, scene, now, dt, rand, claims, pass?.cursor ?? null);
  };
  const lookUp = (before: Pigeon, after: Pigeon, other: Pigeon): Pigeon => {
    const at = grounded(before) && flushedNow(after) ? pageOf(scene, before.floor, before.x) : null;
    const there = at && grounded(other) ? pageOf(scene, other.floor, other.x) : null;
    return at && there && Math.hypot(at.x - there.x, at.y - there.y) <= LOOK ? alert(other, now, rand) : other;
  };
  const pigeons = inTurn(swept, step, lookUp);
  return { ...flock, hawk, pigeons, lastFlush: pigeons.some(flushedNow) ? now : flock.lastFlush };
}

const closeTo = (p: Pigeon, scene: PageMap, cursor: Point) => {
  const at = pageOf(scene, p.floor, p.x);
  return !!at && Math.hypot(at.x - cursor.x, at.y - 12 - cursor.y) < FLUSH_REACH;
};

// A pigeon's part in a sweep: off on its planned route at its planned time,
// to come back when the plan says; or looking up until the hawk has gone.
function reactToHawk(p: Pigeon, hawk: Hawk, scene: PageMap, now: number, rand: Rand): Pigeon {
  const plan = hawk.plan;
  if (!plan || !grounded(p)) return p;
  const off = plan.takeoffs.find((t) => t.id === p.id);
  if (off && now >= off.at) {
    const back = plan.returns.find((r) => r.id === p.id)?.at ?? plan.end + RETRY;
    return { ...takeOff(p, off.route, off.at, overOf(off.route, scene, false)), back };
  }
  if (off || plan.alerts.includes(p.id)) return p.mode === 'alert' && p.until >= plan.end ? p : alert(p, now, rand, plan.end);
  return p;
}

// Back in by the exit it left by, to a spot as near its old one as there
// is that it could fly away from again, over no bird on the ground; not
// while another is in the air (it waits a moment), and if there is no such
// spot, trying again shortly.
const WAIT = 500;

// Whether a way in along the band to c could miss every bird on the ground:
// none stands on its row between it and the exit it comes in by. (The
// route's corridor is checked after; this only saves planning routes that
// cannot do.)
function openApproach(c: { floor: number; x: number }, way: Way, others: readonly Pigeon[], scene: PageMap): boolean {
  const at = pageOf(scene, c.floor, c.x);
  if (!at || way === 'top') return !!at;
  return !others.filter(grounded).some((o) => {
    const there = pageOf(scene, o.floor, o.x);
    if (!there || Math.abs(there.y - at.y) > SAME_ROW) return false;
    return way === 'right' ? there.x > at.x : there.x < at.x;
  });
}
const SAME_ROW = 2;
function comeBack(p: Pigeon, others: readonly Pigeon[], scene: PageMap, sky: Sky, taken: readonly Claim[], now: number, rand: Rand): Pigeon {
  if (airborne(others)) return { ...p, back: now + WAIT };
  const home = p.home && pageOf(scene, p.home.floor, p.home.x);
  const way = p.way ?? 'right';
  const spots = standingSpots(scene, sky, taken, home ?? null, rand, (c) => openApproach(c, way, others, scene));
  const found = spots.reduce<{ route: Route; over: Stretch[] } | null>((done, c) => {
    const f = scene.floors.get(c.floor);
    const route = done || !f || !inView(f, scene) ? null : routeIn(c.floor, f, c.x, way, ENVELOPES, sky);
    const over = route ? overOf(route, scene, true) : [];
    return done ?? (route && !flownOver(over, others) ? { route, over } : null);
  }, null);
  return found ? flyIn(p, found.route, now, found.over) : { ...p, back: now + RETRY };
}

// After a layout change: a bird on the ground keeps its ledge and mode
// where its stretch is still clear (pulled back inside it if it shrank),
// else is placed again with no animation; one in the air flies on if the
// rest of its route is still clear, else counts as away at once (it is
// never drawn over content); missing ones are placed up to the target.
export function reconcileFlock(flock: Flock, scene: PageMap, sky: Sky, now: number, rand: Rand): Flock {
  const keep = (p: Pigeon, settled: Pigeon[], all: Pigeon[]): Pigeon | null => {
    if (p.mode === 'away') return p;
    if (p.flight) {
      const f = scene.floors.get(p.flight.route.floor);
      return f && routeClear(p.flight.route, f, ENVELOPES, sky.clear, p.flight.lands) ? p : { ...p, mode: 'away', flight: null, back: now + RETRY };
    }
    return kept(p, scene, landingClaims(settled)) ?? placePigeon(scene, sky, all.filter((o) => o.id !== p.id), p, now, rand);
  };
  const pigeons = regroup(flock.pigeons, flock.target, keep, (others, id) => placePigeon(scene, sky, others, fresh(id), now, rand));
  return { ...flock, pigeons, hawk: hawkRemeasured(flock.hawk, pigeons, scene, sky, now, rand) };
}

// Reduced motion: every pigeon standing still on its spot, kept there while
// it stays clear; no hawk.
export function restingFlock(scene: PageMap, sky: Sky, previous: Flock | null, now: number): Flock {
  const still = () => 0.5;
  const target = previous?.target ?? createFlock(scene, sky, now, still).target;
  const rest = (p: Pigeon): Pigeon => ({ ...p, mode: 'stand', until: Infinity, target: p.x, flight: null });
  const keep = (p: Pigeon, settled: Pigeon[], all: Pigeon[]): Pigeon | null => {
    const held = grounded(p) ? kept(rest(p), scene, landingClaims(settled)) : null;
    const placed = held ?? placePigeon(scene, sky, all.filter((o) => o.id !== p.id), p, now, still);
    return placed && rest(placed);
  };
  const pigeons = regroup(previous?.pigeons ?? [], target, keep, (others, id) => {
    const p = placePigeon(scene, sky, others, fresh(id), now, still);
    return p && rest(p);
  });
  return { target, pigeons, lastFlush: -Infinity, hawk: { next: Infinity, plan: null } };
}

// Whether the rally may start on a stretch: no pigeon standing in it, none
// flying or away.
export const courtFree = (flock: Flock, court: readonly Claim[]) =>
  flock.pigeons.every((p) => grounded(p) && !flyingNow(p)) && !court.some((c) => flock.pigeons.some((p) => p.floor === c.floor && p.x + PIGEON.half > c.lo && p.x - PIGEON.half < c.hi));
