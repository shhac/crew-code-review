import { meets } from '../air';
import { parabola } from '../curves';
import type { Obstacle } from '../floors';
import { clamp, clamp01, degrees, mixPoint, smooth } from '../math';
import type { Point } from '../pointer';
import type { Scene } from './robin';

type Arc = { from: Point; to: Point; rise: number };
export type FlightCurve = { from: Point; control1: Point; control2: Point; to: Point };
export const arcPoint = (leg: Arc, t: number): Point => parabola(leg.from, leg.to, leg.rise, t);
const length = (leg: Arc) => Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) + leg.rise;
const lerp = (a: Point, b: Point, t = .5): Point => mixPoint(a, b, t);
// By de Casteljau, the construction clearFlight splits a curve's hull with,
// rather than curves.ts's cubic, which rounds differently.
export function curvePoint(curve: FlightCurve, t: number): Point {
  if (t <= 0) return curve.from;
  if (t >= 1) return curve.to;
  const a = lerp(curve.from, curve.control1, t), b = lerp(curve.control1, curve.control2, t), c = lerp(curve.control2, curve.to, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}
const tables = new WeakMap<FlightCurve, number[]>();
function distances(curve: FlightCurve): number[] {
  const held = tables.get(curve);
  if (held) return held;
  const table = [0];
  let previous = curve.from;
  for (let i = 1; i <= 64; i++) {
    const next = curvePoint(curve, i / 64);
    table.push(table[i - 1] + Math.hypot(next.x - previous.x, next.y - previous.y));
    previous = next;
  }
  tables.set(curve, table);
  return table;
}
export const routeLength = (route: readonly FlightCurve[]) => route.reduce((sum, curve) => sum + distances(curve)[64], 0);

function routeLocation(route: readonly FlightCurve[], progress: number): { curve: FlightCurve; t: number } {
  let distance = clamp01(progress) * routeLength(route);
  for (const curve of route) {
    const table = distances(curve), span = table[64];
    if (distance <= span) {
      for (let i = 1; i < table.length; i++) {
        if (distance <= table[i]) return { curve, t: (i - 1 + (distance - table[i - 1]) / (table[i] - table[i - 1] || 1)) / 64 };
      }
    }
    distance -= span;
  }
  return { curve: route[route.length - 1], t: 1 };
}
export function routePoint(route: readonly FlightCurve[], progress: number): Point {
  const { curve, t } = routeLocation(route, progress);
  return curvePoint(curve, t);
}
function routeTangent(route: readonly FlightCurve[], progress: number): Point {
  const { curve, t } = routeLocation(route, progress);
  const derivative = (key: 'x' | 'y') => (1 - t) ** 2 * (curve.control1[key] - curve.from[key])
    + 2 * (1 - t) * t * (curve.control2[key] - curve.control1[key]) + t ** 2 * (curve.to[key] - curve.control2[key]);
  return { x: derivative('x'), y: derivative('y') };
}
export function routeFacing(route: readonly FlightCurve[], progress: number): 1 | -1 {
  const dx = routeTangent(route, progress).x;
  // At the apex of a turn use the outgoing tangent, never the old hop direction.
  if (Math.abs(dx) > 1e-8) return dx > 0 ? 1 : -1;
  const a = routePoint(route, progress >= 1 ? 1 - .00001 : progress), b = routePoint(route, Math.min(1, progress + .00001));
  return b.x >= a.x ? 1 : -1;
}
export function routeTilt(route: readonly FlightCurve[], progress: number): number {
  const tangent = routeTangent(route, progress);
  const pitch = degrees(Math.atan2(tangent.y, Math.abs(tangent.x)));
  return routeFacing(route, progress) * clamp(pitch, -20, 20) * smooth(Math.min(progress, 1 - progress) / .1);
}

// Each small interval encloses the entire curve, including its exact extremum.
// This avoids both gaps between collision samples and the old whole-route box,
// which treated all space below a climbing bird as occupied.
export function clearArc(leg: Arc, scene: Scene, side: number, height: number): boolean {
  if (![leg.from.x, leg.from.y, leg.to.x, leg.to.y, leg.rise, scene.width, scene.height].every(Number.isFinite)
    || scene.obstacles.some(o => ![o.left, o.right, o.top, o.bottom].every(Number.isFinite))) return false;
  const vertex = leg.rise ? (4 * leg.rise - leg.to.y + leg.from.y) / (8 * leg.rise) : -1;
  const steps = Math.max(1, Math.ceil(length(leg) / 8));
  for (let i = 0; i < steps; i++) {
    const start = i / steps, end = (i + 1) / steps;
    const a = arcPoint(leg, start), b = arcPoint(leg, end);
    const top = Math.min(a.y, b.y, vertex > start && vertex < end ? arcPoint(leg, vertex).y : Infinity) - height;
    const box = { left: Math.min(a.x, b.x) - side, right: Math.max(a.x, b.x) + side, top, bottom: Math.max(a.y, b.y) };
    if (box.left < 0 || box.right > scene.width || box.top < 0 || box.bottom > scene.height
      || scene.obstacles.some(o => meets(box, o))) return false;
  }
  return true;
}

export function curveBounds(curve: FlightCurve): Obstacle {
  const points = [curve.from, curve.control1, curve.control2, curve.to];
  return { left: Math.min(...points.map(p => p.x)) - 35, right: Math.max(...points.map(p => p.x)) + 35,
    top: Math.min(...points.map(p => p.y)) - 59, bottom: Math.max(...points.map(p => p.y)) };
}
export function clearFlight(route: readonly FlightCurve[], scene: Scene): boolean {
  if (scene.obstacles.some(o => ![o.left, o.right, o.top, o.bottom].every(Number.isFinite))) return false;
  const clear = (curve: FlightCurve, depth = 0): boolean => {
    const box = curveBounds(curve);
    if (!Object.values(box).every(Number.isFinite)) return false;
    if (box.left >= 0 && box.right <= scene.width && box.top >= 0 && box.bottom <= scene.height
      && !scene.obstacles.some(o => meets(box, o))) return true;
    if (depth === 12) return false;
    // A Bézier curve stays inside its control hull. Subdivide that hull for
    // continuous clearance checks, rather than checking only sampled pixels.
    const a = lerp(curve.from, curve.control1), b = lerp(curve.control1, curve.control2), c = lerp(curve.control2, curve.to);
    const d = lerp(a, b), e = lerp(b, c), middle = lerp(d, e);
    return clear({ from: curve.from, control1: a, control2: d, to: middle }, depth + 1)
      && clear({ from: middle, control1: e, control2: c, to: curve.to }, depth + 1);
  };
  return route.every(curve => clear(curve));
}

export function flightRoute(from: Point, to: Point, scene: Scene): FlightCurve[] | null {
  const rise = Math.max(24, Math.abs(to.y - from.y) * .65);
  const direct = [{ from, to, control1: { ...lerp(from, to, 1 / 3), y: from.y + (to.y - from.y) / 3 - 4 * rise / 3 },
    control2: { ...lerp(from, to, 2 / 3), y: from.y + (to.y - from.y) * 2 / 3 - 4 * rise / 3 } }];
  if (clearFlight(direct, scene)) return direct;
  // Descend into clear heading pockets from above, sweeping sideways into
  // the landing rather than crossing the text at the ledge's height.
  const direction = to.x >= from.x ? 1 : -1;
  for (const offset of [20, -20, 30, -30]) {
    const apex = { x: to.x - direction * offset, y: Math.min(from.y, to.y) - 24 };
    const tangent = { x: direction * 36, y: 24 };
    const approach = [{ from, to: apex, control1: { x: from.x + (apex.x - from.x) / 3, y: apex.y - 24 },
      control2: { x: apex.x - tangent.x / 3, y: apex.y - tangent.y / 3 } },
    { from: apex, to, control1: { x: apex.x + tangent.x / 3, y: apex.y + tangent.y / 3 },
      control2: { x: to.x - direction * 4, y: to.y - 24 } }];
    if (clearFlight(approach, scene)) return approach;
  }
  // Sweep around card walls in three connected curves. Shared tangents keep
  // speed and direction continuous through the bends, with no corner pauses.
  const corridors = new Set(scene.obstacles.flatMap(o => [o.left - 55, o.right + 55]));
  const routes: FlightCurve[][] = [];
  for (const x of corridors) {
    if (x >= Math.min(from.x, to.x) && x <= Math.max(from.x, to.x)) continue;
    const dy = to.y - from.y, lift = Math.max(24, Math.abs(dy) * .12);
    const outward = x < from.x ? -1 : 1;
    const bow = Math.min(60, Math.max(0, (outward < 0 ? x - 35 : scene.width - x - 35) * 3));
    if (bow < 12) continue;
    const points = [from, { x, y: from.y - lift }, { x, y: to.y - lift }, to];
    const tangents = [{ x: x - from.x, y: -lift }, { x: outward * bow, y: dy * .35 },
      { x: -outward * bow, y: 0 }, { x: to.x - x, y: lift }];
    const route = points.slice(1).map((p, i) => ({ from: points[i], to: p,
      control1: { x: points[i].x + tangents[i].x / 3, y: points[i].y + tangents[i].y / 3 },
      control2: { x: p.x - tangents[i + 1].x / 3, y: p.y - tangents[i + 1].y / 3 } }));
    if (clearFlight(route, scene)) routes.push(route);
  }
  routes.sort((a, b) => routeLength(a) - routeLength(b));
  return routes[0] ?? null;
}
