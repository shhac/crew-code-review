import { clearRuns, inView, type Ledge, type PageMap, type Run } from '../floors';
import { apart, clamp, sign } from '../math';
import type { Point } from '../pointer';
import { between, maxBy, type Rand } from '../seed';

// A chase or a bolt is one planned route, the trail, which every hare on it
// follows at the same pace, each a fixed distance behind the one ahead, so
// none can catch another up. It is planned in full when it starts, from the
// page as measured then: runs along ledges, leaps between them, and spells
// out of sight off one ledge's end and in at another's. Everything on a
// ledge is in ledge-local x, so the trail rides with its cards as the page
// scrolls. design-docs/hares/README.md has the airspace contract a leap is
// held to.

// A place on a ledge.
export type Spot = { floor: number; x: number };
export type Segment =
  // Along one ledge, from one ledge-local x to another.
  | { kind: 'run'; floor: number; from: number; to: number }
  // An arc from a run's end to a spot on another ledge, rising `hop` px.
  | { kind: 'leap'; from: Spot; to: Spot; hop: number; length: number }
  // Off one ledge's end and in at another's, out of sight.
  | { kind: 'away'; from: Spot; to: Spot; length: number };
export type Trail = { segments: Segment[]; length: number };

// Where along a trail a hare is: on a ledge, in the air (t through the
// leap) or away; dir is the way it is going.
export type Place =
  | { kind: 'run'; floor: number; x: number; dir: 1 | -1; fade: number }
  | { kind: 'leap'; segment: Extract<Segment, { kind: 'leap' }>; t: number; dir: 1 | -1 }
  | { kind: 'away'; segment: Extract<Segment, { kind: 'away' }> };

// The room a hare needs, in page px: the box its running or flying drawing
// stays inside (hare-rig.ts's tests check it), anchored at its bottom centre.
export type Box = { width: number; height: number };
// How the ledges are measured for a hare: how tall a run must be clear, and
// how far it may reach past the bottom edge of a card or rule above.
export const RUNS = { inset: 8, step: 4 };
export const REACH = 6;
export const FADE = 14;
// How far an away spell counts along the trail.
export const AWAY = 160;
// A leap lands 24 to 140px away across and at most 60px up or down.
const LEAP_MIN = 24;
const LEAP_MAX = 140;
const LEAP_DROP = 60;
const HOP_MAX = 14;
const HOP_MIN = 2;
// How far apart the swept box is checked along an arc.
const SAMPLE = 4;
// A trail goes on along a ledge it lands on, or comes in at, at least this far.
const ONWARD = 40;

export type PlanOptions = {
  clear: number;
  body: Box;
  air: Box;
  // Where other hares are and are going, and their boxes, to keep clear of.
  claims: readonly Claim[];
  spacing: number;
  // How long the trail may get, and over how many ledges (counting the first).
  budget: number;
  ledges: number;
  // A bolt prefers ways further from this; a trip prefers this ledge.
  from?: Point | null;
  toward?: number;
  rand: Rand;
};
// A stretch of a ledge another hare is on, or will pass along; and its box
// on the page where it stands, for a leap to fly clear of.
export type Claim = { floor: number; lo: number; hi: number; box?: { left: number; right: number; top: number; bottom: number } };

const segLength = (s: Segment) => (s.kind === 'run' ? Math.abs(s.to - s.from) : s.length);
export const runsOf = (f: Ledge, scene: PageMap, clear: number) => clearRuns(f, scene.obstacles, clear, { ...RUNS, reach: REACH });
export const runAt = (f: Ledge, scene: PageMap, clear: number, x: number): Run | null => runsOf(f, scene, clear).find((r) => r.lo <= x && x <= r.hi) ?? null;
// The part of a run a hare's middle may use, so all of it is on the run.
export const bodyOf = (r: Run, half: number): Run => ({ lo: r.lo + half, hi: r.hi - half });
// The ends of a run that are also ends of its ledge, where a hare can come
// and go out of sight.
export function ledgeEnds(f: Ledge, r: Run): number[] {
  const first = r.lo < RUNS.inset + RUNS.step, last = r.hi > f.right - f.left - RUNS.inset - RUNS.step;
  return [...(first ? [r.lo] : []), ...(last ? [r.hi] : [])];
}
export const pageAt = (f: Ledge, x: number, lift = 0): Point => ({ x: f.left + x, y: f.y - lift });

