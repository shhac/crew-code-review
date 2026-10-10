import { clearance, clearRuns, inView, type Ledge, type PageMap, type Run } from './floors';
import { apart } from './math';
import type { Point } from './pointer';
import { maxBy } from './seed';

// What every animal that walks the ledges (the fox, the rabbit, the hares)
// does the same way: finding the clear runs it fits on, keeping its whole
// body on one, and keeping apart from the others. Everything is in
// ledge-local x, so a walker rides along with its card as the page scrolls.
// Each animal brings its own sizes as a Walker.

// What a walker needs of a ledge: this much clear space above it, counting
// reach up past the bottom edge of a card or rule above (into their empty
// edges, never over content); half its body's width either side of its
// middle; and this far between it and another, centre to centre.
export type Walker = { clear: number; reach: number; half: number; spacing: number };

// How the ledges are sampled for clear runs; a run reaching the first or
// last sample reaches its ledge's end.
export const RUNS = { inset: 8, step: 4 };

export const runsOf = (f: Ledge, scene: PageMap, w: Pick<Walker, 'clear' | 'reach'>) => clearRuns(f, scene.obstacles, w.clear, { ...RUNS, reach: w.reach });
export const within = (r: Run, x: number, slack = 0) => r.lo - slack <= x && x <= r.hi + slack;
export const runAt = (f: Ledge, scene: PageMap, w: Pick<Walker, 'clear' | 'reach'>, x: number): Run | null => runsOf(f, scene, w).find((r) => within(r, x)) ?? null;
export const lengthOf = (r: Run) => r.hi - r.lo;
export const widthOf = (f: Ledge) => f.right - f.left;
export const clampTo = (r: Run, x: number) => Math.max(r.lo, Math.min(r.hi, x));
// The run under x, or under the nearest sample to it off either end.
export const runUnder = (f: Ledge, scene: PageMap, w: Pick<Walker, 'clear' | 'reach'>, x: number) => runAt(f, scene, w, clampTo({ lo: RUNS.inset, hi: widthOf(f) - RUNS.inset }, x));
// The part of a run a walker's middle may use, so all of it is on the run.
export const bodyOf = (r: Run, half: number): Run => ({ lo: r.lo + half, hi: r.hi - half });
// The ends of a run that are also ends of its ledge, where a walker can come
// and go out of sight.
export function ledgeEnds(f: Ledge, r: Run): number[] {
  const first = r.lo < RUNS.inset + RUNS.step, last = r.hi > widthOf(f) - RUNS.inset - RUNS.step;
  return [...(first ? [r.lo] : []), ...(last ? [r.hi] : [])];
}
export const pageAt = (f: Ledge, x: number, lift = 0): Point => ({ x: f.left + x, y: f.y - lift });

// How tall something can stand over lo..hi of f, counting the walker's reach.
export const roomOver = (f: Ledge, scene: PageMap, w: Pick<Walker, 'reach'>, lo: number, hi: number) => clearance(f, scene.obstacles, lo, hi, w.reach);
// How much clear space is left above a pose of this size, its middle going
// from x0 to x1; negative when it does not fit.
export function spare(f: Ledge, scene: PageMap, w: Pick<Walker, 'reach'>, size: { width: number; height: number }, x0: number, x1 = x0): number {
  const half = size.width / 2;
  return roomOver(f, scene, w, Math.min(x0, x1) - half, Math.max(x0, x1) + half) - size.height;
}

// A stretch of a ledge another walker is on or will pass along; where it
// only stands, or will, the stretch is a point (lo === hi).
export type Claim = { floor: number; lo: number; hi: number };
export const pointClaim = (floor: number, x: number): Claim => ({ floor, lo: x, hi: x });
// Whether the stretch from a to b, a walker's body included, keeps spacing
// from every claim on that ledge.
export const clearOf = (taken: readonly Claim[], floor: number, a: number, b: number, spacing: number) =>
  !taken.some((c) => c.floor === floor && c.hi > Math.min(a, b) - spacing && c.lo < Math.max(a, b) + spacing);

// A run with the stretches near the claims taken out.
export function freeOf(r: Run, claims: readonly Claim[], spacing: number): Run[] {
  return [...claims].sort((a, b) => a.lo - b.lo).reduce<Run[]>((left, c) => left.flatMap((p) => [
    { lo: p.lo, hi: Math.min(p.hi, c.lo - spacing) },
    { lo: Math.max(p.lo, c.hi + spacing), hi: p.hi },
  ].filter((q) => q.hi >= q.lo)), [r]);
}

