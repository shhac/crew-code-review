import { around, GAP, sweeps, type Air } from '../air';
import { fromLedge, toLedge } from '../anchored';
import { cubic, lengthOf, samples, type Curve } from '../curves';
import { inView, type Box, type Ledge, type Obstacle, type PageMap } from '../floors';
import { clearOf, pageAt, roomOver, runsOf, spare, staysPut, type Claim } from '../ledges';
import { apart, clamp01, degrees, sign } from '../math';
import type { Point } from '../pointer';
import { AIR, GROUND, GULL, LIFT, type AirPose } from './gull-poses';

// The swoop at a cursor left still: where the gull pulls up beside it (the
// pass point), the route there and on to a landing spot, and whether every
// part of it stays in the air. Pure geometry on a page map; when a gull
// swoops, and who, is gulls.ts's. design-docs/seaside/README.md has the
// airspace contract.

export type FlightMode = 'run' | 'climb' | 'dive' | 'pullup' | 'cruise' | 'flare';
// One stretch of a flight: its curve (of the body's middle), the pose drawn
// along it, how long it takes, and its speed at each end (px/s).
export type Leg = { mode: FlightMode; pose: AirPose; curve: Curve; duration: number; v0: number; v1: number };
// Where a flight comes down: the ledge, where its run-out ends, and the way
// it faces landing.
export type Landing = { floor: number; x: number; dir: 1 | -1 };
// A flight held relative to its landing ledge, so a scroll carries it with
// the page; with the ledge it took off from.
export type Flight = { floor: number; from: number; legs: Leg[]; start: number; land: Landing };

const SPEED: Record<FlightMode, readonly [number, number]> = {
  run: [40, 40], climb: [200, 200], dive: [200, 360], pullup: [240, 240], cruise: [240, 240], flare: [240, 60],
};
// Two running steps of 9px take 0.45s; the pull-up's two quick flaps 0.35s.
const RUN = 450;
const RUN_LENGTH = 18;
const PULL_UP = 350;
// Two run-out steps of 6px after touching down.
export const RUN_OUT = 12;
// The flare is the last 30px before touchdown. It begins high enough that
// the flight pose's lowered wings, just before it, keep clear of the card
// it lands on.
const FLARE = 30;
const FLARE_DROP = AIR.flight.down - LIFT + GAP + 2;
const FLARE_RUN = Math.sqrt(FLARE ** 2 - FLARE_DROP ** 2);

// The pass point: the swoop's box wholly in air, at least NEAR from the
// cursor and at most FAR, on a GRID px grid round it, never over it.
const NEAR = 12;
const FAR = 160;
const GRID = 8;
const PASSES = 6;
// The dive heads within this many degrees of the cursor.
const AIMED = 35;
// The dive starts back along the approach and above the pass point; the
// pull-up rises to here past it.
const DIVES = [{ back: 100, up: 65 }, { back: 70, up: 45 }, { back: 135, up: 88 }, { back: 40, up: 80 }];
const PULL = { on: 80, up: 40 };
// A walk to a take-off spot is at most this long, tried in these steps.
export const MAX_WALK = 60;
const WALK_STEP = 15;
// Taking off or landing needs this much clear above this much ledge.
const COLUMN = { height: 40, length: 56 };
// A landing is this far from the cursor, at least.
const CURSOR_ROOM = 80;
const LANDINGS = 4;
const MAX_LENGTH = 900;
// Other gulls are kept this far clear of a route.
const BERTH = 12;

const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const scale = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const unit = (p: Point): Point => scale(p, 1 / (Math.hypot(p.x, p.y) || 1));
const straight = (from: Point, to: Point): Curve => ({ from, c1: add(from, scale(sub(to, from), 1 / 3)), c2: add(from, scale(sub(to, from), 2 / 3)), to });
const contains = (b: Box, p: Point) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
const curveLength = (c: Curve) => lengthOf((t) => cubic(c, t));
// The rest of a cubic curve from t on (de Casteljau).
function after(c: Curve, t: number): Curve {
  const mixP = (p: Point, q: Point) => add(p, scale(sub(q, p), t));
  const ab = mixP(c.from, c.c1), bc = mixP(c.c1, c.c2), cd = mixP(c.c2, c.to);
  const abc = mixP(ab, bc), bcd = mixP(bc, cd);
  return { from: mixP(abc, bcd), c1: bcd, c2: cd, to: c.to };
}

