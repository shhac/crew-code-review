import { keepByKey, shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { apart, clamp01, rad } from '../math';
import type { Point } from '../pointer';
import { hash } from '../seed';

// Straw lying along the ledges after the harvest, with small clusters of
// wheat grains among it for the crows to eat. Everything is seeded per ledge
// id and in ledge-local x, so it stays put as the page scrolls; a grain the
// crows have eaten comes back once they have left it alone for a while.

// Nothing stands taller than CAP; the chaff keeps to stretches where a pixel
// more is clear, so it is never drawn under a heading's text.
const CLEAR = 4;
export const CAP = 3;
const STALK_SLOT = 14;
const GRAIN_SLOT = 24;
// The page holds at most this many, shared out a ledge at a time, so a long
// page costs no more and is not bare below its first cards.
export const MAX_STALKS = 220;
export const MAX_GRAINS = 160;
// A wheat grain's size, lying on its side.
export const GRAIN = { length: 1.6, depth: 1.1 };
// A peck takes the grain nearest the bill within BITE; an eaten grain comes
// back over FADE once no crow has been within QUIET_REACH of it for QUIET.
export const BITE = 6;
const QUIET_REACH = 40;
export const QUIET = 20000;
export const FADE = 2000;

// A stalk of straw lying from x along its tilt (degrees, up to the right
// when positive), its width, which of the two straw tones it is, and where
// along it a darker node sits (a fraction of its length), if anywhere.
export type Stalk = { x: number; length: number; tilt: number; width: number; tone: 0 | 1; node: number | null };
// A grain at x, turned by tilt. eaten: when it was eaten (null while it
// lies there); quiet: since when no crow has been near it; back: when it
// came back, from which it fades in.
export type Grain = { key: string; x: number; tilt: number; eaten: number | null; quiet: number; back: number };
// What lies on one ledge: its straw, drawn in a path per tone and one for
// the nodes, and its grains.
export type Chaff = { stalks: Stalk[]; straw: [string, string]; nodes: string; grains: Grain[] };

const slots = (r: Run, spacing: number) => Array.from({ length: Math.max(0, Math.floor((r.hi - r.lo) / spacing)) }, (_, i) => i);

// The steepest a stalk of this length and width may lie and stay under CAP,
// and never steeper than 12 degrees.
const steepest = (length: number, width: number) => Math.min(12, (Math.asin(Math.min(1, (CAP - width) / length)) * 180) / Math.PI);

function stalk(x: number, seed: number, flip: boolean): Stalk {
  const length = 4 + 5 * hash(seed + 1);
  const width = 1.1 + 0.5 * hash(seed + 2);
  const lean = (flip ? -1 : 1) * (0.25 + 0.75 * hash(seed + 3)) * (hash(seed + 4) < 0.5 ? -1 : 1);
  return { x, length, tilt: lean * steepest(length, width), width, tone: hash(seed + 5) < 0.5 ? 0 : 1, node: hash(seed + 6) < 0.3 ? 0.3 + 0.4 * hash(seed + 7) : null };
}

// About one stalk in each slot, some with a second crossing it, every one
// lying wholly inside its run.
function stalksOn(id: number, r: Run): Stalk[] {
  return slots(r, STALK_SLOT).flatMap((i) => {
    const seed = id * 37 + Math.round(r.lo) * 5 + i * 13;
    // Scattered anywhere in its slot, so they never line up like stitching.
    if (hash(seed) < 0.2) return [];
    const first = stalk(r.lo + STALK_SLOT * (i - 0.3 + 1.1 * hash(seed + 8)), seed, false);
    const crossed = hash(seed + 9) < 0.3 ? [stalk(first.x + first.length * (0.15 + 0.35 * hash(seed + 10)), seed + 50, first.tilt > 0)] : [];
    return [first, ...crossed].filter((s) => s.x >= r.lo && s.x + s.length <= r.hi);
  });
}

// Clusters of two to five grains in about half the slots.
function grainsOn(id: number, r: Run): Grain[] {
  return slots(r, GRAIN_SLOT).flatMap((i) => {
    const seed = id * 59 + Math.round(r.lo) * 3 + i * 17;
    if (hash(seed) < 0.5) return [];
    const count = 2 + Math.floor(4 * hash(seed + 1));
    const at = r.lo + GRAIN_SLOT * (i + 0.2 + 0.6 * hash(seed + 2));
    return Array.from({ length: count }, (_, k): Grain => ({
      key: `${id}:${Math.round(r.lo)}:${i}:${k}`,
      x: at + (k - (count - 1) / 2) * 1.9 + (hash(seed + 3 + k) - 0.5) * 1.2,
      tilt: (hash(seed + 10 + k) - 0.5) * 50,
      eaten: null, quiet: -Infinity, back: -Infinity,
    })).filter((g) => g.x - GRAIN.length / 2 >= r.lo && g.x + GRAIN.length / 2 <= r.hi);
  });
}

// A stalk as a thin four-sided shape lying on the ledge, its lower end
// touching it, so stalks of different widths share one filled path.
function stalkShape(s: Stalk): string {
  const a = rad(s.tilt);
  const [dx, dy] = [Math.cos(a) * s.length, -Math.sin(a) * s.length];
  const base = Math.max(0, dy);
  const [nx, ny] = [-Math.sin(a) * s.width, -Math.cos(a) * s.width];
  const p = (x: number, y: number) => `${(s.x + x).toFixed(1)} ${(y - base).toFixed(2)}`;
  return `M${p(0, 0)}L${p(dx, dy)}L${p(dx + nx, dy + ny)}L${p(nx, ny)}Z`;
}

// A node: a short darker band across the stalk.
function nodeShape(s: Stalk): string {
  if (s.node === null) return '';
  const a = rad(s.tilt);
  const base = Math.max(0, -Math.sin(a) * s.length);
  const along = s.node * s.length;
  const [x, y] = [s.x + Math.cos(a) * along, -Math.sin(a) * along - base];
  const [nx, ny] = [-Math.sin(a) * s.width, -Math.cos(a) * s.width];
  const [tx, ty] = [Math.cos(a) * 0.5, -Math.sin(a) * 0.5];
  const p = (px: number, py: number) => `${px.toFixed(1)} ${py.toFixed(2)}`;
  return `M${p(x, y)}L${p(x + tx, y + ty)}L${p(x + tx + nx, y + ty + ny)}L${p(x + nx, y + ny)}Z`;
}

const drawn = (stalks: readonly Stalk[]): Pick<Chaff, 'straw' | 'nodes'> => ({
  straw: [stalks.filter((s) => s.tone === 0).map(stalkShape).join(''), stalks.filter((s) => s.tone === 1).map(stalkShape).join('')],
  nodes: stalks.map(nodeShape).join(''),
});

// What lies on one ledge, before the page's caps.
export function chaffOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Chaff {
  const runs = clearRuns(f, obstacles, CLEAR);
  const stalks = runs.flatMap((r) => stalksOn(id, r));
  return { stalks, ...drawn(stalks), grains: runs.flatMap((r) => grainsOn(id, r)) };
}

// The chaff on every ledge, each grain keeping whether it has been eaten;
// capped at MAX_STALKS stalks and MAX_GRAINS grains in all.
export function reconcileChaff(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[], old: ReadonlyMap<number, Chaff> = new Map()): Map<number, Chaff> {
  const fresh = [...floors].map(([id, f]) => {
    const chaff = chaffOn(id, f, obstacles);
    return [id, { ...chaff, grains: keepByKey(old.get(id)?.grains, chaff.grains) }] as const;
  });
  const keptStalks = shareOut(fresh.map(([, c]) => c.stalks), MAX_STALKS);
  const keptGrains = shareOut(fresh.map(([, c]) => c.grains), MAX_GRAINS);
  return new Map(fresh.map(([id, c]) => {
    const stalks = c.stalks.filter((s) => keptStalks.has(s));
    return [id, { stalks, ...drawn(stalks), grains: c.grains.filter((g) => keptGrains.has(g)) }];
  }));
}

const present = (g: Grain) => g.eaten === null;

// The grain still lying on a ledge nearest x within reach, if any.
export function grainNear(chaff: ReadonlyMap<number, Chaff>, floor: number, x: number, reach: number): Grain | null {
  const near = (chaff.get(floor)?.grains ?? []).filter((g) => present(g) && Math.abs(g.x - x) <= reach);
  return near.reduce<Grain | null>((best, g) => (!best || Math.abs(g.x - x) < Math.abs(best.x - x) ? g : best), null);
}

// The nearest grain along a ledge from x the way dir goes, within reach.
export function grainAhead(chaff: ReadonlyMap<number, Chaff>, floor: number, x: number, dir: 1 | -1, reach: number): Grain | null {
  const ahead = (chaff.get(floor)?.grains ?? []).filter((g) => present(g) && (g.x - x) * dir > 0 && Math.abs(g.x - x) <= reach);
  return ahead.reduce<Grain | null>((best, g) => (!best || Math.abs(g.x - x) < Math.abs(best.x - x) ? g : best), null);
}

// A peck with the bill's tip at x on a ledge: the nearest grain within BITE
// is eaten, and no longer drawn.
export function peck(chaff: ReadonlyMap<number, Chaff>, floor: number, x: number, now: number): Map<number, Chaff> {
  const bitten = grainNear(chaff, floor, x, BITE);
  if (!bitten) return new Map(chaff);
  return new Map([...chaff].map(([id, c]) => [id, id !== floor ? c : { ...c, grains: c.grains.map((g) => (g === bitten ? { ...g, eaten: now, quiet: now } : g)) }]));
}

// Eaten grain comes back once no crow has been within QUIET_REACH of it for
// QUIET (someone has scattered more). crows are where each crow is now, in
// the page's coordinates, standing or flying.
export function regrow(chaff: ReadonlyMap<number, Chaff>, floors: ReadonlyMap<number, Ledge>, crows: readonly Point[], now: number): Map<number, Chaff> {
  return new Map([...chaff].map(([id, c]) => {
    const f = floors.get(id);
    if (!f || c.grains.every(present)) return [id, c];
    const grains = c.grains.map((g) => {
      if (present(g)) return g;
      const watched = crows.some((p) => apart(p, { x: f.left + g.x, y: f.y }) < QUIET_REACH);
      if (watched) return { ...g, quiet: now };
      return now - g.quiet >= QUIET ? { ...g, eaten: null, back: now } : g;
    });
    return [id, { ...c, grains }];
  }));
}

// How much of a grain is drawn at now: none eaten, fading in once back.
// Under reduced motion every grain is drawn whole.
export function grainOpacity(g: Grain, now: number, still: boolean): number {
  if (still) return 1;
  return present(g) ? clamp01((now - g.back) / FADE) : 0;
}

// A grain on its side with a darker crease along it, about its middle.
export const GRAIN_PATH = (() => {
  const [a, b] = [GRAIN.length / 2, GRAIN.depth / 2];
  return { body: `M${-a} 0A${a} ${b} 0 1 0 ${a} 0A${a} ${b} 0 1 0 ${-a} 0Z`, crease: `M${(-a * 0.55).toFixed(2)} 0H${(a * 0.55).toFixed(2)}` };
})();
