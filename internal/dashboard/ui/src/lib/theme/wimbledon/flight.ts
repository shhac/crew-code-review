import { around } from '../air';
import { cubic, samples, type Curve } from '../curves';
import type { Box, Ledge, Reach } from '../floors';
import { apart, clamp01, mix, smooth } from '../math';
import type { Point } from '../pointer';

// The pigeons' flights: away from a ledge and out of the window, and back
// in to a ledge, each a chain of cubic curves planned whole and checked
// before the bird leaves the ground. July's own route policy (see the
// note's "Airspace contract"): out along the band of air over the row it
// stands on to the far side of the window, or up and out of its top,
// whichever is clear and shorter; back in the same way it went out.
// Routes are kept relative to the ledge the flight belongs to, so a scroll
// carries a bird in the air with its card.

// Whether a box is in air, or past an exit: the surfaces and bird kits'
// check, handed in. Exits are the window's right edge, its top, and the
// rail's edge when the rail is a column (null otherwise).
export type Clear = (box: Box) => boolean;
export type Exits = { left: number | null; right: number };
export type Sky = { clear: Clear; exits: Exits };
export type Way = 'left' | 'right' | 'top';

// A flight's ledge, its curves in that ledge's local space (x from its left
// end, y up from its line, negative), and the exit it uses.
export type Route = { floor: number; curves: readonly Curve[]; way: Way };

// The envelopes a flight is checked with, anchored at the bird's feet under
// its hip: lifting off (wings clapped overhead, nothing below the feet),
// flying (the whole flap), and landing (body upright, wings braking, the
// feet reaching for the ledge).
export type Envelopes = { takeoff: Reach; fly: Reach; land: Reach };

// Flying at SPEED px/s after a TAKEOFF ms climb from the ledge, rising
// CLIMB px; landing over the last LAND ms, slowing evenly to a stop.
export const SPEED = 480;
export const TAKEOFF = 300;
export const CLIMB = 8;
export const LAND = 350;
// Slowing evenly from SPEED to nothing over LAND covers this far, and
// speeding up evenly over TAKEOFF as far.
export const LAND_RUN = (SPEED * LAND) / 2000;
export const LIFT_RUN = (SPEED * TAKEOFF) / 2000;
// The heights (above the ledge) a band route is tried at, lowest first.
const BANDS = [10, 12, 14, 16, 18, 20, 24, 28, 32];
// The climb reaches its height this far ahead of where it lifted off; a
// landing comes down over the whole of its slowing.
const RISE_RUN = 28;
// Out of the top: this far ahead by the time it is above the window.
const TOP_RUN = 160;
// Routes are checked at boxes this far apart.
const STEP = 4;

const line = (from: Point, to: Point): Curve => ({ from, c1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 }, c2: { x: from.x + (2 * (to.x - from.x)) / 3, y: from.y + (2 * (to.y - from.y)) / 3 }, to });

// Where a box of reach fully past an exit puts the bird's feet, in ledge-
// local x: past the window's right edge, or behind the rail's edge.
function exitX(f: Ledge, way: 'left' | 'right', exits: Exits, reach: Reach): number | null {
  if (way === 'right') return exits.right + reach.half + 1 - f.left;
  return exits.left === null ? null : exits.left - reach.half - 1 - f.left;
}

// Out along the band: a climb to h above the ledge, then level to the exit.
export function bandRoute(floor: number, f: Ledge, x: number, way: 'left' | 'right', h: number, exits: Exits, reach: Reach, run = RISE_RUN): Route | null {
  const end = exitX(f, way, exits, reach);
  if (end === null) return null;
  const dir = way === 'right' ? 1 : -1;
  const top = { x: x + dir * run, y: -h };
  const climb: Curve = { from: { x, y: 0 }, c1: { x: x + dir * run * 0.15, y: -h * 0.7 }, c2: { x: x + dir * run * 0.5, y: -h }, to: top };
  return { floor, way, curves: [climb, line(top, { x: end, y: -h })] };
}

