import { around, meets, union } from '../air';
import type { Box } from '../floors';
import { apart, clamp, mixPoint, smooth } from '../math';
import type { Point } from '../pointer';
import { between, hash, type Rand } from '../seed';
import { grown, within, type WaspAir } from './air';
import { SPACE, along, clearRoute, firstClear, flightOf, flightProgress, flying, rounded, routes, sweptFrom, type Flight, type Route } from './flight';
import { FOOTPRINTS, STAND, type WaspPose } from './footprints';
import { BLEND, LAP, LAPS, bandOf, nearestTheta, orbitFits, orbitOf, orbitPoint, thetaAt, trueOrbitPoint } from './orbit';
import type { Places } from './table';
import { SHUFFLE } from './wasp-rig';

// Two common wasps at the fête's cake, in the shelf stage's coordinates (so
// they ride with the stage), never leaving the rail's air or its exit lane.
// Wasp 0 circles low round the cake and feeds on its sugared top; wasp 1
// circles above it and feeds on the blackcurrant jar's lid. Each keeps to its
// own band, and a route that leaves it is planned clear of wherever the other
// is or is going, so the two never meet. A moving cursor that comes close
// chases one off out of the window's left edge; it comes back a little
// later. design-docs/fete/README.md has the state table and the airspace
// contract.

export type Mode = 'circle' | 'inspect' | 'land' | 'feed' | 'takeoff' | 'depart' | 'flee' | 'away' | 'return' | 'rest' | 'dodge';
export type Wasp = {
  id: number;
  seed: number;
  mode: Mode;
  // When the mode's own motion began, after any flight into it, and when a
  // timed mode ends.
  since: number;
  until: number;
  flight: Flight | null;
  // Circling: its angle on its orbit at `since`, which way round it goes,
  // and how long a lap takes; it eases in from `from`.
  angle: number;
  spin: 1 | -1;
  lap: number;
  from: Point;
  // Which way it faces, eased through a turn: 1 right, -1 left.
  face: number;
};

// The cursor, in the stage's coordinates: where it last moved to, when, and
// how fast it was going (px/s).
export type Pointer = Point & { at: number; speed: number };
export type World = { air: WaspAir; places: Places; now: number; rand: Rand; cursor: Pointer | null };

// Inspecting: sweeps either side of its spot, two a second, this high above
// where it stands.
const ZIG = 8;
const SWEEP = 500;
const SWEEPS = [3, 5] as const;
const RISE = 9;
// Landing, feeding, taking off and backing away.
const LAND = 500;
const FEED = [4000, 8000] as const;
const TAKEOFF = 350;
const DEPART = 1500;
// The arcs it backs away in, from just above its spot out to its widest.
const ARCS = [{ from: STAND + RISE, to: 20 }, { from: STAND + RISE, to: 18 }] as const;
// Each shuffle is one step of a tripod (wasp-rig.ts's), so all six feet
// are down between them.
const SHUFFLE_TIME = 300;
// Chased: by a cursor that moved in the last CHASE_FRESH ms at CHASE_SPEED
// or more, within CHASE_REACH of it. No wasp lands within LAND_SHY of a
// cursor, and none comes back while one is within BACK_SHY of the cake.
const CHASE_FRESH = 120;
const CHASE_SPEED = 60;
const CHASE_REACH = 40;
const LAND_SHY = 50;
const BACK_SHY = 60;
const AWAY = [6000, 12000] as const;
// Speeds in px/s.
const FLEE_SPEED = 260;
const RETURN_SPEED = 120;
const CRUISE_SPEED = 90;
const DODGE_SPEED = 200;
// A turn about takes this long.
const TURN = 120;
// Resting, it looks for room to take off this often.
export const RECHECK = 1000;

// Where it lands and feeds: wasp 0 on the cake's top, wasp 1 on the jar's lid.
export const spotOf = (id: number, places: Places): Point => (id === 0 ? { x: places.cake.x, y: places.cake.y } : { x: places.jar.x, y: places.jar.y });
const standOf = (id: number, places: Places): Point => {
  const s = spotOf(id, places);
  return { x: s.x, y: s.y - STAND };
};
// Hovering just above its spot: where it inspects, and where its arcs begin.
const aboveOf = (id: number, places: Places): Point => {
  const s = standOf(id, places);
  return { x: s.x, y: s.y - RISE };
};