function leg(mode: FlightMode, pose: AirPose, curve: Curve): Leg {
  const [v0, v1] = SPEED[mode];
  const length = curveLength(curve);
  if (mode === 'run') return { mode, pose, curve, duration: RUN, v0: (length / RUN) * 1000, v1: (length / RUN) * 1000 };
  if (mode === 'pullup') return { mode, pose, curve, duration: PULL_UP, v0: (length / PULL_UP) * 1000, v1: (length / PULL_UP) * 1000 };
  return { mode, pose, curve, duration: (length / ((v0 + v1) / 2)) * 1000, v0, v1 };
}

// How far along its curve a leg is, u of the way through its time, speeding
// up or slowing down evenly from v0 to v1.
export const along = (l: Pick<Leg, 'v0' | 'v1'>, u: number) => {
  const t = clamp01(u);
  return (l.v0 * t + ((l.v1 - l.v0) * t * t) / 2) / ((l.v0 + l.v1) / 2);
};

export const flightTime = (f: Pick<Flight, 'legs'>) => f.legs.reduce((sum, l) => sum + l.duration, 0);
export const routeLength = (legs: readonly Leg[]) => legs.reduce((sum, l) => sum + curveLength(l.curve), 0);

// Where a flight is at now: its leg, how far through it, the body's middle
// on the page and the way it is heading; null with its ledge gone or the
// flight over.
export type InFlight = { leg: Leg; index: number; u: number; at: Point; heading: Point };
export function inFlight(page: PageMap, f: Flight, now: number): InFlight | null {
  const found = f.legs.reduce<{ index: number; begin: number } | null>((hit, l, i) => {
    if (hit) return hit;
    const begin = f.start + f.legs.slice(0, i).reduce((s, x) => s + x.duration, 0);
    return now < begin + l.duration ? { index: i, begin } : null;
  }, null);
  if (!found) return null;
  const l = f.legs[found.index];
  const curve = fromLedge(page, f.floor, l.curve);
  if (!curve) return null;
  const u = (now - found.begin) / l.duration;
  const t = along(l, u);
  const at = cubic(curve, t);
  const ahead = cubic(curve, Math.min(1, t + 0.02));
  const behind = cubic(curve, Math.max(0, t - 0.02));
  return { leg: l, index: found.index, u, at, heading: unit(sub(ahead, behind)) };
}

// A gull running along a card's top, lifting off it or landing on it dips
// its feet and its lowered wings a few pixels into the card's empty top
// edge, which covers nothing. The legs that touch a ledge are checked
// against a page where that one card's box starts DIP px lower.
const DIP = AIR.flight.down - LIFT + GAP + 2;
const STEP = 8;
const ownCard = (f: Ledge, o: Obstacle) => !!o.block && Math.abs(o.top - f.y) <= 1 && o.left <= f.left + 1 && o.right >= f.right - 1;
export function touching(air: Pick<Air, 'page' | 'room'>, f: Ledge): Pick<Air, 'page' | 'room'> {
  const obstacles = air.page.obstacles.map((o) => (ownCard(f, o) ? { ...o, top: o.top + DIP } : o));
  return { ...air, page: { ...air.page, obstacles } };
}

// Whether a leg's pose, swept along its curve, stays in the air, clear of
// `also` (the other gulls). Its boxes are taken STEP px apart and each
// neighbouring pair is tested as one (air.ts's sweeps), so nothing between
// them is missed: every pose is wider and taller than that.
export function legClear(air: Pick<Air, 'page' | 'room'>, l: Pick<Leg, 'pose' | 'curve'>, also: readonly Box[] = []): boolean {
  const boxes = samples((t) => cubic(l.curve, t), STEP).map((s) => around(s.p, AIR[l.pose]));
  return sweeps(air, boxes, also);
}

