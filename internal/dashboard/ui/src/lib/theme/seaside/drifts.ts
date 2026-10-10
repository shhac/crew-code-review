import { shareOut } from '../decor';
import { clearRuns, type Ledge, type Obstacle, type Run } from '../floors';
import { hash } from '../seed';

// Low drifts of sand along the ledges, each a little dune blown up by the
// wind, and on some a shell washed up at its foot. Nothing moves: they are
// seeded per ledge id and in ledge-local x, so they stay put as the page
// scrolls and look the same under reduced motion.

// The tallest drift is 5px and a shell 5px, standing beside it rather than
// on it; the sand keeps to stretches where a pixel more is clear, so nothing
// is drawn over a heading's text.
const CLEAR = 6;
const INSET = 8;
const SLOT = 56;
// About this many slots get a drift.
const DRIFTS = 0.55;
const SHORTEST = 16;
const LONGEST = 44;
const LOWEST = 1.5;
const HIGHEST = 5;
// The crest stands this far along from the windward end: the windward slope
// long and gentle, the lee short and steep, as wind-blown sand lies.
const CREST = 2 / 3;
// Room kept at the lee end of a slot for a shell.
const SHELL_ROOM = 7;
const SHELLS = 0.25;
const MAX_GRAINS = 3;
// The page holds at most this many shells, so a long page costs no more.
export const MAX_SHELLS = 14;

export type ShellKind = 'cockle' | 'winkle';
// A shell standing on the ledge at x, size px across, facing dir.
export type Shell = { key: string; x: number; kind: ShellKind; size: number; dir: 1 | -1 };
// One drift: from lo to hi along the ledge, its crest at crest, height tall.
export type Drift = { lo: number; crest: number; hi: number; height: number; grains: { x: number; y: number }[] };
// One ledge's sand, ready to draw: the drifts' fill, their crests' lighter
// line, their darker grains, and the shells.
export type Beach = { drifts: Drift[]; sand: string; crest: string; grains: string; shells: Shell[] };

// Which way the wind blows along a ledge: every drift on it faces the same.
export const windOf = (id: number): 1 | -1 => (hash(id * 7 + 3) < 0.5 ? 1 : -1);

const slots = (r: Run) => Array.from({ length: Math.max(0, Math.floor((r.hi - r.lo) / SLOT)) }, (_, i) => i);

// The drift in slot i of run r, or none; with its shell, if it has one.
function driftIn(id: number, r: Run, i: number, wind: 1 | -1): { drift: Drift; shell: Shell | null } | null {
  const seed = id * 29 + Math.round(r.lo) * 5 + i * 13;
  if (hash(seed) >= DRIFTS) return null;
  const length = SHORTEST + (LONGEST - SHORTEST) * hash(seed + 1);
  const height = LOWEST + (HIGHEST - LOWEST) * hash(seed + 2);
  const start = r.lo + i * SLOT;
  // The lee end of the slot is kept free for a shell.
  const lo = start + (wind === 1 ? 0 : SHELL_ROOM) + (SLOT - SHELL_ROOM - length) * hash(seed + 3);
  const hi = lo + length;
  const crest = wind === 1 ? lo + CREST * length : hi - CREST * length;
  const drift = { lo, crest, hi, height, grains: grainsOf(lo, hi, crest, height, seed + 10) };
  if (hash(seed + 4) >= SHELLS) return { drift, shell: null };
  const size = 4 + hash(seed + 5);
  const foot = wind === 1 ? hi + size / 2 : lo - size / 2;
  const shell: Shell = { key: `${id}:${Math.round(r.lo)}:${i}`, x: foot, kind: hash(seed + 6) < 0.5 ? 'cockle' : 'winkle', size, dir: hash(seed + 7) < 0.5 ? 1 : -1 };
  return { drift, shell };
}

// How high the sand stands at x, on straight slopes up to the crest: a
// grain inside this is inside the curved drift too.
function heightAt(d: Pick<Drift, 'lo' | 'crest' | 'hi' | 'height'>, x: number): number {
  if (x <= d.lo || x >= d.hi) return 0;
  return d.height * (x < d.crest ? (x - d.lo) / (d.crest - d.lo) : (d.hi - x) / (d.hi - d.crest));
}

// A few darker grains, 1px each, set in the body of the drift.
function grainsOf(lo: number, hi: number, crest: number, height: number, seed: number) {
  if (height < 2.5) return [];
  const count = Math.floor(hash(seed) * (MAX_GRAINS + 1));
  return Array.from({ length: count }, (_, k) => {
    const x = lo + (hi - lo) * (0.2 + 0.6 * hash(seed + 3 * k + 1));
    const y = -heightAt({ lo, crest, hi, height }, x) * (0.25 + 0.35 * hash(seed + 3 * k + 2));
    return { x, y };
  }).filter((g) => g.y <= -1.2);
}

