import { clearRuns, type Ledge, type Obstacle } from '../floors';
import { distance, type Segment } from '../pointer';
import { hash } from '../seed';
import { auroraRgb, rgb } from './aurora';

// A thin rim of frost along the ledges, its crystals tinted by the aurora's
// current colour, with a few glints that catch the light now and then, and
// when the cursor passes. Everything is seeded per ledge id and in ledge-local
// x, so the frost stays put as the page scrolls.

// Crystals stand at most this tall, and the rim keeps to stretches where that
// much space is clear: the overlay sits above the page, so frost under a
// heading's text would be drawn over it.
const TALL = 3.5;
const CLEAR = 4;
const INSET = 6;
const CLUSTER_SPACING = 40;
const GLINT_SPACING = 90;
const GLINT = 600;
const GLINT_PEAK = 0.8;
const GLINT_REACH = 24;
// The page holds at most this many glints, so a long page costs no more.
export const MAX_GLINTS = 40;
const ICE = [232, 246, 255] as const;
const TINT = 0.35;

export type Glint = { key: string; x: number; size: number; phase: number; period: number; at: number };
// One ledge's frost: a single stroked path for the rim and its crystals, and
// its glints.
export type Rime = { d: string; glints: Glint[] };

export function rimeOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Rime {
  const runs = clearRuns(f, obstacles, CLEAR, { inset: INSET });
  // Crystals grow in small seeded clusters, a fan of three, rather than in a
  // row, which would read as grass or stitching.
  const d = runs.map((r) => {
    const clusters = Array.from({ length: Math.floor((r.hi - r.lo) / CLUSTER_SPACING) }, (_, i) => i).flatMap((i) => {
      const seed = id * 17 + Math.round(r.lo) + i * 5;
      if (hash(seed) < 0.35) return [];
      const x = r.lo + CLUSTER_SPACING * (i + 0.2 + 0.6 * hash(seed + 1));
      const h = 2 + (TALL - 2) * hash(seed + 2);
      return [-1, 0, 1].map((k) => {
        const tall = k === 0 ? h : h * 0.65;
        return `M${(x + k * 1.2).toFixed(1)} 0L${(x + k * (1.2 + tall * 0.55)).toFixed(1)} ${(-tall * (k === 0 ? 1 : 0.85)).toFixed(1)}`;
      });
    });
    return `M${r.lo} -0.5H${r.hi}${clusters.join('')}`;
  }).join('');
  const glints = runs.flatMap((r) => Array.from({ length: Math.floor((r.hi - r.lo) / GLINT_SPACING) }, (_, i) => i).flatMap((i) => {
    const seed = id * 41 + Math.round(r.lo) * 3 + i;
    if (hash(seed) < 0.5) return [];
    return [{
      key: `${id}:${Math.round(r.lo)}:${i}`,
      x: r.lo + GLINT_SPACING * (i + 0.2 + 0.6 * hash(seed + 1)),
      size: 2.5 + 1.5 * hash(seed + 2),
      phase: hash(seed + 3),
      period: 7000 + 8000 * hash(seed + 4),
      at: -Infinity,
    }];
  }));
  return { d, glints };
}

// Frost for every ledge, keeping the moment each surviving glint last caught
// the light; capped at MAX_GLINTS glints in all.
export function reconcileRime(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[], old: ReadonlyMap<number, Rime> = new Map()): Map<number, Rime> {
  const fresh = [...floors].map(([id, f]) => {
    const held = new Map(old.get(id)?.glints.map((g) => [g.key, g]));
    const rime = rimeOn(id, f, obstacles);
    const glints = rime.glints.map((g) => {
      const before = held.get(g.key);
      return before && before.x === g.x ? before : g;
    });
    return [id, { ...rime, glints }] as const;
  });
  const kept = new Set(fresh.flatMap(([, r]) => r.glints).slice(0, MAX_GLINTS));
  return new Map(fresh.map(([id, r]) => [id, { ...r, glints: r.glints.filter((g) => kept.has(g)) }]));
}

// A soft rise and fall over GLINT ms, from time alone.
const swell = (since: number) => (since >= 0 && since < GLINT ? Math.sin((Math.PI * since) / GLINT) : 0);

// How bright a glint is at now: its own twinkle once a period, or the cursor's.
export function shine(g: Glint, now: number): number {
  const into = (((now / g.period + g.phase) % 1) + 1) % 1 * g.period;
  return GLINT_PEAK * Math.max(swell(into), swell(now - g.at));
}

// A moving cursor passing close makes a glint catch the light, unless it is
// already glinting.
export function catchLight(rime: ReadonlyMap<number, Rime>, floors: ReadonlyMap<number, Ledge>, stroke: Segment): Map<number, Rime> {
  return new Map([...rime].map(([id, r]) => {
    const f = floors.get(id);
    if (!f) return [id, r];
    const glints = r.glints.map((g) => {
      const close = distance({ x: f.left + g.x, y: f.y - 2 }, stroke.from, stroke.to) < GLINT_REACH;
      return close && stroke.at - g.at >= GLINT ? { ...g, at: stroke.at } : g;
    });
    return [id, { ...r, glints }];
  }));
}

// Ice white, tinted by the aurora at now.
export function frostColour(now: number): string {
  const sky = auroraRgb(now);
  const mix = (c: 0 | 1 | 2) => Math.round(ICE[c] + (sky[c] - ICE[c]) * TINT);
  return rgb([mix(0), mix(1), mix(2)]);
}
