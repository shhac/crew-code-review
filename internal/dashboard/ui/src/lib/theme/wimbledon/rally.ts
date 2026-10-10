import type { Box, Obstacle, PageMap } from '../floors';
import { clearance, inView, type Ledge, type Run } from '../floors';
import type { Claim } from '../ledges';
import { clamp01, degrees } from '../math';
import { distance, type Point, type Segment } from '../pointer';
import { between, type Rand } from '../seed';
import { meets, union } from '../air';
import { parabola, samples } from '../curves';

// Now and then a ball rallies between two cards side by side: it bounces on
// each card's top, the gap between them the net, and a cursor hovering in
// its path volleys it back. Everything is in court-local coordinates, from
// the left card's top left corner, so the ball rides with the cards as the
// page scrolls. Every shot is planned whole before it is played and played
// only if the ball's whole box, swept along it, stays in air.
// design-docs/wimbledon/README.md ("The rally") has the mode table.

// Two cards side by side, by ledge id: the left one's right end and the
// right one's left end are the net. The surfaces kit finds them.
export type CourtPair = { left: number; right: number };

// The ball is BALL across (a tennis ball at the birds' scale); a shot
// leaves from the top of its hop, HOP up.
export const BALL = 6;
const R = BALL / 2;
export const HOP = 6;
// The highest a shot rises (its bottom, above the ledges) is between these;
// a court with less room than MIN_APEX has no rally.
export const MIN_APEX = 12;
export const MAX_APEX = 20;
// Kept this far below what is above it, and this far over the net.
const SPARE = 2;
export const NET_CLEAR = 4;
// A ball may rise into the empty bottom edge of a card above it, as the
// animals may, never into its content.
const REACH = 6;
// Bounce spots lie this far from the net, and never nearer a card's end
// than its rounded corner.
export const SPOT_NEAR = 40;
export const SPOT_FAR = 140;
const CORNER = 12;
// Across the court at SPEED px/s; a volley 1.4 times as fast and flat.
export const SPEED = 320;
export const VOLLEY = 1.4;
const VOLLEY_RISE = 2;
// The bounce: squashed two frames, then a low hop on HOP_ON px, HOP high,
// to the top of which the next shot is struck.
export const SQUASH = 33;
export const HOP_MS = 120;
export const HOP_ON = 10;
// A rally is this many shots, and ends out or in the net about evenly.
export const SHOTS = [4, 9] as const;
// When one starts: first after 15 to 30s, then 40 to 90s apart.
export const FIRST = [15000, 30000] as const;
export const AGAIN = [40000, 90000] as const;
// The serve fades in; the end fades out.
export const FADE_IN = 150;
export const FADE_OUT = 500;
// Into the net: down this far below the ledges.
export const NET_DROP = 10;
// A cursor this close to the ball's middle (its radius and 6px) volleys it.
export const VOLLEY_REACH = R + 6;
// Out: two lower bounces and a roll, which the deep spot leaves room for.
const OUT_HOPS = [{ on: 14, high: 4, ms: 200 }, { on: 8, high: 2, ms: 140 }] as const;
const ROLL = 12;
const OUT_ROOM = OUT_HOPS.reduce((sum, h) => sum + h.on, 0) + ROLL + 4;
// Spots tried before a shot gives up.
const TRIES = 8;

// A piece of the ball's way, its bottom point going from `from` to `to`
// over ms from start, lifted by a parabola peaking `rise` above the
// straight line; `fade` 1 fades it in, -1 out.
export type Seg = {
  kind: 'shot' | 'squash' | 'hop' | 'fall' | 'roll' | 'drop';
  from: Point; to: Point; rise: number; start: number; ms: number;
  fade?: 1 | -1;
};
// A ball in play: the segments of its current exchange (a shot, the bounce
// and the hop to be struck from), which side it is going to (0 left, 1
// right), how many shots are left, how it ends, and whether this shot may
// still be volleyed.
export type Play = {
  court: CourtPair;
  segs: readonly Seg[];
  to: 0 | 1;
  left: number;
  ending: 'out' | 'net';
  volleyable: boolean;
  // The last segments, once the rally is ending.
  over: boolean;
};
export type Rally = { next: number; play: Play | null };

