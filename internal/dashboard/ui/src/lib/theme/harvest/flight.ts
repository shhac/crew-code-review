import type { Box } from '../floors';
import { meets } from '../air';
import { cubic, lengthOf, type Curve } from '../curves';
import { clamp, degrees } from '../math';
import type { Point } from '../pointer';

// Where a crow flies: off the page by the top or the right edge when it is
// scared or restless, and back in the same way to a feeding spot. A route
// is a chain of cubic curves sharing tangents, in viewport coordinates;
// which routes are clear is the air's business (`Clear`, built on the
// surfaces kit's exits and the bird kit's swept-envelope check), so this
// only shapes the candidates, in the note's order, and flies along them.

// Speed along the route, px/s, each flight its own.
export const SPEED = { lo: 180, hi: 240 };
// The body pitches with the route's slope, at most this far.
export const PITCH = 20;
// Ends this far past an exit edge, so the whole envelope is off the page.
export const BEYOND = 64;
// A skim keeps this far above its ledge: its envelope reaches 28px up and
// 6px down from its line, so the line runs 14px up with room either side.
export const SKIM = 14;
// Skims are tried breaking into a climb every this far along the band.
const SKIM_STEP = 40;
// Separation between two crows' envelopes in the air, sampled this often.
export const SEPARATION = 8;
const SAMPLE = 50;

export type Leg = 'depart' | 'arrive';
// A flight: its curves, when it started, how long it takes, and which way
// it goes (leaving eases in from the take-off, arriving eases out to the
// landing). `end` is where it ends: off the page leaving, the spot arriving.
export type Flight = { curves: Curve[]; start: number; duration: number; leg: Leg };
// Whether a route's whole swept envelope stays in air (the kits' check).
export type Clear = (curves: readonly Curve[], leg: Leg) => boolean;

const along = (curves: readonly Curve[]) => curves.map((c) => lengthOf((t) => cubic(c, t)));
export const routeLength = (curves: readonly Curve[]) => along(curves).reduce((a, b) => a + b, 0);

// How far along its route a flight is at now, 0 to 1: easing in from the
// take-off, out to the landing.
export function progress(f: Flight, now: number): number {
  const u = clamp((now - f.start) / f.duration, 0, 1);
  return f.leg === 'depart' ? 1 - Math.cos((Math.PI * u) / 2) : Math.sin((Math.PI * u) / 2);
}

export const done = (f: Flight, now: number) => now >= f.start + f.duration;

// The point a fraction s of the way along a chain, by length.
export function pointAlong(curves: readonly Curve[], s: number): { p: Point; curve: Curve; t: number; i: number } {
  const lengths = along(curves);
  const total = lengths.reduce((a, b) => a + b, 0);
  const target = clamp(s, 0, 1) * total;
  const walk = (i: number, before: number): { p: Point; curve: Curve; t: number; i: number } => {
    const c = curves[i];
    const last = i === curves.length - 1;
    if (!last && before + lengths[i] < target) return walk(i + 1, before + lengths[i]);
    const t = lengths[i] ? clamp((target - before) / lengths[i], 0, 1) : 1;
    return { p: cubic(c, t), curve: c, t, i };
  };
  return walk(0, 0);
}

// Where a flying crow is at now, which way it faces and how far its body
// pitches (degrees, nose up positive), from the route's slope.
export function flightAt(f: Flight, now: number): { at: Point; dir: 1 | -1; pitch: number } {
  const { p, curve, t } = pointAlong(f.curves, progress(f, now));
  const ahead = cubic(curve, Math.min(1, t + 0.02));
  const behind = cubic(curve, Math.max(0, t - 0.02));
  const dx = ahead.x - behind.x, dy = ahead.y - behind.y;
  const dir: 1 | -1 = dx < 0 ? -1 : 1;
  return { at: p, dir, pitch: clamp(degrees(Math.atan2(-dy, Math.abs(dx) || 1e-6)), -PITCH, PITCH) };
}

export function fly(curves: Curve[], leg: Leg, start: number, speed: number): Flight {
  return { curves, start, leg, duration: (routeLength(curves) / speed) * 1000 };
}

// The part of a curve after t, by de Casteljau.
export function after(c: Curve, t: number): Curve {
  const m = (a: Point, b: Point) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const ab = m(c.from, c.c1), bc = m(c.c1, c.c2), cd = m(c.c2, c.to);
  const abc = m(ab, bc), bcd = m(bc, cd);
  return { from: m(abc, bcd), c1: bcd, c2: cd, to: c.to };
}

