import { clearance, type Ledge, type PageMap } from '../floors';
import { distance, type Point, type Segment } from '../pointer';
import { hash } from '../seed';

// The egg hunt: painted eggs tucked into the ends of the page's ledges, only
// their tops peeping over the edge, found by passing the cursor close to
// one. The tally is the session's alone: found counts every egg found since
// the page loaded, total that plus the eggs still hidden on the page now.
// Nothing is stored anywhere; a reload starts a new hunt.

// An egg's size on the page, and where it stands: centred this far in from
// its ledge's end.
export const EGG = { width: 10.75, height: 14 };
export const END_IN = 10;
// Hidden, this much of its height peeps over the ledge.
export const PEEP = 0.42;
// It needs this much clear above the ledge over the stretch it stands on,
// with the reach every creature has into a card's empty edge.
const CLEAR = 16;
const REACH = 6;
const HALF = 6;
// A ledge too short for an egg at each end without crowding.
const MIN_LEDGE = 60;
// When a ledge is first seen, the chance its id gives it an egg; a page
// starts with at most START eggs hidden, and rabbits add up to MOST.
const CHANCE = 0.4;
export const START = 5;
export const MOST = 8;
// A stroke passing this close to an egg's top finds it.
export const FIND_REACH = 26;
export const DESIGNS = 6;

export type End = 'left' | 'right';
export type Egg = {
  key: string;
  floor: number;
  end: End;
  design: number;
  // When it was found, or null while hidden.
  found: number | null;
  // When it was hidden: a rabbit's egg peeps up as it is left.
  hidden: number;
};
// Every egg on the page, found so far, and the ledges already looked at for
// an egg, so a ledge seen again is never given another.
export type Hunt = { eggs: readonly Egg[]; found: number; seen: ReadonlySet<number> };

export const NO_HUNT: Hunt = { eggs: [], found: 0, seen: new Set() };

export const xOf = (f: Ledge, end: End) => (end === 'left' ? END_IN : f.right - f.left - END_IN);

// Whether an egg can stand at this end of f: room on the ledge, and clear of
// text, controls and charts above it.
export function spotClear(f: Ledge, page: PageMap, end: End): boolean {
  if (f.right - f.left < MIN_LEDGE) return false;
  const x = xOf(f, end);
  return clearance(f, page.obstacles, x - HALF, x + HALF, REACH) >= CLEAR;
}

const hiddenCount = (eggs: readonly Egg[]) => eggs.filter((e) => e.found === null).length;
const taken = (eggs: readonly Egg[], floor: number, end: End) => eggs.some((e) => e.floor === floor && e.end === end);
const keyOf = (floor: number, end: End) => `${floor}:${end}`;

// After a measurement: eggs whose ledge is gone, or whose spot is now
// covered, leave the hunt (a found one stays counted); each ledge seen for
// the first time may get one, seeded by its id, while the page has fewer
// than START hidden.
export function hideEggs(hunt: Hunt, page: PageMap): Hunt {
  const kept = hunt.eggs.filter((e) => {
    const f = page.floors.get(e.floor);
    return !!f && spotClear(f, page, e.end);
  });
  const fresh = [...page.floors].filter(([id]) => !hunt.seen.has(id));
  const eggs = fresh.reduce<Egg[]>((all, [id, f]) => {
    if (hash(id * 31 + 7) >= CHANCE || hiddenCount(all) >= START) return all;
    const end: End = hash(id * 17 + 3) < 0.5 ? 'left' : 'right';
    if (!spotClear(f, page, end) || taken(all, id, end)) return all;
    return [...all, { key: keyOf(id, end), floor: id, end, design: Math.floor(hash(id * 13 + 1) * DESIGNS), found: null, hidden: -Infinity }];
  }, kept);
  return { eggs, found: hunt.found, seen: new Set([...hunt.seen, ...fresh.map(([id]) => id)]) };
}

// Where an egg's top peeps over its ledge, on the page.
export function peepAt(egg: Egg, f: Ledge): Point {
  return { x: f.left + xOf(f, egg.end), y: f.y - PEEP * EGG.height / 2 };
}

// A stroke of the cursor finds every hidden egg it passes close to.
export function findEggs(hunt: Hunt, page: PageMap, stroke: Segment): Hunt {
  const near = (e: Egg) => {
    const f = page.floors.get(e.floor);
    return e.found === null && !!f && distance(peepAt(e, f), stroke.from, stroke.to) <= FIND_REACH;
  };
  const hits = hunt.eggs.filter(near);
  if (!hits.length) return hunt;
  return { ...hunt, found: hunt.found + hits.length, eggs: hunt.eggs.map((e) => (hits.includes(e) ? { ...e, found: stroke.at } : e)) };
}

// Whether a rabbit could leave an egg at this end of a ledge: free, clear,
// and the page not already holding MOST hidden.
export const canLeave = (hunt: Hunt, page: PageMap, floor: number, end: End) => {
  const f = page.floors.get(floor);
  return !!f && hiddenCount(hunt.eggs) < MOST && !taken(hunt.eggs, floor, end) && spotClear(f, page, end);
};

// A rabbit's egg, nudged into a ledge's end: hidden like the rest.
export function leaveEgg(hunt: Hunt, page: PageMap, floor: number, end: End, now: number, design: number): Hunt {
  if (!canLeave(hunt, page, floor, end)) return hunt;
  return { ...hunt, eggs: [...hunt.eggs, { key: keyOf(floor, end), floor, end, design: design % DESIGNS, found: null, hidden: now }] };
}

// The counter's numbers: found this session, and that plus those still
// hidden here.
export const tally = (hunt: Hunt) => ({ found: hunt.found, total: hunt.found + hiddenCount(hunt.eggs) });

// Where the counter sits: in the rail's head, right-aligned in the brand's
// box and centred on it, in the empty space after the brand's words; null
// where it would not fit there with GAP to spare, so it never covers them.
export const TALLY = { width: 34, height: 16 };
const GAP = 8;
type Box = { left: number; right: number; top: number; bottom: number };
export function tallySpot(brand: Box, words: Box): Point | null {
  const x = brand.right - TALLY.width;
  if (x < words.right + GAP) return null;
  return { x, y: (brand.top + brand.bottom) / 2 - TALLY.height / 2 };
}
