import type { PageMap, Run } from '../floors';
import { bodyOf, clampTo, pageAt, runAt, type Walker } from '../ledges';
import { apart, sign } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { grainAhead, grainNear, BITE, type Chaff } from './chaff';
import { done, flightAt, type Flight } from './flight';

// One carrion crow: on a ledge it scans, walks to grain and pecks at it,
// grows wary of a cursor and sidles away from one coming at it; it flies
// only when the group sends it (a scarecrow's alarm, or now and then on its
// own). Standing, it is in ledge-local x so it rides with its card on
// scroll; flying, it is in viewport coordinates. A pure model: the group
// (crows.ts) decides when it leaves and where it comes back to.

// What the crow needs of a ledge: room for its stand pose (27px, reaching
// 6px into a card's empty edge above), its body's half width either side
// of its feet, and 60px between it and another crow, centre to centre.
export const WALKER: Walker = { clear: 27, reach: 6, half: 20, spacing: 60 };
// Its bill reaches the ground this far ahead of its feet pecking.
export const BILL = 14;
export const WALK = 20;
export const SIDLE = 45;
// How far a walk or a sidle goes at most.
export const WALK_MOST = 60;
export const SIDLE_MOST = 30;
// A cursor within WARY (moving, or still for less than CALM) makes it wary;
// one coming at it within SIDLE_REACH makes it sidle away. Its head turns
// toward a cursor within LOOK.
export const WARY = 70;
export const SIDLE_REACH = 40;
export const CALM = 1200;
export const LOOK = 160;
// The timings of its modes, ms.
export const SETTLE = 600;
export const FIRST_SCAN = { lo: 1500, hi: 3000 };
export const SCAN = { lo: 800, hi: 2000 };
export const PECK = 350;
export const PECKS = { lo: 2, hi: 5 };
// Each peck strikes this far through it, when the bill is down.
const STRIKE = 0.6;
export const CROUCH = 150;
export const SPRING = 120;
// After a bout of pecks it walks on this often, else it looks about.
const WALK_ON = 0.7;

export type Mode = 'away' | 'arrive' | 'settle' | 'scan' | 'walk' | 'peck' | 'wary' | 'sidle' | 'takeoff' | 'depart';
export const GROUNDED: readonly Mode[] = ['settle', 'scan', 'walk', 'peck', 'wary', 'sidle'];
export const FLYING: readonly Mode[] = ['takeoff', 'depart', 'arrive'];

// floor and x: the ledge and the feet's ledge-local x it stands at, or is
// coming down to. target: where a walk or sidle is going. until: when a
// timed mode ends. pecks: how many pecks this bout, bitten how many struck.
// noticed: when a cursor last made it wary; near: how far the cursor was
// last frame (to tell one coming at it). flight: its route in the air.
// back: when, away, it may come back; wait: how long it stays away after a
// scarecrow's last flap; leave: when the group has told it to take off;
// from: the spot it left, to come back somewhere else if it can. stuck:
// since when it has found no clear way off.
export type Crow = {
  id: number; mode: Mode; since: number; until: number;
  floor: number; x: number; dir: 1 | -1; target: number;
  pecks: number; bitten: number; noticed: number; near: number;
  flight: Flight | null; back: number; wait: number; leave: number | null; from: { floor: number; x: number } | null; stuck: number;
};

export function standing(id: number, floor: number, x: number, dir: 1 | -1, now: number, rand: Rand): Crow {
  return {
    id, mode: 'scan', since: now, until: now + between(rand, FIRST_SCAN.lo, FIRST_SCAN.hi), floor, x, dir, target: x,
    pecks: 0, bitten: 0, noticed: -Infinity, near: Infinity, flight: null, back: -Infinity, wait: 0, leave: null, from: null, stuck: -Infinity,
  };
}

export function away(id: number, back: number): Crow {
  return { ...standing(id, -1, 0, 1, back, () => 0), mode: 'away', until: Infinity, back };
}

export const grounded = (c: Crow) => GROUNDED.includes(c.mode);
export const flying = (c: Crow) => FLYING.includes(c.mode);

