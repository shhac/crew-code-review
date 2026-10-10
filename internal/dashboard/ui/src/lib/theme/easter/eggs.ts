import type { Ledge } from '../floors';
import { hash } from '../seed';
import { EGG, PEEP, xOf, type Egg } from './hunt';

// How an egg is drawn at a moment: hidden, sunk behind its ledge's edge so
// only its top peeps over, now and then giving a small wobble; found, popping
// up to stand on the ledge with a brief glint. Worked out from the time
// alone, so nothing is stored per frame.

const POP = 400;
const GLINT = 600;
// A hidden egg wobbles once in each window, at a seeded moment in it.
const WOBBLE_EVERY = { lo: 7000, hi: 13000 };
const WOBBLE = 500;
const WOBBLE_TILT = 9;
// A rabbit's egg rises from out of sight to its peep as it is left.
const LEFT = 500;

// Where an egg is drawn on the page: its bottom centre (x, y); how far it is
// sunk below the ledge's line (drawn clipped at the line); its tilt; and a
// glint's strength, 0 to 1.
export type EggView = { x: number; y: number; ledge: number; sunk: number; tilt: number; glint: number };

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
// Up quickly, easing into standing, never past it.
const pop = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) ** 3;
};

const HIDDEN = (1 - PEEP) * EGG.height;

function wobble(egg: Egg, seed: number, now: number): number {
  const span = WOBBLE_EVERY.lo + hash(seed) * (WOBBLE_EVERY.hi - WOBBLE_EVERY.lo);
  const n = Math.floor(now / span);
  const t = (now - n * span - hash(seed * 7 + n) * (span - WOBBLE)) / WOBBLE;
  if (t < 0 || t > 1) return 0;
  return WOBBLE_TILT * Math.sin(Math.PI * t) * Math.sin(3 * Math.PI * t);
}

export function eggView(egg: Egg, f: Ledge, now: number, still: boolean): EggView {
  const at = { x: f.left + xOf(f, egg.end), y: f.y, ledge: f.y };
  const seed = egg.floor * 3 + (egg.end === 'left' ? 1 : 2);
  if (egg.found !== null) {
    const since = still ? Infinity : now - egg.found;
    const glint = still || since > GLINT ? 0 : Math.sin(Math.PI * (since / GLINT));
    return { ...at, sunk: HIDDEN * (1 - pop(since / POP)), tilt: 0, glint };
  }
  if (still) return { ...at, sunk: HIDDEN, tilt: 0, glint: 0 };
  const rising = smooth((now - egg.hidden) / LEFT);
  return { ...at, sunk: EGG.height - (EGG.height - HIDDEN) * rising, tilt: rising < 1 ? 0 : wobble(egg, seed, now), glint: 0 };
}
