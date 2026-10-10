import { around, meets, union } from '../air';
import { cubic, lengthOf, samples, type Curve } from '../curves';
import type { Box, Reach } from '../floors';
import { inTurn } from '../group';
import { apart, clamp, mixPoint, smooth } from '../math';
import type { Point } from '../pointer';
import { between, hash, type Rand } from '../seed';
import { inWaspAir, type WaspAir } from './air';
import { FOOTPRINTS, STAND, type WaspPose } from './footprints';

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
// A route: a line of straight legs whose corners are rounded off, as cubic
// curves end to end. A flight along one is eased in and out, or has two
// brief hovers on the way (coming back).
export type Route = readonly Curve[];
export type Flight = { route: Route; start: number; duration: number; hovers: boolean };
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

// The places on the table the wasps use (fete/table.ts).
export type Places = { cake: { x: number; y: number; half: number }; jar: { x: number; y: number; half: number } };
// The cursor, in the stage's coordinates: where it last moved to, when, and
// how fast it was going (px/s).
export type Pointer = Point & { at: number; speed: number };
export type World = { air: WaspAir; places: Places; now: number; rand: Rand; cursor: Pointer | null };

// Each orbit drifts a little off true and bobs, so no two laps match.
const DRIFT_X = 3;
const DRIFT_Y = 2;
const BOB = 1;
// The low orbit round the cake, and the high one above it; the high one's
// height is worked out so the two bands' boxes stay APART.
const LOWER = { lift: 8, across: 12, deep: 9 };
const UPPER = { across: 4, deep: 7 };
export const APART = 6;
// The least room the two keep between their boxes at any moment.
export const SPACE = 2;
// Blending onto an orbit, and a lap's time.
const BLEND = 300;
const LAP = [1600, 2400] as const;
const LAPS = [2, 5] as const;
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
const SHUFFLE = 3;
const SHUFFLE_TIME = 400;
// Chased: by a cursor that moved in the last CHASE_FRESH ms at CHASE_SPEED
// or more, within CHASE_REACH of it. No wasp lands within LAND_SHY of a
// cursor, and none comes back while one is within BACK_SHY of the cake.
const CHASE_FRESH = 120;
const CHASE_SPEED = 60;
const CHASE_REACH = 40;
const LAND_SHY = 50;
const BACK_SHY = 60;
const AWAY = [6000, 12000] as const;
// Speeds in px/s, and the shortest flights.
const FLEE_SPEED = 260;
const RETURN_SPEED = 120;
const CRUISE_SPEED = 90;
const DODGE_SPEED = 200;
const HOVER_STOP = 250;
const MIN_FLIGHT = 300;
// A turn about takes this long.
const TURN = 120;
// Resting, it looks for room to take off this often.
const RECHECK = 1000;

export type Orbit = { c: Point; rx: number; ry: number };

// The box a footprint of `reach` can ever take on an orbit, drifting and
// bobbing.
export function bandOf(o: Orbit, reach: Reach = FOOTPRINTS.hover): Box {
  return {
    left: o.c.x - o.rx - DRIFT_X - reach.half, right: o.c.x + o.rx + DRIFT_X + reach.half,
    top: o.c.y - o.ry - DRIFT_Y - BOB - reach.up, bottom: o.c.y + o.ry + DRIFT_Y + BOB + reach.down,
  };
}

export function orbitOf(id: number, places: Places): Orbit {
  const { cake } = places;
  const lower = { c: { x: cake.x, y: cake.y - LOWER.lift }, rx: cake.half + LOWER.across, ry: LOWER.deep };
  if (id === 0) return lower;
  const bottom = bandOf(lower).top - APART;
  return { c: { x: cake.x, y: bottom - FOOTPRINTS.hover.down - BOB - DRIFT_Y - UPPER.deep }, rx: cake.half + UPPER.across, ry: UPPER.deep };
}

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

// Whether its orbit's whole band is in the air.
export const orbitFits = (id: number, w: Pick<World, 'air' | 'places'>) => within(bandOf(orbitOf(id, w.places)), w.air.air);
const within = (box: Box, room: Box) => box.left >= room.left && box.right <= room.right && box.top >= room.top && box.bottom <= room.bottom;

