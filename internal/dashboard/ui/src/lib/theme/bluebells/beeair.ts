import type { Curve } from '../curves';
import { meets } from '../air';
import type { Box, Obstacle, PageMap } from '../floors';
import { mixPoint } from '../math';
import type { Point } from '../pointer';
import type { Sky } from '../sky';

// Where a bee may be: main's box minus everything the page map knows as an
// obstacle (text, controls, charts and every card's own box), plus the
// rail's air when the shelf is shown. A footprint may reach REACH px into
// the empty bottom edge of a card above it, as the walkers may, and keeps
// MARGIN px off content. design-docs/bluebells/README.md has the contract.

export type BeeAir = {
  page: PageMap;
  // Where a bee already somewhere must stay: main's whole box, in view or
  // not (a scroll carries a bee out of view and back with its card), and
  // the rail's air.
  rooms: readonly Box[];
  // Where new spots and routes' ends are chosen: the rooms in the window,
  // clear of the top bar and the window's bottom edge.
  views: readonly Box[];
  // The rail's air, held by the rail (which does not scroll); null with
  // the shelf hidden or its sky too short.
  rail: Box | null;
};

export const REACH = 6;
export const MARGIN = 2;
// As the shared TOP_MARGIN and BOTTOM_MARGIN in floors.ts.
const TOP = 70;
const BOTTOM = 30;
// The rail's air is used only where its sky is at least this tall.
const SKY = 60;
// Obstacles are looked up by band, so a test looks at those near it only.
const BAND = 48;

const clip = (a: Box, b: Box): Box | null => {
  const c = { left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) };
  return c.left < c.right && c.top < c.bottom ? c : null;
};

// The rail's air as the bees use it (the sky down through the shelf, as
// sky.ts measures it), widened rightward to main's left edge: the rail's
// padding beside the sky is empty, the nav above it and the shelf below.
// Only where the sky above the shelf is SKY px tall or more.
export function railRoom(sky: Sky | null, railAir: Sky | null, page: PageMap): Box | null {
  if (!sky || !railAir || !page.main || sky.height < SKY) return null;
  return { left: railAir.left, right: Math.max(railAir.left + railAir.width, page.main.left), top: railAir.top, bottom: railAir.top + railAir.height };
}

export function beeAirOf(page: PageMap, rail: Box | null = null): BeeAir {
  const main = page.main;
  const rooms = [...(main ? [main] : []), ...(rail ? [rail] : [])];
  const window = { left: 0, right: page.width, top: TOP, bottom: page.height - BOTTOM };
  const views = rooms.flatMap((r) => clip(r, window) ?? []);
  return { page, rooms, views, rail };
}

// Whether a box lies inside the union of some boxes: each vertical slab of
// it between their edges covered top to bottom by those spanning the slab.
export function inside(box: Box, rooms: readonly Box[]): boolean {
  if (rooms.some((r) => r.left <= box.left && r.right >= box.right && r.top <= box.top && r.bottom >= box.bottom)) return true;
  const cuts = rooms.flatMap((r) => [r.left, r.right]).filter((x) => x > box.left && x < box.right);
  const xs = [box.left, ...cuts, box.right].sort((a, b) => a - b);
  return xs.slice(1).every((hi, i) => {
    const lo = xs[i];
    if (hi - lo <= 0) return true;
    const spans = rooms.filter((r) => r.left <= lo && r.right >= hi).sort((a, b) => a.top - b.top);
    const reached = spans.reduce((y, r) => (r.top <= y ? Math.max(y, r.bottom) : y), box.top);
    return reached >= box.bottom;
  });
}

const index = new WeakMap<PageMap, Map<number, Obstacle[]>>();
// The obstacles near a box, by band.
function near(page: PageMap, box: Box): Obstacle[] {
  const bands = index.get(page) ?? page.obstacles.reduce((m, o) => {
    const first = Math.floor((o.top - MARGIN) / BAND), last = Math.floor((o.bottom + MARGIN + REACH) / BAND);
    for (const k of Array.from({ length: last - first + 1 }, (_, i) => first + i)) m.set(k, [...(m.get(k) ?? []), o]);
    return m;
  }, new Map<number, Obstacle[]>());
  index.set(page, bands);
  const first = Math.floor(box.top / BAND), last = Math.floor(box.bottom / BAND);
  // An obstacle in two bands is looked at twice, which costs less than
  // telling them apart.
  if (first === last) return bands.get(first) ?? [];
  return Array.from({ length: last - first + 1 }, (_, i) => bands.get(first + i) ?? []).flat();
}

// What a box may not meet of an obstacle: content and a margin round it;
// a card's box, less its empty bottom edge.
export const keepOff = (o: Obstacle): Box => (o.block
  ? { left: o.left, right: o.right, top: o.top, bottom: o.bottom - REACH }
  : { left: o.left - MARGIN, right: o.right + MARGIN, top: o.top - MARGIN, bottom: o.bottom + MARGIN });

export type Clear = {
  // Boxes it must also keep off (other bees, a cursor at rest).
  also?: readonly Box[];
  // Obstacles to treat otherwise (a wall a bonk touches); return a box to
  // keep off in its place, or null to leave it out.
  except?: (o: Obstacle) => Box | null | undefined;
  // In view, not only in the rooms.
  view?: boolean;
};

// Whether a box is wholly in air.
export function clear(air: BeeAir, box: Box, { also = [], except, view = false }: Clear = {}): boolean {
  if (![box.left, box.right, box.top, box.bottom].every(Number.isFinite)) return false;
  if (!inside(box, view ? air.views : air.rooms)) return false;
  if (also.some((b) => meets(box, b))) return false;
  return !near(air.page, box).some((o) => {
    const held = except?.(o);
    const off = held === undefined ? keepOff(o) : held;
    return off !== null && meets(box, off);
  });
}

// Whether something taking up `reach` round every point of a curve stays in
// air: a curve stays inside its control points' hull, so the hull's box,
// grown by the reach, is tested, and split in two by de Casteljau where it
// fails, down to pieces a pixel or two long.
export function sweptClear(air: BeeAir, curve: Curve, reach: (p: Point) => Box, opts: Clear = {}, depth = 0): boolean {
  const pts = [curve.from, curve.c1, curve.c2, curve.to];
  const boxes = pts.map(reach);
  const hull = {
    left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
  if (clear(air, hull, opts)) return true;
  const span = Math.hypot(curve.to.x - curve.from.x, curve.to.y - curve.from.y) + Math.hypot(curve.c1.x - curve.from.x, curve.c1.y - curve.from.y);
  if (depth >= 10 || span < 1.5) return false;
  const a = mixPoint(curve.from, curve.c1, 0.5), b = mixPoint(curve.c1, curve.c2, 0.5), c = mixPoint(curve.c2, curve.to, 0.5);
  const d = mixPoint(a, b, 0.5), e = mixPoint(b, c, 0.5), m = mixPoint(d, e, 0.5);
  return sweptClear(air, { from: curve.from, c1: a, c2: d, to: m }, reach, opts, depth + 1)
    && sweptClear(air, { from: m, c1: e, c2: c, to: curve.to }, reach, opts, depth + 1);
}