// The arcs it backs away from its spot in, s from 0 to 1: out to the right
// and back across, each wider than the last, eased at each turn.
function arcsAt(id: number, places: Places, s: number): Point {
  const spot = spotOf(id, places);
  const { from, to } = ARCS[id === 0 ? 0 : 1];
  const r = from + (to - from) * smooth(s);
  const first = s < 0.5;
  const t = smooth(first ? s * 2 : s * 2 - 1);
  const deg = first ? -90 + 65 * t : -25 - 130 * t;
  const a = (deg * Math.PI) / 180;
  return { x: spot.x + r * Math.cos(a), y: spot.y + r * Math.sin(a) };
}

// Inspecting: side to side in front of its spot, hovering a moment at each
// end of a sweep.
const zigAt = (id: number, places: Places, t: number): Point => {
  const above = aboveOf(id, places);
  return { x: above.x + ZIG * clamp(1.3 * Math.sin((Math.PI * t) / SWEEP), -1, 1), y: above.y };
};

// A few short shuffles across its spot while it feeds, out and back: how
// far from the middle it stands at t into feeding.
export function shuffleAt(seed: number, t: number): number {
  const every = 1800 + 1200 * hash(seed + 5);
  const n = Math.floor(t / every);
  const into = clamp((t - n * every - 600) / SHUFFLE_TIME, 0, 1);
  const out = n % 2 === 0;
  return SHUFFLE * (out ? smooth(into) : 1 - smooth(into)) * (hash(seed + 3) < 0.5 ? 1 : -1);
}

// Where a wasp is now, or null while it is away.
export function where(w: Wasp, places: Places, now: number): Point | null {
  if (w.mode === 'away') return null;
  if (w.flight && (flying(w, now) || !settled(w.mode))) return along(w.flight.route, flightProgress(w.flight, now));
  switch (w.mode) {
    case 'circle': {
      const on = orbitPoint(orbitOf(w.id, places), thetaAt(w, now), now, w.seed);
      return mixPoint(w.from, on, smooth((now - w.since) / BLEND));
    }
    case 'inspect': return zigAt(w.id, places, now - w.since);
    case 'depart': return arcsAt(w.id, places, clamp((now - w.since) / DEPART, 0, 1));
    case 'feed':
    case 'rest': {
      const stand = standOf(w.id, places);
      return { x: stand.x + shuffleAt(w.seed, now - w.since), y: stand.y };
    }
    default: return w.from;
  }
}
// The modes whose own motion takes over once their flight in has ended;
// the rest are wholly their flight.
const settled = (mode: Mode) => mode === 'circle' || mode === 'inspect' || mode === 'depart' || mode === 'feed' || mode === 'rest';

export function poseOf(w: Pick<Wasp, 'mode'>): WaspPose {
  switch (w.mode) {
    case 'flee':
    case 'return': return 'cruise';
    case 'land':
    case 'takeoff': return 'land';
    case 'feed':
    case 'rest': return 'feed';
    default: return 'hover';
  }
}

// The box a wasp takes up now, or null while away.
export function boxOf(w: Wasp, places: Places, now: number): Box | null {
  const p = where(w, places, now);
  return p && around(p, FOOTPRINTS[poseOf(w)]);
}

// What the drawing needs: its pose, which way it faces, its size (a little
// smaller on the far side of its orbit) and how far it has walked feeding
// (for its tripod). There is no bank: a tilt would take her past the
// footprints her rig is measured to.
export type WaspView = Point & { pose: WaspPose; face: number; scale: number; walked: number };
export function waspView(w: Wasp, places: Places, now: number, still = false): WaspView | null {
  const p = still ? standOf(w.id, places) : where(w, places, now);
  if (!p) return null;
  const base = { ...p, face: w.face, scale: 1, walked: 0 };
  if (still) return { ...base, pose: 'standing' };
  if (w.mode === 'circle' && !flying(w, now)) {
    const theta = thetaAt(w, now);
    return { ...base, pose: 'hover', scale: 0.95 + 0.05 * Math.sin(theta) };
  }
  // Her legs step as far as she has moved, forward of her facing or back,
  // so each foot stays where she set it down.
  if (w.mode === 'feed' || w.mode === 'rest') return { ...base, pose: 'feed', walked: shuffleAt(w.seed, now - w.since) * (w.face < 0 ? -1 : 1) };
  return { ...base, pose: poseOf(w) };
}

