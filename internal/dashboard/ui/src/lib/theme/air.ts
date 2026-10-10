import type { Box, Ledge, Obstacle, PageMap, Reach } from './floors';
import type { Point } from './pointer';

// The page's open air, for things that fly: the box of `main` (never the
// rail, whose nav is not measured), inside the window, minus everything the
// page map knows as an obstacle (text, controls, charts and every card's own
// box), each widened a little. A flier, or anything it shoots, is drawn only
// where its whole footprint, swept along wherever it goes, stays in air.
// design-docs/valentine/README.md has the contract.

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
export function airOf(page: PageMap, reach: Reach): Air {
  const main = page.main;
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
export const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Whether a point is inside a box, edges included: a flier in view.
export const inAir = (view: Box, p: Point) => p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom;

// Whether a box is wholly in air: inside the room, and clear of every
// obstacle (widened by GAP) and of anything else given.
export function fits(air: Pick<Air, 'page' | 'room'>, box: Box, also: readonly Box[] = [], obstacles: readonly Obstacle[] = air.page.obstacles): boolean {
  const { room } = air;
  if (!(box.left >= room.left && box.right <= room.right && box.top >= room.top && box.bottom <= room.bottom)) return false;
  if (![box.left, box.right, box.top, box.bottom].every(Number.isFinite)) return false;
  const near = (o: Box) => meets(box, { left: o.left - GAP, right: o.right + GAP, top: o.top - GAP, bottom: o.bottom + GAP });
  return !obstacles.some(near) && !also.some((o) => meets(box, o));
}

// Whether something taking up these boxes, one after another along a path,
// stays in air: each neighbouring pair is tested as one box covering both,
// so nothing between two samples is missed. Only obstacles near the path
// are looked at; `ignore` leaves some out (the card an arrow lands in).
export function sweeps(air: Pick<Air, 'page' | 'room'>, boxes: readonly Box[], also: readonly Box[] = [], ignore: (o: Obstacle) => boolean = () => false): boolean {
  if (!boxes.length) return true;
  const all = boxes.reduce(union);
  const near = air.page.obstacles.filter((o) => !ignore(o) && meets(all, { left: o.left - GAP - 1, right: o.right + GAP + 1, top: o.top - GAP - 1, bottom: o.bottom + GAP + 1 }));
  if (boxes.length === 1) return fits(air, boxes[0], also, near);
  return boxes.slice(1).every((b, i) => fits(air, union(boxes[i], b), also, near));
}

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