// Every pass point for a cursor, nearest first: the swoop's box wholly in
// air and never over the cursor, 12 to 160px from it, on an 8px grid.
export function passPoints(air: Pick<Air, 'page' | 'room'>, cursor: Point, also: readonly Box[] = []): Point[] {
  const steps = Math.floor(FAR / GRID);
  const grid = Array.from({ length: (2 * steps + 1) ** 2 }, (_, i) => ({ x: cursor.x + GRID * ((i % (2 * steps + 1)) - steps), y: cursor.y + GRID * (Math.floor(i / (2 * steps + 1)) - steps) }));
  // Only what is within reach of the grid can be in the way.
  const reach = FAR + AIR.swoop.half + GAP + 1;
  const near = air.page.obstacles.filter((o) => o.right > cursor.x - reach && o.left < cursor.x + reach && o.bottom > cursor.y - reach && o.top < cursor.y + reach);
  const local = { ...air, page: { ...air.page, obstacles: near } };
  return grid
    .filter((p) => apart(p, cursor) >= NEAR && apart(p, cursor) <= FAR)
    .sort((a, b) => apart(a, cursor) - apart(b, cursor))
    .filter((p) => !contains(around(p, AIR.swoop), cursor) && sweeps(local, [around(p, AIR.swoop)], also));
}

// The angle between the dive and the line from its start to the cursor.
export const aimOff = (a: Point, p: Point, cursor: Point) => {
  const d = unit(sub(p, a)), c = unit(sub(cursor, a));
  return degrees(Math.acos(Math.max(-1, Math.min(1, d.x * c.x + d.y * c.y))));
};

// What a plan asks of the page again and again, worked out once: each
// ledge's clear runs and its page with its own card dipped into, whether a
// spot has its column of air to take off or land, and each flare.
function planner(air: Pick<Air, 'page' | 'room'>, taken: readonly Claim[], cursor: Point | null) {
  const page = air.page;
  const memo = <K, V>(work: (key: K) => V) => {
    const known = new Map<string, { value: V }>();
    return (key: K): V => {
      const id = JSON.stringify(key);
      const hit = known.get(id);
      if (hit) return hit.value;
      const value = work(key);
      known.set(id, { value });
      return value;
    };
  };
  const runs = memo((floor: number) => runsOf(page.floors.get(floor)!, page, GULL));
  const dipped = memo((floor: number) => touching(air, page.floors.get(floor)!));
  // 40px clear over the 56px of ledge from x, the way dir says.
  const column = memo(([floor, x, dir]: [number, number, 1 | -1]) => {
    const f = page.floors.get(floor)!;
    const end = x + dir * COLUMN.length;
    return roomOver(f, page, GULL, Math.min(x, end), Math.max(x, end)) >= COLUMN.height;
  });
  // Taking off from x running dir: the run's 18px on a clear run, and the
  // column ahead.
  const takeOffAt = (floor: number, x: number, dir: 1 | -1) => {
    const lo = Math.min(x, x + dir * RUN_LENGTH), hi = Math.max(x, x + dir * RUN_LENGTH);
    return runs(floor).some((r) => r.lo <= lo && hi <= r.hi) && column([floor, x, dir]);
  };
  // Landing at x flying dir: the column behind it, and 80px from the cursor.
  const landAt = (floor: number, x: number, dir: 1 | -1) => {
    const f = page.floors.get(floor)!;
    return column([floor, x, sign(-dir)]) && (!cursor || apart(pageAt(f, x, LIFT), cursor) >= CURSOR_ROOM);
  };
  // Every spot in view a gull could stand at, 24px apart, clear of the
  // others.
  const spots = [...page.floors].flatMap(([floor, f]) => {
    if (!inView(f, page)) return [];
    return runs(floor).flatMap((r) => {
      const lo = r.lo + GULL.half, hi = r.hi - GULL.half;
      const count = Math.max(0, Math.floor((hi - lo) / 24) + 1);
      return Array.from({ length: count }, (_, i) => ({ floor, x: lo + i * 24, at: pageAt(f, lo + i * 24, LIFT) })).filter((s) => clearOf(taken, floor, s.x, s.x, GULL.spacing));
    });
  });
  // Up to four landings for a flight coming from `from`: those in `first`
  // it can land at, then the nearest.
  const landings = (from: Point, first: readonly { floor: number; x: number }[] = []): Landing[] => {
    const facing = (floor: number, x: number) => sign(pageAt(page.floors.get(floor)!, x).x - from.x);
    const found: Landing[] = first.map((h) => ({ ...h, dir: facing(h.floor, h.x) })).filter((h) => landAt(h.floor, h.x, h.dir));
    const near = [...spots].sort((a, b) => apart(a.at, from) - apart(b.at, from));
    for (const s of near) {
      if (found.length >= LANDINGS) break;
      const dir = facing(s.floor, s.x);
      if (!found.some((h) => h.floor === s.floor && h.x === s.x) && landAt(s.floor, s.x, dir)) found.push({ floor: s.floor, x: s.x, dir });
    }
    return found.slice(0, LANDINGS);
  };
  // The flare onto a landing, if clear.
  const flareOnto = memo((l: Landing): Leg | null => {
    const f = page.floors.get(l.floor)!;
    const touch = pageAt(f, l.x - l.dir * RUN_OUT, LIFT);
    const from = { x: touch.x - l.dir * FLARE_RUN, y: touch.y - FLARE_DROP };
    const flare = leg('flare', 'flare', { from, c1: { x: from.x + l.dir * 12, y: from.y + 2 }, c2: { x: touch.x - l.dir * 6, y: touch.y - 6 }, to: touch });
    return legClear(dipped(l.floor), flare) ? flare : null;
  });
  return { dipped, takeOffAt, landings, flareOnto };
}
type Planner = ReturnType<typeof planner>;

