import { keepByKey, shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { distance, type Segment } from '../pointer';
import { hash } from '../seed';

// Tufts of grass along the ledges and, here and there, daffodil shoots. The
// blades lean in a slow breeze, a gust running along now and then, and part
// where a moving cursor brushes them. Everything is seeded per ledge id and
// in ledge-local x, so the grass stays put as the page scrolls; the sway is
// worked out from time alone and the parting from when it was last brushed.

// The tallest thing drawn is a shoot with its bud, 9px; the grass keeps to
// stretches where a pixel more than that is clear, so nothing is drawn over
// a heading's text.
const CLEAR = 10;
const INSET = 6;
// Kept this far inside a clear run's ends, so a blade leaning its furthest
// still stays over the clear stretch.
const MARGIN = 6;
const TUFT_SLOT = 14;
const SHOOT_SLOT = 60;
// No tuft this close to a shoot, so a shoot stands on its own.
const SHOOT_ROOM = 7;
// The page holds at most this many, so a long page costs no more.
export const MAX_TUFTS = 160;
export const MAX_SHOOTS = 24;
// Breeze and gust together lean a blade at most SWAY degrees; a cursor's
// brush parts it up to PART more, springing back over SPRING ms.
const BREEZE = 3.5;
const GUST = 2.5;
export const SWAY = BREEZE + GUST;
export const PART = 25;
const SPRING = 800;
const BRUSH_REACH = 16;
// A shoot leans a third as far as the grass.
const STIFF = 1 / 3;
// A gust runs along the page every GUST_EVERY ms at GUST_SPEED px/s.
const GUST_EVERY = 9000;
const GUST_SPEED = 260;
const GUST_WIDTH = 60;

// A blade: its lean from upright (degrees, positive to the right), height
// and width at its base, from where it stands in its tuft.
export type Blade = { dx: number; lean: number; height: number; width: number; tone: number };
// Something growing at x on the ledge: a tuft of grass, or a shoot's leaves
// with perhaps a bud. phase and period set its own sway; at is when it was
// last brushed and away which way it was pushed.
export type Plant = { key: string; kind: 'tuft' | 'shoot'; x: number; blades: Blade[]; bud: boolean; phase: number; period: number; at: number; away: 1 | -1 };
export type Meadow = Plant[];

const slots = (r: Run, spacing: number) => Array.from({ length: Math.max(0, Math.floor((r.hi - r.lo - 2 * MARGIN) / spacing)) }, (_, i) => i);
const slotX = (r: Run, spacing: number, i: number, seed: number) => r.lo + MARGIN + spacing * (i + 0.15 + 0.7 * hash(seed));

function tuft(key: string, x: number, seed: number): Plant {
  const count = 3 + Math.floor(hash(seed + 1) * 3);
  const blades = Array.from({ length: count }, (_, i): Blade => {
    const spread = count === 1 ? 0 : i / (count - 1) - 0.5;
    return { dx: spread * 2.4, lean: spread * 34 + (hash(seed + 7 * i + 2) - 0.5) * 10, height: 3 + 3 * hash(seed + 7 * i + 3), width: 1.1 + 0.4 * hash(seed + 7 * i + 4), tone: hash(seed + 7 * i + 5) };
  });
  return { key, kind: 'tuft', x, blades, bud: false, phase: hash(seed + 40), period: 3000 + 3000 * hash(seed + 41), at: -Infinity, away: 1 };
}

// Two or three spear leaves, a third of the shoots with a closed bud on a
// stalk standing between them.
function shoot(key: string, x: number, seed: number): Plant {
  const count = 2 + Math.floor(hash(seed + 1) * 2);
  const blades = Array.from({ length: count }, (_, i): Blade => {
    const spread = i / (count - 1) - 0.5;
    return { dx: spread * 2, lean: spread * 22 + (hash(seed + 5 * i + 2) - 0.5) * 6, height: 6 + 2.5 * hash(seed + 5 * i + 3), width: 1.9, tone: hash(seed + 5 * i + 4) };
  });
  return { key, kind: 'shoot', x, blades, bud: hash(seed + 30) < 0.34, phase: hash(seed + 40), period: 3000 + 3000 * hash(seed + 41), at: -Infinity, away: 1 };
}

// What grows on one ledge, before the page's caps.
export function meadowOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Meadow {
  const runs = clearRuns(f, obstacles, CLEAR, { inset: INSET });
  const shoots = runs.flatMap((r) => slots(r, SHOOT_SLOT).flatMap((i) => {
    const seed = id * 53 + Math.round(r.lo) * 7 + i * 11;
    return hash(seed) < 0.25 ? [shoot(`s${id}:${Math.round(r.lo)}:${i}`, slotX(r, SHOOT_SLOT, i, seed + 1), seed)] : [];
  }));
  const tufts = runs.flatMap((r) => slots(r, TUFT_SLOT).flatMap((i) => {
    const seed = id * 31 + Math.round(r.lo) * 3 + i * 5;
    const x = slotX(r, TUFT_SLOT, i, seed + 1);
    if (hash(seed) >= 0.67 || shoots.some((s) => Math.abs(s.x - x) < SHOOT_ROOM)) return [];
    return [tuft(`t${id}:${Math.round(r.lo)}:${i}`, x, seed)];
  }));
  return [...tufts, ...shoots].sort((a, b) => a.x - b.x);
}

// The grass on every ledge, keeping when each surviving plant was last
// brushed; capped at MAX_TUFTS tufts and MAX_SHOOTS shoots in all.
export function reconcileMeadows(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[], old: ReadonlyMap<number, Meadow> = new Map()): Map<number, Meadow> {
  const fresh = [...floors].map(([id, f]) => [id, keepByKey(old.get(id), meadowOn(id, f, obstacles), (before, p) => ({ ...p, at: before.at, away: before.away }))] as const);
  const kept = new Set([
    ...shareOut(fresh.map(([, m]) => m.filter((p) => p.kind === 'tuft')), MAX_TUFTS),
    ...shareOut(fresh.map(([, m]) => m.filter((p) => p.kind === 'shoot')), MAX_SHOOTS),
  ]);
  return new Map(fresh.map(([id, m]) => [id, m.filter((p) => kept.has(p))]));
}

// A soft pulse running along the page now and then: how much of it is at
// page x at now, 0 to 1.
function gustAt(pageX: number, now: number): number {
  const since = now % GUST_EVERY;
  const front = (since / 1000) * GUST_SPEED - GUST_WIDTH;
  return Math.exp(-(((pageX - front) / GUST_WIDTH) ** 2));
}

// How far a pushed plant still leans away, 1 just brushed to 0 recovered.
const spring = (since: number) => (since >= 0 && since < SPRING ? (1 - since / SPRING) ** 2 : 0);

// How far a plant at page x leans at now, in degrees (positive to the
// right): its own breeze, a passing gust, and any parting.
export function leanOf(p: Plant, pageX: number, now: number): number {
  const breeze = BREEZE * Math.sin((2 * Math.PI * now) / p.period + 2 * Math.PI * p.phase);
  const sway = breeze + GUST * gustAt(pageX, now);
  const parted = PART * p.away * spring(now - p.at);
  return (p.kind === 'shoot' ? STIFF : 1) * (sway + parted);
}

// A moving cursor brushing past parts the plants it passes close to,
// pushing each away from it, unless it is already springing back.
export function brush(meadows: ReadonlyMap<number, Meadow>, floors: ReadonlyMap<number, Ledge>, stroke: Segment): Map<number, Meadow> {
  return new Map([...meadows].map(([id, m]) => {
    const f = floors.get(id);
    if (!f) return [id, m];
    return [id, m.map((p) => {
      const at = { x: f.left + p.x, y: f.y - 3 };
      if (distance(at, stroke.from, stroke.to) >= BRUSH_REACH || stroke.at - p.at < SPRING) return p;
      const passing = (stroke.from.x + stroke.to.x) / 2;
      return { ...p, at: stroke.at, away: at.x < passing ? -1 : 1 };
    })];
  }));
}

// A blade as a filled path from its base, upright and then leaned: a
// tapering spear curving a little toward its tip.
export function bladePath(b: Blade): string {
  const a = (b.lean * Math.PI) / 180;
  const tip = { x: b.dx + b.height * Math.sin(a), y: -b.height * Math.cos(a) };
  const mid = { x: b.dx + 0.45 * b.height * Math.sin(a * 0.6), y: -0.55 * b.height };
  const w = b.width / 2;
  const f = (n: number) => n.toFixed(2);
  return `M${f(b.dx - w)} 0Q${f(mid.x - w * 0.6)} ${f(mid.y)} ${f(tip.x)} ${f(tip.y)}Q${f(mid.x + w * 0.6)} ${f(mid.y)} ${f(b.dx + w)} 0Z`;
}

// How tall a plant stands, upright: its tallest blade, or its bud.
export const BUD_TOP = 9;
export const heightOf = (p: Plant) => (p.bud ? BUD_TOP : Math.max(...p.blades.map((b) => b.height)));