// Every box a wasp may take from now on: the rest of any flight, then the
// part of the air it keeps to (its band, or its spot and what it does there).
export function claimsOf(w: Wasp, places: Places, now: number): Box[] {
  if (w.mode === 'away') return [];
  const ahead = w.flight && flying(w, now) ? sweptFrom(w.flight, FOOTPRINTS[poseOf(w)], now) : [];
  if (w.mode === 'flee') return ahead;
  return [...ahead, onOrbit(w, places) ? bandOf(orbitOf(w.id, places)) : zoneOf(w.id, places)];
}

// Whether it keeps to its orbit's band now (or is coming back to it), rather
// than to its spot. Wasp 0's spot is inside its band.
export const onOrbit = (w: Wasp, places: Places) =>
  w.id === 0 || w.mode === 'circle' || w.mode === 'dodge' || (w.mode === 'return' && apart(w.from, aboveOf(w.id, places)) > 1);

// Everything a wasp does at its spot (inspecting, landing, feeding, taking
// off and backing away), as one box.
export function zoneOf(id: number, places: Places): Box {
  const stand = standOf(id, places);
  const boxes = [
    around({ x: stand.x - SHUFFLE, y: stand.y }, FOOTPRINTS.feed), around({ x: stand.x + SHUFFLE, y: stand.y }, FOOTPRINTS.feed),
    around({ x: stand.x - ZIG, y: stand.y - RISE }, FOOTPRINTS.hover), around({ x: stand.x + ZIG, y: stand.y - RISE }, FOOTPRINTS.hover),
    around(stand, FOOTPRINTS.land),
    ...Array.from({ length: 51 }, (_, i) => around(arcsAt(id, places, i / 50), FOOTPRINTS.hover)),
  ];
  return boxes.reduce(union);
}

const othersClaims = (others: readonly Wasp[], places: Places, now: number) => others.flatMap((o) => claimsOf(o, places, now));

// Circling, from wherever it is: straight onto its orbit if it is near,
// else by a clear flight to the nearest point on it.
export function toCircle(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
  const { places, now, rand } = world;
  const o = orbitOf(w.id, places);
  const theta = nearestTheta(o, here);
  const onto = trueOrbitPoint(o, theta);
  const laps = Math.round(between(rand, ...LAPS));
  const lap = between(rand, ...LAP);
  const circling = (since: number, from: Point, flight: Flight | null): Wasp => ({ ...w, mode: 'circle', since, until: since + laps * lap, lap, angle: theta, from, flight });
  if (apart(here, onto) < 4) return circling(now, here, null);
  const route = firstClear(routes(here, onto), FOOTPRINTS.hover, world.air, othersClaims(others, places, now));
  if (!route) return null;
  const flight = flightOf(route, now, CRUISE_SPEED);
  return circling(now + flight.duration, onto, flight);
}

// Down to its spot to land, from wherever it is.
export function toLand(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
  const stand = standOf(w.id, world.places);
  const route = firstClear(routes(here, stand), FOOTPRINTS.land, world.air, othersClaims(others, world.places, world.now));
  if (!route) return null;
  const flight = flightOf(route, world.now, CRUISE_SPEED);
  return { ...w, mode: 'land', flight: { ...flight, duration: Math.max(LAND, flight.duration) }, from: stand, since: world.now, until: Infinity };
}

export const resting = (w: Wasp, places: Places, now: number): Wasp => ({ ...w, mode: 'rest', flight: null, since: now, until: now + RECHECK, from: standOf(w.id, places) });

// Over to inspect its spot, then side to side in front of it.
export function toInspect(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
  const above = aboveOf(w.id, world.places);
  const route = firstClear(routes(here, above), FOOTPRINTS.hover, world.air, othersClaims(others, world.places, world.now));
  if (!route) return null;
  const flight = flightOf(route, world.now, CRUISE_SPEED);
  const sweeps = Math.round(between(world.rand, ...SWEEPS));
  return { ...w, mode: 'inspect', flight, since: world.now + flight.duration, until: world.now + flight.duration + sweeps * SWEEP };
}

// The heights a wasp may fly the lane at, farthest from y first.
function laneHeights(air: WaspAir, y: number): number[] {
  const r = FOOTPRINTS.cruise;
  const top = air.lane.top + r.up + 1, bottom = air.lane.bottom - r.down - 1;
  if (bottom < top) return [];
  return [top, (top + bottom) / 2, bottom].sort((a, b) => Math.abs(b - y) - Math.abs(a - y));
}

