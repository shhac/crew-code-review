import { meets, type Box, type Ledge, type Obstacle, type PageMap, type Reach } from './floors';
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
// shots are chosen; spots: the points in view where a hover fits. exits:
// the lines past which a flier is out of sight, where the air asked for them
// (absent, a flier never leaves; see Exit).
export type Air = { page: PageMap; room: Box; view: Box; spots: readonly Point[]; exits?: Exits };

// Where a flier may leave the page, or come in: past the window's right
// edge; past its top, within main's width, wherever main reaches the top
// (on a phone the rail is stacked above main until it scrolls away); and
// behind the rail, where the rail is a column left of main, clipped at
// main's left edge so it passes behind the rail rather than over it. Never
// the bottom. design-docs/wimbledon/README.md has the contract.
export type Exit = 'right' | 'top' | 'rail';
export const EXITS: readonly Exit[] = ['right', 'top', 'rail'];
// Each exit's line, in viewport px: right and rail are an x, top a y.
export type Exits = { right?: number; top?: number; rail?: number };

// Kept this far from main's edges, the window's and every obstacle.
const EDGE = 6;
export const GAP = 4;
// Hover spots are sampled this far apart.
const GRID = 16;
const NOWHERE: Box = { left: 0, right: 0, top: 0, bottom: 0 };
// The rail is a column beside main, not stacked above it, when main starts
// this far right.
const RAIL_COLUMN = 120;

// Which of the wanted exits this page has, and their lines.
export function exitsOf(page: PageMap, wanted: readonly Exit[] = EXITS): Exits {
  const { main } = page;
  if (!main) return {};
  const line = (exit: Exit, at: number | undefined) => (wanted.includes(exit) ? at : undefined);
  return {
    right: line('right', page.width),
    top: line('top', main.top <= 0 ? 0 : undefined),
    rail: line('rail', main.left >= RAIL_COLUMN ? main.left : undefined),
  };
}

// main's box, all of it and the part in view, with the room opened past
// any exits asked for.
export function boundsOf(page: PageMap, wanted: readonly Exit[] = []): Pick<Air, 'room' | 'view' | 'exits'> {
  const main = page.main;
  const room = main ? { left: main.left + EDGE, right: main.right - EDGE, top: main.top + EDGE, bottom: main.bottom - EDGE } : NOWHERE;
  const view = main ? {
    left: Math.max(EDGE, room.left), right: Math.min(page.width - EDGE, room.right),
    top: Math.max(EDGE, room.top), bottom: Math.min(page.height - EDGE, room.bottom),
  } : NOWHERE;
  if (!wanted.length) return { room, view };
  const exits = exitsOf(page, wanted);
  const open = {
    left: exits.rail === undefined ? room.left : -Infinity,
    right: exits.right === undefined ? room.right : Infinity,
    top: exits.top === undefined ? room.top : -Infinity,
    bottom: room.bottom,
  };
  return { room: open, view, exits };
}

