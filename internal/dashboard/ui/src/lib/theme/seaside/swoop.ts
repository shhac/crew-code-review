import { around, fitsAir, GAP, sweeps, sweptPath, type Air } from '../air';
import { fromLedge } from '../anchored';
import type { Curve } from '../curves';
import { inView, type Box, type Ledge, type Obstacle, type PageMap, type Run } from '../floors';
import { bodyOf, clearOf, pageAt, pointsAlong, roomOver, runsOf, spare, staysPut, type Claim } from '../ledges';
import { apart, degrees, sign } from '../math';
import type { Point } from '../pointer';
import {
  add, along, inFlight, leg, routeLength, RUN_OUT, scale, sub, unit,
  type Flight, type Landing, type Leg,
} from './flight';
import { AIR, GULL } from './gull-poses';

// The swoop at a cursor left still: where the gull pulls up beside it (the
// pass point), the route there and on to a landing spot, and whether every
// part of it stays in the air. Pure geometry on a page map; when a gull
// swoops, and who, is gulls.ts's. design-docs/seaside/README.md has the
// airspace contract.

// Two running steps of 9px.
const RUN_LENGTH = 18;
// The flare is the last 30px before touchdown. It begins high enough that
// the flapping pose just before it keeps clear of the card it lands on.
const FLARE = 30;
const FLARE_DROP = AIR.flap.down + GAP + 2;
const FLARE_RUN = Math.sqrt(FLARE ** 2 - FLARE_DROP ** 2);

// The pass point: the swoop's box wholly in air, at least NEAR from the
// cursor and at most FAR, on a GRID px grid round it, never over it.
const NEAR = 12;
const FAR = 160;
const GRID = 8;
// A route is planned through at most PASSES pass points that have a clear
// dive into them, of the PASS_LOOK nearest: the very nearest are often
// where no dive fits above them (under the top of main, say).
const PASSES = 6;
const PASS_LOOK = 80;
// The dive heads within this many degrees of the cursor.
const AIMED = 35;
// The dive starts back along the approach and above the pass point; the
// pull-up rises to one of these past it, the first that is clear (a
// shallower one where the top of main is near).
const DIVES = [{ back: 100, up: 65 }, { back: 70, up: 45 }, { back: 135, up: 88 }, { back: 40, up: 80 }];
const PULLS = [{ on: 80, up: 40 }, { on: 90, up: 30 }];
// A walk to a take-off spot is at most this long, tried in these steps.
export const MAX_WALK = 60;
const WALK_STEP = 15;
// Taking off or landing needs this much ledge clear to the height of its
// wings raised to beat (or to brake), and the gap air keeps round them.
const COLUMN = { height: Math.max(AIR.takeoff.up, AIR.flare.up) + GAP, length: 56 };
// A landing is this far from the cursor, at least.
const CURSOR_ROOM = 80;
const LANDINGS = 4;
const MAX_LENGTH = 900;
// Other gulls are kept this far clear of a route.
const BERTH = 12;

const straight = (from: Point, to: Point): Curve => ({ from, c1: add(from, scale(sub(to, from), 1 / 3)), c2: add(from, scale(sub(to, from), 2 / 3)), to });
const contains = (b: Box, p: Point) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
// The rest of a cubic curve from t on (de Casteljau).
function after(c: Curve, t: number): Curve {
  const mixP = (p: Point, q: Point) => add(p, scale(sub(q, p), t));
  const ab = mixP(c.from, c.c1), bc = mixP(c.c1, c.c2), cd = mixP(c.c2, c.to);
  const abc = mixP(ab, bc), bcd = mixP(bc, cd);
  return { from: mixP(abc, bcd), c1: bcd, c2: cd, to: c.to };
}

// A gull running along a card's top, lifting off it or landing on it dips
// its feet and its lowered wings a few pixels into the card's empty top
// edge, which covers nothing. The legs that touch a ledge are checked
// against a page where that one card's box starts DIP px lower.
const DIP = Math.max(AIR.takeoff.down, AIR.flare.down, AIR.flap.down) + GAP + 2;
const ownCard = (f: Ledge, o: Obstacle) => !!o.block && Math.abs(o.top - f.y) <= 1 && o.left <= f.left + 1 && o.right >= f.right - 1;
export function touching(air: Pick<Air, 'page' | 'room'>, f: Ledge): Pick<Air, 'page' | 'room'> {
  const obstacles = air.page.obstacles.map((o) => (ownCard(f, o) ? { ...o, top: o.top + DIP } : o));
  return { ...air, page: { ...air.page, obstacles } };
}