// What a step of one crow sees: the page, the grain, the frame's time, the
// cursor, and the others as they now are.
export type Ground = { scene: PageMap; chaff: ReadonlyMap<number, Chaff>; now: number; dt: number; rand: Rand; cursor: Cursor | null; others: readonly Crow[] };
// A peck that struck: where the bill came down, for the grain to be eaten.
export type Bite = { floor: number; x: number };

const to = (c: Crow, mode: Mode, now: number, until = Infinity): Crow => ({ ...c, mode, since: now, until });
const scan = (c: Crow, now: number, rand: Rand, first = false): Crow => {
  const t = first ? FIRST_SCAN : SCAN;
  return to(c, 'scan', now, now + between(rand, t.lo, t.hi));
};

// The stretch of the crow's run its feet may use, less what the other
// crows on its ledge keep for themselves.
function roomOf(c: Crow, g: Ground): Run | null {
  const f = g.scene.floors.get(c.floor);
  const run = f && runAt(f, g.scene, WALKER, c.x);
  if (!run) return null;
  const body = bodyOf(run, WALKER.half);
  return g.others.filter((o) => grounded(o) && o.floor === c.floor).reduce<Run>((r, o) => {
    const at = Math.abs(o.target - c.x) < Math.abs(o.x - c.x) ? o.target : o.x;
    return at < c.x ? { ...r, lo: Math.max(r.lo, at + WALKER.spacing) } : { ...r, hi: Math.min(r.hi, at - WALKER.spacing) };
  }, body);
}

const billOf = (c: Crow) => c.x + c.dir * BILL;
const inReach = (c: Crow, g: Ground) => !!grainNear(g.chaff, c.floor, billOf(c), BITE);

// The next grain along its run, the way it faces first, its feet stopping
// with the bill over it; else a short wander. null: nowhere to go.
function walkTarget(c: Crow, g: Ground): { target: number; dir: 1 | -1 } | null {
  const room = roomOf(c, g);
  if (!room || room.hi < room.lo) return null;
  const ways: (1 | -1)[] = [c.dir, c.dir === 1 ? -1 : 1];
  const found = ways.map((d) => ({ d, grain: grainAhead(g.chaff, c.floor, c.x + d * BILL, d, WALK_MOST) })).find((w) => w.grain);
  const raw = found?.grain ? found.grain.x - found.d * BILL : c.x + (g.rand() < 0.5 ? -1 : 1) * between(g.rand, 20, WALK_MOST);
  const target = clampTo(room, Math.max(c.x - WALK_MOST, Math.min(c.x + WALK_MOST, raw)));
  return Math.abs(target - c.x) < 3 ? null : { target, dir: sign(target - c.x) };
}

function walkOn(c: Crow, g: Ground): Crow {
  const next = walkTarget(c, g);
  return next ? { ...to(c, 'walk', g.now), ...next } : scan(c, g.now, g.rand);
}

const peckBout = (c: Crow, now: number, rand: Rand): Crow => {
  const pecks = Math.round(between(rand, PECKS.lo, PECKS.hi));
  return { ...to(c, 'peck', now, now + pecks * PECK), pecks, bitten: 0 };
};

// Its middle on the page, where the cursor is measured from.
export const middleOf = (c: Crow, scene: PageMap): Point | null => {
  const f = scene.floors.get(c.floor);
  return f ? pageAt(f, c.x, 13) : null;
};

// What the cursor is to a crow on the ground: how far, whether it counts
// (moving, or still less than CALM), and whether it is coming at it.
function threat(c: Crow, g: Ground): { distance: number; live: boolean; coming: boolean } {
  const mid = middleOf(c, g.scene);
  if (!g.cursor || !mid) return { distance: Infinity, live: false, coming: false };
  const distance = apart(mid, g.cursor);
  const moving = g.now - g.cursor.at < 150;
  return { distance, live: g.now - g.cursor.at < CALM, coming: moving && distance < c.near - 0.5 };
}

