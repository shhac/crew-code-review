import type { Ledge, Obstacle } from '../floors';
import type { Point, Segment } from '../pointer';
import { choosePerch, type Perch } from './snow';
export type Scene = { floors: ReadonlyMap<number, Ledge>; obstacles: readonly Obstacle[]; width: number; height: number };
type Action = { from: Point; to: Point; target: Perch; start: number; duration: number; rise: number; kind: 'hop' | 'flight' };
export type Bird = { perch: Perch | null; action: Action | null; restUntil: number; flightAt: number; cooldown: number; nearAt: number; alert: boolean };
const range = (rand: () => number, min: number, max: number) => min + Math.max(0, Math.min(1, rand())) * (max - min);
export const position = (p: Perch, scene: Scene): Point => ({ x: scene.floors.get(p.floor)!.left + p.x, y: scene.floors.get(p.floor)!.y });
export function safePerch(s: Scene, previous: Perch | null = null): Perch | null {
  const valid = (p: Perch) => choosePerch(s.floors, s.width, s.height, p) === p
    && safeRoute(position(p, s), position(p, s), 0, s);
  if (previous && valid(previous)) return previous;
  for (const [floor, f] of s.floors) {
    for (const dir of [1, -1] as const) {
      const p = { floor, x: dir === 1 ? Math.max(24, 24 - f.left) : Math.min(f.right - f.left - 24, s.width - 24 - f.left), dir };
      if (valid(p)) return p;
    }
  }
  return null;
}
export function createBird(scene: Scene, now: number, rand: () => number): Bird {
  return { perch: safePerch(scene), action: null, restUntil: now + range(rand, 6000, 12000), flightAt: now + range(rand, 12000, 20000), cooldown: -Infinity, nearAt: -Infinity, alert: false };
}
export function birdPose(b: Bird, scene: Scene, now: number): (Point & { dir: 1 | -1; pose: 'perch' | 'alert' | 'flight'; wing: number }) | null {
  if (!b.perch || !scene.floors.has(b.perch.floor)) return null;
  const a = b.action;
  const t = a ? Math.max(0, Math.min(1, (now - a.start) / a.duration)) : 0;
  const p = a ? { x: a.from.x + (a.to.x - a.from.x) * t, y: a.from.y + (a.to.y - a.from.y) * t - 4 * a.rise * t * (1 - t) } : position(b.perch, scene);
  return { ...p, dir: b.perch.dir, pose: a?.kind === 'flight' ? 'flight' : b.alert && !a ? 'alert' : 'perch', wing: a?.kind === 'flight' ? 5 * Math.sin(t * Math.PI * 6) : 0 };
}
// Conservative continuous envelope, including the rotated wing. A rejected
// route leaves the bird perched rather than obscuring content between samples.
export function safeRoute(from: Point, to: Point, rise: number, s: Scene): boolean {
  const box = { left: Math.min(from.x, to.x) - 24, right: Math.max(from.x, to.x) + 24,
    top: Math.min(from.y, to.y) - rise - 37, bottom: Math.max(from.y, to.y) };
  return [box.left, box.right, box.top, box.bottom].every(Number.isFinite)
    && box.left >= 0 && box.right <= s.width && box.top >= 0 && box.bottom <= s.height
    && !s.obstacles.some((o) => ![o.left, o.right, o.top, o.bottom].every(Number.isFinite)
      || box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top);
}
export function reconcileBird(b: Bird, s: Scene, now: number, rand: () => number): Bird {
  return { ...b, perch: safePerch(s, b.perch), action: null, alert: false, nearAt: -Infinity, restUntil: now + range(rand, 6000, 12000) };
}
export function advanceBird(b: Bird, s: Scene, now: number, rand: () => number, cursor: Segment | null = null): Bird {
  if (!b.perch) return b;
  if (!s.floors.has(b.perch.floor)) return reconcileBird(b, s, now, rand);
  if (b.action) {
    const a = b.action;
    if (!s.floors.has(a.target.floor) || choosePerch(s.floors, s.width, s.height, a.target) !== a.target
      || !safeRoute(a.from, a.to, a.rise, s)) return reconcileBird(b, s, now, rand);
    const from = position(b.perch, s), to = position(a.target, s);
    if (from.x !== a.from.x || from.y !== a.from.y || to.x !== a.to.x || to.y !== a.to.y) return reconcileBird(b, s, now, rand);
    if (now < b.action.start + b.action.duration) return b;
    return { ...b, perch: b.action.target, action: null, restUntil: now + range(rand, 6000, 12000) };
  }
  const here = position(b.perch, s);
  const d = cursor ? Math.hypot(cursor.to.x - here.x, cursor.to.y - here.y) : Infinity;
  let next = { ...b, alert: now - b.nearAt < 3000 };
  if (d <= 90) next = { ...next, nearAt: now, alert: true, perch: { ...b.perch, dir: cursor!.to.x >= here.x ? 1 : -1 } };
  const escape = d <= 48 && now >= b.cooldown;
  if (!escape && (cursor || now < b.restUntil || next.alert)) return next;
  const dir: 1 | -1 = escape ? (cursor!.to.x >= here.x ? -1 : 1) : rand() < .5 ? -1 : 1;
  const length = range(rand, 18, 32), rise = range(rand, 6, 10);
  const target = { ...b.perch, x: b.perch.x + dir * length, dir };
  const held = choosePerch(s.floors, s.width, s.height, target);
  let action: Action | null = held === target && safeRoute(here, position(target, s), rise, s)
    ? { from: here, to: position(target, s), target, rise, start: now, duration: range(rand, 220, 320), kind: 'hop' } : null;
  if ((!action || !escape && rand() < .25) && now >= b.flightAt) {
    for (const [floor, f] of s.floors) {
      for (const x of [24, f.right - f.left - 24]) {
        const p: Perch = { floor, x, dir };
        if (choosePerch(s.floors, s.width, s.height, p) !== p) continue;
        const to = position(p, s);
        if (Math.hypot(to.x - here.x, to.y - here.y) < 32 || escape && Math.hypot(to.x - cursor!.to.x, to.y - cursor!.to.y) <= d) continue;
        if (safeRoute(here, to, 24, s)) { action = { from: here, to, target: p, rise: 24, start: now, duration: range(rand, 450, 750), kind: 'flight' }; break; }
      }
      if (action?.kind === 'flight') break;
    }
  }
  if (!action) return { ...next, restUntil: now + range(rand, 6000, 12000) };
  return { ...next, perch: { ...b.perch, dir }, action, alert: false,
    cooldown: escape ? now + action.duration + 2000 : b.cooldown,
    flightAt: action.kind === 'flight' ? now + range(rand, 12000, 20000) : b.flightAt };
}