// Whether legs, each swept with its own pose's reach (air.ts's sweptPath),
// stay in the air, clear of `also` (the other gulls); and the boxes they
// were found clear by, for the debug overlay.
export const swept = (air: Pick<Air, 'page' | 'room'>, legs: readonly Pick<Leg, 'pose' | 'curve'>[], also: readonly Box[] = []) =>
  sweptPath(legs.map((l) => ({ curve: l.curve, reach: AIR[l.pose] })), fitsAir(air, also));
export const legClear = (air: Pick<Air, 'page' | 'room'>, l: Pick<Leg, 'pose' | 'curve'>, also: readonly Box[] = []): boolean => swept(air, [l], also).clear;

// Every pass point for a cursor, nearest first: the swoop's box wholly in
// air and never over the cursor, 12 to 160px from it, on an 8px grid.
export function passPoints(air: Pick<Air, 'page' | 'room'>, cursor: Point, also: readonly Box[] = []): Point[] {
  const steps = Math.floor(FAR / GRID);
  const grid = Array.from({ length: (2 * steps + 1) ** 2 }, (_, i) => ({ x: cursor.x + GRID * ((i % (2 * steps + 1)) - steps), y: cursor.y + GRID * (Math.floor(i / (2 * steps + 1)) - steps) }));
  // Only what is within reach of the grid can be in the way.
  const reach = FAR + Math.max(AIR.stoop.half, AIR.stoop.up) + GAP + 1;
  const near = air.page.obstacles.filter((o) => o.right > cursor.x - reach && o.left < cursor.x + reach && o.bottom > cursor.y - reach && o.top < cursor.y + reach);
  const local = { ...air, page: { ...air.page, obstacles: near } };
  return grid
    .filter((p) => apart(p, cursor) >= NEAR && apart(p, cursor) <= FAR)
    .sort((a, b) => apart(a, cursor) - apart(b, cursor))
    .filter((p) => !contains(around(p, AIR.stoop), cursor) && sweeps(local, [around(p, AIR.stoop)], also));
}

// The angle between the dive and the line from its start to the cursor.
export const aimOff = (a: Point, p: Point, cursor: Point) => {
  const d = unit(sub(p, a)), c = unit(sub(cursor, a));
  return degrees(Math.acos(Math.max(-1, Math.min(1, d.x * c.x + d.y * c.y))));
};

// The column's height clear over its length of ledge from x, the way dir
// says.
function columnClear(f: Ledge, page: PageMap, x: number, dir: 1 | -1): boolean {
  const end = x + dir * COLUMN.length;
  return roomOver(f, page, GULL, Math.min(x, end), Math.max(x, end)) >= COLUMN.height;
}

// Taking off from x running dir: the run's 18px on a clear run, and the
// column ahead (only looked at for a run that fits).
function takeOffFits(runs: readonly Run[], x: number, dir: 1 | -1, column: () => boolean): boolean {
  const lo = Math.min(x, x + dir * RUN_LENGTH), hi = Math.max(x, x + dir * RUN_LENGTH);
  return runs.some((r) => r.lo <= lo && hi <= r.hi) && column();
}

// Whether a gull standing at x on a ledge could take off from there, one
// way or the other.
export function roomToTakeOff(scene: PageMap, floor: number, x: number): boolean {
  const f = scene.floors.get(floor);
  if (!f) return false;
  const runs = runsOf(f, scene, GULL);
  return ([1, -1] as const).some((dir) => takeOffFits(runs, x, dir, () => columnClear(f, scene, x, dir)));
}

// Work done once for each key, told apart by its JSON.
function memo<K, V>(work: (key: K) => V): (key: K) => V {
  const known = new Map<string, { value: V }>();
  return (key) => {
    const id = JSON.stringify(key);
    const hit = known.get(id);
    if (hit) return hit.value;
    const value = work(key);
    known.set(id, { value });
    return value;
  };
}

// Every spot in view a gull could stand at, 24px apart along each ledge's
// clear runs, clear of the others.
type StandSpot = { floor: number; x: number; at: Point };
function standSpots(page: PageMap, runs: (floor: number) => readonly Run[], taken: readonly Claim[]): StandSpot[] {
  return [...page.floors].flatMap(([floor, f]) => {
    if (!inView(f, page)) return [];
    return pointsAlong(runs(floor).map((r) => ({ floor, room: bodyOf(r, GULL.half) })), 24)
      .filter((s) => clearOf(taken, floor, s.x, s.x, GULL.spacing)).map((s) => ({ ...s, at: pageAt(f, s.x) }));
  });
}