// Where a walker could settle: every clear run in view at least minSpot
// long, as the stretch its middle may use, away from the claims. Ledges
// nobody has claimed come first, so walkers spread out.
export type Spot = { floor: number; room: Run };
export function spots(scene: PageMap, taken: readonly Claim[], w: Walker, minSpot: number): Spot[] {
  const all = [...scene.floors].flatMap(([floor, f]) => {
    if (!inView(f, scene)) return [];
    const near = taken.filter((c) => c.floor === floor);
    return runsOf(f, scene, w).filter((r) => lengthOf(r) >= minSpot).flatMap((r) => freeOf(bodyOf(r, w.half), near, w.spacing).map((room) => ({ floor, room })));
  });
  const empty = all.filter((s) => !taken.some((c) => c.floor === s.floor));
  return empty.length ? empty : all;
}
export const roomiest = (scene: PageMap, taken: readonly Claim[], w: Walker, minSpot: number) => maxBy(spots(scene, taken, w, minSpot), (s) => lengthOf(s.room));

// Whether a walker can stay where it is: all of it on a clear run (give or
// take slack), and clear of every claim.
export function staysPut(at: { floor: number; x: number }, scene: PageMap, w: Walker, taken: readonly Claim[], slack = 0): boolean {
  const f = scene.floors.get(at.floor);
  const run = f && runAt(f, scene, w, at.x);
  return !!run && within(bodyOf(run, w.half), at.x, slack) && clearOf(taken, at.floor, at.x, at.x, w.spacing);
}

// Where a walker changing ledge is going: the end of the ledge it comes in
// at, and where it will stop.
export type Trip = { floor: number; entry: number; x: number };
// A way onto another ledge, and where on the page it comes in.
export type Entry = { trip: Trip; at: Point };

// Every way onto a ledge in view other than `leaving`: in at an end of one
// of its clear runs at least minEntry long, to where `inside` says it stops
// on that run going inward (null for nowhere), clear of the claims.
export function entries(scene: PageMap, w: Walker, leaving: number, minEntry: number, taken: readonly Claim[], inside: (r: Run, entry: number, inward: 1 | -1) => number | null): Entry[] {
  return [...scene.floors].flatMap(([floor, g]) => {
    if (floor === leaving || !inView(g, scene)) return [];
    return runsOf(g, scene, w).filter((r) => lengthOf(r) >= minEntry).flatMap((r) => ledgeEnds(g, r).flatMap((entry) => {
      const x = inside(r, entry, entry === r.lo ? 1 : -1);
      return x !== null && clearOf(taken, floor, entry, x, w.spacing) ? [{ trip: { floor, entry, x }, at: pageAt(g, entry) }] : [];
    }));
  });
}

// Whether a trip's way in is still there: its ledge in view, its entry still
// a clear end of that ledge, and where it was heading on the same run (with
// all of its body on it, for 'body').
export function stillOpen(trip: Trip, scene: PageMap, w: Walker, room: 'run' | 'body'): boolean {
  const g = scene.floors.get(trip.floor);
  if (!g || !inView(g, scene)) return false;
  const run = runAt(g, scene, w, trip.entry);
  return !!run && ledgeEnds(g, run).includes(trip.entry) && within(room === 'body' ? bodyOf(run, w.half) : run, trip.x);
}

// The trip a walker out of sight comes in by: still open and clear of the
// claims; else null, and it turns up somewhere else.
export const arriving = (trip: Trip | null, scene: PageMap, w: Walker, taken: readonly Claim[], room: 'run' | 'body') =>
  trip && stillOpen(trip, scene, w, room) && clearOf(taken, trip.floor, trip.entry, trip.x, w.spacing) ? trip : null;

// The end of its run a walker leaves its ledge by: one it can reach clear of
// the claims, the furthest from `away` when given, else the nearer.
export function exitEnd(f: Ledge, run: Run, at: { floor: number; x: number }, taken: readonly Claim[], spacing: number, away: Point | null): number | undefined {
  const open = ledgeEnds(f, run).filter((e) => clearOf(taken, at.floor, at.x, e, spacing));
  return maxBy(open, (e) => (away ? apart(pageAt(f, e), away) : -Math.abs(e - at.x)));
}