// Up and out of the top of the window, ahead in dir: a climb that steepens
// and leaves the window above its top edge.
export function topRoute(floor: number, f: Ledge, x: number, dir: 1 | -1, reach: Reach): Route {
  const out = -(f.y + reach.down + 1);
  const rise: Curve = { from: { x, y: 0 }, c1: { x: x + dir * 6, y: -CLIMB * 2 }, c2: { x: x + dir * TOP_RUN * 0.5, y: out * 0.35 }, to: { x: x + dir * TOP_RUN, y: out } };
  return { floor, way: 'top', curves: [rise] };
}

// Points along a route, every STEP px or closer, with how far along each is.
export type Track = { at: Point; s: number }[];
export function trackOf(route: Route): Track {
  const pts = route.curves.flatMap((c, i) => samples((t) => cubic(c, t), STEP).map((p) => p.p).slice(i ? 1 : 0));
  const sums = pts.reduce<number[]>((acc, p, i) => {
    acc.push(i ? acc[i - 1] + apart(pts[i - 1], p) : 0);
    return acc;
  }, []);
  return pts.map((at, i) => ({ at, s: sums[i] }));
}
export const lengthOfTrack = (track: Track) => (track.length ? track[track.length - 1].s : 0);

// The point s along a track.
export function along(track: Track, s: number): Point {
  if (!track.length) return { x: 0, y: 0 };
  const i = track.findIndex((q) => q.s >= s);
  if (i <= 0) return track[i === 0 ? 0 : track.length - 1].at;
  const a = track[i - 1], b = track[i];
  const k = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
  return { x: a.at.x + (b.at.x - a.at.x) * k, y: a.at.y + (b.at.y - a.at.y) * k };
}

const onPage = (f: Ledge, p: Point): Point => ({ x: f.left + p.x, y: f.y + p.y });

// The envelope a flight has s along a track total long: from the clap at
// lift-off into the flap over its takeoff, and from the flap into the
// braking pose over its landing, as the wings swing.
export function envelopeAt(env: Envelopes, s: number, total: number, lands: boolean): Reach {
  if (!lands && s < LIFT_RUN) return blend(env.takeoff, env.fly, s / LIFT_RUN);
  return lands && total - s < LAND_RUN ? blend(env.land, env.fly, (total - s) / LAND_RUN) : env.fly;
}
const blend = (a: Reach, b: Reach, k: number): Reach => ({ half: mix(a.half, b.half, k), up: mix(a.up, b.up, k), down: mix(a.down, b.down, k) });

// Whether a route is clear for its whole length, each point with the
// envelope it has there, each neighbouring pair joined so nothing between
// two samples is missed. A route out lifts off its ledge; one in lands.
export function routeClear(route: Route, f: Ledge, env: Envelopes, clear: Clear, lands = false): boolean {
  const boxes = routeBoxes(route, f, env, lands);
  return boxes.every((b, i) => clear(i ? join(boxes[i - 1], b) : b));
}
// The envelope's box at each point of a route, on the page.
export function routeBoxes(route: Route, f: Ledge, env: Envelopes, lands: boolean): Box[] {
  const track = trackOf(route);
  const total = lengthOfTrack(track);
  return track.map((q) => around(onPage(f, q.at), envelopeAt(env, q.s, total, lands)));
}

// The stretches of each ledge a route passes low over: where its envelope
// comes within `tall` of the ledge's line (a bird standing there that
// tall, and gap more), in that ledge's local x, widened by gap. A bird
// standing in one would be flown over; one walking keeps out of them.
export type Stretch = { floor: number; lo: number; hi: number };
export function corridor(route: Route, f: Ledge, env: Envelopes, lands: boolean, floors: ReadonlyMap<number, Ledge>, tall: number, gap: number): Stretch[] {
  const boxes = routeBoxes(route, f, env, lands);
  return [...floors].flatMap(([floor, g]) => {
    const low = boxes.filter((b) => b.bottom > g.y - tall - gap && b.top < g.y && b.right > g.left && b.left < g.right);
    if (!low.length) return [];
    return [{ floor, lo: Math.min(...low.map((b) => b.left)) - g.left - gap, hi: Math.max(...low.map((b) => b.right)) - g.left + gap }];
  });
}
const join = (a: Box, b: Box): Box => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) });