// The flight to a landing from `from` heading `out`: a cruise on one of a
// few arcs, then the flare; each made only if clear.
function comeDown(air: Pick<Air, 'page' | 'room'>, plan: Planner, from: Point, out: Point, l: Landing, also: readonly Box[]): Leg[] | null {
  const flare = plan.flareOnto(l);
  if (!flare || (also.length && !legClear(plan.dipped(l.floor), flare, also))) return null;
  const to = flare.curve.from;
  const span = Math.max(40, apart(from, to));
  const k = 0.35 * span;
  const cruise = [0, 0.3, 0.6, -0.2].map((bow) => leg('cruise', 'flight', {
    from,
    c1: add(from, add(scale(unit(out), k), { x: 0, y: -bow * span })),
    c2: { x: to.x - l.dir * k, y: to.y - bow * span },
    to,
  })).find((c) => legClear(air, c, also));
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
  const page = air.page;
  const f = page.floors.get(gull.floor);
  if (!f) return null;
  const plan = planner(air, taken, cursor);
  const home = ask.home && staysPut(ask.home, page, GULL, taken) ? [ask.home] : [];
  const heads = passPoints(air, cursor, also).slice(0, PASSES).flatMap((p) => ([1, -1] as const).flatMap((s) => DIVES.flatMap(({ back, up }) => {
    const a = { x: p.x - s * back, y: p.y - up };
    if (aimOff(a, p, cursor) > AIMED) return [];
    const dive = leg('dive', 'swoop', straight(a, p));
    const b = { x: p.x + s * PULL.on, y: p.y - PULL.up };
    const pull = leg('pullup', 'flight', { from: p, c1: add(p, scale(unit(sub(p, a)), 25)), c2: { x: b.x - s * 25, y: b.y + 6 }, to: b });
    return [{ s, a, dive, pull }];
  })));
  for (const { s, a, dive, pull } of heads) {
    if (!legClear(air, dive, also) || !legClear(air, pull, also)) continue;
    const off = takeOff(plan, f, gull, a, unit(sub(dive.curve.to, a)), also);
    if (!off) continue;
    const head = [...off.legs, dive, pull];
    const sofar = routeLength(head) + Math.abs(off.x - gull.x);
    for (const land of plan.landings(pull.curve.to, home)) {
      const flare = plan.flareOnto(land);
      // A cruise is never shorter than the straight way to its flare.
      if (!flare || sofar + apart(pull.curve.to, flare.curve.from) + FLARE > MAX_LENGTH) continue;
      const tail = comeDown(air, plan, pull.curve.to, { x: s, y: -0.3 }, land, also);
      if (tail && sofar + routeLength(tail) <= MAX_LENGTH) return { floor: gull.floor, from: off.x, legs: [...head, ...tail], land, length: routeLength([...head, ...tail]) };
    }
  }
  return null;
}