// The flare onto a landing on ledge f: its last 30px, braking to touch
// down RUN_OUT short of where the landing ends.
function flareLeg(f: Ledge, l: Landing): Leg {
  const touch = pageAt(f, l.x - l.dir * RUN_OUT);
  const from = { x: touch.x - l.dir * FLARE_RUN, y: touch.y - FLARE_DROP };
  return leg('flare', 'flare', { from, c1: { x: from.x + l.dir * 12, y: from.y + 2 }, c2: { x: touch.x - l.dir * 6, y: touch.y - 6 }, to: touch });
}

// What a plan asks of the page again and again, worked out once: each
// ledge's clear runs and its page with its own card dipped into, whether a
// spot has its column of air to take off or land, and each flare; with the
// air a route must keep to and the boxes it keeps clear of.
function planner(air: Pick<Air, 'page' | 'room'>, taken: readonly Claim[], cursor: Point | null, also: readonly Box[]) {
  const page = air.page;
  const runs = memo((floor: number) => runsOf(page.floors.get(floor)!, page, GULL));
  const dipped = memo((floor: number) => touching(air, page.floors.get(floor)!));
  const column = memo(([floor, x, dir]: [number, number, 1 | -1]) => columnClear(page.floors.get(floor)!, page, x, dir));
  const takeOffAt = (floor: number, x: number, dir: 1 | -1) => takeOffFits(runs(floor), x, dir, () => column([floor, x, dir]));
  // Landing at x flying dir: the column behind it, and 80px from the cursor.
  const landAt = (floor: number, x: number, dir: 1 | -1) => {
    const f = page.floors.get(floor)!;
    return column([floor, x, sign(-dir)]) && (!cursor || apart(pageAt(f, x), cursor) >= CURSOR_ROOM);
  };
  const spots = standSpots(page, runs, taken);
  // Up to four landings for a flight coming from `from`: those in `first`
  // it can land at, then the nearest.
  // Each spot is landed on flying the way that faces from `from` if its
  // column is that side, else coming round to land the other way.
  const landings = (from: Point, first: readonly { floor: number; x: number }[] = []): Landing[] => {
    const facing = (floor: number, x: number) => sign(pageAt(page.floors.get(floor)!, x).x - from.x);
    const way = (s: { floor: number; x: number }): Landing[] => {
      const dir = facing(s.floor, s.x);
      return ([dir, sign(-dir)] as const).filter((d) => landAt(s.floor, s.x, d)).slice(0, 1).map((d) => ({ floor: s.floor, x: s.x, dir: d }));
    };
    const found: Landing[] = first.flatMap(way);
    const near = [...spots].sort((a, b) => apart(a.at, from) - apart(b.at, from));
    for (const s of near) {
      if (found.length >= LANDINGS) break;
      if (!found.some((h) => h.floor === s.floor && h.x === s.x)) found.push(...way(s));
    }
    return found.slice(0, LANDINGS);
  };
  // The flare onto a landing, if clear.
  const flareOnto = memo((l: Landing): Leg | null => {
    const flare = flareLeg(page.floors.get(l.floor)!, l);
    return legClear(dipped(l.floor), flare) ? flare : null;
  });
  return { air, also, dipped, takeOffAt, landings, flareOnto };
}
type Planner = ReturnType<typeof planner>;

// The flight to a landing from `from` heading `out`: a cruise on one of a
// few arcs, then the flare; each made only if clear.
function comeDown(plan: Planner, from: Point, out: Point, l: Landing): Leg[] | null {
  const { air, also } = plan;
  const flare = plan.flareOnto(l);
  if (!flare || (also.length && !legClear(plan.dipped(l.floor), flare, also))) return null;
  const to = flare.curve.from;
  const span = Math.max(40, apart(from, to));
  const k = 0.35 * span;
  // Arcs coming in level to the flare, then two dropping into it from
  // above, for a landing in a narrow gap (beside a heading's text, say).
  const level = [0, 0.3, 0.6, -0.2].map((bow) => ({
    c1: add(from, add(scale(unit(out), k), { x: 0, y: -bow * span })),
    c2: { x: to.x - l.dir * k, y: to.y - bow * span },
  }));
  const drop = [0, 0.3].map((bow) => ({
    c1: add(from, add(scale(unit(out), k), { x: 0, y: -bow * span })),
    c2: { x: to.x - l.dir * 8, y: to.y - k },
  }));
  const cruise = [...level, ...drop].map((c) => leg('cruise', 'flap', { from, ...c, to })).find((c) => legClear(air, c, also));
  return cruise ? [cruise, flare] : null;
}