// What the ball shows at a moment, on the page: its middle, how far it has
// spun (degrees), how squashed it is (1 round), and how faded.
export type Ball = { x: number; y: number; spin: number; squash: number; opacity: number };

// The court as measured now: where its left card's top left is on the page,
// the right card's offset from it, the net between, and where bounce spots
// may go on each side (court-local).
export type Table = { origin: Point; right: number; dy: number; net: Run; sides: readonly [Run, Run]; ends: readonly [number, number] };

export function tableOf(court: CourtPair, page: PageMap): Table | null {
  const a = page.floors.get(court.left), b = page.floors.get(court.right);
  if (!a || !b || b.left <= a.right) return null;
  const net = { lo: a.right - a.left, hi: b.left - a.left };
  const ends = [CORNER, b.right - a.left - CORNER] as const;
  const sides = [
    { lo: Math.max(ends[0], net.lo - SPOT_FAR), hi: net.lo - SPOT_NEAR },
    { lo: net.hi + SPOT_NEAR, hi: Math.min(ends[1], net.hi + SPOT_FAR) },
  ] as const;
  return { origin: { x: a.left, y: a.y }, right: net.hi, dy: b.y - a.y, net, sides, ends };
}

const ledgesOf = (court: CourtPair, page: PageMap): [Ledge, Ledge] | null => {
  const a = page.floors.get(court.left), b = page.floors.get(court.right);
  return a && b ? [a, b] : null;
};

// The tallest a shot over x0..x1 (court-local) may rise, its bottom above
// the ledges: what is clear over the span on both cards, less the ball and
// a little spare.
export function roomOver(court: CourtPair, page: PageMap, x0: number, x1: number): number {
  const both = ledgesOf(court, page);
  if (!both) return -Infinity;
  const [a, b] = both;
  const lo = Math.min(x0, x1) - R, hi = Math.max(x0, x1) + R;
  const shift = b.left - a.left;
  return Math.min(clearance(a, page.obstacles, lo, hi, REACH), clearance(b, page.obstacles, lo - shift, hi - shift, REACH)) - BALL - SPARE;
}

// The ledge's line under side s (its bottom point there, court-local y).
const groundOf = (t: Table, s: 0 | 1) => (s === 0 ? 0 : t.dy);
const sideAt = (t: Table, x: number): 0 | 1 => (x < (t.net.lo + t.net.hi) / 2 ? 0 : 1);

// Where a segment has the ball's bottom at f (0 to 1 of its time).
export const pointOf = (s: Seg, f: number): Point => parabola(s.from, s.to, s.rise, clamp01(f));

// The rise that makes a shot from `from` to `to` peak `apex` above the
// ledge (its bottom at -apex): solved from the parabola's lowest point.
export function riseFor(from: Point, to: Point, apex: number): number {
  const d = to.y - from.y;
  const k = from.y + apex;
  if (k <= 0) return 0;
  const b = 8 * d + 16 * k;
  return (b + Math.sqrt(Math.max(0, b * b - 64 * d * d))) / 32;
}

const ballBox = (bottom: Point, squash = 1): Box => {
  const w = R * (2 - squash);
  return { left: bottom.x - w, right: bottom.x + w, top: bottom.y - BALL * squash, bottom: bottom.y };
};
const onPage = (b: Box, o: Point): Box => ({ left: b.left + o.x, right: b.right + o.x, top: b.top + o.y, bottom: b.bottom + o.y });

