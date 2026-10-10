import { around } from '../air';
import { reachOf, type PageMap } from '../floors';
import { pageAt, runAt } from '../ledges';
import type { Point } from '../pointer';
import type { Rand } from '../seed';
import { claimsOfHares, HARE, POSES, SPACING, type Hare, type Mode } from './hare';
import { arcPoint, claimsOf, placeOn, sweptClear, type Claim, type PlanOptions, type Place, type Trail } from './trail';

// The trails the hares are running: who is on each, how far along it each
// is, and moving them along it. A run is one planned trail (trail.ts) that
// every hare on it follows at the same pace, each a fixed distance behind
// the one ahead.

// A hare on a trail: how far behind the leader it keeps, and where along the
// trail it started (it waits there until the leader is lag ahead).
export type Member = { id: number; lag: number; start: number };
export type Run = { kind: 'chase' | 'bolt' | 'trip'; trail: Trail; at: number; speed: number; members: Member[] };
// The hares, and the trails some of them are running.
export type Troupe = { hares: Hare[]; runs: Run[] };

export const sAt = (run: Run, m: Member) => Math.max(m.start, run.at - m.lag);
export const runOf = (group: Troupe, id: number) => group.runs.find((r) => r.members.some((m) => m.id === id)) ?? null;
export const memberOf = (run: Run, id: number) => run.members.find((m) => m.id === id)!;
// On its way along a trail, rather than still waiting to set off.
const moving = (run: Run, m: Member) => sAt(run, m) > m.start;

// Where a hare is on the page: its spot on its ledge, or on its trail.
export function placeOf(group: Troupe, hare: Hare): Place {
  const run = runOf(group, hare.id);
  const m = run && memberOf(run, hare.id);
  if (run && m && moving(run, m)) return placeOn(run.trail, sAt(run, m));
  return { kind: 'run', floor: hare.floor, x: hare.x, dir: hare.dir, fade: 1 };
}

export function pagePoint(place: Place, scene: PageMap): Point | null {
  if (place.kind === 'away') return null;
  if (place.kind === 'leap') return arcPoint(place.segment, scene, place.t);
  const f = scene.floors.get(place.floor);
  return f ? pageAt(f, place.x) : null;
}

// Whether a hare is standing on a ledge (not in the air or away).
export const grounded = (group: Troupe, hare: Hare) => placeOf(group, hare).kind === 'run';

// The group with these hares changed.
export const update = <G extends Troupe>(group: G, ...changed: Hare[]): G => ({ ...group, hares: group.hares.map((h) => changed.find((c) => c.id === h.id) ?? h) });

// Running a trail, a hare takes up a bound's room on a ledge and a leap's in
// the air.
const BOUND = reachOf(POSES.bound);
const LEAP = reachOf(POSES.leap);
// Where it stands, another hare is kept as clear of as one sitting up.
const SIT = reachOf(POSES.sit);

// The stretches every hare not in `but` is on or heading along, and every
// other trail, with their boxes on the page for a leap to fly clear of.
export function claimsBut(group: Troupe, scene: PageMap, but: readonly number[], runs: readonly Run[] = group.runs): Claim[] {
  const others = group.hares.filter((h) => !but.includes(h.id) && !runOf(group, h.id));
  const boxed = claimsOfHares(others).map((c, i) => {
    const at = pagePoint(placeOf(group, others[i]), scene);
    return at ? { ...c, box: around(at, SIT) } : c;
  });
  return [...boxed, ...runs.filter((r) => !r.members.some((m) => but.includes(m.id))).flatMap((r) => claimsOf(r.trail))];
}

export const planning = (claims: Claim[], extra: { budget: number; ledges: number; from?: Point | null; toward?: number }, rand: Rand): PlanOptions =>
  ({ clear: HARE.clear, body: BOUND, air: LEAP, claims, spacing: SPACING, rand, ...extra });

// Every trail moves on; each hare on one is put where it now is on it, its
// steps driven by how far it moved. The trails that reached their end are
// handed back, finished, for their hares to stop.
export function advanceRuns<G extends Troupe>(group: G, dt: number): { group: G; finished: Run[] } {
  const moved = group.runs.map((r) => ({ ...r, at: Math.min(r.trail.length, r.at + (r.speed * dt) / 1000) }));
  const hares = group.hares.map((h) => {
    const before = runOf(group, h.id);
    const after = moved.find((r) => r.members.some((m) => m.id === h.id));
    if (!before || !after) return h;
    const m = memberOf(after, h.id);
    if (!moving(after, m)) return h;
    const step = sAt(after, m) - sAt(before, memberOf(before, h.id));
    const place = placeOn(after.trail, sAt(after, m));
    const at = place.kind === 'run' ? { floor: place.floor, x: place.x, target: place.x, dir: place.dir } : {};
    return { ...h, ...at, mode: 'run' as Mode, walked: h.walked + step };
  });
  const finished = moved.filter((r) => r.at >= r.trail.length);
  return { group: { ...group, hares, runs: moved.filter((r) => r.at < r.trail.length) }, finished };
}

// Whether the rest of a trail still holds: every ledge still there, every
// run still on a clear run, every leap still clear.
export function trailHolds(run: Run, scene: PageMap): boolean {
  const from = Math.min(...run.members.map((m) => sAt(run, m)));
  const ahead = run.trail.segments.filter((_, i) => run.trail.segments.slice(0, i + 1).reduce((sum, s) => sum + (s.kind === 'run' ? Math.abs(s.to - s.from) : s.length), 0) >= from);
  return ahead.every((s) => {
    if (s.kind === 'away') return scene.floors.has(s.from.floor) && scene.floors.has(s.to.floor);
    if (s.kind === 'run') {
      const f = scene.floors.get(s.floor);
      const r = f && runAt(f, scene, HARE, s.from);
      return !!r && Math.min(s.from, s.to) >= r.lo && Math.max(s.from, s.to) <= r.hi;
    }
    const a = scene.floors.get(s.from.floor), b = scene.floors.get(s.to.floor);
    return !!a && !!b && sweptClear(pageAt(a, s.from.x), pageAt(b, s.to.x), s.hop, LEAP, scene);
  });
}
