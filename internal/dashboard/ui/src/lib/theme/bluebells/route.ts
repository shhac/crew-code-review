import { cubic, shiftPath, type Curve } from '../curves';
import type { Box, PageMap } from '../floors';
import type { Point } from '../pointer';
import { keepOff, sweptClear, type BeeAir, type Clear } from './beeair';
import { eitherWay, FOOTPRINTS } from './footprints';

// A bee's way from one place to another: planned on a grid of CELL px
// cells, a cell open where the flying footprint, either way round, grown by
// the bumbling's bound and a margin, lies in air; A* over the open cells;
// then smoothed into cubic curves through every third cell, each curve
// checked against the grown footprint by splitting its control hull. A
// curve that fails is drawn through more of its cells; a route that still
// fails is not flown. Gaps narrower than the footprint are closed by
// construction, as a bumblebee judges a gap against its own wingspan.

export const CELL = 12;
// The bumbling's bound across the route (bee.ts), and a margin.
export const WOBBLE = 3.5;
const SPARE = 2;
// The grid reaches this far past the window's top and bottom, so a bee can
// fly in from beyond it or out.
const EXTEND = 120;

export const flyReach = (p: Point): Box => eitherWay(p, FOOTPRINTS.fly, WOBBLE + SPARE);

// What a flight is held by: a ledge, so it rides with its card, or the
// rail, which does not scroll.
export type Frame = number | 'rail';
export function originOf(page: PageMap, frame: Frame): Point | null {
  if (frame === 'rail') return { x: 0, y: 0 };
  const f = page.floors.get(frame);
  return f ? { x: f.left, y: f.y } : null;
}

// A route: its curves, how long each is and how far along each ends.
export type Route = { curves: readonly Curve[]; lengths: readonly number[]; ends: readonly number[]; length: number };

const lengthOfCurve = (c: Curve) => {
  const pts = Array.from({ length: 33 }, (_, i) => cubic(c, i / 32));
  return pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
};
export function routeOf(curves: readonly Curve[]): Route {
  const lengths = curves.map(lengthOfCurve);
  const ends = lengths.reduce<number[]>((acc, len) => [...acc, (acc.at(-1) ?? 0) + len], []);
  return { curves, lengths, ends, length: ends.at(-1) ?? 0 };
}

// A route on the page, held by a frame, and back.
export const holdRoute = (route: Route, at: Point): Route => ({ ...route, curves: route.curves.map((c) => shiftPath(c, { x: -at.x, y: -at.y })) });
export const placeRoute = (route: Route, at: Point): Route => ({ ...route, curves: route.curves.map((c) => shiftPath(c, at)) });

// Points every `every` px along a route, with how far along each is; kept
// per route, as the others' ways are looked at every frame.
const sampled = new WeakMap<Route, { s: number; p: Point }[]>();
export function samplesOf(route: Route, every = 12): readonly { s: number; p: Point }[] {
  const held = sampled.get(route);
  if (held) return held;
  const count = Math.ceil(route.length / every);
  const pts = Array.from({ length: count + 1 }, (_, i) => {
    const s = Math.min(route.length, i * every);
    return { s, p: along(route, s).p };
  });
  sampled.set(route, pts);
  return pts;
}

// Where on a route s px along it is, and which way it is heading there.
export function along(route: Route, s: number): { p: Point; dx: number; dy: number } {
  const ends = route.ends;
  const found = ends.findIndex((end) => s <= end);
  const i = found < 0 ? route.curves.length - 1 : found;
  const before = i > 0 ? ends[i - 1] : 0;
  const len = route.lengths[i] || 1;
  const t = Math.min(1, Math.max(0, (s - before) / len));
  const c = route.curves[i];
  const p = cubic(c, t);
  const q = cubic(c, Math.min(1, t + 0.01)), o = cubic(c, Math.max(0, t - 0.01));
  return { p, dx: q.x - o.x, dy: q.y - o.y };
}

// The rest of a route from s on, as curves (the curve it is on split there).
export function routeFrom(route: Route, s: number): Route {
  const starts = [0, ...route.ends];
  const i = Math.max(0, starts.findIndex((_, k) => k < route.lengths.length && s < starts[k + 1]));
  const c = route.curves[i];
  if (!c) return routeOf([]);
  const t = Math.min(1, Math.max(0, (s - starts[i]) / (route.lengths[i] || 1)));
  const rest = splitAt(c, t);
  return routeOf([rest, ...route.curves.slice(i + 1)]);
}

// The part of a curve from t to its end, by de Casteljau.
function splitAt(c: Curve, t: number): Curve {
  const mix = (a: Point, b: Point) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const a = mix(c.from, c.c1), b = mix(c.c1, c.c2), d = mix(c.c2, c.to);
  const e = mix(a, b), f = mix(b, d);
  return { from: mix(e, f), c1: f, c2: d, to: c.to };
}

type Grid = { left: number; top: number; cols: number; rows: number; open: Uint8Array };
const grids = new WeakMap<BeeAir, Grid>();

