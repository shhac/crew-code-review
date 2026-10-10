import { shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { hash } from '../seed';
import { CLUMPS, CUSHIONS, type Bell } from './art';

// A low rim of moss along the ledges, with clumps of bluebells growing out
// of it where there is room, and here and there a plain cushion of moss.
// Everything is seeded per ledge id and in ledge-local x, so the wood stays
// put as the page scrolls, and a clump keeps its slot along its ledge
// whatever changes elsewhere on it: a bee's flower is a clump's key. The
// overlay sits above the page, so nothing grows where it would be drawn over
// a heading's text.

// The moss stands at most 4px, outline included, where 5 are clear, kept
// in from a card's ends, which are rounded.
const MOSS_CLEAR = 5;
const MOSS_INSET = 10;
const BUMP_LOW = 1.2;
const BUMP_HIGH = 3.6;
// Each bump is this wide, give or take a half.
const BUMP = 6;
// The moss swells and thins along a ledge over about this many px, so it
// reads as growing rather than as a trim.
const SWELL = 45;
// The outline's width; the rim's bottom is lifted by half of it, so nothing
// of it hangs below the ledge.
export const MOSS_LINE = 0.6;

// Clumps are seeded in slots this far apart along a ledge, each kept where
// a clump stands clear with room either side for a bee to perch, rising up
// to REACH into the empty bottom edge of a card above, as the walkers may.
const SLOT = 140;
const CLUMP_CLEAR = 26;
const REACH = 6;
const CLUMP_ROOM = 10;
const CLUMP_CHANCE = 0.7;
export const MAX_CLUMPS_A_LEDGE = 3;
export const MAX_CLUMPS = 12;
// A cushion sits in a slot with no clump, where 10px are clear.
const CUSHION_CLEAR = 10;
const CUSHION_ROOM = 4;
const CUSHION_CHANCE = 0.5;
export const MAX_CUSHIONS = 6;

// A clump of bluebells: which of the three it is, where it stands (its
// middle, ledge-local), and whether it is drawn mirrored.
export type Clump = { key: string; x: number; art: number; flip: boolean };
export type Cushion = { key: string; x: number; art: number; flip: boolean };
// One ledge's wood: the moss as one outlined path and its lighter tops,
// and what grows on it.
export type Moss = { d: string; tops: string; clumps: Clump[]; cushions: Cushion[] };

const f2 = (n: number) => n.toFixed(2);

// The bumps of a run, edge to edge, each its own seeded width and height
// on a slow swell along the ledge, lower toward the run's ends so the moss
// thins out rather than stops.
function bumps(id: number, r: Run): { a: number; b: number; h: number }[] {
  const count = Math.max(1, Math.round((r.hi - r.lo) / BUMP));
  const widths = Array.from({ length: count }, (_, i) => 0.5 + hash(id * 97 + Math.round(r.lo) * 13 + i * 7));
  const total = widths.reduce((s, w) => s + w, 0);
  const edges = widths.reduce<number[]>((xs, w) => [...xs, xs.at(-1)! + ((r.hi - r.lo) * w) / total], [r.lo]);
  const phase = 2 * Math.PI * hash(id * 83 + 5);
  return widths.map((_, i) => {
    const mid = (edges[i] + edges[i + 1]) / 2;
    const swell = 0.5 + 0.3 * Math.sin(mid / SWELL + phase) + 0.2 * Math.sin(mid / (SWELL * 0.37) + 2 * phase);
    const end = Math.min(1, Math.min(i + 0.5, count - i - 0.5) / 1.5);
    const h = BUMP_LOW + (BUMP_HIGH - BUMP_LOW) * swell * (0.7 + 0.3 * hash(id * 89 + i * 3 + 1));
    return { a: edges[i], b: edges[i + 1], h: BUMP_LOW + end * (h - BUMP_LOW) };
  });
}

// An arch from (a, base) to (b, base) peaking h above the ledge: a cubic
// rises three quarters of the way to its control points.
const arch = (a: number, b: number, h: number, base: number) => {
  const top = base - (h + base) / 0.75;
  return `C${f2(a)} ${f2(top)} ${f2(b)} ${f2(top)} ${f2(b)} ${f2(base)}`;
};

function mossPath(id: number, r: Run): string {
  const base = -MOSS_LINE / 2;
  return `M${f2(r.lo)} ${f2(base)}${bumps(id, r).map((p) => arch(p.a, p.b, p.h, base)).join('')}Z`;
}

// A lighter cap on the bigger bumps, as the sun catches the moss's top.
function topsPath(id: number, r: Run): string {
  return bumps(id, r).filter((p) => p.h > 2.2).map((p) => {
    const w = p.b - p.a;
    const base = -p.h * 0.45;
    return `M${f2(p.a + w * 0.25)} ${f2(base)}${arch(p.a + w * 0.25, p.b - w * 0.25, p.h - 0.5, base)}Z`;
  }).join('');
}

const covers = (runs: readonly Run[], lo: number, hi: number) => runs.some((r) => r.lo <= lo && r.hi >= hi);

// The middle of a ledge's slot i, seeded.
const slotX = (id: number, i: number) => SLOT * (i + 0.25 + 0.5 * hash(id * 71 + i * 3 + 1));

// What grows on one ledge, before the page's caps.
export function mossOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Moss {
  const moss = clearRuns(f, obstacles, MOSS_CLEAR, { inset: MOSS_INSET });
  const tall = clearRuns(f, obstacles, CLUMP_CLEAR, { inset: MOSS_INSET, reach: REACH });
  const low = clearRuns(f, obstacles, CUSHION_CLEAR, { inset: MOSS_INSET });
  const count = Math.floor((f.right - f.left) / SLOT);
  const grown = Array.from({ length: count }, (_, i) => {
    const seed = id * 53 + i * 11;
    const x = slotX(id, i);
    const art = Math.floor(hash(seed + 2) * CLUMPS.length);
    const half = CLUMPS[art].width / 2;
    const clump = hash(seed) < CLUMP_CHANCE && covers(tall, x - half - CLUMP_ROOM, x + half + CLUMP_ROOM) && covers(moss, x - half, x + half);
    return clump ? { key: `${id}:${i}`, x, art, flip: hash(seed + 3) < 0.5 } : undefined;
  });
  const clumps = grown.filter((c) => c !== undefined).slice(0, MAX_CLUMPS_A_LEDGE);
  const cushions = Array.from({ length: count }, (_, i) => i).flatMap((i) => {
    if (grown[i]) return [];
    const seed = id * 59 + i * 13;
    const x = slotX(id, i);
    const art = Math.floor(hash(seed + 2) * CUSHIONS.length);
    const half = CUSHIONS[art].width / 2;
    if (hash(seed) >= CUSHION_CHANCE || !covers(low, x - half - CUSHION_ROOM, x + half + CUSHION_ROOM) || !covers(moss, x - half, x + half)) return [];
    return [{ key: `${id}:${i}`, x, art, flip: hash(seed + 3) < 0.5 }];
  });
  return { d: moss.map((r) => mossPath(id, r)).join(''), tops: moss.map((r) => topsPath(id, r)).join(''), clumps, cushions };
}

// The wood on every ledge, its clumps and cushions shared out a ledge at a
// time up to the page's caps, so a long page keeps some on every ledge.
export function growMoss(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[]): Map<number, Moss> {
  const all = [...floors].map(([id, f]) => [id, mossOn(id, f, obstacles)] as const);
  const clumps = shareOut(all.map(([, m]) => m.clumps), MAX_CLUMPS);
  const cushions = shareOut(all.map(([, m]) => m.cushions), MAX_CUSHIONS);
  return new Map(all.map(([id, m]) => [id, { ...m, clumps: m.clumps.filter((c) => clumps.has(c)), cushions: m.cushions.filter((c) => cushions.has(c)) }]));
}

// The bells of a clump, lowest first, ledge-local: x along the ledge and y
// up from it (negative).
export function bellsOf(c: Clump): Bell[] {
  const art = CLUMPS[c.art];
  return art.bells.map((b) => ({ x: c.x + (c.flip ? 0.5 - b.x : b.x - 0.5) * art.width, y: -(1 - b.y) * art.height }));
}

// A clump's box, ledge-local.
export function clumpBox(c: Clump): { left: number; right: number; top: number; bottom: number } {
  const art = CLUMPS[c.art];
  return { left: c.x - art.width / 2, right: c.x + art.width / 2, top: -art.height, bottom: 0 };
}