// A cursor coming at it within reach makes it sidle away along its run if
// it has room, else stand wary; any within WARY makes it wary.
function react(c: Crow, g: Ground): Crow {
  const t = threat(c, g);
  const seen = { ...c, near: t.distance };
  if (!g.cursor || !t.live || t.distance >= WARY) return seen;
  const noticed = { ...seen, noticed: g.now };
  if (c.mode === 'sidle') return noticed;
  const away = sign((middleOf(c, g.scene)?.x ?? 0) - g.cursor.x);
  if (t.coming && t.distance < SIDLE_REACH) {
    const room = roomOf(c, g);
    const target = room ? clampTo(room, c.x + away * SIDLE_MOST) : c.x;
    if (Math.abs(target - c.x) >= 5) return { ...to(noticed, 'sidle', g.now), target, dir: away };
  }
  return c.mode === 'wary' ? noticed : { ...to(noticed, 'wary', g.now), dir: away === 1 ? -1 : 1 };
}

// Moving toward target at speed, stopping short of any crow ahead.
function stride(c: Crow, g: Ground, speed: number): Crow {
  const room = roomOf(c, g);
  const goal = room ? clampTo(room, c.target) : c.x;
  const step = (speed * g.dt) / 1000;
  const x = Math.abs(goal - c.x) <= step ? goal : c.x + sign(goal - c.x) * step;
  return { ...c, x, target: goal };
}

// One frame of a crow on the ground or in the air; flying modes end here
// too, the group having started them. Returns the crow and any bite.
export function stepCrow(c: Crow, g: Ground): { crow: Crow; bite: Bite | null } {
  const { now, rand } = g;
  if (c.mode === 'away') return { crow: c, bite: null };
  if (c.mode === 'takeoff') return { crow: now >= c.since + CROUCH + SPRING ? to(c, 'depart', now) : c, bite: null };
  if (c.mode === 'depart') return { crow: c.flight && !done(c.flight, now) ? c : { ...to(c, 'away', now), flight: null, floor: -1 }, bite: null };
  if (c.mode === 'arrive') {
    if (c.flight && !done(c.flight, now)) return { crow: c, bite: null };
    return { crow: { ...to(c, 'settle', now, now + SETTLE), flight: null, dir: c.flight ? flightAt(c.flight, now).dir : c.dir }, bite: null };
  }
  if (c.mode === 'settle') return { crow: now >= c.until ? scan(c, now, rand, true) : c, bite: null };
  const reacted = react(c, g);
  if (reacted.mode === 'sidle') {
    const moved = stride(reacted, g, SIDLE);
    return { crow: Math.abs(moved.x - moved.target) < 0.01 ? to(moved, 'wary', now) : moved, bite: null };
  }
  if (reacted.mode === 'wary') return { crow: now - reacted.noticed >= CALM ? scan(reacted, now, rand) : reacted, bite: null };
  if (c.mode === 'scan') {
    if (now < c.until) return { crow: reacted, bite: null };
    return { crow: inReach(c, g) ? peckBout(c, now, rand) : walkOn(c, g), bite: null };
  }
  if (c.mode === 'walk') {
    const moved = stride(c, g, WALK);
    if (Math.abs(moved.x - moved.target) > 0.01) return { crow: { ...moved, near: reacted.near }, bite: null };
    return { crow: inReach(moved, g) ? peckBout(moved, now, rand) : scan(moved, now, rand), bite: null };
  }
  // Pecking: each peck strikes partway through; the bout ends after its last.
  const struck = Math.min(c.pecks, Math.floor((now - c.since) / PECK + (1 - STRIKE)));
  const bite = struck > c.bitten ? { floor: c.floor, x: billOf(c) } : null;
  const pecked = { ...c, bitten: struck, near: reacted.near };
  if (now < c.until) return { crow: pecked, bite };
  return { crow: rand() < WALK_ON ? walkOn(pecked, g) : scan(pecked, now, rand), bite };
}

// Told to take off: the crouch and spring, its route starting as it springs.
export function takeOff(c: Crow, flight: Flight, now: number, from: Crow['from'] = { floor: c.floor, x: c.x }): Crow {
  return { ...to(c, 'takeoff', now), flight, leave: null, from, dir: flightAt(flight, flight.start + flight.duration / 2).dir };
}

// Sent in to a spot along a route.
export function comeIn(c: Crow, flight: Flight, floor: number, x: number, now: number): Crow {
  return { ...to(c, 'arrive', now), flight, floor, x, target: x, back: Infinity, leave: null };
}