// A planned swoop: the ledge it leaves and where on it (it walks there
// first), the flight from there, and how long the flight is.
export type Plan = { floor: number; from: number; legs: Leg[]; land: Landing; length: number };

export type SwoopAsk = {
  // The page's air in view, where a new route must be.
  air: Pick<Air, 'page' | 'room'>;
  gull: { floor: number; x: number };
  // Its own spot, tried first for landing.
  home: { floor: number; x: number } | null;
  cursor: Point;
  // The other gulls: where they are and are going (for landing), and the
  // boxes a route keeps clear of.
  taken: readonly Claim[];
  also: readonly Box[];
};

// A wholly clear swoop for a gull at a cursor, or null: a walk of at most
// 60px to a take-off spot, the run, a climb to above and behind the pass
// point, the dive at it, a pull-up past it, and a flight to one of up to
// four landing spots (its home first, then the nearest), at most 900px.
// Pass points are tried nearest the cursor first.
export function planSwoop(ask: SwoopAsk): Plan | null {
  const { air, gull, cursor, taken, also } = ask;
  const f = air.page.floors.get(gull.floor);
  if (!f) return null;
  const plan = planner(air, taken, cursor, also);
  const home = ask.home && staysPut(ask.home, air.page, GULL, taken) ? [ask.home] : [];
  // Nearest the cursor first, through the first PASSES with a clear dive
  // into them, of the first PASS_LOOK: each pass point's dives are only
  // worked out once the nearer ones have no route.
  const passes = passPoints(air, cursor, also).slice(0, PASS_LOOK);
  const through = (i: number, left: number): Plan | null => {
    if (i >= passes.length || left <= 0) return null;
    const dives = divesAt(plan, passes[i], cursor);
    for (const dive of dives) {
      const route = swoopVia(plan, f, gull, dive, home);
      if (route) return route;
    }
    return through(i + 1, dives.length ? left - 1 : left);
  };
  return through(0, PASSES);
}

// A dive at a pass point p: from its start a, the dive itself and the
// pull-up past p, flown the way s says.
type Dive = { s: 1 | -1; a: Point; dive: Leg; pull: Leg };

// The dives at a pass point, each with its pull-up, that are clear.
function divesAt(plan: Planner, p: Point, cursor: Point): Dive[] {
  const { air, also } = plan;
  return ([1, -1] as const).flatMap((s) => DIVES.flatMap(({ back, up }) => {
    const a = { x: p.x - s * back, y: p.y - up };
    if (aimOff(a, p, cursor) > AIMED) return [];
    const dive = leg('dive', 'stoop', straight(a, p));
    if (!legClear(air, dive, also)) return [];
    const pull = PULLS.map(({ on, up }) => {
      const b = { x: p.x + s * on, y: p.y - up };
      return leg('pullup', 'flap', { from: p, c1: add(p, scale(unit(sub(p, a)), 25)), c2: { x: b.x - s * 25, y: b.y + 6 }, to: b });
    }).find((l) => legClear(air, l, also));
    return pull ? [{ s, a, dive, pull }] : [];
  }));
}

// The whole swoop through one dive, if there is one: the take-off into it,
// and on from the pull-up to a landing.
function swoopVia(plan: Planner, f: Ledge, gull: { floor: number; x: number }, { s, a, dive, pull }: Dive, home: readonly { floor: number; x: number }[]): Plan | null {
  const off = takeOff(plan, f, gull, a, unit(sub(dive.curve.to, a)));
  if (!off) return null;
  const head = [...off.legs, dive, pull];
  const sofar = routeLength(head) + Math.abs(off.x - gull.x);
  const tail = landingFor(plan, pull.curve.to, { x: s, y: -0.3 }, home, sofar);
  return tail && { floor: gull.floor, from: off.x, legs: [...head, ...tail.legs], land: tail.land, length: routeLength([...head, ...tail.legs]) };
}

// The flight down from `from` heading `out` to the first landing (those in
// `first`, then the nearest) that is clear and keeps a route already
// `sofar` long to MAX_LENGTH.
function landingFor(plan: Planner, from: Point, out: Point, first: readonly { floor: number; x: number }[], sofar: number): { legs: Leg[]; land: Landing } | null {
  for (const land of plan.landings(from, first)) {
    const flare = plan.flareOnto(land);
    // A cruise is never shorter than the straight way to its flare.
    if (!flare || sofar + apart(from, flare.curve.from) + FLARE > MAX_LENGTH) continue;
    const legs = comeDown(plan, from, out, land);
    if (legs && sofar + routeLength(legs) <= MAX_LENGTH) return { legs, land };
  }
  return null;
}