// The open cells over the rooms, near the window.
export function gridOf(air: BeeAir): Grid {
  const held = grids.get(air);
  if (held) return held;
  const near = air.rooms.flatMap((r) => {
    const top = Math.max(r.top, -EXTEND), bottom = Math.min(r.bottom, air.page.height + EXTEND);
    return top < bottom ? [{ ...r, top, bottom }] : [];
  });
  const left = Math.min(...near.map((r) => r.left)), right = Math.max(...near.map((r) => r.right));
  const top = Math.min(...near.map((r) => r.top)), bottom = Math.max(...near.map((r) => r.bottom));
  const cols = near.length ? Math.max(0, Math.floor((right - left) / CELL)) : 0;
  const rows = near.length ? Math.max(0, Math.floor((bottom - top) / CELL)) : 0;
  const open = new Uint8Array(cols * rows);
  const grid = { left, top, cols, rows, open };
  // Open where the grown footprint is inside the rooms; then every cell
  // whose grown footprint would meet an obstacle is closed, obstacle by
  // obstacle, which is far quicker than testing each cell against them.
  const reach = flyReach({ x: 0, y: 0 });
  // Row by row: the stretches across that the rooms cover from the grown
  // box's top to its bottom, joined where they meet.
  for (const r of Array.from({ length: rows }, (_, i) => i)) {
    const y = top + (r + 0.5) * CELL;
    const spans = air.rooms.filter((room) => room.top <= y + reach.top && room.bottom >= y + reach.bottom).sort((a, b) => a.left - b.left);
    const joined = spans.reduce<{ left: number; right: number }[]>((acc, s) => {
      const last = acc.at(-1);
      return last && s.left <= last.right ? [...acc.slice(0, -1), { left: last.left, right: Math.max(last.right, s.right) }] : [...acc, { left: s.left, right: s.right }];
    }, []);
    for (const c of Array.from({ length: cols }, (_, i) => i)) {
      const x = left + (c + 0.5) * CELL;
      open[r * cols + c] = joined.some((s) => s.left <= x + reach.left && s.right >= x + reach.right) ? 1 : 0;
    }
  }
  for (const o of air.page.obstacles) {
    const k = keepOff(o);
    const c0 = Math.max(0, Math.floor((k.left - reach.right - left) / CELL - 0.5)), c1 = Math.min(cols - 1, Math.ceil((k.right - reach.left - left) / CELL - 0.5));
    const r0 = Math.max(0, Math.floor((k.top - reach.bottom - top) / CELL - 0.5)), r1 = Math.min(rows - 1, Math.ceil((k.bottom - reach.top - top) / CELL - 0.5));
    for (const r of Array.from({ length: Math.max(0, r1 - r0 + 1) }, (_, i) => r0 + i)) {
      for (const c of Array.from({ length: Math.max(0, c1 - c0 + 1) }, (_, i) => c0 + i)) {
        const at = centre(grid, r * cols + c);
        if (at.x + reach.left < k.right && at.x + reach.right > k.left && at.y + reach.top < k.bottom && at.y + reach.bottom > k.top) open[r * cols + c] = 0;
      }
    }
  }
  grids.set(air, grid);
  return grid;
}

const centre = (g: Grid, k: number): Point => ({ x: g.left + ((k % g.cols) + 0.5) * CELL, y: g.top + (Math.floor(k / g.cols) + 0.5) * CELL });