export const trailOf = (segments: Segment[]): Trail => ({ segments, length: segments.reduce((sum, s) => sum + segLength(s), 0) });

// Where a hare is, s along the trail (clamped to it).
export function placeOn(trail: Trail, s: number): Place {
  const at = clamp(s, 0, trail.length);
  const found = trail.segments.reduce<{ left: number; place: Place | null }>((acc, seg, i) => {
    if (acc.place) return acc;
    const length = segLength(seg);
    const last = i === trail.segments.length - 1;
    if (acc.left > length && !last) return { left: acc.left - length, place: null };
    const into = Math.min(acc.left, length);
    return { left: 0, place: placeIn(trail, i, into) };
  }, { left: at, place: null });
  return found.place ?? { kind: 'run', floor: 0, x: 0, dir: 1, fade: 0 };
}

function placeIn(trail: Trail, i: number, into: number): Place {
  const seg = trail.segments[i];
  if (seg.kind === 'away') return { kind: 'away', segment: seg };
  if (seg.kind === 'leap') return { kind: 'leap', segment: seg, t: seg.length ? into / seg.length : 1, dir: sign(seg.to.x - seg.from.x) };
  const dir = sign(seg.to - seg.from);
  // Fading out over the last FADE px before going away, in over the first
  // FADE px after coming back.
  const before = trail.segments[i + 1]?.kind === 'away' ? Math.min(1, (Math.abs(seg.to - seg.from) - into) / FADE) : 1;
  const after = trail.segments[i - 1]?.kind === 'away' ? Math.min(1, into / FADE) : 1;
  return { kind: 'run', floor: seg.floor, x: seg.from + dir * into, dir, fade: Math.max(0, Math.min(before, after)) };
}

// Where a hare in the air is on the page: on the arc between the two spots.
export function arcPoint(seg: Extract<Segment, { kind: 'leap' }>, scene: PageMap, t: number): Point | null {
  const a = scene.floors.get(seg.from.floor), b = scene.floors.get(seg.to.floor);
  if (!a || !b) return null;
  return arc(pageAt(a, seg.from.x), pageAt(b, seg.to.x), seg.hop, t);
}

// A parabola from p to q rising hop above the higher of the two.
function arc(p: Point, q: Point, hop: number, t: number): Point {
  const lift = hop + Math.abs(q.y - p.y) / 2;
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t - 4 * lift * t * (1 - t) };
}

type Rect = { left: number; right: number; top: number; bottom: number };
const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Whether a box (anchored at its bottom centre at p) is clear in the air:
// inside the window; off every piece of content; off every card's box but
// its empty bottom edge (REACH); never across a ledge's line except by
// standing on it or reaching REACH up past it from below; and off every
// other hare.
export function clearAt(p: Point, box: Box, scene: PageMap, avoid: readonly Rect[] = []): boolean {
  const r = { left: p.x - box.width / 2, right: p.x + box.width / 2, top: p.y - box.height, bottom: p.y };
  if (r.left < 0 || r.right > scene.width || r.top < 0 || r.bottom > scene.height) return false;
  const hit = scene.obstacles.some((o) => overlaps(r, o.block ? { ...o, top: o.top + 1, bottom: o.bottom - REACH } : o));
  if (hit) return false;
  const crossed = [...scene.floors.values()].some((f) => f.left < r.right && r.left < f.right && r.bottom > f.y + 1 && r.top < f.y - REACH);
  return !crossed && !avoid.some((a) => overlaps(r, a));
}