// Chased: off along the exit lane at the height farthest from the cursor,
// starting directly away from it; else across to the air's edge first and
// up; else climbing first and leaving along the lane. With no clear way out
// it dodges to the far side of its orbit, if it is on it.
function chased(w: Wasp, here: Point, cursor: Point, world: World, others: readonly Wasp[]): Wasp {
  const { air, places, now } = world;
  const r = FOOTPRINTS.cruise;
  const out = air.lane.left + r.half;
  const d = apart(here, cursor) || 1;
  const away = { x: here.x + (24 * (here.x - cursor.x)) / d, y: here.y + (24 * (here.y - cursor.y)) / d };
  const edge = air.air.left + r.half + 2;
  const claims = othersClaims(others, places, now);
  const tried = laneHeights(air, cursor.y).flatMap((y): Route[] => [
    [here, away, { x: edge, y }, { x: out, y }],
    [here, { x: edge, y: here.y }, { x: edge, y }, { x: out, y }],
    [here, { x: here.x, y }, { x: out, y }],
  ].map(rounded));
  const route = firstClear(tried, r, air, claims, true);
  if (route) return { ...w, mode: 'flee', flight: flightOf(route, now, FLEE_SPEED), since: now, until: Infinity };
  const onOrbit = w.mode === 'circle' || w.mode === 'dodge';
  if (!onOrbit || !orbitFits(w.id, world)) return w;
  const o = orbitOf(w.id, places);
  const far = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6).reduce((best, t) => (apart(trueOrbitPoint(o, t), cursor) > apart(trueOrbitPoint(o, best), cursor) ? t : best), 0);
  const to = trueOrbitPoint(o, far);
  const dodge: Route = [{ from: here, c1: mixPoint(here, o.c, 0.6), c2: mixPoint(to, o.c, 0.6), to }];
  if (!clearRoute(dodge, FOOTPRINTS.hover, air, claims)) return w;
  return { ...w, mode: 'dodge', flight: flightOf(dodge, now, DODGE_SPEED), since: now, until: Infinity, angle: far, from: to };
}

// Back from the lane: in at a seeded height, with two brief hovers on the
// way, to the leftmost point of its orbit, or to just above its spot if its
// orbit has no room.
function comeBack(w: Wasp, world: World, others: readonly Wasp[]): Wasp | null {
  const { air, places, now, rand } = world;
  const r = FOOTPRINTS.cruise;
  const heights = laneHeights(air, 0);
  if (!heights.length) return null;
  const to = orbitFits(w.id, world) ? trueOrbitPoint(orbitOf(w.id, places), Math.PI) : aboveOf(w.id, places);
  const claims = othersClaims(others, places, now);
  const y = between(rand, Math.min(...heights), Math.max(...heights));
  const from = { x: air.lane.left + r.half, y };
  const edge = air.air.left + r.half + 2;
  const tried = [[from, { x: edge, y }, { x: edge, y: to.y }, to], [from, { x: to.x, y }, to], [from, to]].map(rounded);
  const route = firstClear(tried, r, air, claims, true);
  if (!route) return null;
  const flight = flightOf(route, now, RETURN_SPEED, true);
  return { ...w, mode: 'return', flight, since: now + flight.duration, until: Infinity, from: to, face: 1 };
}

// Where it is facing toward, or null to keep facing as it is.
function facingOf(w: Wasp, here: Point, places: Places, now: number): number | null {
  const toward = (x: number) => (Math.abs(x - here.x) < 1 ? null : x > here.x ? 1 : -1);
  if (w.flight && flying(w, now)) {
    const ahead = along(w.flight.route, Math.min(1, flightProgress(w.flight, now) + 0.03));
    return w.mode === 'land' || w.mode === 'takeoff' ? null : toward(ahead.x);
  }
  if (w.mode === 'circle') return toward(places.cake.x);
  if (w.mode === 'depart') return toward(spotOf(w.id, places).x);
  return null;
}

const moving = (c: Pointer | null, now: number): c is Pointer => !!c && now - c.at <= CHASE_FRESH && c.speed >= CHASE_SPEED;
const near = (c: Point | null, p: Point, by: number) => !!c && apart(c, p) < by;

