import { keepByKey, shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { distance, type Segment } from '../pointer';
import { hash } from '../seed';
import { auroraRgb, mixRgb, rgb, type Rgb } from './aurora';

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
const ICE: Rgb = [232, 246, 255];
const TINT = 0.35;

export type Glint = { key: string; x: number; size: number; phase: number; period: number; at: number };
// One ledge's frost: a single stroked path for the rim and its crystals, and
// its glints.
export type Rime = { d: string; glints: Glint[] };

export function rimeOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Rime {
  const runs = clearRuns(f, obstacles, CLEAR, { inset: INSET });
  return { d: runs.map((r) => rimPath(id, r)).join(''), glints: runs.flatMap((r) => glintsOn(id, r)) };
}

// The slots of a run spacing apart, for seeded decorations.
const slots = (r: Run, spacing: number) => Array.from({ length: Math.floor((r.hi - r.lo) / spacing) }, (_, i) => i);

// The rim along a run, and crystals in small seeded clusters, a fan of three,
// rather than in a row, which would read as grass or stitching.
function rimPath(id: number, r: Run): string {
  const clusters = slots(r, CLUSTER_SPACING).flatMap((i) => {
    const seed = id * 17 + Math.round(r.lo) + i * 5;
    if (hash(seed) < 0.35) return [];
    return [fan(r.lo + CLUSTER_SPACING * (i + 0.2 + 0.6 * hash(seed + 1)), 2 + (TALL - 2) * hash(seed + 2))];
  });
  return `M${r.lo} -0.5H${r.hi}${clusters.join('')}`;
}

// Three crystals from about x, the middle one h tall and upright, the outer
// two shorter and leaning away.
function fan(x: number, h: number): string {
  return [-1, 0, 1].map((k) => {
    const [tall, rise] = k === 0 ? [h, h] : [h * 0.65, h * 0.65 * 0.85];
    return `M${(x + k * 1.2).toFixed(1)} 0L${(x + k * (1.2 + tall * 0.55)).toFixed(1)} ${(-rise).toFixed(1)}`;
  }).join('');
}

function glintsOn(id: number, r: Run): Glint[] {
  return slots(r, GLINT_SPACING).flatMap((i) => {
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
  });
}

// Frost for every ledge, keeping the moment each surviving glint last caught
// the light; capped at MAX_GLINTS glints in all.
export function reconcileRime(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[], old: ReadonlyMap<number, Rime> = new Map()): Map<number, Rime> {
  const fresh = [...floors].map(([id, f]) => {
    const rime = rimeOn(id, f, obstacles);
    return [id, { ...rime, glints: keepByKey(old.get(id)?.glints, rime.glints) }] as const;
  });
  const kept = shareOut(fresh.map(([, r]) => r.glints), MAX_GLINTS);
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
  return rgb(mixRgb(ICE, auroraRgb(now), TINT));
}

// A four-pointed star of radius s, pinched to a fifth of that between points.
export function glintPath(s: number): string {
  const pinch = s * 0.22;
  return `M0 ${-s}L${pinch} ${-pinch}L${s} 0L${pinch} ${pinch}L0 ${s}L${-pinch} ${pinch}L${-s} 0L${-pinch} ${-pinch}Z`;
}