function orbitPoint(o: Orbit, theta: number, now: number, seed: number): Point {
  return {
    x: o.c.x + o.rx * Math.cos(theta) + DRIFT_X * Math.sin((2 * Math.PI * now) / 3700 + seed),
    y: o.c.y + o.ry * Math.sin(theta) + DRIFT_Y * Math.sin((2 * Math.PI * now) / 5300 + 2 * seed) + BOB * Math.sin((2 * Math.PI * now) / 900 + 3 * seed),
  };
}
const trueOrbitPoint = (o: Orbit, theta: number): Point => ({ x: o.c.x + o.rx * Math.cos(theta), y: o.c.y + o.ry * Math.sin(theta) });
const thetaAt = (w: Pick<Wasp, 'angle' | 'spin' | 'lap' | 'since'>, now: number) => w.angle + (w.spin * 2 * Math.PI * Math.max(0, now - w.since)) / w.lap;
// The angle on an orbit nearest a point.
const nearestTheta = (o: Orbit, p: Point) => Math.atan2((p.y - o.c.y) / o.ry, (p.x - o.c.x) / o.rx);

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

// A few short shuffles across its spot while it feeds: how far from the
// middle it stands at t into feeding, and how far it has walked.
function shuffleAt(seed: number, t: number): { dx: number; walked: number } {
  const every = 1800 + 1200 * hash(seed + 5);
  const n = Math.floor(t / every);
  const into = clamp((t - n * every - 600) / SHUFFLE_TIME, 0, 1);
  const out = n % 2 === 0;
  const dx = SHUFFLE * (out ? smooth(into) : 1 - smooth(into)) * (hash(seed + 3) < 0.5 ? 1 : -1);
  return { dx, walked: SHUFFLE * (n + smooth(into)) };
}

// How far along its flight it is, 0 to 1: eased in and out, or coming back
// with two brief hovers a third and two thirds of the way.
function flightProgress(f: Flight, now: number): number {
  const u = clamp(now - f.start, 0, f.duration);
  if (!f.hovers) return smooth(u / f.duration);
  const travel = (f.duration - 2 * HOVER_STOP) / 3;
  const piece = travel + HOVER_STOP;
  const k = Math.min(2, Math.floor(u / piece));
  return (k + smooth(Math.min(1, (u - k * piece) / travel))) / 3;
}
const flying = (w: Wasp, now: number) => w.flight !== null && now < w.flight.start + w.flight.duration;

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
      return { x: stand.x + shuffleAt(w.seed, now - w.since).dx, y: stand.y };
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
// smaller on the far side of its orbit), its bank into a turn and how far it
// has walked feeding (for its tripod).
export type WaspView = Point & { pose: WaspPose; face: number; scale: number; bank: number; walked: number };
export function waspView(w: Wasp, places: Places, now: number, still = false): WaspView | null {
  const p = where(w, places, now);
  if (!p) return null;
  const base = { ...p, face: w.face, scale: 1, bank: 0, walked: 0 };
  if (still) return { ...base, pose: 'standing' };
  if (w.mode === 'circle' && !flying(w, now)) {
    const theta = thetaAt(w, now);
    return { ...base, pose: 'hover', scale: 0.95 + 0.05 * Math.sin(theta), bank: -10 * Math.cos(theta) * w.spin };
  }
  if (w.mode === 'feed' || w.mode === 'rest') return { ...base, pose: 'feed', walked: shuffleAt(w.seed, now - w.since).walked };
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
const onOrbit = (w: Wasp, places: Places) =>
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

function sweptFrom(f: Flight, reach: Reach, now: number): Box[] {
  const done = flightProgress(f, now);
  return samples((u) => along(f.route, done + u * (1 - done)), 3).map((s) => around(s.p, reach));
}

// Each leg's length, worked out once per route.
const lengths = new WeakMap<Route, number[]>();
function legsOf(route: Route): number[] {
  const known = lengths.get(route);
  if (known) return known;
  const measured = route.map((c) => lengthOf((t) => cubic(c, t)));
  lengths.set(route, measured);
  return measured;
}
export const routeLength = (route: Route) => legsOf(route).reduce((a, b) => a + b, 0);

// The point p of the way along a route, by distance.
export function along(route: Route, p: number): Point {
  const legs = legsOf(route);
  const total = legs.reduce((a, b) => a + b, 0) || 1;
  const goal = clamp(p, 0, 1) * total;
  const k = legs.findIndex((_, i) => legs.slice(0, i + 1).reduce((a, b) => a + b, 0) >= goal - 1e-9);
  const leg = k < 0 ? route.length - 1 : k;
  const before = legs.slice(0, leg).reduce((a, b) => a + b, 0);
  return cubic(route[leg], legs[leg] ? clamp((goal - before) / legs[leg], 0, 1) : 1);
}

// A line through these points with each corner rounded off over CORNER px
// (or half the shorter leg), so a flight turns smoothly.
const CORNER = 12;
export function rounded(points: readonly Point[]): Route {
  const toward = (a: Point, b: Point, by: number) => {
    const d = apart(a, b) || 1;
    return { x: a.x + ((b.x - a.x) * by) / d, y: a.y + ((b.y - a.y) * by) / d };
  };
  const corners = points.slice(1, -1).map((v, i) => {
    const before = points[i], after = points[i + 2];
    const r = Math.min(CORNER, apart(before, v) / 2, apart(v, after) / 2);
    return { v, a: toward(v, before, r), b: toward(v, after, r) };
  });
  const straight = (a: Point, b: Point): Curve => ({ from: a, c1: mixPoint(a, b, 1 / 3), c2: mixPoint(a, b, 2 / 3), to: b });
  const starts = [points[0], ...corners.map((c) => c.b)];
  const stops = [...corners.map((c) => c.a), points[points.length - 1]];
  return starts.flatMap((s, i): Curve[] => {
    const leg = straight(s, stops[i]);
    const c = corners[i];
    return c ? [leg, { from: c.a, c1: mixPoint(c.a, c.v, 0.55), c2: mixPoint(c.b, c.v, 0.55), to: c.b }] : [leg];
  });
}

const grown = (b: Box, by: number): Box => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });

