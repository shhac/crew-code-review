import { anchor } from '../anchored';
import { inView, type Box, type PageMap } from '../floors';
import type { Point } from '../pointer';
import { SHELF } from './art';
import { clear, keepOff, type BeeAir } from './beeair';
import { boxAt, FEET, FOOTPRINTS } from './footprints';
import { bellsOf, clumpBox, type Moss } from './moss';
import { flyReach, originOf, type Frame } from './route';

// What a bee visits: a clump of bluebells on a ledge, or the shelf's. Each
// is held by its frame (its ledge, or the rail), so it rides with its card,
// and has its bells, lowest first, in that frame: the tops a bee perches
// on. A bee lands on the lowest and works up, never reaching the top bell,
// as bumblebees on a spike do.

export type Flower = { key: string; frame: Frame; bells: readonly Point[]; box: Box };
// A spot in a frame: a bee's thorax, held so it rides with its frame.
export type Spot = { frame: Frame; x: number; y: number };

// How far above its perch a bee hovers before it lands, and how far beside
// the hover a bee comes in from or leaves to.
export const ABOVE = 8;
const BESIDE = [22, 34] as const;
// Level with that hover or a little lower, where the room above a card is
// short.
const LOWER = [0, 4] as const;
export const SHELF_KEY = 'shelf';

export function flowersOf(wood: ReadonlyMap<number, Moss>, shelf: Box | null): Flower[] {
  const clumps = [...wood].flatMap(([floor, m]) => m.clumps.map((c): Flower => ({ key: `${floor}:${c.key}`, frame: floor, bells: bellsOf(c), box: clumpBox(c) })));
  if (!shelf) return clumps;
  const w = shelf.right - shelf.left, h = shelf.bottom - shelf.top;
  const bells = SHELF.bells.map((b) => ({ x: shelf.left + b.x * w, y: shelf.top + b.y * h }));
  return [...clumps, { key: SHELF_KEY, frame: 'rail', bells, box: shelf }];
}

// The highest bell a bee may work up to: never the top one.
export const lastBell = (f: Flower) => Math.max(0, f.bells.length - 2);

// On the page now.
export function onPage(page: PageMap, s: Spot): Point | null {
  const o = originOf(page, s.frame);
  return o && { x: o.x + s.x, y: o.y + s.y };
}
export const spotIn = (frame: Frame, p: Point, page: PageMap): Spot | null => {
  const o = originOf(page, frame);
  return o && { frame, x: p.x - o.x, y: p.y - o.y };
};

// Where a bee's thorax is, perched on bell i, and hovering above it.
export const perchSpot = (f: Flower, i: number): Spot => ({ frame: f.frame, x: f.bells[i].x, y: f.bells[i].y - FEET });
export const hoverSpot = (f: Flower, i: number): Spot => ({ ...perchSpot(f, i), y: f.bells[i].y - FEET - ABOVE });

// Whether a footprint at a spot is in air (in view, when asked).
export function fitsAt(air: BeeAir, s: Spot, pose: keyof typeof FOOTPRINTS, dir: 1 | -1, view = false, also: readonly Box[] = []): boolean {
  const p = onPage(air.page, s);
  return !!p && clear(air, boxAt(p, FOOTPRINTS[pose], dir), { view, also });
}

// The spots beside a flower a bee comes in from and leaves to, at its
// hovering height (or a little lower) either side, nearest first; each open
// to a flying bee (its grown footprint in air, in view).
export function approaches(air: BeeAir, f: Flower, i = 0, also: readonly Box[] = []): Spot[] {
  const above = hoverSpot(f, i);
  const p = onPage(air.page, above);
  if (!p) return [];
  return LOWER.flatMap((dy) => BESIDE.flatMap((d) => [-1, 1].flatMap((side) => {
    const q = { x: p.x + side * d, y: p.y + dy };
    return clear(air, flyReach(q), { view: true, also }) ? [{ frame: f.frame, x: above.x + side * d, y: above.y + dy }] : [];
  })));
}

// Whether its frame is on the page and in view: a ledge's clump while the
// ledge is, the shelf whenever the rail's air is there.
function shown(air: BeeAir, f: Flower): boolean {
  if (f.frame === 'rail') return air.rail !== null;
  const ledge = air.page.floors.get(f.frame);
  return !!ledge && inView(ledge, air.page);
}

// Whether a bee can visit a flower now: in view, with its lowest bell's
// perch and the hover above it in air, and a way in from beside it.
export function visitable(air: BeeAir, f: Flower, also: readonly Box[] = []): boolean {
  if (!shown(air, f) || !f.bells.length) return false;
  if (!fitsAt(air, perchSpot(f, 0), 'perch', 1, true, also) || !fitsAt(air, perchSpot(f, 0), 'perch', -1, true, also)) return false;
  if (!fitsAt(air, hoverSpot(f, 0), 'hover', 1, true, also) || !fitsAt(air, hoverSpot(f, 0), 'hover', -1, true, also)) return false;
  return approaches(air, f, 0, also).length > 0;
}

// How much room there is round a flower's hover: how far it is to the
// nearest thing a bee keeps off, up to 120px.
export function roomAt(air: BeeAir, f: Flower): number {
  const p = onPage(air.page, hoverSpot(f, 0));
  if (!p) return 0;
  const gap = (b: Box) => Math.hypot(Math.max(0, b.left - p.x, p.x - b.right), Math.max(0, b.top - p.y, p.y - b.bottom));
  return Math.min(120, ...air.page.obstacles.map((o) => gap(keepOff(o))));
}

// What holds a bee hovering free of any flower at p: the rail inside its
// air, else the nearest ledge.
export function frameAt(air: BeeAir, p: Point): Spot | null {
  const r = air.rail;
  if (r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) return { frame: 'rail', x: p.x, y: p.y };
  const a = anchor(air.page, p);
  return a && { frame: a.floor, x: a.dx, y: a.dy };
}
