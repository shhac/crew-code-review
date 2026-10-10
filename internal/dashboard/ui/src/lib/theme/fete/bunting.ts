import { clamp, rad } from '../math';
import { distance, type Point, type Segment } from '../pointer';
import { hash } from '../seed';

// Bunting strung across the gaps between ledges: festooned in shallow swags
// under a page heading's rule, and one short swag across each gutter between
// two cards side by side. It hangs only inside a gap's free space, its whole
// swept footprint (the tape at its lowest and widest, every pennant at its
// widest swing) with 2px to spare, so it never covers content. Swags hang
// on a catenary, sway in two damped modes, their pennants swing as small
// pendulums and flutter in a slow breeze; a cursor brushing one kicks it.
// Everything is in viewport coordinates, like the gaps it hangs in, and
// worked out from time and the last kick alone, so it follows every
// remeasure. design-docs/fete/README.md has the contract.

// What bunting needs of a gap (gaps.ts's Gap): its stable id, its kind, its
// two ends (from on the left) and the height anything hung in it starts at.
export type Hanging = { id: string; kind: 'side' | 'under'; from: Point; to: Point; top: number };
// How far below the gap's top the stretch x0..x1 (viewport x) is free of
// content (gaps.ts's gapDepth for this gap).
export type Depth = (x0: number, x1: number) => number;

// The cotton prints: pillar-box red, cream, cornflower, buttercup, sweet pea
// and sage, each with the darker edge that lets it read on a card and on
// the page alike.
export const COLOURS = ['#d9473f', '#f4ecd8', '#5f8fd6', '#f2c94c', '#f39ac0', '#8cc49a'] as const;
export const EDGES = ['#9e2d27', '#b9ab88', '#3d649f', '#b8902a', '#b8668b', '#5b8e68'] as const;
export const TAPE = '#efe6d0';

// A pennant: 5px along the tape, 7px deep.
export const WIDE = 5;
export const DEEP = 7;
// Pennants this far apart along a festoon, and kept this far from its pins.
const PITCH = 7;
const PIN_CLEAR = 4;
// Festoons start this far in from the gap's ends, pinned this far under the
// rule, each swag about SWAG wide and sagging FESTOON_SAG.
const END_IN = 4;
const PIN_DROP = 1;
const SWAG = 64;
const MIN_SWAG = 40;
const FESTOON_SAG = 4;
// A side swag's pennants keep this far from its ends.
const SIDE_MARGIN = 2;
// Room left free below everything a string can reach.
export const SPARE = 2;
// How far the tape may move, and a pennant swing, each way.
export const TAPE_CAP = { festoon: 1.5, side: 2 } as const;
export const SWING_CAP = { festoon: 22, side: 12 } as const;
// The breeze's flutter in the page's plane, and toward and away from the
// viewer, in degrees at the height of a gust.
export const BREEZE = 3;
const FLUTTER = 30;
// The page holds at most this many.
export const MAX_STRINGS = 32;
export const MAX_PENNANTS = 200;
// A cursor this near a tape, or through a pennant, kicks its swag; faster
// than CAP_SPEED counts as CAP_SPEED.
const BRUSH = 3;
const CAP_SPEED = 900;
// How far along a swag a kick still swings a pennant.
const KICK_REACH = 24;
// A festoon's swags share a tape: each passes on this much of a kick.
const PASS_ON = 0.4;

// Frequencies (Hz) and the damping that halves a swing every 0.6s: a
// shallow cable's first mode and its rocking mode at twice it, and a
// pennant hinged along its top edge (see the note's Research).
const SAG_HZ = 1.2;
const ROCK_HZ = 2.5;
const SWING_HZ = 1.6;
const DECAY = Math.LN2 / 600;

export type Pennant = { x: number; colour: number; phase: number; rate: number };
export type Swag = {
  id: string;
  gap: string;
  index: number;
  festoon: boolean;
  a: Point;
  b: Point;
  sag: number;
  pennants: readonly Pennant[];
};