// The nearest take-off spot within a walk of 60px from which the run heads
// toward the dive's start (`into` is the dive's way), and the run and climb
// from it, if clear: a climb rising straight away, or one that flies out
// level first (over the rest of its card, say) and comes round into the
// dive. The first three spots with room to take off are tried.
function takeOff(plan: Planner, f: Ledge, gull: { floor: number; x: number }, a: Point, into: Point): { x: number; legs: Leg[] } | null {
  const { also } = plan;
  const offsets = [0, ...Array.from({ length: MAX_WALK / WALK_STEP }, (_, i) => (i + 1) * WALK_STEP).flatMap((d) => [d, -d])];
  const ground = plan.dipped(gull.floor);
  const spots = offsets.map((dx) => gull.x + dx).flatMap((x) => {
    const dir = sign(a.x - (f.left + x));
    return plan.takeOffAt(gull.floor, x, dir) ? [{ x, dir }] : [];
  }).slice(0, 3);
  for (const { x, dir } of spots) {
    const from = pageAt(f, x);
    const lift = { x: from.x + dir * RUN_LENGTH, y: from.y - 3 };
    const run = leg('run', 'takeoff', straight(from, lift));
    if (!legClear(ground, run, also)) continue;
    const out = Math.max(30, 0.6 * Math.abs(a.x - lift.x));
    const climbs = [
      { c1: { x: lift.x + dir * 30, y: lift.y - 12 }, c2: add(a, scale(unit(sub(a, lift)), -30)) },
      { c1: { x: lift.x + dir * out, y: lift.y - 12 }, c2: add(a, scale(into, -40)) },
    ];
    const climb = climbs.map((c) => leg('climb', 'flap', { from: lift, ...c, to: a })).find((c) => legClear(ground, c, also));
    if (climb) return { x, legs: [run, climb] };
  }
  return null;
}

// After a layout change mid-flight: from where it is, heading the way it
// is going, to the nearest landing spot it can reach clear (up to four
// tried); or null.
export function replan(air: Pick<Air, 'page' | 'room'>, here: Point, heading: Point, taken: readonly Claim[], also: readonly Box[], cursor: Point | null): Pick<Plan, 'legs' | 'land' | 'length'> | null {
  const plan = planner(air, taken, cursor, also);
  for (const land of plan.landings(here)) {
    const legs = comeDown(plan, here, heading, land);
    if (legs) return { legs, land, length: routeLength(legs) };
  }
  return null;
}

// Whether the rest of a flight, from now on, is still clear on this page,
// and its landing still somewhere to land. A flight already under way keeps
// to all of main's air (`room`), in view or not: nothing out of view is
// covered.
export function stillClear(air: Pick<Air, 'page' | 'room'>, f: Flight, now: number, taken: readonly Claim[], also: readonly Box[]): boolean {
  const page = air.page;
  const g = page.floors.get(f.land.floor);
  const at = inFlight(page, f, now);
  if (!g || !at) return false;
  if (!staysPut(f.land, page, GULL, taken) || spare(g, page, GULL, { width: 2 * GULL.half, height: GULL.clear }, f.land.x) < 0) return false;
  const leaving = page.floors.get(f.from);
  return f.legs.slice(at.index).every((l, i) => {
    const curve = fromLedge(page, f.floor, l.curve)!;
    const rest = i === 0 ? after(curve, along(l, at.u)) : curve;
    const ledge = l.mode === 'flare' ? g : l.mode === 'run' || l.mode === 'climb' ? leaving : undefined;
    return legClear(ledge ? touching(air, ledge) : air, { pose: l.pose, curve: rest }, also);
  });
}

// The boxes a route keeps clear of: each other gull's footprint where it
// stands (or flies) and where it walks to, grown by 12px.
export function berths(points: readonly { at: Point; to: Point | null; reach: { half: number; up: number; down: number } }[]): Box[] {
  const grow = (b: Box): Box => ({ left: b.left - BERTH, right: b.right + BERTH, top: b.top - BERTH, bottom: b.bottom + BERTH });
  return points.flatMap((o) => [grow(around(o.at, o.reach)), ...(o.to ? [grow(around(o.to, o.reach))] : [])]);
}