// Whether a flight along this route is clear: its footprint swept along it
// stays in the air (and the lane, where allowed), and never comes within
// SPACE of what the other has claimed.
export function clearRoute(route: Route, reach: Reach, air: WaspAir, claims: readonly Box[], lane = false): boolean {
  const boxes = samples((t) => along(route, t), 2).map((s) => around(s.p, reach));
  const room = (b: Box) => (lane ? inWaspAir(b, air) : within(b, air.air));
  const pairs = boxes.length === 1 ? boxes : boxes.slice(1).map((b, i) => union(boxes[i], b));
  return pairs.every((b) => room(b) && !claims.some((c) => meets(b, grown(c, SPACE))));
}

// The routes tried for a flight from a to b: across then down, down then
// across, straight, and bowed either way.
export function routes(a: Point, b: Point): Route[] {
  const mid = mixPoint(a, b, 0.5);
  const bow = (k: number) => ({ x: mid.x - (b.y - a.y) * k, y: mid.y + (b.x - a.x) * k });
  return [[a, { x: b.x, y: a.y }, b], [a, { x: a.x, y: b.y }, b], [a, b], [a, bow(0.3), b], [a, bow(-0.3), b]].map(rounded);
}

const flightOf = (route: Route, now: number, speed: number, hovers = false): Flight => ({
  route, start: now, hovers,
  duration: Math.max(MIN_FLIGHT, (routeLength(route) / speed) * 1000) + (hovers ? 2 * HOVER_STOP : 0),
});

const othersClaims = (others: readonly Wasp[], places: Places, now: number) => others.flatMap((o) => claimsOf(o, places, now));

// The first clear route from a to b, for a footprint of reach.
const firstClear = (tried: readonly Route[], reach: Reach, air: WaspAir, claims: readonly Box[], lane = false) => tried.find((r) => clearRoute(r, reach, air, claims, lane)) ?? null;