// The way out from x on ledge f, heading `way` along the band or up and out
// of the top going that way, whichever is clear and shorter; null for none.
export function escape(floor: number, f: Ledge, x: number, way: 'left' | 'right', env: Envelopes, sky: Sky): Route | null {
  const band = BANDS.map((h) => bandRoute(floor, f, x, way, h, sky.exits, env.fly)).find((r) => r !== null && routeClear(r, f, env, sky.clear)) ?? null;
  const up = topRoute(floor, f, x, way === 'right' ? 1 : -1, env.fly);
  const top = routeClear(up, f, env, sky.clear) ? up : null;
  const options = [band, top].filter((r): r is Route => r !== null);
  return options.sort((a, b) => lengthOfTrack(trackOf(a)) - lengthOfTrack(trackOf(b)))[0] ?? null;
}

// Either way out from x: away from `from` first (a cursor, the hawk), else
// the other way.
export function escapeFrom(floor: number, f: Ledge, x: number, from: number | null, env: Envelopes, sky: Sky): Route | null {
  const first: 'left' | 'right' = from === null || from <= f.left + x ? 'right' : 'left';
  const second: 'left' | 'right' = first === 'right' ? 'left' : 'right';
  return escape(floor, f, x, first, env, sky) ?? escape(floor, f, x, second, env, sky);
}

// The way back in to x on ledge f by the exit `way`: an escape that way,
// flown backwards, landing at the end.
export function routeIn(floor: number, f: Ledge, x: number, way: Way, env: Envelopes, sky: Sky): Route | null {
  const out = way === 'top'
    ? [topRoute(floor, f, x, 1, env.fly), topRoute(floor, f, x, -1, env.fly)]
    : BANDS.map((h) => bandRoute(floor, f, x, way, h, sky.exits, env.fly, LAND_RUN)).filter((r): r is Route => r !== null);
  const back = out.map(reversed).find((r) => routeClear(r, f, env, sky.clear, true));
  return back ?? null;
}

export const reversed = (r: Route): Route => ({ ...r, curves: [...r.curves].reverse().map((c) => ({ from: c.to, c1: c.c2, c2: c.c1, to: c.from })) });

// Where a flight is at `ms` after it began: its feet's point (ledge-local),
// its pose, how far along it is, and whether it is over. Out: a TAKEOFF ms
// climb speeding up to SPEED, then on at SPEED. In: at SPEED until the last
// LAND_RUN, slowing evenly to touch down.
export type Phase = 'takeoff' | 'fly' | 'land';
export type InFlight = { at: Point; pose: Phase; s: number; done: boolean };
export function flying(track: Track, ms: number, lands: boolean): InFlight {
  const total = lengthOfTrack(track);
  if (!lands) {
    const s = ms < TAKEOFF ? LIFT_RUN * (ms / TAKEOFF) ** 2 : LIFT_RUN + (SPEED * (ms - TAKEOFF)) / 1000;
    return { at: along(track, Math.min(s, total)), pose: ms < TAKEOFF ? 'takeoff' : 'fly', s, done: s >= total };
  }
  const cruise = Math.max(0, total - LAND_RUN);
  const reach = (1000 * cruise) / SPEED;
  if (ms < reach) return { at: along(track, (SPEED * ms) / 1000), pose: 'fly', s: (SPEED * ms) / 1000, done: false };
  const k = clamp01((ms - reach) / LAND);
  const s = cruise + (total - cruise) * (1 - (1 - k) ** 2);
  return { at: along(track, s), pose: 'land', s, done: k >= 1 };
}
// How long a flight takes, to its exit or its touchdown.
export function durationOf(track: Track, lands: boolean): number {
  const total = lengthOfTrack(track);
  if (lands) return (1000 * Math.max(0, total - LAND_RUN)) / SPEED + LAND;
  return total <= LIFT_RUN ? TAKEOFF * Math.sqrt(total / LIFT_RUN) : TAKEOFF + (1000 * (total - LIFT_RUN)) / SPEED;
}
// The wings fold over this long once it has landed.
export const FOLD = 300;
export const folded = (since: number) => smooth(since / FOLD);