// The drifts and shells along one ledge, before the page's cap on shells.
export function beachOn(id: number, f: Ledge, obstacles: readonly Obstacle[]): Beach {
  const wind = windOf(id);
  const found = clearRuns(f, obstacles, CLEAR, { inset: INSET }).flatMap((r) => slots(r).flatMap((i) => driftIn(id, r, i, wind) ?? []));
  const drifts = found.map((d) => d.drift);
  return { drifts, ...pathsOf(drifts), shells: found.flatMap((d) => d.shell ?? []) };
}

const n = (v: number) => Number(v.toFixed(1));

// Each drift as one closed shape on the ledge's line: a long gentle rise
// that steepens to the crest, and a short steep fall from it.
export function driftPath(d: Drift): string {
  const up = d.crest - d.lo, down = d.hi - d.crest;
  return `M${n(d.lo)} 0C${n(d.lo + 0.45 * up)} 0 ${n(d.crest - 0.4 * up)} ${n(-d.height)} ${n(d.crest)} ${n(-d.height)}`
    + `C${n(d.crest + 0.3 * down)} ${n(-d.height)} ${n(d.hi - 0.35 * down)} 0 ${n(d.hi)} 0Z`;
}

// The lighter line along the top of the windward slope, where the sun
// catches the crest: the upper part of the rise, a little below its edge.
function crestLine(d: Drift): string {
  const from = d.crest + (d.lo - d.crest) * 0.45;
  return `M${n(from)} ${n(-heightAt(d, from) + 0.6)}Q${n((from + d.crest) / 2)} ${n(-d.height + 0.4)} ${n(d.crest)} ${n(-d.height + 0.6)}`;
}

function pathsOf(drifts: readonly Drift[]) {
  return {
    sand: drifts.map(driftPath).join(''),
    crest: drifts.filter((d) => d.height >= 2).map(crestLine).join(''),
    grains: drifts.flatMap((d) => d.grains).map((g) => `M${n(g.x)} ${n(g.y)}h1v1h-1Z`).join(''),
  };
}

// The sand on every ledge, with at most MAX_SHELLS shells on the page,
// shared out a ledge at a time so later cards are not left bare.
export function reconcileBeaches(floors: ReadonlyMap<number, Ledge>, obstacles: readonly Obstacle[]): Map<number, Beach> {
  const fresh = [...floors].map(([id, f]) => [id, beachOn(id, f, obstacles)] as const);
  const kept = shareOut(fresh.map(([, b]) => b.shells), MAX_SHELLS);
  return new Map(fresh.map(([id, b]) => [id, { ...b, shells: b.shells.filter((s) => kept.has(s)) }]));
}

// A shell's drawing, size px across, standing on its edge at 0 0. A cockle
// is a ribbed fan on its hinge, three ribs showing; a winkle a small
// spiralled cone lying on its side.
export function shellPaths(kind: ShellKind, size: number): { body: string; lines: string } {
  const s = size, h = s / 2;
  if (kind === 'cockle') {
    const top = -0.9 * s;
    return {
      body: `M${n(-0.12 * s)} 0L${n(-h)} ${n(-0.3 * s)}Q${n(-h)} ${n(top)} 0 ${n(top)}Q${n(h)} ${n(top)} ${n(h)} ${n(-0.3 * s)}L${n(0.12 * s)} 0Z`,
      lines: `M0 -0.4V${n(top + 0.6)}M${n(-0.06 * s)} -0.4L${n(-0.3 * s)} ${n(-0.72 * s)}M${n(0.06 * s)} -0.4L${n(0.3 * s)} ${n(-0.72 * s)}`,
    };
  }
  return {
    body: `M${n(-h)} 0Q${n(-h)} ${n(-0.75 * s)} ${n(0.05 * s)} ${n(-0.75 * s)}Q${n(h)} ${n(-0.72 * s)} ${n(h)} ${n(-0.3 * s)}L${n(0.2 * s)} 0Z`,
    lines: `M${n(0.25 * s)} ${n(-0.35 * s)}Q${n(0.05 * s)} ${n(-0.6 * s)} ${n(-0.15 * s)} ${n(-0.35 * s)}Q${n(-0.05 * s)} ${n(-0.15 * s)} ${n(0.1 * s)} ${n(-0.3 * s)}`,
  };
}
