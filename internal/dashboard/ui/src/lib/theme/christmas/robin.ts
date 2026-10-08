import type { PageMap } from '../floors';
import type { Point, Segment } from '../pointer';
import { choosePerch, type Perch } from './snow';
import { arcPoint, clearArc, clearFlight, flightRoute, routeFacing, routeLength, routePoint, routeTilt, type FlightCurve } from './flight-route';
export type Scene = PageMap;
type Action = { from: Point; to: Point; target: Perch; start: number; duration: number; rise: number; kind: 'hop' | 'flight'; route?: FlightCurve[] };
export type Bird = { perch: Perch | null; action: Action | null; restUntil: number; flightAt: number; cooldown: number; nearAt: number; alert: boolean; escapeHops: number };
const range = (rand: () => number, min: number, max: number) => min + Math.max(0, Math.min(1, rand())) * (max - min);
export const position = (p: Perch, scene: Scene): Point => ({ x: scene.floors.get(p.floor)!.left + p.x, y: scene.floors.get(p.floor)!.y });
export function perchCandidates(s: Scene): Perch[] {
  const candidates: Perch[] = [];
  for (const [floor, f] of s.floors) {
    if (![f.left, f.right].every(Number.isFinite)) continue;
    const left = Math.max(35, 35 - f.left), right = Math.min(f.right - f.left - 35, s.width - 35 - f.left);
    const offsets = [left, right];
    // Include exact pocket boundaries: a coarse grid can miss the only spot
    // beside heading text or the other robin on a narrow mobile ledge.
    for (const obstacle of s.obstacles) {
      if (obstacle.top >= f.y || obstacle.bottom <= f.y - 37) continue;
      for (const x of [obstacle.left - 30 - f.left, obstacle.right + 30 - f.left]) {
        if (x >= left && x <= right) offsets.push(x);
      }
    }
    for (let x = left + 30; x < right; x += 30) offsets.push(x);
    for (const x of offsets) {
      const p: Perch = { floor, x, dir: x <= (left + right) / 2 ? 1 : -1 };
      if (choosePerch(s.floors, s.width, s.height, p) === p
        && safeRoute(position(p, s), position(p, s), 0, s, 'perch')) candidates.push(p);
    }
  }
  return candidates;
}
export function safePerch(s: Scene, previous: Perch | null = null): Perch | null {
  if (previous && choosePerch(s.floors, s.width, s.height, previous) === previous
    && safeRoute(position(previous, s), position(previous, s), 0, s, 'perch')) return previous;
  return perchCandidates(s)[0] ?? null;
}
export function createBird(scene: Scene, now: number, rand: () => number): Bird {
  // Leave enough time for the resting peck to finish before ordinary movement.
  return { perch: safePerch(scene), action: null, restUntil: now + range(rand, 9000, 13000), flightAt: now + range(rand, 12000, 20000), cooldown: -Infinity, nearAt: -Infinity, alert: false, escapeHops: 0 };
}
export function birdPose(b: Bird, scene: Scene, now: number): (Point & { dir: 1 | -1; rotation: number; pose: 'perch' | 'alert' | 'flight' }) | null {
  if (!b.perch || !scene.floors.has(b.perch.floor)) return null;
  const a = b.action;
  const t = a ? Math.max(0, Math.min(1, (now - a.start) / a.duration)) : 0;
  const p = a ? a.route ? routePoint(a.route, t) : arcPoint(a, t) : position(b.perch, scene);
  const dir = a?.route ? routeFacing(a.route, t) : a?.kind === 'flight' ? a.target.dir : b.perch.dir;
  return { ...p, dir, rotation: a?.route ? routeTilt(a.route, t) : 0,
    pose: a?.kind === 'flight' ? 'flight' : b.alert && !a ? 'alert' : 'perch' };
}
export function safeRoute(from: Point, to: Point, rise: number, s: Scene, kind: 'perch' | 'hop' | 'flight' = 'flight'): boolean {
  // Pecking extends the head past the standing cell; flight adds wing clearance.
  return clearArc({ from, to, rise }, s, kind === 'flight' ? 35 : 30, kind === 'flight' ? 59 : 37);
}
export function reconcileBird(b: Bird, s: Scene, now: number, rand: () => number): Bird {
  return { ...b, perch: safePerch(s, b.perch), action: null, alert: false, nearAt: -Infinity, escapeHops: 0, restUntil: now + range(rand, 9000, 13000) };
}
export function advanceBird(b: Bird, s: Scene, now: number, rand: () => number, cursor: Segment | null = null, flightAllowed = true): Bird {
  if (!b.perch) return b;
  if (!s.floors.has(b.perch.floor)) return reconcileBird(b, s, now, rand);
  if (b.action) {
    const a = b.action;
    if (!s.floors.has(a.target.floor) || choosePerch(s.floors, s.width, s.height, a.target) !== a.target
      || !(a.route ? clearFlight(a.route, s) : safeRoute(a.from, a.to, a.rise, s, a.kind))) return reconcileBird(b, s, now, rand);
    const from = position(b.perch, s), to = position(a.target, s);
    if (from.x !== a.from.x || from.y !== a.from.y || to.x !== a.to.x || to.y !== a.to.y) return reconcileBird(b, s, now, rand);
    if (now < b.action.start + b.action.duration) return b;
    return { ...b, perch: b.action.target, action: null, restUntil: now + range(rand, 9000, 13000) };
  }
  const here = position(b.perch, s);
  const d = cursor ? Math.hypot(cursor.to.x - here.x, cursor.to.y - here.y) : Infinity;
  let next = { ...b, alert: now - b.nearAt < 3000, escapeHops: now - b.nearAt > 5000 ? 0 : b.escapeHops };
  if (d <= 90) next = { ...next, nearAt: now, alert: true, perch: { ...b.perch, dir: cursor!.to.x >= here.x ? 1 : -1 } };
  const escape = d <= 48 && now >= b.cooldown;
  const chased = escape && next.escapeHops >= 2;
  if (!escape && (cursor || now < b.restUntil || next.alert)) return next;
  const dir: 1 | -1 = escape ? (cursor!.to.x >= here.x ? -1 : 1) : rand() < .5 ? -1 : 1;
  const length = range(rand, 18, 32), rise = range(rand, 6, 10);
  const target = { ...b.perch, x: b.perch.x + dir * length, dir };
  const held = choosePerch(s.floors, s.width, s.height, target);
  let action: Action | null = held === target && safeRoute(here, position(target, s), rise, s, 'hop')
    ? { from: here, to: position(target, s), target, rise, start: now, duration: range(rand, 220, 320), kind: 'hop' } : null;
  if (flightAllowed && (now >= b.flightAt || chased) && (!escape || !action || chased)) {
    const candidates = perchCandidates(s);
    // Rotate the choices, but always try a different ledge before this one.
    const offset = Math.max(0, Math.min(candidates.length - 1, Math.floor(range(rand, 0, candidates.length))));
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    const ordered = [...rotated.filter(p => p.floor !== b.perch!.floor), ...rotated.filter(p => p.floor === b.perch!.floor)];
    const away = (p: Perch) => (position(p, s).x - here.x) * dir > 0;
    const destinations = escape ? [...ordered.filter(away), ...ordered.filter(p => !away(p))] : ordered;
    for (const candidate of destinations) {
      const to = position(candidate, s);
      if (Math.hypot(to.x - here.x, to.y - here.y) < 60
        || escape && Math.hypot(to.x - cursor!.to.x, to.y - cursor!.to.y) <= d) continue;
      const route = flightRoute(here, to, s);
      if (!route) continue;
      const p: Perch = { ...candidate, dir: routeFacing(route, 1) };
      action = { from: here, to, target: p, route, rise: 0, start: now,
        duration: Math.max(range(rand, 900, 1200), routeLength(route) / range(rand, 220, 280) * 1000), kind: 'flight' };
      break;
    }
  }
  if (!action) return { ...next, restUntil: now + range(rand, 9000, 13000) };
  return { ...next, perch: { ...b.perch, dir: action.route ? routeFacing(action.route, 0) : dir }, action, alert: false,
    escapeHops: action.kind === 'flight' ? 0 : escape ? next.escapeHops + 1 : 0,
    cooldown: escape ? now + action.duration + 2000 : b.cooldown,
    flightAt: action.kind === 'flight' ? now + range(rand, 12000, 20000) : b.flightAt };
}
