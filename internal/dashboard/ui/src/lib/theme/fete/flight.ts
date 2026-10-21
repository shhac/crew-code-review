import { around, meets, union } from '../air';
import { chainAt, chainOf, samples, type Curve } from '../curves';
import type { Box, Reach } from '../floors';
import { apart, clamp, mixPoint, smooth } from '../math';
import type { Point } from '../pointer';
import { grown, inWaspAir, within, type WaspAir } from './air';

// A wasp's flights: the routes it tries, whether one is clear, and how far
// along one it is at a moment.

// A route: a line of straight legs whose corners are rounded off, as cubic
// curves end to end. A flight along one is eased in and out, or has two
// brief hovers on the way (coming back).
export type Route = readonly Curve[];
export type Flight = { route: Route; start: number; duration: number; hovers: boolean };

// The least room the two keep between their boxes at any moment.
export const SPACE = 2;
// The hovers on the way back, and the shortest flight.
const HOVER_STOP = 250;
const MIN_FLIGHT = 300;

// How far along its flight it is, 0 to 1: eased in and out, or coming back
// with two brief hovers a third and two thirds of the way.
export function flightProgress(f: Flight, now: number): number {
  const u = clamp(now - f.start, 0, f.duration);
  if (!f.hovers) return smooth(u / f.duration);
  const travel = (f.duration - 2 * HOVER_STOP) / 3;
  const piece = travel + HOVER_STOP;
  const k = Math.min(2, Math.floor(u / piece));
  return (k + smooth(Math.min(1, (u - k * piece) / travel))) / 3;
}
export const flying = (w: { flight: Flight | null }, now: number) => w.flight !== null && now < w.flight.start + w.flight.duration;

export function sweptFrom(f: Flight, reach: Reach, now: number): Box[] {
  const done = flightProgress(f, now);
  return samples((u) => along(f.route, done + u * (1 - done)), 3).map((s) => around(s.p, reach));
}

const routeLength = (route: Route) => chainOf(route).length;

// The point p of the way along a route, by distance.
export function along(route: Route, p: number): Point {
  const chain = chainOf(route);
  return chainAt(chain, p * chain.length)?.p ?? { x: 0, y: 0 };
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

export const flightOf = (route: Route, now: number, speed: number, hovers = false): Flight => ({
  route, start: now, hovers,
  duration: Math.max(MIN_FLIGHT, (routeLength(route) / speed) * 1000) + (hovers ? 2 * HOVER_STOP : 0),
});

// The first clear route from a to b, for a footprint of reach.
export const firstClear = (tried: readonly Route[], reach: Reach, air: WaspAir, claims: readonly Box[], lane = false) => tried.find((r) => clearRoute(r, reach, air, claims, lane)) ?? null;
