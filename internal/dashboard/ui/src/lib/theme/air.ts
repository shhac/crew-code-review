import type { Box, Obstacle, PageMap, Reach } from './floors';
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

// A flier's path, swept with the box of whatever pose it flies each piece
// in: July's pigeons and hawk, August's gull and September's crows each
// plan their own routes, and each route is checked here. A piece is a
// cubic curve (the robin's FlightCurve has this shape) and an envelope: how
// far the pose's drawing reaches from the point on the curve, every way,
// at every moment of its motion (a whole wingbeat, a bank), as its rig test
// measures it, mirrored to the way it faces along that piece.
export type Cubic = { from: Point; control1: Point; control2: Point; to: Point };
export type Envelope = { left: number; right: number; up: number; down: number };
export type Segment = { curve: Cubic; envelope: Envelope };

// The same envelope facing the other way.
export const mirrored = (e: Envelope): Envelope => ({ ...e, left: e.right, right: e.left });

// A footprint (rig.ts's page box: its width centred on the point, its
// height above it and `down` below) as an envelope, facing either way.
export const envelopeOf = (box: { width: number; height: number; down?: number }): Envelope =>
  ({ left: box.width / 2, right: box.width / 2, up: box.height, down: box.down ?? 0 });

// Subdivided this many times at most before a piece counts as blocked: as
// deep as the robin's clearFlight goes.
const DEPTH = 12;

const hullOf = (c: Cubic, e: Envelope): Box => {
  const points = [c.from, c.control1, c.control2, c.to];
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { left: Math.min(...xs) - e.left, right: Math.max(...xs) + e.right, top: Math.min(...ys) - e.up, bottom: Math.max(...ys) + e.down };
};

const halves = (c: Cubic): [Cubic, Cubic] => {
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const a = mid(c.from, c.control1), b = mid(c.control1, c.control2), d = mid(c.control2, c.to);
  const e = mid(a, b), f = mid(b, d), middle = mid(e, f);
  return [{ from: c.from, control1: a, control2: e, to: middle }, { from: middle, control1: f, control2: d, to: c.to }];
};

// The boxes a piece is checked as: its control hull, which a cubic never
// leaves, grown by its envelope; where that box is not clear, the two
// halves' (by de Casteljau, as clearFlight splits them), and so on, so
// every point of the curve is covered, its exact extremes included, and
// nothing is checked only at its ends. Null when some part of it, split as
// far as DEPTH, is still not clear.
function sweptBoxes(curve: Cubic, envelope: Envelope, clear: (box: Box) => boolean, depth: number): Box[] | null {
  const box = hullOf(curve, envelope);
  if (![box.left, box.right, box.top, box.bottom].every(Number.isFinite)) return null;
  if (clear(box)) return [box];
  if (depth === DEPTH) return null;
  const [a, b] = halves(curve);
  const first = sweptBoxes(a, envelope, clear, depth + 1);
  if (!first) return null;
  const second = sweptBoxes(b, envelope, clear, depth + 1);
  return second && [...first, ...second];
}

// Whether a path is clear, each piece swept with its own envelope, and the
// boxes it was found clear by (for the debug overlay to draw). `clear` says
// whether a box is all in air: a month's own rule (its exits, the rail's
// sky, the card edges it may reach into), or fitsAir's.
export function sweptPath(segments: readonly Segment[], clear: (box: Box) => boolean): { clear: boolean; boxes: Box[] } {
  const found = segments.map((s) => sweptBoxes(s.curve, s.envelope, clear, 0));
  return { clear: found.every((b) => b !== null), boxes: found.flatMap((b) => b ?? []) };
}

// A box all in this air (fits), clear of anything else given: the plain
// rule for sweptPath.
export const fitsAir = (air: Pick<Air, 'page' | 'room'>, also: readonly Box[] = []) => (box: Box) => fits(air, box, also);