// Circling, from wherever it is: straight onto its orbit if it is near,
// else by a clear flight to the nearest point on it.
function toCircle(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
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
function toLand(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
  const stand = standOf(w.id, world.places);
  const route = firstClear(routes(here, stand), FOOTPRINTS.land, world.air, othersClaims(others, world.places, world.now));
  if (!route) return null;
  const flight = flightOf(route, world.now, CRUISE_SPEED);
  return { ...w, mode: 'land', flight: { ...flight, duration: Math.max(LAND, flight.duration) }, from: stand, since: world.now, until: Infinity };
}

const resting = (w: Wasp, places: Places, now: number): Wasp => ({ ...w, mode: 'rest', flight: null, since: now, until: now + RECHECK, from: standOf(w.id, places) });

// Over to inspect its spot, then side to side in front of it.
function toInspect(w: Wasp, here: Point, world: World, others: readonly Wasp[]): Wasp | null {
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
      return takeOff(w, here, now);
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

export function stepWasps(wasps: readonly Wasp[], world: World, dt: number): Wasp[] {
  return inTurn(wasps, (w, others) => stepWasp(w, others, world, dt));
}

const fresh = (id: number): Pick<Wasp, 'id' | 'seed' | 'spin' | 'face'> => ({ id, seed: id * 11 + 5, spin: id === 0 ? 1 : -1, face: id === 0 ? 1 : -1 });
const NOWHERE: Point = { x: 0, y: 0 };

// The two placed afresh: circling where their orbits fit, at seeded points
// on them (wasp 1's first inspection 1 to 3s behind wasp 0's), else
// resting on their spots; under reduced motion both standing on their
// spots, never stepped.
export function placeWasps(world: Omit<World, 'cursor'>, still = false): Wasp[] {
  const { places, now, rand } = world;
  return [0, 1].map((id): Wasp => {
    const base = { ...fresh(id), flight: null, angle: 0, lap: LAP[0], from: NOWHERE };
    if (still || !orbitFits(id, world)) return { ...base, ...resting({ ...base, mode: 'rest', since: now, until: now }, places, now), until: still ? Infinity : now + RECHECK };
    const angle = between(rand, 0, 2 * Math.PI);
    const lap = between(rand, ...LAP);
    const behind = id === 0 ? 0 : between(rand, 1000, 3000);
    // Already circling a moment ago, so it does not ease in from anywhere.
    const since = now - BLEND;
    const from = orbitPoint(orbitOf(id, places), angle, since, base.seed);
    return { ...base, mode: 'circle', since, angle: angle - (base.spin * 2 * Math.PI * BLEND) / lap, lap, from, until: now + behind + Math.round(between(rand, ...LAPS)) * lap };
  });
}

// After the air changes: a wasp that no longer fits where it is going is
// sent from where it is to its orbit, or, if that has no room, down to its
// spot; failing a clear way, it is set down on its spot. An away wasp keeps
// its timer.
export function reconcileWasps(wasps: readonly Wasp[], world: World): Wasp[] {
  return inTurn(wasps, (w, others) => reconcileWasp(w, others, world));
}

function reconcileWasp(w: Wasp, others: readonly Wasp[], world: World): Wasp {
  const { places, now } = world;
  const here = where(w, places, now);
  if (!here || w.mode === 'feed' || w.mode === 'rest' || w.mode === 'land') return w;
  if (stillFits(w, world)) return w;
  const moved = orbitFits(w.id, world) ? toCircle(w, here, world, others) : toLand(w, here, world, others);
  return moved ?? resting(w, places, now);
}

// Whether what it is doing still fits the air: the rest of its flight, and
// its orbit if it is circling or flying onto it.
function stillFits(w: Wasp, world: World): boolean {
  const { air, places, now } = world;
  if (w.flight && flying(w, now)) {
    const lane = w.mode === 'flee' || w.mode === 'return';
    const swept = sweptFrom(w.flight, FOOTPRINTS[poseOf(w)], now);
    if (!swept.every((b) => (lane ? inWaspAir(b, air) : within(b, air.air)))) return false;
  }
  if (w.mode === 'circle' || w.mode === 'dodge' || (w.mode === 'return' && onOrbit(w, places))) return orbitFits(w.id, world);
  return within(zoneOf(w.id, places), air.air);
}
