import type { Point } from '../pointer';
import type { Scene } from './robin';

export type FlightLeg = { from: Point; to: Point; rise: number };
export const arcPoint = (leg: FlightLeg, t: number): Point => ({
  x: leg.from.x + (leg.to.x - leg.from.x) * t,
  y: leg.from.y + (leg.to.y - leg.from.y) * t - 4 * leg.rise * t * (1 - t),
});
const length = (leg: FlightLeg) => Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) + leg.rise;
export const routeLength = (route: readonly FlightLeg[]) => route.reduce((sum, leg) => sum + length(leg), 0);

export function routePoint(route: readonly FlightLeg[], progress: number): Point {
  let distance = Math.max(0, Math.min(1, progress)) * routeLength(route);
  for (const leg of route) {
    const span = length(leg);
    if (distance <= span) {
      const t = span ? distance / span : 1;
      // Ease through turns instead of snapping velocity at corridor corners.
      return arcPoint(leg, route.length > 1 ? t * t * (3 - 2 * t) : t);
    }
    distance -= span;
  }
  return route[route.length - 1].to;
}

// Each small interval encloses the entire curve, including its exact extremum.
// This avoids both gaps between collision samples and the old whole-route box,
// which treated all space below a climbing bird as occupied.
export function clearArc(leg: FlightLeg, scene: Scene, side: number, height: number): boolean {
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
      || scene.obstacles.some(o => box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top)) return false;
  }
  return true;
}

export const clearFlight = (route: readonly FlightLeg[], scene: Scene) => route.every(leg => clearArc(leg, scene, 35, 59));

export function flightRoute(from: Point, to: Point, scene: Scene): FlightLeg[] | null {
  const direct = [{ from, to, rise: Math.max(24, Math.abs(to.y - from.y) * .65) }];
  if (clearFlight(direct, scene)) return direct;
  // Depart sideways before climbing past a higher card's wall, then approach
  // the destination from above. Try both sides of actual obstacles, not just
  // ledge endpoints, so vertically stacked cards can share a flight corridor.
  const corridors = new Set(scene.obstacles.flatMap(o => [o.left - 40, o.right + 40]));
  const routes: FlightLeg[][] = [];
  for (const x of corridors) {
    const points = [from, { x, y: from.y - 12 }, { x, y: to.y - 12 }, { x: to.x, y: to.y - 12 }, to];
    const route = points.slice(1).flatMap((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y) < .01
      ? [] : [{ from: points[i], to: p, rise: p.y === points[i].y ? 12 : 0 }]);
    if (clearFlight(route, scene)) routes.push(route);
  }
  routes.sort((a, b) => routeLength(a) - routeLength(b));
  return routes[0] ?? null;
}
