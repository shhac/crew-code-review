import { keepByKey } from '../decor';
import type { Ledge } from '../floors';
import { distance, type Segment } from '../pointer';
import { hash } from '../seed';

// Embers dropped along the card tops, each smouldering on its own slow cycle
// from a glow down to grey ash and back. A moving cursor fans the ones it
// passes, which flare and then settle. x is along the ledge, so an ember
// stays where it fell as the page scrolls.
export type Ember = { key: string; x: number; size: number; phase: number; period: number; fanned: number; at: number };

// The glow spreads this far above the ledge; less clear space and it would
// light up whatever sits over the card.
const GLOW = 8;
const SPACING = 70;
const INSET = 14;
const FAN_REACH = 28;
const FAN_HALF_LIFE = 1400;

// Headings carry text right on their rule, so only card tops get embers.
export function emberSpots(id: number, f: Ledge): Ember[] {
  if (f.kind === 'heading' || f.room < GLOW + 2 || ![f.left, f.right, f.y].every(Number.isFinite)) return [];
  const width = f.right - f.left - 2 * INSET;
  const slots = Math.floor(width / SPACING);
  return Array.from({ length: Math.max(0, slots) }, (_, i) => i).flatMap((i) => {
    // About half the slots stay empty, in seeded clumps rather than evenly.
    if (hash(id * 53 + i * 7) < 0.45) return [];
    return [{
      key: `${id}:${i}`,
      x: INSET + SPACING * (i + 0.15 + 0.7 * hash(id * 31 + i)),
      size: 1.1 + hash(id * 13 + i),
      phase: hash(id * 7 + i * 3),
      period: 18000 + 14000 * hash(id * 11 + i),
      fanned: 0,
      at: -Infinity,
    }];
  });
}

export function reconcileEmbers(floors: ReadonlyMap<number, Ledge>, old: ReadonlyMap<number, Ember[]> = new Map()): Map<number, Ember[]> {
  return new Map([...floors].map(([id, f]) => [id, keepByKey(old.get(id), emberSpots(id, f))]));
}

// What is left at now of the last fanning.
const flare = (e: Ember, now: number) => e.fanned * 2 ** (-Math.max(0, now - e.at) / FAN_HALF_LIFE);

// 0 is cold ash, 1 a bright coal. Evaluated from time alone, so a skipped
// frame or a hidden tab changes nothing.
export function heat(e: Ember, now: number): number {
  const cycle = 0.5 + 0.5 * Math.sin(2 * Math.PI * (now / e.period + e.phase));
  return Math.min(1, 0.1 + 0.75 * cycle ** 2 + flare(e, now));
}

export function fanEmbers(embers: ReadonlyMap<number, Ember[]>, floors: ReadonlyMap<number, Ledge>, stroke: Segment): Map<number, Ember[]> {
  return new Map([...embers].map(([id, list]) => {
    const f = floors.get(id);
    if (!f) return [id, list];
    return [id, list.map((e) => {
      const strength = Math.max(0, Math.min(1, (FAN_REACH - distance({ x: f.left + e.x, y: f.y - 2 }, stroke.from, stroke.to)) / 10));
      // A second pass never cools what the first left burning.
      return strength ? { ...e, fanned: Math.max(flare(e, stroke.at), strength), at: stroke.at } : e;
    })];
  }));
}

// Ash grey through ember orange to a hot yellow.
export function emberColour(h: number): string {
  const stops = [[112, 106, 100], [236, 96, 38], [255, 214, 120]];
  const t = Math.max(0, Math.min(1, h)) * 2;
  const [a, b, k] = t < 1 ? [stops[0], stops[1], t] : [stops[1], stops[2], t - 1];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(', ')})`;
}