// What is left of a flight's route from now: re-checked against new air
// when the page moves under it.
export function remaining(f: Flight, now: number): Curve[] {
  const { curve, t, i } = pointAlong(f.curves, progress(f, now));
  return [after(curve, t), ...f.curves.slice(i + 1)];
}

const reverse = (curves: readonly Curve[]): Curve[] => [...curves].reverse().map((c) => ({ from: c.to, c1: c.c2, c2: c.c1, to: c.from }));
const line = (a: Point, b: Point): Curve => ({ from: a, c1: { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, c2: { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 }, to: b });

// A climb from p up and to the right, off the top: leaving the ledge
// steeply, levelling into a slant.
function climb(p: Point, start: Point = p): Curve {
  const rise = start.y + BEYOND;
  const end = { x: start.x + rise * 0.7, y: -BEYOND };
  return { from: p, c1: { x: p.x + 18, y: p.y - 32 }, c2: { x: end.x - rise * 0.25, y: end.y + rise * 0.35 }, to: end };
}

// A skim from the feet at p up to the band SKIM above its ledge and along
// it to x, rising gently: the take-off's hop and the first strokes.
function skimTo(p: Point, x: number): Curve[] {
  const up = { x: p.x + 24, y: p.y - SKIM };
  return [{ from: p, c1: { x: p.x + 8, y: p.y - 10 }, c2: { x: up.x - 10, y: up.y }, to: up }, line(up, { x, y: up.y })];
}

// The ways off the page from a crow's feet at p, in the note's order: a
// climb off the top; a skim along its ledge's band to the right edge; a
// skim to where the climb first fits, then the climb.
export function departures(p: Point, width: number): Curve[][] {
  const right = width + BEYOND;
  const breaks = Array.from({ length: Math.max(0, Math.floor((width - p.x - 24) / SKIM_STEP)) }, (_, i) => p.x + 24 + SKIM_STEP * (i + 1));
  return [
    [climb(p)],
    skimTo(p, right),
    ...breaks.map((x) => {
      const [hop, run] = skimTo(p, x);
      return [hop, run, climb(run.to)];
    }),
  ];
}

// The first clear way off the page from a crow's feet at p, or from the
// air (a crow turning back, or re-routed after the page moved).
export function leave(p: Point, width: number, clear: Clear, start: number, speed: number, grounded = true): Flight | null {
  const options = grounded ? departures(p, width) : [[climb(p)], [line(p, { x: width + BEYOND, y: p.y })]];
  const route = options.find((r) => clear(r, 'depart'));
  return route ? fly(route, 'depart', start, speed) : null;
}

// The first clear way in from past an exit edge down to the feet at p: a
// departure from p, flown backwards.
export function arrive(p: Point, width: number, clear: Clear, start: number, speed: number): Flight | null {
  const route = departures(p, width).map(reverse).find((r) => clear(r, 'arrive'));
  return route ? fly(route, 'arrive', start, speed) : null;
}

// A new way down to the feet at p from a crow already in the air at
// from: in level to the band above its spot, then the hop down onto it.
export function landFrom(from: Point, p: Point, clear: Clear, start: number, speed: number): Flight | null {
  const [hop] = skimTo(p, p.x + 24);
  const up = hop.to;
  const side = from.x < up.x ? -1 : 1;
  const route = [{ from, c1: { x: from.x + (up.x - from.x) / 3, y: from.y + (up.y - from.y) / 3 }, c2: { x: up.x + side * 30, y: up.y }, to: up }, ...reverse([hop])];
  return clear(route, 'arrive') ? fly(route, 'arrive', start, speed) : null;
}

// Whether a flight keeps its envelope SEPARATION from every other flight
// at the same moments, and from every crow standing, sampled every 50ms.
export function keepsApart(f: Flight, others: readonly Flight[], standing: readonly Box[], envelope: (p: Point) => Box): boolean {
  const grow = (b: Box): Box => ({ left: b.left - SEPARATION, right: b.right + SEPARATION, top: b.top - SEPARATION, bottom: b.bottom + SEPARATION });
  const count = Math.ceil(f.duration / SAMPLE);
  return Array.from({ length: count + 1 }, (_, i) => f.start + i * SAMPLE).every((now) => {
    const mine = grow(envelope(flightAt(f, now).at));
    const flying = others.filter((o) => now >= o.start && now <= o.start + o.duration);
    return !flying.some((o) => meets(mine, envelope(flightAt(o, now).at))) && !standing.some((b) => meets(mine, b));
  });
}