// Whether the ball's box at each of these bottom points, and between each
// pair, stays in air: in view, clear of text, controls and charts by
// SPARE, and of a card above it except its empty bottom edge.
export function clearAlong(points: readonly Point[], t: Table, page: PageMap, squash = 1): boolean {
  const boxes = points.map((p) => onPage(ballBox(p, squash), t.origin));
  const all = boxes.reduce(union);
  if (all.left < 0 || all.right > page.width || all.top < 0 || all.bottom > page.height) return false;
  const near = page.obstacles.filter((o) => meets(all, grown(o)));
  const hits = (b: Box) => near.some((o) => meets(b, grown(o)));
  return boxes.length === 1 ? !hits(boxes[0]) : boxes.slice(1).every((b, i) => !hits(union(boxes[i], b)));
}
// Content is kept SPARE away; a card only from its content, so the ball may
// touch its top (it bounces there) and rise into its empty bottom edge.
const grown = (o: Obstacle): Box => (o.block
  ? { left: o.left, right: o.right, top: o.top, bottom: o.bottom - REACH }
  : { left: o.left - SPARE, right: o.right + SPARE, top: o.top - SPARE, bottom: o.bottom + SPARE });

export const segPoints = (s: Seg): Point[] => samples((f) => pointOf(s, f), 2).map((p) => p.p);
const segClear = (s: Seg, t: Table, page: PageMap) => clearAlong(segPoints(s), t, page, s.kind === 'squash' ? SQUASH_SHAPE : 1);
const SQUASH_SHAPE = 0.7;

// A shot from `from` to a bounce at x on side s, starting at start, then
// its bounce and the hop it is struck from; null when it would not be clear.
function exchange(t: Table, page: PageMap, court: CourtPair, from: Point, s: 0 | 1, x: number, start: number, apex: number, speed: number, fade?: 1): Seg[] | null {
  const to = { x, y: groundOf(t, s) };
  const room = roomOver(court, page, from.x, x);
  const top = Math.min(apex, room);
  if (top < -from.y || top < NET_CLEAR) return null;
  const rise = speed === SPEED ? riseFor(from, to, top) : VOLLEY_RISE;
  const shot: Seg = { kind: 'shot', from, to, rise, start, ms: (1000 * Math.abs(x - from.x)) / speed, ...(fade ? { fade } : {}) };
  if (!overNet(shot, t)) return null;
  const on = s === 0 ? -HOP_ON : HOP_ON;
  const squash: Seg = { kind: 'squash', from: to, to, rise: 0, start: shot.start + shot.ms, ms: SQUASH };
  const hop: Seg = { kind: 'hop', from: to, to: { x: x + on, y: to.y - HOP }, rise: HOP / 2, start: squash.start + SQUASH, ms: HOP_MS };
  const segs = [shot, squash, hop];
  return segs.every((g) => segClear(g, t, page)) ? segs : null;
}

// Whether a shot is NET_CLEAR above the ledges all the way over the net.
function overNet(s: Seg, t: Table): boolean {
  return segPoints(s).every((p) => p.x < t.net.lo - R || p.x > t.net.hi + R || p.y <= -NET_CLEAR);
}

// A shot to a bounce somewhere on side s: spots tried at random, the first
// clear one played.
function shotTo(t: Table, page: PageMap, court: CourtPair, from: Point, s: 0 | 1, start: number, rand: Rand, speed = SPEED, fade?: 1): Seg[] | null {
  const side = t.sides[s];
  if (side.hi < side.lo) return null;
  return Array.from({ length: TRIES }).reduce<Seg[] | null>((found) => found ?? exchange(t, page, court, from, s, between(rand, side.lo, side.hi), start, between(rand, MIN_APEX, MAX_APEX), speed, fade), null);
}

const endOf = (segs: readonly Seg[]) => {
  const last = segs[segs.length - 1];
  return last.start + last.ms;
};

export const createRally = (now: number, rand: Rand): Rally => ({ next: now + between(rand, FIRST[0], FIRST[1]), play: null });
const rest = (now: number, rand: Rand): Rally => ({ next: now + between(rand, AGAIN[0], AGAIN[1]), play: null });

