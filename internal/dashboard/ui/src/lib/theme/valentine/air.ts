import type { Ledge, Obstacle, PageMap } from '../floors';
import type { Point } from '../pointer';

// The page's open air, for things that fly: the box of `main` (never the
// rail, whose nav is not measured), inside the window, minus everything the
// page map knows as an obstacle (text, controls, charts and every card's own
// box), each widened a little. A flier, or anything it shoots, is drawn only
// where its whole footprint, swept along wherever it goes, stays in air.
// design-docs/valentine/README.md has the contract.

export type Box = { left: number; right: number; top: number; bottom: number };
// How far a drawing reaches from its anchor: either way across (it is
// mirrored to face both ways), up and down.
export type Reach = { half: number; up: number; down: number };
// room: all of main's box, in view or not, which is what a flier already
// somewhere must stay inside (a scroll carries it out of view and back);
// view: the part of it in the window, where new spots, routes' ends and
// shots are chosen; spots: the points in view where a hover fits.
export type Air = { page: PageMap; room: Box; view: Box; spots: readonly Point[] };

// Kept this far from main's edges, the window's and every obstacle.
const EDGE = 6;
export const GAP = 4;
// Hover spots are sampled this far apart.
const GRID = 16;
const NOWHERE: Box = { left: 0, right: 0, top: 0, bottom: 0 };

// The air on this page: main's box, and every point in view where a
// footprint of `reach` fits.
export function airOf(page: PageMap, main: Box | null, reach: Reach): Air {
  const room = main ? { left: main.left + EDGE, right: main.right - EDGE, top: main.top + EDGE, bottom: main.bottom - EDGE } : NOWHERE;
  const view = main ? {
    left: Math.max(EDGE, room.left), right: Math.min(page.width - EDGE, room.right),
    top: Math.max(EDGE, room.top), bottom: Math.min(page.height - EDGE, room.bottom),
  } : NOWHERE;
  const air = { page, room, view, spots: [] };
  return { ...air, spots: gridIn(view).filter((p) => fits({ page, room: view }, around(p, reach), linesOf(page))) };
}

// The ledges' own lines (card tops, heading rules), as thin boxes: a flier
// may cross one, but never hovers over one, or it would read as standing
// on it.
export const linesOf = (page: PageMap): Box[] => [...page.floors.values()].map((f) => ({ left: f.left, right: f.right, top: f.y - 1, bottom: f.y + 1 }));

function gridIn(room: Box): Point[] {
  const cols = Math.max(0, Math.floor((room.right - room.left) / GRID) + 1);
  const rows = Math.max(0, Math.floor((room.bottom - room.top) / GRID) + 1);
  return Array.from({ length: rows * cols }, (_, i) => ({ x: room.left + (i % cols) * GRID, y: room.top + Math.floor(i / cols) * GRID }));
}

export const around = (p: Point, r: Reach): Box => ({ left: p.x - r.half, right: p.x + r.half, top: p.y - r.up, bottom: p.y + r.down });
export const union = (a: Box, b: Box): Box => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) });
const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Whether a box is wholly in air: inside the room, and clear of every
// obstacle (widened by GAP) and of anything else given.
export function fits(air: Pick<Air, 'page' | 'room'>, box: Box, also: readonly Box[] = [], obstacles: readonly Obstacle[] = air.page.obstacles): boolean {
  const { room } = air;
  if (!(box.left >= room.left && box.right <= room.right && box.top >= room.top && box.bottom <= room.bottom)) return false;
  if (![box.left, box.right, box.top, box.bottom].every(Number.isFinite)) return false;
  const near = (o: Box) => meets(box, { left: o.left - GAP, right: o.right + GAP, top: o.top - GAP, bottom: o.bottom + GAP });
  return !obstacles.some(near) && !also.some((o) => meets(box, o));
}

// Whether something whose footprint at each point is `boxAt` can be swept
// along these points: each neighbouring pair is tested as one box covering
// both, so nothing between two samples is missed.
export function sweeps(air: Pick<Air, 'page' | 'room'>, points: readonly Point[], boxAt: (p: Point, i: number) => Box, also: readonly Box[] = [], obstacles?: readonly Obstacle[]): boolean {
  if (points.length === 1) return fits(air, boxAt(points[0], 0), also, obstacles);
  return points.slice(1).every((p, i) => fits(air, union(boxAt(points[i], i), boxAt(p, i + 1)), also, obstacles));
}

// A cubic curve, for a flight from spot to spot.
export type Curve = { from: Point; c1: Point; c2: Point; to: Point };
export function curveAt(c: Curve, t: number): Point {
  const u = 1 - t;
  const mix = (k: 'x' | 'y') => u * u * u * c.from[k] + 3 * u * u * t * c.c1[k] + 3 * u * t * t * c.c2[k] + t * t * t * c.to[k];
  return { x: mix('x'), y: mix('y') };
}
// A quadratic arc, for an arrow.
export type Arc = { from: Point; via: Point; to: Point };
export function arcAt(a: Arc, t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.from.x + 2 * u * t * a.via.x + t * t * a.to.x, y: u * u * a.from.y + 2 * u * t * a.via.y + t * t * a.to.y };
}
// Where an arc is heading at t (not normalised).
export const arcHeading = (a: Arc, t: number): Point => ({
  x: 2 * (1 - t) * (a.via.x - a.from.x) + 2 * t * (a.to.x - a.via.x),
  y: 2 * (1 - t) * (a.via.y - a.from.y) + 2 * t * (a.to.y - a.via.y),
});

// Points along a curve at most `step` apart, its ends included, with the t
// each was taken at. Its length is measured on a fine pass first.
export function samples(at: (t: number) => Point, step = 2): { t: number; p: Point }[] {
  const fine = Array.from({ length: 65 }, (_, i) => at(i / 64));
  const length = fine.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - fine[i].x, p.y - fine[i].y), 0);
  // A curve can bunch up, so twice as many as its length asks for.
  const count = Math.max(1, Math.ceil((2 * length) / step));
  return Array.from({ length: count + 1 }, (_, i) => ({ t: i / count, p: at(i / count) }));
}

export const lengthOf = (at: (t: number) => Point) => {
  const fine = Array.from({ length: 65 }, (_, i) => at(i / 64));
  return fine.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - fine[i].x, p.y - fine[i].y), 0);
};

// A point in the air, held relative to a ledge (an offset from its left end
// and its line), so it rides with the page on scroll.
export type Anchored = { floor: number; dx: number; dy: number };

// Nearest ledge to p, by how far p is from the ledge's line.
export function anchor(page: PageMap, p: Point): Anchored | null {
  const best = [...page.floors].reduce<{ id: number; f: Ledge; d: number } | null>((b, [id, f]) => {
    const x = Math.max(f.left, Math.min(f.right, p.x));
    const d = Math.hypot(p.x - x, p.y - f.y);
    return b && b.d <= d ? b : { id, f, d };
  }, null);
  return best && { floor: best.id, dx: p.x - best.f.left, dy: p.y - best.f.y };
}

// Where an anchored point is now, or null with its ledge gone.
export function placed(page: PageMap, a: Anchored): Point | null {
  const f = page.floors.get(a.floor);
  return f ? { x: f.left + a.dx, y: f.y + a.dy } : null;
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
