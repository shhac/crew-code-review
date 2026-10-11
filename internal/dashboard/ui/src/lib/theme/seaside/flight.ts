import { fromLedge, toLedge } from '../anchored';
import { cubic, lengthOf, type Curve } from '../curves';
import type { PageMap } from '../floors';
import { clamp01 } from '../math';
import type { Point } from '../pointer';
import type { AirPose } from './gull-poses';

// A gull's flight in time: the legs a route is flown in, how long each
// takes and how fast, and where along it a flight is at a moment, held by
// its landing ledge so a scroll carries it with the page. Where a route
// goes, and whether it is clear, is swoop.ts's.

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
const PULL_UP = 350;
// Two run-out steps of 6px after touching down.
export const RUN_OUT = 12;

export const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
export const scale = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
export const unit = (p: Point): Point => scale(p, 1 / (Math.hypot(p.x, p.y) || 1));
const curveLength = (c: Curve) => lengthOf((t) => cubic(c, t));

// A leg flown along a curve: the run and the pull-up take a fixed time,
// the rest go at their mode's speeds.
export function leg(mode: FlightMode, pose: AirPose, curve: Curve): Leg {
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

// A flight's legs on the page now, or null with its ledge gone: what the
// debug overlay draws, with the boxes they are found clear by.
export function routeOf(page: PageMap, f: Flight): Leg[] | null {
  const legs = f.legs.map((l) => {
    const curve = fromLedge(page, f.floor, l.curve);
    return curve && { ...l, curve };
  });
  return legs.every((l) => l) ? legs.flatMap((l) => l ?? []) : null;
}

// A plan as a flight starting now, held by its landing ledge; from is the
// ledge it leaves (the landing's, for a flight re-planned in the air).
export function flightOf(page: PageMap, plan: { legs: readonly Leg[]; land: Landing }, from: number, now: number): Flight | null {
  const legs = plan.legs.map((l) => {
    const curve = toLedge(page, plan.land.floor, l.curve);
    return curve && { ...l, curve };
  });
  if (legs.some((l) => !l)) return null;
  return { floor: plan.land.floor, from, legs: legs.flatMap((l) => l ?? []), start: now, land: plan.land };
}