// The air on this page: main's box, and every point in view where a
// footprint of `reach` fits. With exits, a flier may also be past them,
// where it is out of sight; the spots are in view all the same.
export function airOf(page: PageMap, reach: Reach, { exits = [] }: { exits?: readonly Exit[] } = {}): Air {
  const bounds = boundsOf(page, exits);
  const { view } = bounds;
  return { page, ...bounds, spots: gridIn(view).filter((p) => fits({ page, room: view }, around(p, reach), linesOf(page))) };
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
export { meets } from './floors';

// Whether a point is inside a box, edges included: a flier in view.
export const inAir = (view: Box, p: Point) => p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom;

// The part of a box still in sight, short of every exit; null when it is
// all past one.
export function inSight(exits: Exits | undefined, box: Box): Box | null {
  if (!exits) return box;
  const seen = {
    left: Math.max(box.left, exits.rail ?? -Infinity), right: Math.min(box.right, exits.right ?? Infinity),
    top: Math.max(box.top, exits.top ?? -Infinity), bottom: box.bottom,
  };
  return seen.left < seen.right && seen.top < seen.bottom ? seen : null;
}

// Where a footprint is wholly past an exit, at `along` (a y for the right
// edge and the rail, an x for the top): where a flier leaving is gone, and
// where one arriving starts. None where the air has no such exit.
export function pastExit(air: Pick<Air, 'exits'>, exit: Exit, reach: Reach, along: number): Point | null {
  const line = air.exits?.[exit];
  if (line === undefined) return null;
  if (exit === 'right') return { x: line + reach.half, y: along };
  if (exit === 'rail') return { x: line - reach.half, y: along };
  return { x: along, y: line - reach.down };
}

// Whether a box is wholly in air: inside the room, and clear of every
// obstacle (widened by GAP) and of anything else given. Past an exit only
// the part still in sight counts, and a box wholly past one is in air.
export function fits(air: Pick<Air, 'page' | 'room' | 'exits'>, whole: Box, also: readonly Box[] = [], obstacles: readonly Obstacle[] = air.page.obstacles): boolean {
  const { room } = air;
  if (![whole.left, whole.right, whole.top, whole.bottom].every(Number.isFinite)) return false;
  const box = inSight(air.exits, whole);
  if (!box) return true;
  if (!(box.left >= room.left && box.right <= room.right && box.top >= room.top && box.bottom <= room.bottom)) return false;
  const near = (o: Box) => meets(box, { left: o.left - GAP, right: o.right + GAP, top: o.top - GAP, bottom: o.bottom + GAP });
  return !obstacles.some(near) && !also.some((o) => meets(box, o));
}

// Whether something taking up these boxes, one after another along a path,
// stays in air: each neighbouring pair is tested as one box covering both,
// so nothing between two samples is missed. Only obstacles near the path
// are looked at; `ignore` leaves some out (the card an arrow lands in).
export function sweeps(air: Pick<Air, 'page' | 'room' | 'exits'>, boxes: readonly Box[], also: readonly Box[] = [], ignore: (o: Obstacle) => boolean = () => false): boolean {
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
export const fitsAir = (air: Pick<Air, 'page' | 'room' | 'exits'>, also: readonly Box[] = []) => (box: Box) => fits(air, box, also);

// A row: the ledges level within 2px of each other, side by side
// (measureFloors already merges any that overlap), named by its leftmost
// ledge's id; y is its highest top.
export type Row = { id: number; ledges: readonly number[]; y: number; left: number; right: number };
const LEVEL = 2;

export function rowsOf(page: PageMap): Row[] {
  type Entry = readonly [number, Ledge];
  const byHeight = [...page.floors].sort(([, a], [, b]) => a.y - b.y);
  const groups = byHeight.reduce<Entry[][]>((rows, entry) => {
    const last = rows.at(-1);
    return last && entry[1].y - last[0][1].y <= LEVEL ? [...rows.slice(0, -1), [...last, entry]] : [...rows, [entry]];
  }, []);
  return groups.map((group) => {
    const ledges = [...group].sort(([, a], [, b]) => a.left - b.left);
    return {
      id: ledges[0][0], ledges: ledges.map(([id]) => id), y: Math.min(...ledges.map(([, f]) => f.y)),
      left: ledges[0][1].left, right: Math.max(...ledges.map(([, f]) => f.right)),
    };
  });
}

// A lane: a level line `above` px over a row (where the footprint's anchor
// flies) along which the footprint crosses the whole page in air, in view:
// from behind the rail, or main's left edge where the rail is no exit, to
// past the window's right edge, or main's. Its id is the row's and the
// height, so it holds while the row's first ledge does.
export type Lane = { id: string; row: number; above: number; y: number; from: number; to: number };

export function laneOf(air: Air, row: Row, above: number, reach: Reach): Lane | null {
  const y = row.y - above;
  const { rail, right } = air.exits ?? {};
  const from = rail === undefined ? air.room.left + reach.half : rail - reach.half;
  const to = right === undefined ? air.room.right - reach.half : right + reach.half;
  if (!(from < to) || y - reach.up < air.view.top || y + reach.down > air.view.bottom) return null;
  if (!sweeps(air, [around({ x: from, y }, reach), around({ x: to, y }, reach)])) return null;
  return { id: `${row.id}+${above}`, row: row.id, above, y, from, to };
}
