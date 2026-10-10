import { shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { hash } from '../seed';

// Chalk court lines along the ledges: on each clear stretch a baseline with
// its centre mark, and at each end the corner where a sideline meets it and
// the doubles tramline just inside. Here and there the chalk is worn thin
// where play has scuffed the grass. Everything is seeded per ledge id and in ledge-local x, so
// the lines stay put as the page scrolls; nothing here moves but the chalk a
// bounce puffs up.

// The marks stand 4px up from the ledge, and the lines keep to stretches
// where that much is clear, so nothing is drawn over a heading's text.
export const MARK = 4;
const CLEAR = MARK;
// Kept inside a card's rounded corners (12px), where its top edge curves
// away from the ledge's line.
const INSET = 12;
// A stretch this long gets a baseline; this long, its centre mark too.
export const MIN_RUN = 60;
export const CENTRE_RUN = 120;
// The tramline is 1.37m in from a 10.97m doubles sideline: 12.5% of the
// court's width, here of the run, and never more than TRAM_MAX.
const TRAM = 1.37 / 10.97;
const TRAM_MAX = 18;
// The line is LINE thick, so a sideline at the very end of a run is drawn
// half that in, inside it.
export const LINE = 1.5;
// The page holds at most this many baselines and scuffs, so a long page costs
// no more.
export const MAX_BASELINES = 40;
export const MAX_SCUFFS = 40;
const SCUFF_SLOT = 50;
// A bounce puffs chalk when it lands this close to a mark.
export const PUFF_REACH = 3;

// A worn stretch of the line, x to x + width, its chalk faint.
export type Scuff = { key: string; x: number; width: number; tone: number };
// One baseline on a clear stretch, lo to hi, the x of each mark
// standing up from it (at most five), and its worn patches.
export type Baseline = { key: string; lo: number; hi: number; marks: readonly number[]; scuffs: readonly Scuff[] };
// Everything chalked on one ledge.
export type Lines = readonly Baseline[];

// The marks of a court on a baseline lo to hi: the two corners, the two
// tramlines and, on a long enough line, the centre mark.
export function marksOf(lo: number, hi: number): number[] {
  const tram = Math.min(TRAM_MAX, TRAM * (hi - lo));
  const ends = [lo + LINE / 2, lo + tram, hi - tram, hi - LINE / 2];
  return hi - lo >= CENTRE_RUN ? [ends[0], ends[1], (lo + hi) / 2, ends[2], ends[3]] : ends;
}

function baselineOn(id: number, r: Run): Baseline {
  const line = { key: `${id}:${Math.round(r.lo)}`, lo: r.lo, hi: r.hi, marks: marksOf(r.lo, r.hi) };
  return { ...line, scuffs: scuffsOn(id, line) };
}

function scuffsOn(id: number, c: Omit<Baseline, 'scuffs'>): Scuff[] {
  const slots = Math.floor((c.hi - c.lo) / SCUFF_SLOT);
  return Array.from({ length: slots }, (_, i) => i).flatMap((i) => {
    const seed = id * 29 + Math.round(c.lo) * 5 + i * 13;
    if (hash(seed) >= 0.45) return [];
    const width = 3 + 6 * hash(seed + 1);
    const x = c.lo + SCUFF_SLOT * i + (SCUFF_SLOT - width) * hash(seed + 2);
    // Kept clear of the marks, where a worn patch would read as a gap in them.
    if (c.marks.some((m) => m > x - 2 && m < x + width + 2)) return [];
    return [{ key: `${c.key}:${i}`, x, width, tone: hash(seed + 3) }];
  });
}

// What is chalked on one ledge, before the page's caps.
export function linesOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Lines {
  return clearRuns(f, obstacles, CLEAR, { inset: INSET }).filter((r) => r.hi - r.lo >= MIN_RUN).map((r) => baselineOn(id, r));
}

// The lines on every ledge, capped at MAX_BASELINES baselines and MAX_SCUFFS
// scuffs in all, shared out a ledge at a time.
export function chalkLines(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[]): Map<number, Lines> {
  const fresh = [...floors].map(([id, f]) => [id, linesOn(id, f, obstacles)] as const);
  const shown = shareOut(fresh.map(([, l]) => l), MAX_BASELINES);
  const kept = fresh.map(([id, l]) => [id, l.filter((c) => shown.has(c))] as const);
  const scuffs = shareOut(kept.map(([, l]) => l.flatMap((c) => c.scuffs)), MAX_SCUFFS);
  return new Map(kept.map(([id, l]) => [id, l.map((c) => ({ ...c, scuffs: c.scuffs.filter((s) => scuffs.has(s)) }))]));
}

const f2 = (n: number) => Number(n.toFixed(2));

// The baseline sits on the ledge: stroked LINE wide along its middle.
const BASE = -LINE / 2;

// One ledge's chalk as a single stroked path: each baseline along the
// ledge, broken where it is worn, and each mark standing MARK up from it.
export function linesPath(l: Lines): string {
  return l.map((c) => {
    const worn = [...c.scuffs].sort((a, b) => a.x - b.x);
    const ends = [c.lo, ...worn.flatMap((s) => [s.x, s.x + s.width]), c.hi];
    const runs = Array.from({ length: ends.length / 2 }, (_, i) => `M${f2(ends[2 * i])} ${BASE}H${f2(ends[2 * i + 1])}`);
    return runs.join('') + c.marks.map((m) => `M${f2(m)} ${BASE}V${-MARK}`).join('');
  }).join('');
}

// The worn stretches, drawn faint where the baseline breaks.
export const wornOf = (l: Lines): Scuff[] => l.flatMap((c) => c.scuffs);
export const wornPath = (s: Scuff) => `M${f2(s.x)} ${BASE}H${f2(s.x + s.width)}`;

// The mark nearest ledge-local x, if one is within PUFF_REACH.
export function markNear(l: Lines, x: number): number | undefined {
  const marks = l.flatMap((c) => c.marks);
  const near = marks.filter((m) => Math.abs(m - x) <= PUFF_REACH);
  return near.sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
}

// A little chalk a bounce kicks up from a mark: a few specks rising and
// spreading, fading over PUFF ms. x is ledge-local, at is when it landed.
export const PUFF = 400;
export const PUFF_RISE = 5;
const SPREAD = 4;
export type Puff = { key: string; x: number; at: number; count: number; seed: number };
export type Speck = { x: number; y: number; r: number; opacity: number };

export const puffAt = (key: string, x: number, at: number): Puff => ({ key, x, at, count: 4 + (hash(at) < 0.5 ? 0 : 1), seed: Math.round(at) });

// The specks of a puff at now, ledge-local (y up is negative); none once it
// has faded, or before it starts.
export function specksOf(p: Puff, now: number): Speck[] {
  const t = (now - p.at) / PUFF;
  if (t < 0 || t >= 1) return [];
  const out = 1 - (1 - t) ** 2;
  return Array.from({ length: p.count }, (_, i) => {
    const side = (i / (p.count - 1) - 0.5) * 2;
    const lean = side + 0.4 * (hash(p.seed + i) - 0.5);
    return {
      x: p.x + SPREAD * lean * out,
      y: -LINE - (PUFF_RISE - LINE) * out * (0.6 + 0.4 * hash(p.seed + i + 9)),
      r: 0.5 + 0.3 * hash(p.seed + i + 17),
      opacity: 0.8 * (1 - t),
    };
  });
}

// The puffs still showing at now.
export const livePuffs = (puffs: readonly Puff[], now: number) => puffs.filter((p) => now - p.at < PUFF);