// Whether a whole arc is clear, sampled every SAMPLE px along it.
export function sweptClear(p: Point, q: Point, hop: number, box: Box, scene: PageMap, avoid: readonly Rect[] = []): boolean {
  const count = Math.max(2, Math.ceil(apart(q, p) / SAMPLE));
  return Array.from({ length: count + 1 }, (_, i) => arc(p, q, hop, i / count)).every((at) => clearAt(at, box, scene, avoid));
}

const claimed = (claims: readonly Claim[], floor: number, lo: number, hi: number, spacing: number) =>
  claims.some((c) => c.floor === floor && c.hi > lo - spacing && c.lo < hi + spacing);

// How far along its run a hare going dir from x can go: to the run's end,
// its whole body on it, or spacing short of another hare's claim; and
// whether that is the run's own end.
function laneEnd(f: Ledge, r: Run, floor: number, x: number, dir: 1 | -1, opts: PlanOptions): { end: number; open: boolean } {
  const room = bodyOf(r, opts.body.width / 2);
  const runEnd = dir > 0 ? room.hi : room.lo;
  const ahead = opts.claims.filter((c) => c.floor === floor && (dir > 0 ? c.hi > x : c.lo < x)).map((c) => (dir > 0 ? c.lo - opts.spacing : c.hi + opts.spacing));
  const end = dir > 0 ? Math.min(runEnd, ...ahead) : Math.max(runEnd, ...ahead);
  return { end: dir > 0 ? Math.max(x, end) : Math.min(x, end), open: end === runEnd };
}

type Hop = { segment: Segment; floor: number; x: number; dir: 1 | -1; at: Point };

// Every leap from the end of a run (at x on ledge f, going dir) onto
// another ledge in view, landing near a clear run's end that faces it.
function leapsFrom(fid: number, f: Ledge, x: number, dir: 1 | -1, scene: PageMap, visited: readonly number[], opts: PlanOptions): Hop[] {
  const p = pageAt(f, x);
  const avoid = opts.claims.flatMap((c) => (c.box ? [c.box] : []));
  return [...scene.floors].flatMap(([gid, g]) => {
    if (gid === fid || visited.includes(gid) || !inView(g, scene)) return [];
    return runsOf(g, scene, opts.clear).flatMap((r) => {
      const room = bodyOf(r, opts.body.width / 2);
      const land = dir > 0 ? room.lo : room.hi;
      const q = pageAt(g, land);
      const across = (q.x - p.x) * dir;
      if (room.hi - room.lo < ONWARD || across < LEAP_MIN || across > LEAP_MAX || Math.abs(q.y - p.y) > LEAP_DROP) return [];
      if (claimed(opts.claims, gid, Math.min(land, land + dir * ONWARD), Math.max(land, land + dir * ONWARD), opts.spacing)) return [];
      const hops = Array.from({ length: HOP_MAX - HOP_MIN + 1 }, (_, i) => HOP_MAX - i);
      const hop = hops.find((h) => sweptClear(p, q, h, opts.air, scene, avoid));
      if (hop === undefined) return [];
      const length = apart(q, p);
      return [{ segment: { kind: 'leap', from: { floor: fid, x }, to: { floor: gid, x: land }, hop, length }, floor: gid, x: land, dir, at: q }];
    });
  });
}

// Every way out of sight off this ledge's end and in at another's, coming
// in to a clear run reaching that end.
function entriesFrom(fid: number, x: number, scene: PageMap, visited: readonly number[], opts: PlanOptions): Hop[] {
  const half = opts.body.width / 2;
  return [...scene.floors].flatMap(([gid, g]) => {
    if (gid === fid || visited.includes(gid) || !inView(g, scene)) return [];
    return runsOf(g, scene, opts.clear).flatMap((r) => ledgeEnds(g, r).flatMap((entry) => {
      const dir: 1 | -1 = entry === r.lo ? 1 : -1;
      if (r.hi - r.lo < 2 * half + ONWARD) return [];
      const inward = entry + dir * (half + ONWARD);
      if (claimed(opts.claims, gid, Math.min(entry, inward), Math.max(entry, inward), opts.spacing)) return [];
      return [{ segment: { kind: 'away', from: { floor: fid, x }, to: { floor: gid, x: entry }, length: AWAY }, floor: gid, x: entry, dir, at: pageAt(g, entry) }];
    }));
  });
}