// The nearest take-off spot within a walk of 60px from which the run heads
// toward the dive's start (`into` is the dive's way), and the run and climb
// from it, if clear: a climb rising straight away, or one that flies out
// level first (over the rest of its card, say) and comes round into the
// dive. The first three spots with room to take off are tried.
function takeOff(plan: Planner, f: Ledge, gull: { floor: number; x: number }, a: Point, into: Point, also: readonly Box[]): { x: number; legs: Leg[] } | null {
  const offsets = [0, ...Array.from({ length: MAX_WALK / WALK_STEP }, (_, i) => (i + 1) * WALK_STEP).flatMap((d) => [d, -d])];
  const ground = plan.dipped(gull.floor);
  const spots = offsets.map((dx) => gull.x + dx).flatMap((x) => {
    const dir = sign(a.x - (f.left + x));
    return plan.takeOffAt(gull.floor, x, dir) ? [{ x, dir }] : [];
  }).slice(0, 3);
  for (const { x, dir } of spots) {
    const from = pageAt(f, x, LIFT);
    const lift = { x: from.x + dir * RUN_LENGTH, y: from.y - 3 };
    const run = leg('run', 'takeoff', straight(from, lift));
    if (!legClear(ground, run, also)) continue;
    const out = Math.max(30, 0.6 * Math.abs(a.x - lift.x));
    const climbs = [
      { c1: { x: lift.x + dir * 30, y: lift.y - 12 }, c2: add(a, scale(unit(sub(a, lift)), -30)) },
      { c1: { x: lift.x + dir * out, y: lift.y - 12 }, c2: add(a, scale(into, -40)) },
    ];
    const climb = climbs.map((c) => leg('climb', 'flight', { from: lift, ...c, to: a })).find((c) => legClear(ground, c, also));
    if (climb) return { x, legs: [run, climb] };
  }
  return null;
}

// After a layout change mid-flight: from where it is, heading the way it
// is going, to the nearest landing spot it can reach clear (up to four
// tried); or null.
export function replan(air: Pick<Air, 'page' | 'room'>, here: Point, heading: Point, taken: readonly Claim[], also: readonly Box[], cursor: Point | null): Pick<Plan, 'legs' | 'land' | 'length'> | null {
  const plan = planner(air, taken, cursor);
  for (const land of plan.landings(here)) {
    const legs = comeDown(air, plan, here, heading, land, also);
    if (legs) return { legs, land, length: routeLength(legs) };
  }
  return null;
}

// A plan as a flight starting now, held by its landing ledge; from is the
// ledge it leaves (the landing's, for a flight re-planned in the air).
export function flightOf(page: PageMap, plan: Pick<Plan, 'legs' | 'land'>, from: number, now: number): Flight | null {
  const legs = plan.legs.map((l) => {
    const curve = toLedge(page, plan.land.floor, l.curve);
    return curve && { ...l, curve };
  });
  if (legs.some((l) => !l)) return null;
  return { floor: plan.land.floor, from, legs: legs.flatMap((l) => l ?? []), start: now, land: plan.land };
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
  if (!staysPut(f.land, page, GULL, taken) || spare(g, page, GULL, GROUND.strut, f.land.x) < 0) return false;
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