// Its timed modes running on into the next, and a moving cursor chasing it.
function advance(w: Wasp, world: World, others: readonly Wasp[]): Wasp {
  const { places, now, rand, cursor } = world;
  const here = where(w, places, now);
  if (here && moving(cursor, now) && w.mode !== 'flee' && w.mode !== 'dodge' && apart(here, cursor) < CHASE_REACH) return chased(w, here, cursor, world, others);
  if (!here) {
    if (now < w.until || near(cursor, spotOf(0, places), BACK_SHY)) return w;
    return comeBack(w, world, others) ?? { ...w, until: now + RECHECK };
  }
  if (w.flight && flying(w, now)) return w;
  switch (w.mode) {
    case 'circle': {
      if (!orbitFits(w.id, world)) return toLand(w, here, world, others) ?? resting(w, places, now);
      if (now < w.until) return w;
      if (rand() < 0.5) return toInspect(w, here, world, others) ?? { ...w, until: now + w.lap };
      return { ...w, until: now + Math.round(between(rand, ...LAPS)) * w.lap };
    }
    case 'inspect': {
      if (now < w.until) return w;
      const spotFree = !others.some((o) => { const b = boxOf(o, places, now); return b && meets(b, grown(around(standOf(w.id, places), FOOTPRINTS.land), SPACE)); });
      if (spotFree && !near(cursor, spotOf(w.id, places), LAND_SHY)) return toLand(w, here, world, others) ?? w;
      return toCircle(w, here, world, others) ?? { ...w, until: now + SWEEP };
    }
    case 'land': return { ...w, mode: 'feed', flight: null, since: now, until: now + between(rand, ...FEED) };
    case 'feed': {
      if (now < w.until) return w;
      // Taking off and backing away need its spot's whole zone; in an air
      // too short for that it feeds on, as a resting wasp waits for room.
      return within(zoneOf(w.id, places), world.air.air) ? takeOff(w, here, now) : { ...w, until: now + RECHECK };
    }
    case 'rest': {
      if (now < w.until) return w;
      return orbitFits(w.id, world) ? takeOff(w, here, now) : { ...w, until: now + RECHECK };
    }
    case 'takeoff': return { ...w, mode: 'depart', flight: null, since: now, until: now + DEPART };
    case 'depart': {
      if (now < w.until) return w;
      if (!orbitFits(w.id, world)) return toLand(w, here, world, others) ?? resting(w, places, now);
      return toCircle(w, here, world, others) ?? w;
    }
    case 'flee': return { ...w, mode: 'away', flight: null, since: now, until: now + between(rand, ...AWAY) };
    case 'return': {
      if (orbitFits(w.id, world)) return toCircle(w, here, world, others) ?? w;
      return toLand(w, here, world, others) ?? resting(w, places, now);
    }
    case 'dodge': return toCircle(w, here, world, others) ?? w;
    default: return w;
  }
}

function takeOff(w: Wasp, here: Point, now: number): Wasp {
  const to = { x: here.x, y: here.y - RISE };
  return { ...w, mode: 'takeoff', flight: { route: rounded([here, to]), start: now, duration: TAKEOFF, hovers: false }, since: now, until: Infinity, from: to };
}

// Every time it holds: each of its moments moved on by dt, so it hovers
// where it is for that frame.
function held(w: Wasp, dt: number): Wasp {
  return {
    ...w,
    since: w.since + dt, until: w.until + dt,
    flight: w.flight && { ...w.flight, start: w.flight.start + dt },
  };
}

// One wasp's step: its turn about eased, its modes run on, and, for wasp 1,
// holding where it is for a frame rather than moving into wasp 0's box
// (the lower id has right of way). dt in milliseconds.
export function stepWasp(w: Wasp, others: readonly Wasp[], world: World, dt: number): Wasp {
  const { places, now } = world;
  const next = advance(w, world, others);
  const here = where(next, places, now);
  const target = here ? facingOf(next, here, places, now) : null;
  const turn = (2 * dt) / TURN;
  const face = target === null ? next.face : clamp(target, next.face - turn, next.face + turn);
  const turned = { ...next, face };
  if (w.id === 0 || !here) return turned;
  const box = around(here, FOOTPRINTS[poseOf(turned)]);
  const blocked = others.some((o) => {
    const b = o.id < w.id && boxOf(o, places, now);
    return b && meets(box, grown(b, SPACE));
  });
  return blocked ? held({ ...w, face }, dt) : turned;
}
