import { shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { hash } from '../seed';

// A few rose petals lying along the ledges, seeded per ledge id and in
// ledge-local x, so they stay put as the page scrolls. They keep to
// stretches where a petal's height is clear: the overlay sits above the
// page, so a petal under a heading's text would be drawn over it.

const CLEAR = 7;
const INSET = 8;
const SLOT = 70;
// Just under half the slots hold a few.
const CHANCE = 0.45;
// The page holds at most this many, so a long page costs no more.
export const MAX_PETALS = 36;
const REDS = ['#d81b5a', '#f0507a', '#e8436b'] as const;
export const EDGE = '#7a0f2e';

// One petal: where it lies (ledge-local x), its turn, size and colour.
export type Petal = { key: string; x: number; angle: number; size: number; fill: string };

const slots = (r: Run) => Array.from({ length: Math.floor((r.hi - r.lo) / SLOT) }, (_, i) => i);

// Each slot's petals, a little apart, the ones in a slot each turned their
// own way.
function petalsOn(id: number, r: Run): Petal[] {
  return slots(r).flatMap((i) => {
    const seed = id * 37 + Math.round(r.lo) * 5 + i;
    if (hash(seed) >= CHANCE) return [];
    const count = 1 + Math.floor(hash(seed + 1) * 3);
    const at = r.lo + SLOT * (i + 0.2 + 0.6 * hash(seed + 2));
    return Array.from({ length: count }, (_, k) => ({
      key: `${id}:${Math.round(r.lo)}:${i}:${k}`,
      x: Math.min(r.hi - 3, at + (k - (count - 1) / 2) * 7),
      angle: -25 + 50 * hash(seed + 3 + k * 7),
      size: 1.15 + 0.35 * hash(seed + 4 + k * 7),
      fill: REDS[Math.floor(hash(seed + 5 + k * 7) * REDS.length)],
    }));
  });
}

// Petals for every ledge, capped at MAX_PETALS: a slot from each ledge in
// turn, so a long page keeps some on every ledge rather than all of them on
// the first few cards.
export function scatterPetals(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[]): Map<number, Petal[]> {
  const all = [...floors].map(([id, f]) => [id, clearRuns(f, obstacles, CLEAR, { inset: INSET }).flatMap((r) => petalsOn(id, r))] as const);
  const kept = shareOut(all.map(([, p]) => p), MAX_PETALS);
  return new Map(all.map(([id, p]) => [id, p.filter((petal) => kept.has(petal))]));
}

// A curled teardrop about 5 by 2.5 lying on the ledge, its round end at x,
// pointed end leaning the way it is turned, in ledge-local units.
const SHAPE = [[-2.5, 0], [-2.6, -2.4], [1, -3.2], [2.6, -0.9], [1.2, -0.2], [-0.8, 0], [-2.5, 0]] as const;
export function petalPath(p: Petal): string {
  const [start, ...rest] = SHAPE.map(([x, y]) => `${(x * p.size).toFixed(2)} ${(y * p.size).toFixed(2)}`);
  return `M${start}C${rest.slice(0, 3).join(' ')}C${rest.slice(3).join(' ')}Z`;
}