// One damped mode, from the state it had at `at`: its offset and speed
// (per ms), worked out at any later moment in closed form.
export type Spring = { x: number; v: number; at: number };
export const REST: Spring = { x: 0, v: 0, at: 0 };
type Mode = { omega: number };
const SAG: Mode = { omega: (2 * Math.PI * SAG_HZ) / 1000 };
const ROCK: Mode = { omega: (2 * Math.PI * ROCK_HZ) / 1000 };
const SWING: Mode = { omega: (2 * Math.PI * SWING_HZ) / 1000 };
const damped = (m: Mode) => Math.sqrt(Math.max(1e-12, m.omega * m.omega - DECAY * DECAY));

export function springAt(s: Spring, m: Mode, now: number): { x: number; v: number } {
  const t = Math.max(0, now - s.at);
  const w = damped(m);
  const e = Math.exp(-DECAY * t);
  const b = (s.v + DECAY * s.x) / w;
  const c = Math.cos(w * t), sn = Math.sin(w * t);
  return { x: e * (s.x * c + b * sn), v: e * (-DECAY * (s.x * c + b * sn) + (-s.x * w * sn + b * w * c)) };
}

// The most a spring can still reach either way: its envelope now.
const reachOf = (x: number, v: number, m: Mode) => Math.hypot(x, (v + DECAY * x) / damped(m));

// A swag's motion: its two tape modes and each pennant's swing (degrees).
export type Swing = { sag: Spring; rock: Spring; pennants: readonly Spring[] };
const still = (s: Swag): Swing => ({ sag: REST, rock: REST, pennants: s.pennants.map(() => REST) });