// A serve on this court, from the far end of a side: null where no first
// shot is clear.
export function serve(court: CourtPair, page: PageMap, now: number, rand: Rand): Play | null {
  const t = tableOf(court, page);
  if (!t || roomOver(court, page, t.sides[0].lo, t.sides[1].hi) < MIN_APEX) return null;
  const s: 0 | 1 = rand() < 0.5 ? 0 : 1;
  const from = s === 0 ? { x: t.sides[0].lo, y: -HOP } : { x: t.sides[1].hi, y: t.dy - HOP };
  const to: 0 | 1 = s === 0 ? 1 : 0;
  const segs = shotTo(t, page, court, from, to, now, rand, SPEED, 1);
  if (!segs) return null;
  const shots = Math.round(between(rand, SHOTS[0], SHOTS[1]));
  return { court, segs, to, left: shots - 1, ending: rand() < 0.5 ? 'out' : 'net', volleyable: true, over: false };
}

// The courts that could host a rally, nearest the top of the window first.
export function courtsInView(courts: readonly CourtPair[], page: PageMap): CourtPair[] {
  const y = (c: CourtPair) => page.floors.get(c.left)?.y ?? Infinity;
  return courts.filter((c) => {
    const a = page.floors.get(c.left), b = page.floors.get(c.right);
    return !!a && !!b && inView(a, page) && inView(b, page);
  }).sort((p, q) => y(p) - y(q));
}

// The last shot: deep, then two lower bounces and a roll, fading; or into
// the net. Falls back to the other ending, then to none.
function finish(play: Play, t: Table, page: PageMap, from: Point, start: number, rand: Rand): Seg[] | null {
  const tries = play.ending === 'out' ? [outShot, netShot] : [netShot, outShot];
  return tries.reduce<Seg[] | null>((found, f) => found ?? f(play, t, page, from, start, rand), null);
}

function outShot(play: Play, t: Table, page: PageMap, from: Point, start: number, rand: Rand): Seg[] | null {
  const s = play.to;
  const far = t.ends[s];
  const x = s === 0 ? far + OUT_ROOM : far - OUT_ROOM;
  if (s === 0 ? x > t.net.lo - SPOT_NEAR : x < t.net.hi + SPOT_NEAR) return null;
  const ground = groundOf(t, s);
  const to = { x, y: ground };
  const top = Math.min(between(rand, MIN_APEX, MAX_APEX), roomOver(play.court, page, from.x, x));
  if (top < MIN_APEX) return null;
  const shot: Seg = { kind: 'shot', from, to, rise: riseFor(from, to, top), start, ms: (1000 * Math.abs(x - from.x)) / SPEED };
  if (!overNet(shot, t)) return null;
  const way = s === 0 ? -1 : 1;
  const hops = OUT_HOPS.reduce<Seg[]>((segs, h) => {
    const at = segs.length ? segs[segs.length - 1].to : to;
    const begin = segs.length ? endOf(segs) : start + shot.ms;
    return [...segs, { kind: 'hop', from: at, to: { x: at.x + way * h.on, y: ground }, rise: h.high, start: begin, ms: h.ms }];
  }, []);
  const at = hops[hops.length - 1].to;
  const roll: Seg = { kind: 'roll', from: at, to: { x: at.x + way * ROLL, y: ground }, rise: 0, start: endOf(hops), ms: FADE_OUT, fade: -1 };
  const segs = [shot, ...hops, roll];
  return segs.every((g) => segClear(g, t, page)) ? segs : null;
}