// The open cell nearest p, within two cells, that `free` allows.
function nearestCell(g: Grid, p: Point, free: (k: number) => boolean): number | null {
  const c = Math.floor((p.x - g.left) / CELL), r = Math.floor((p.y - g.top) / CELL);
  const around = Array.from({ length: 25 }, (_, i) => ({ c: c + (i % 5) - 2, r: r + Math.floor(i / 5) - 2 }))
    .filter((q) => q.c >= 0 && q.r >= 0 && q.c < g.cols && q.r < g.rows)
    .map((q) => q.r * g.cols + q.c)
    .filter(free)
    .sort((a, b) => Math.hypot(centre(g, a).x - p.x, centre(g, a).y - p.y) - Math.hypot(centre(g, b).x - p.x, centre(g, b).y - p.y));
  return around[0] ?? null;
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

// A* from cell a to cell b over the cells `free` allows, eight ways, never
// cutting a corner; the cells passed through, or null.
function search(g: Grid, a: number, b: number, free: (k: number) => boolean): number[] | null {
  const goal = centre(g, b);
  const h = (k: number) => {
    const p = centre(g, k);
    const dx = Math.abs(p.x - goal.x) / CELL, dy = Math.abs(p.y - goal.y) / CELL;
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const cost = new Map<number, number>([[a, 0]]);
  const from = new Map<number, number>();
  const heap = new Heap();
  heap.push(a, h(a));
  const done = new Set<number>();
  while (heap.size() > 0) {
    const k = heap.pop();
    if (k === b) return walkBack(from, b);
    if (done.has(k)) continue;
    done.add(k);
    const c = k % g.cols, r = Math.floor(k / g.cols);
    for (const [dc, dr] of STEPS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
      const n = nr * g.cols + nc;
      if (!free(n) || (dc && dr && (!free(r * g.cols + nc) || !free(nr * g.cols + c)))) continue;
      const step = cost.get(k)! + (dc && dr ? Math.SQRT2 : 1);
      if (step >= (cost.get(n) ?? Infinity)) continue;
      cost.set(n, step);
      from.set(n, k);
      heap.push(n, step + h(n));
    }
  }
  return null;
}

function walkBack(from: ReadonlyMap<number, number>, b: number): number[] {
  const path = [b];
  while (from.has(path[0])) path.unshift(from.get(path[0])!);
  return path;
}

// A binary heap of cells by priority, lowest first.
class Heap {
  private items: { k: number; f: number }[] = [];
  size() { return this.items.length; }
  push(k: number, f: number) {
    const a = this.items;
    a.push({ k, f });
    const up = (i: number): void => {
      const p = (i - 1) >> 1;
      if (i === 0 || a[p].f <= a[i].f) return;
      [a[p], a[i]] = [a[i], a[p]];
      up(p);
    };
    up(a.length - 1);
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      const down = (i: number): void => {
        const l = 2 * i + 1, r = l + 1;
        const m = [l, r].filter((j) => j < a.length).reduce((best, j) => (a[j].f < a[best].f ? j : best), i);
        if (m === i) return;
        [a[m], a[i]] = [a[i], a[m]];
        down(m);
      };
      down(0);
    }
    return top.k;
  }
}

// Smooth curves through these points (Catmull-Rom, as cubics), leaving the
// first along `out` when given and arriving at the last along `into`.
export function smoothThrough(pts: readonly Point[], out?: Point, into?: Point): Curve[] {
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const tangent = (i: number): Point => {
    if (i === 0 && out) return out;
    if (i === pts.length - 1 && into) return into;
    const a = at(i - 1), b = at(i + 1);
    return { x: (b.x - a.x) / 2, y: (b.y - a.y) / 2 };
  };
  return pts.slice(1).map((to, i) => {
    const from = pts[i], t0 = tangent(i), t1 = tangent(i + 1);
    return { from, c1: { x: from.x + t0.x / 3, y: from.y + t0.y / 3 }, c2: { x: to.x - t1.x / 3, y: to.y - t1.y / 3 }, to };
  });
}

// Through every cell, rounding each corner inside the cell: from the middle
// of the step into a cell to the middle of the step out, pulled toward the
// cell's centre. Each curve stays in the triangle of those three points,
// which the open cells' grown boxes hold, so this way is clear wherever the
// cells are (only its two ends, off the grid, need checking).
export function cornered(pts: readonly Point[]): Curve[] {
  const mid = (i: number) => ({ x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 });
  const line = (a: Point, b: Point): Curve => ({ from: a, c1: { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, c2: { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 }, to: b });
  if (pts.length < 3) return pts.length === 2 ? [line(pts[0], pts[1])] : [];
  const corners = pts.slice(1, -1).map((p, k): Curve => {
    const a = mid(k), b = mid(k + 1);
    return { from: a, c1: { x: a.x + (2 * (p.x - a.x)) / 3, y: a.y + (2 * (p.y - a.y)) / 3 }, c2: { x: b.x + (2 * (p.x - b.x)) / 3, y: b.y + (2 * (p.y - b.y)) / 3 }, to: b };
  });
  return [line(pts[0], mid(0)), ...corners, line(mid(pts.length - 2), pts[pts.length - 1])];
}

// The cells kept as waypoints: every stride-th, not the first or last
// (the route's own ends stand for them).
const waypoints = (cells: readonly Point[], stride: number) => cells.filter((_, i) => i > 0 && i < cells.length - 1 && i % stride === 0);

// A clear way from a to b for a bee flying, keeping off `also` (other bees,
// a cursor at rest), or null. into: the way it should be heading as it
// arrives, if it matters.
export function plan(air: BeeAir, a: Point, b: Point, opts: Clear & { into?: Point } = {}): Route | null {
  const g = gridOf(air);
  if (!g.cols || !g.rows) return null;
  const also = opts.also ?? [];
  const cellBox = (k: number): Box => flyReach(centre(g, k));
  const free = (k: number) => g.open[k] === 1 && !also.some((o) => meetsBox(cellBox(k), o));
  const start = nearestCell(g, a, free), end = nearestCell(g, b, free);
  if (start === null || end === null) return null;
  const cells = search(g, start, end, free);
  if (!cells) return null;
  const pts = cells.map((k) => centre(g, k));
  const check = { also, except: opts.except };
  for (const stride of [3, 2]) {
    const curves = smoothThrough([a, ...waypoints(pts, stride), b], undefined, opts.into);
    if (curves.every((c) => sweptClear(air, c, flyReach, check))) return routeOf(curves);
  }
  const tight = cornered([a, ...pts, b]);
  return tight.every((c) => sweptClear(air, c, flyReach, check)) ? routeOf(tight) : null;
}

// Whether a route, as it stands, is still clear.
export const stillClear = (air: BeeAir, route: Route, opts: Clear = {}) => route.curves.every((c) => sweptClear(air, c, flyReach, opts));

const meetsBox = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