// Of the ways on, the one to take: onto the ledge a trip is heading for;
// for a bolt, the one landing furthest from what scared it; else any.
function choose(hops: readonly Hop[], opts: PlanOptions): Hop | undefined {
  const toward = hops.filter((h) => h.floor === opts.toward);
  if (toward.length) return toward[0];
  const from = opts.from;
  if (from) return maxBy(hops, (h) => apart(h.at, from));
  return hops.length ? hops[Math.floor(between(opts.rand, 0, hops.length - 0.001))] : undefined;
}

// The trail from a hare at start going dir: along its run, then leaping
// (or, where it cannot, going off its ledge's end and in at another's), on
// until the budget or the ledges run out, or a dead end. A trip toward a
// ledge stops once on it.
export function plan(start: Spot, dir: 1 | -1, scene: PageMap, opts: PlanOptions): Trail {
  const step = (at: Spot, d: 1 | -1, segments: Segment[], visited: number[]): Segment[] => {
    const f = scene.floors.get(at.floor);
    const r = f && runAt(f, scene, opts.clear, at.x);
    if (!f || !r) return segments;
    const used = segments.reduce((sum, s) => sum + segLength(s), 0);
    const lane = laneEnd(f, r, at.floor, at.x, d, opts);
    const end = at.x + d * Math.min(Math.abs(lane.end - at.x), Math.max(0, opts.budget - used));
    const run: Segment[] = Math.abs(end - at.x) > 0 ? [{ kind: 'run', floor: at.floor, from: at.x, to: end }] : [];
    const so = [...segments, ...run];
    const spent = used + Math.abs(end - at.x) >= opts.budget;
    if (spent || !lane.open || end !== lane.end || visited.length >= opts.ledges || at.floor === opts.toward) return so;
    const leap = choose(leapsFrom(at.floor, f, end, d, scene, visited, opts), opts);
    const atEnd = ledgeEnds(f, r).includes(d > 0 ? r.hi : r.lo);
    const way = leap ?? (atEnd ? choose(entriesFrom(at.floor, d > 0 ? r.hi : r.lo, scene, visited, opts), opts) : undefined);
    if (!way) return so;
    // Going away, it runs on to the ledge's very end first.
    const exit: Segment[] = way.segment.kind === 'away' ? [{ kind: 'run', floor: at.floor, from: end, to: way.segment.from.x }] : [];
    const entered = way.segment.kind === 'away' ? [{ kind: 'run' as const, floor: way.floor, from: way.x, to: way.x + way.dir * opts.body.width / 2 }] : [];
    const next = entered.length ? { floor: way.floor, x: entered[0].to } : { floor: way.floor, x: way.x };
    return step(next, way.dir, [...so, ...exit, way.segment, ...entered], [...visited, way.floor]);
  };
  return trailOf(step(start, dir, [], [start.floor]));
}

// The trail's end: where the leader stops.
export const endOf = (trail: Trail): Place => placeOn(trail, trail.length);

// The stretches a trail passes along on each ledge, for others to keep
// clear of.
export function claimsOf(trail: Trail): Claim[] {
  return trail.segments.flatMap((s): Claim[] => {
    if (s.kind === 'run') return [{ floor: s.floor, lo: Math.min(s.from, s.to), hi: Math.max(s.from, s.to) }];
    return [{ floor: s.to.floor, lo: s.to.x, hi: s.to.x }];
  });
}

// Whether every ledge a trail uses is still there, so it can go on.
export const stillThere = (trail: Trail, scene: PageMap) => trail.segments.every((s) => (s.kind === 'run' ? scene.floors.has(s.floor) : scene.floors.has(s.from.floor) && scene.floors.has(s.to.floor)));