function netShot(play: Play, t: Table, page: PageMap, from: Point, start: number, rand: Rand): Seg[] | null {
  const mid = (t.net.lo + t.net.hi) / 2;
  if (t.net.hi - t.net.lo < BALL + 2) return null;
  const to = { x: mid, y: Math.max(0, t.dy) };
  const top = Math.min(between(rand, MIN_APEX, MAX_APEX), roomOver(play.court, page, from.x, mid));
  if (top < MIN_APEX) return null;
  const shot: Seg = { kind: 'shot', from, to, rise: riseFor(from, to, top), start, ms: (1000 * Math.abs(mid - from.x)) / SPEED };
  const drop: Seg = { kind: 'drop', from: to, to: { x: mid, y: to.y + NET_DROP + BALL }, rise: 0, start: start + shot.ms, ms: 300, fade: -1 };
  return [shot, drop].every((g) => segClear(g, t, page)) ? [shot, drop] : null;
}

// Struck where the cursor met it: a fast flat shot back to the side it came
// from, or, with none clear, dropping dead where it is.
function volleyFrom(play: Play, t: Table, page: PageMap, at: Point, now: number, rand: Rand): Play {
  const back: 0 | 1 = play.to === 0 ? 1 : 0;
  const segs = shotTo(t, page, play.court, at, back, now, rand, SPEED * VOLLEY);
  if (segs) return { ...play, segs, to: back, volleyable: false, over: false, left: Math.max(1, play.left) };
  return { ...play, segs: dead(t, page, at, now), over: true, volleyable: false };
}

// Falling straight down from where it is, two small bounces and a roll; or,
// over the net, down into it.
function dead(t: Table, page: PageMap, at: Point, now: number): Seg[] {
  const s = sideAt(t, at.x);
  const overGap = at.x > t.net.lo - R && at.x < t.net.hi + R;
  const ground = groundOf(t, s);
  if (overGap) {
    const to = { x: at.x, y: Math.max(0, t.dy) + NET_DROP + BALL };
    return [{ kind: 'drop', from: at, to, rise: 0, start: now, ms: 360, fade: -1 }];
  }
  const fallMs = 1000 * Math.sqrt((2 * Math.max(0, ground - at.y)) / 600);
  const fall: Seg = { kind: 'fall', from: at, to: { x: at.x, y: ground }, rise: 0, start: now, ms: Math.max(40, fallMs) };
  const way = s === 0 ? -1 : 1;
  const hop1: Seg = { kind: 'hop', from: fall.to, to: { x: at.x + way * 3, y: ground }, rise: 3, start: endOf([fall]), ms: 160 };
  const hop2: Seg = { kind: 'hop', from: hop1.to, to: { x: at.x + way * 5, y: ground }, rise: 1.5, start: endOf([hop1]), ms: 110 };
  const roll: Seg = { kind: 'roll', from: hop2.to, to: { x: at.x + way * 9, y: ground }, rise: 0, start: endOf([hop2]), ms: FADE_OUT, fade: -1 };
  const segs = [fall, hop1, hop2, roll];
  // A dead ball that would roll into something just fades where it lands.
  return segs.every((g) => segClear(g, t, page)) ? segs : [fall, { ...roll, from: fall.to, to: fall.to, start: endOf([fall]) }];
}

// The ball's bottom point at now, and the segment it is on.
export function segAt(play: Play, now: number): { seg: Seg; f: number } {
  const seg = play.segs.find((g) => now < g.start + g.ms) ?? play.segs[play.segs.length - 1];
  return { seg, f: seg.ms ? (now - seg.start) / seg.ms : 1 };
}

// What the cursor did this frame: where it rests, and the stroke it last
// moved along (null for none in this frame).
export type Touch = { cursor: Point | null; stroke: Segment | null };

// Whether the cursor meets the ball this frame: hovering within
// VOLLEY_REACH of its middle, or its stroke crossing the ball's path since
// the last frame.
export function meetsBall(middle: Point, before: Point, touch: Touch): boolean {
  if (touch.cursor && Math.hypot(touch.cursor.x - middle.x, touch.cursor.y - middle.y) < VOLLEY_REACH) return true;
  return !!touch.stroke && segmentsApart(touch.stroke.from, touch.stroke.to, before, middle) < VOLLEY_REACH;
}