// A seed from a string's id, so its colours and flutter stay put.
export function seedOf(id: string): number {
  const n = [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return n % 100003;
}

// The curve a tape hangs in between a and b, its middle `sag` below the
// middle of the line between them: a catenary, solved for its parameter
// so it passes through both ends; between ends at different heights its
// lowest point moves toward the lower end. Returns y (down the page) for x.
export function catenary(a: Point, b: Point, sag: number): (x: number) => number {
  const span = b.x - a.x;
  const chord = (x: number) => a.y + ((b.y - a.y) * (x - a.x)) / (span || 1);
  if (sag <= 0 || span <= 0) return chord;
  const through = (c: number) => {
    const p = Math.asinh(-(b.y - a.y) / (2 * c * Math.sinh(span / (2 * c))));
    const m = (a.x + b.x) / 2 - c * p;
    const lowest = a.y + c * (Math.cosh((a.x - m) / c) - 1);
    return (x: number) => lowest - c * (Math.cosh((x - m) / c) - 1);
  };
  const sagOf = (c: number) => through(c)((a.x + b.x) / 2) - (a.y + b.y) / 2;
  // The sag shrinks as the parameter grows; halve the bracket in log terms.
  const solve = (lo: number, hi: number, n: number): number => {
    if (n === 0) return Math.sqrt(lo * hi);
    const mid = Math.sqrt(lo * hi);
    return sagOf(mid) > sag ? solve(mid, hi, n - 1) : solve(lo, mid, n - 1);
  };
  return through(solve(span / 40, span * 1e5, 80));
}

// A swag's curve, solved once per swag: drawing it each frame needs it
// again and again.
const curves = new WeakMap<Swag, (x: number) => number>();
function curveOf(s: Swag): (x: number) => number {
  const known = curves.get(s);
  if (known) return known;
  const curve = catenary(s.a, s.b, s.sag);
  curves.set(s, curve);
  return curve;
}

const palette = (seed: number) => Math.floor(hash(seed) * COLOURS.length) % COLOURS.length;
function pennantsAt(xs: readonly number[], seed: number): Pennant[] {
  const start = palette(seed);
  return xs.map((x, k) => ({ x, colour: (start + k) % COLOURS.length, phase: hash(seed + 31 * k + 7), rate: 1.3 + 0.7 * hash(seed + 31 * k + 11) }));
}

// The festoon under a heading's rule: the gap's length, END_IN in from each
// end, divided evenly into swags of about SWAG, each pinned PIN_DROP under
// the rule; a swag hangs only where its deepest reach fits, and the swags
// either side of a blocked one stay. Numbered from the left end, so a
// blocked swag never renumbers the rest.
function festoon(g: Hanging, depth: Depth): Swag[] {
  const left = g.from.x + END_IN, inner = g.to.x - END_IN - left;
  if (inner < MIN_SWAG) return [];
  const count = Math.max(1, Math.round(inner / SWAG));
  const wide = inner / count;
  const y = g.top + PIN_DROP;
  return Array.from({ length: count }, (_, index): Swag | null => {
    const x0 = left + index * wide, x1 = x0 + wide;
    const room = x1 - x0 - 2 * PIN_CLEAR - WIDE;
    const n = Math.floor(room / PITCH) + 1;
    const first = (x0 + x1) / 2 - ((n - 1) * PITCH) / 2;
    const id = `${g.id}#${index}`;
    const swag = { id, gap: g.id, index, festoon: true, a: { x: x0, y }, b: { x: x1, y }, sag: FESTOON_SAG, pennants: pennantsAt(Array.from({ length: n }, (_, k) => first + k * PITCH), seedOf(id)) };
    return fits(swag, g, depth) ? swag : null;
  }).filter((s): s is Swag => s !== null);
}

// Across a side gap: one swag tied at the two ends, sagging a quarter of
// its span, with as many pennants as fit evenly between 2px margins.
function across(g: Hanging, depth: Depth): Swag[] {
  const span = g.to.x - g.from.x;
  const n = Math.floor((span - 3) / 6);
  if (n < 1) return [];
  const id = `${g.id}#0`;
  const room = span - 2 * SIDE_MARGIN;
  const between = (room - n * WIDE) / (n + 1);
  const xs = Array.from({ length: n }, (_, k) => g.from.x + SIDE_MARGIN + between * (k + 1) + WIDE * (k + 0.5));
  const swag = { id, gap: g.id, index: 0, festoon: false, a: g.from, b: g.to, sag: span / 4, pennants: pennantsAt(xs, seedOf(id)) };
  return fits(swag, g, depth) ? [swag] : [];
}

const capOf = (s: Pick<Swag, 'festoon'>) => (s.festoon ? 'festoon' : 'side');

// The box a swag can ever reach, at its lowest sag and widest swing.
export function reach(s: Swag): { left: number; right: number; top: number; bottom: number } {
  const curve = curveOf(s);
  const swing = Math.sin(rad(SWING_CAP[capOf(s)]));
  // The two modes vanish at the ends, so the tape moves least there.
  const moved = (x: number) => TAPE_CAP[capOf(s)] * shapeAt(s, x);
  const lows = s.pennants.map((p) => Math.max(...[p.x - WIDE / 2, p.x + WIDE / 2].map((x) => curve(x) + moved(x))));
  const tape = xsAlong(s);
  const sides = s.pennants.flatMap((p) => [p.x - Math.max(WIDE / 2, DEEP * swing), p.x + Math.max(WIDE / 2, DEEP * swing)]);
  return {
    left: Math.min(s.a.x, ...sides),
    right: Math.max(s.b.x, ...sides),
    top: Math.min(s.a.y, s.b.y, ...tape.map((x) => curve(x) - moved(x))),
    bottom: Math.max(...tape.map((x) => curve(x) + moved(x)), ...lows.map((y) => y + DEEP)),
  };
}

// Whether all of a swag's reach fits the gap's free space with SPARE to
// spare: below its top, inside its columns, above the depth found there.
function fits(s: Swag, g: Hanging, depth: Depth): boolean {
  const r = reach(s);
  if (r.left < g.from.x || r.right > g.to.x || r.top < g.top) return false;
  return r.bottom + SPARE <= g.top + depth(r.left, r.right);
}

// How much of the tape's movement reaches x: the larger of the two modes'
// shapes there, since the two together never pass the cap.
function shapeAt(s: Pick<Swag, 'a' | 'b'>, x: number): number {
  const t = clamp((x - s.a.x) / (s.b.x - s.a.x || 1), 0, 1);
  return Math.max(Math.sin(Math.PI * t), Math.abs(Math.sin(2 * Math.PI * t)));
}

const xsAlong = (s: Pick<Swag, 'a' | 'b'>) => {
  const n = Math.max(2, Math.ceil((s.b.x - s.a.x) / 2));
  return Array.from({ length: n + 1 }, (_, i) => s.a.x + ((s.b.x - s.a.x) * i) / n);
};

// Every string the gaps hold, in gap order, up to the page's caps.
export function hangAll(gaps: readonly { gap: Hanging; depth: Depth }[]): Swag[] {
  const all = gaps.flatMap(({ gap, depth }) => (gap.kind === 'under' ? festoon(gap, depth) : across(gap, depth)));
  return all.reduce<{ kept: Swag[]; pennants: number }>((acc, s) => {
    if (acc.kept.length >= MAX_STRINGS || acc.pennants + s.pennants.length > MAX_PENNANTS) return acc;
    return { kept: [...acc.kept, s], pennants: acc.pennants + s.pennants.length };
  }, { kept: [], pennants: 0 }).kept;
}

// The swings kept by string id across a remeasure, so a scroll mid-swing
// carries on; a string whose id has gone is dropped, and one whose pennants
// changed starts its pennants still.
export function keepSwings(swags: readonly Swag[], old: ReadonlyMap<string, Swing>): Map<string, Swing> {
  return new Map(swags.flatMap((s) => {
    const before = old.get(s.id);
    if (!before) return [];
    const kept = before.pennants.length === s.pennants.length ? before : { ...before, pennants: still(s).pennants };
    return [[s.id, kept] as const];
  }));
}

// A slow gust, 0 to 1, rising and falling over 9 to 13 seconds: a sine whose
// pace itself wanders, so the breeze never repeats in step.
export function gust(now: number): number {
  const phase = (2 * Math.PI * now) / 11000 + 3.3 * Math.sin((2 * Math.PI * now) / 37000);
  return 0.5 - 0.5 * Math.cos(phase);
}

// What to draw: the tape as a line of points, and each pennant as its two
// top corners and its tip, with its colour.
export type Drawn = { id: string; tape: Point[]; pennants: { points: [Point, Point, Point]; colour: number }[] };

export function drawSwag(s: Swag, swing: Swing | undefined, now: number, reduced: boolean): Drawn {
  const curve = curveOf(s);
  const motion = reduced || !swing ? null : swing;
  const sag = motion ? springAt(motion.sag, SAG, now).x : 0;
  const rock = motion ? springAt(motion.rock, ROCK, now).x : 0;
  const cap = TAPE_CAP[capOf(s)];
  const scale = Math.abs(sag) + Math.abs(rock) > cap ? cap / (Math.abs(sag) + Math.abs(rock)) : 1;
  const span = s.b.x - s.a.x || 1;
  const tapeAt = (x: number) => {
    const t = clamp((x - s.a.x) / span, 0, 1);
    return curve(x) + scale * (sag * Math.sin(Math.PI * t) + rock * Math.sin(2 * Math.PI * t));
  };
  const breeze = reduced ? 0 : 0.35 + 0.65 * gust(now);
  const limit = SWING_CAP[capOf(s)];
  const pennants = s.pennants.map((p, k) => {
    const left = { x: p.x - WIDE / 2, y: tapeAt(p.x - WIDE / 2) };
    const right = { x: p.x + WIDE / 2, y: tapeAt(p.x + WIDE / 2) };
    const swung = motion ? springAt(motion.pennants[k] ?? REST, SWING, now).x : 0;
    const wave = 2 * Math.PI * (p.rate * now / 1000 + p.phase);
    const angle = clamp(swung + BREEZE * breeze * Math.sin(wave), -limit, limit);
    const toward = reduced ? 0 : FLUTTER * breeze * Math.sin(wave * 0.77 + 1.3);
    const length = DEEP * Math.cos(rad(toward));
    const tip = { x: p.x + length * Math.sin(rad(angle)), y: (left.y + right.y) / 2 + length * Math.cos(rad(angle)) };
    return { points: [left, right, tip] satisfies [Point, Point, Point], colour: p.colour };
  });
  return { id: s.id, tape: xsAlong(s).map((x) => ({ x, y: tapeAt(x) })), pennants };
}

// A moving cursor passing within BRUSH of a tape, or through a pennant,
// kicks that swag: its speed down the page into the sag mode, its speed
// across into the rocking mode and the pennants' swing, scaled by the speed
// and by how near each pennant is to the crossing. A festoon's swags either
// side get PASS_ON of the kick. speed is the stroke's, in px/s.
export function brush(swags: readonly Swag[], swings: ReadonlyMap<string, Swing>, stroke: Segment, speed: number, now: number = stroke.at): Map<string, Swing> {
  const length = Math.hypot(stroke.to.x - stroke.from.x, stroke.to.y - stroke.from.y);
  if (length === 0) return new Map(swings);
  const pace = Math.min(speed, CAP_SPEED) / CAP_SPEED;
  const across = (pace * (stroke.to.x - stroke.from.x)) / length;
  const down = (pace * (stroke.to.y - stroke.from.y)) / length;
  const out = new Map(swings);
  const kicked = swags.flatMap((s) => {
    const crossing = crossingOf(s, swings.get(s.id), stroke, now);
    return crossing === null ? [] : [{ s, x: crossing }];
  });
  const kick = (s: Swag, x: number | null, share: number) => {
    const before = out.get(s.id) ?? still(s);
    out.set(s.id, kickSwing(s, before, x, across * share, down * share, now));
  };
  kicked.forEach(({ s, x }) => kick(s, x, 1));
  kicked.filter(({ s }) => s.festoon).forEach(({ s }) => {
    swags.filter((o) => o.festoon && o.gap === s.gap && Math.abs(o.index - s.index) === 1 && !kicked.some((k) => k.s === o)).forEach((o) => kick(o, null, PASS_ON));
  });
  return out;
}

// Where along the swag (x) a stroke crosses it, or null if it misses.
function crossingOf(s: Swag, swing: Swing | undefined, stroke: Segment, now: number): number | null {
  const drawn = drawSwag(s, swing, now, false);
  const near = drawn.tape.filter((p) => distance(p, stroke.from, stroke.to) < BRUSH);
  if (near.length) return near.reduce((sum, p) => sum + p.x, 0) / near.length;
  const through = drawn.pennants.find(({ points }) => {
    const mid = { x: (points[0].x + points[1].x + points[2].x) / 3, y: (points[0].y + points[1].y + points[2].y) / 3 };
    return distance(mid, stroke.from, stroke.to) < 2;
  });
  return through ? (through.points[0].x + through.points[1].x) / 2 : null;
}

// One kick, at x along the swag (or spread evenly for a passed-on one);
// across and down are the stroke's direction scaled by its speed, 0 to 1.
function kickSwing(s: Swag, before: Swing, x: number | null, across: number, down: number, now: number): Swing {
  const cap = TAPE_CAP[capOf(s)];
  const limit = SWING_CAP[capOf(s)] - BREEZE;
  const t = x === null ? 0.5 : clamp((x - s.a.x) / (s.b.x - s.a.x || 1), 0, 1);
  const sag = springAt(before.sag, SAG, now), rock = springAt(before.rock, ROCK, now);
  const sagV = sag.v + down * cap * SAG.omega * (x === null ? 1 : Math.sin(Math.PI * t));
  const rockV = rock.v + across * cap * ROCK.omega * (x === null ? 1 : Math.sin(2 * Math.PI * t));
  // Kept so the two together can never take the tape past its cap.
  const total = reachOf(sag.x, sagV, SAG) + reachOf(rock.x, rockV, ROCK);
  const k = total > cap ? cap / total : 1;
  const pennants = s.pennants.map((p, i) => {
    const state = springAt(before.pennants[i] ?? REST, SWING, now);
    const near = x === null ? 0.5 : Math.max(0, 1 - Math.abs(p.x - x) / KICK_REACH);
    const v = state.v + across * limit * SWING.omega * near;
    const r = reachOf(state.x, v, SWING);
    const j = r > limit ? limit / r : 1;
    return { x: state.x * j, v: v * j, at: now };
  });
  return { sag: { x: sag.x * k, v: sagV * k, at: now }, rock: { x: rock.x * k, v: rockV * k, at: now }, pennants };
}