// How near two strokes come to each other.
export function segmentsApart(a: Point, b: Point, c: Point, d: Point): number {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}

// Where the ball's middle is on the page at now (court-local + origin).
const middleOf = (t: Table, bottom: Point): Point => ({ x: t.origin.x + bottom.x, y: t.origin.y + bottom.y - R });

// The rally a frame on: a serve when its time comes on a free court, each
// exchange followed by the next or the ending, a volley where the cursor
// meets a shot, and rest once the ball is gone. `free` says whether a court
// may start a rally now (no pigeon in its air, no bird flying).
export function stepRally(r: Rally, page: PageMap, courts: readonly CourtPair[], free: (court: CourtPair) => boolean, now: number, last: number, rand: Rand, touch: Touch): Rally {
  if (!r.play) {
    if (now < r.next) return r;
    const play = courtsInView(courts, page).filter(free).reduce<Play | null>((found, c) => found ?? serve(c, page, now, rand), null);
    return play ? { next: Infinity, play } : { next: now + 5000, play: null };
  }
  const play = r.play;
  const t = tableOf(play.court, page);
  if (!t) return rest(now, rand);
  const { seg } = segAt(play, now);
  if (play.volleyable && seg.kind === 'shot' && now >= seg.start) {
    const here = pointOf(seg, (now - seg.start) / seg.ms);
    const before = pointOf(seg, (last - seg.start) / seg.ms);
    if (meetsBall(middleOf(t, here), middleOf(t, before), touch)) return { ...r, play: volleyFrom(play, t, page, here, now, rand) };
  }
  const end = endOf(play.segs);
  if (now < end) return r;
  if (play.over) return rest(now, rand);
  const from = play.segs[play.segs.length - 1].to;
  const next: 0 | 1 = play.to === 0 ? 1 : 0;
  const segs = play.left > 1 ? shotTo(t, page, play.court, from, next, end, rand) : null;
  if (segs) return { ...r, play: { ...play, segs, to: next, left: play.left - 1, volleyable: true } };
  const last2 = finish({ ...play, to: next }, t, page, from, end, rand);
  return last2 ? { ...r, play: { ...play, segs: last2, to: next, left: 0, over: true, volleyable: true } } : rest(now, rand);
}

// What the ball looks like at now, on the page; null with none in play.
export function ballOf(r: Rally, page: PageMap, now: number): Ball | null {
  const t = r.play && tableOf(r.play.court, page);
  if (!r.play || !t) return null;
  const { seg, f } = segAt(r.play, now);
  const bottom = pointOf(seg, f);
  const squash = seg.kind === 'squash' ? SQUASH_SHAPE : 1;
  const fading = seg.fade === 1 ? clamp01((now - seg.start) / FADE_IN) : seg.fade === -1 ? 1 - clamp01(f) : 1;
  const middle = { x: t.origin.x + bottom.x, y: t.origin.y + bottom.y - R * squash };
  return { ...middle, spin: degrees(bottom.x / R), squash, opacity: fading };
}

// The ledge the ball and its bounces take while it plays, as claims: no
// pigeon walks or lands there.
export function claimsOf(r: Rally, page: PageMap): Claim[] {
  const t = r.play && tableOf(r.play.court, page);
  if (!r.play || !t) return [];
  return [
    { floor: r.play.court.left, lo: t.ends[0], hi: t.net.lo },
    { floor: r.play.court.right, lo: 0, hi: t.ends[1] - t.right },
  ];
}

// After the page changes: a rally whose court has gone, or whose remaining
// way is no longer clear, ends at once (the ball is never drawn over
// content, even for a frame).
export function remeasured(r: Rally, page: PageMap, now: number, rand: Rand): Rally {
  if (!r.play) return r;
  const t = tableOf(r.play.court, page);
  const ahead = r.play.segs.filter((g) => g.start + g.ms > now);
  return t && ahead.every((g) => segClear(g, t, page)) ? r : rest(now, rand);
}
