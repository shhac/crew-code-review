import { mixPoint } from './math';
import type { Point } from './pointer';

// The curves things fly along: a cupid's flight, an arrow's arc, a robin's
// route and a hare's leap. Pure maths on page points; what counts as clear
// along one is each caller's own rule.

export const shift = (p: Point, by: Point): Point => ({ x: p.x + by.x, y: p.y + by.y });

// A cubic curve, for a flight from spot to spot.
export type Curve = { from: Point; c1: Point; c2: Point; to: Point };
export function cubic(c: Curve, t: number): Point {
  const u = 1 - t;
  const mix = (k: 'x' | 'y') => u * u * u * c.from[k] + 3 * u * u * t * c.c1[k] + 3 * u * t * t * c.c2[k] + t * t * t * c.to[k];
  return { x: mix('x'), y: mix('y') };
}

// A quadratic arc, for an arrow.
export type Arc = { from: Point; via: Point; to: Point };
export function quadratic(a: Arc, t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.from.x + 2 * u * t * a.via.x + t * t * a.to.x, y: u * u * a.from.y + 2 * u * t * a.via.y + t * t * a.to.y };
}
// Where an arc is heading at t (not normalised).
export const heading = (a: Arc, t: number): Point => ({
  x: 2 * (1 - t) * (a.via.x - a.from.x) + 2 * t * (a.to.x - a.via.x),
  y: 2 * (1 - t) * (a.via.y - a.from.y) + 2 * t * (a.to.y - a.via.y),
});

// The rest of an arc from t on: by de Casteljau, from the point at t, its
// control a t of the way from the old one to the end.
export const arcFrom = (a: Arc, t: number): Arc => ({ from: quadratic(a, t), via: mixPoint(a.via, a.to, t), to: a.to });

// A curve or an arc moved by an offset, whole.
export type Path = Curve | Arc;
export function shiftPath<T extends Path>(path: T, by: Point): T {
  const ends = { ...path, from: shift(path.from, by), to: shift(path.to, by) };
  if ('via' in path) return { ...ends, via: shift(path.via, by) };
  return { ...ends, c1: shift(path.c1, by), c2: shift(path.c2, by) };
}

// A hop from p to q: straight across, lifted by a parabola that peaks rise
// above the straight line halfway.
export const parabola = (p: Point, q: Point, rise: number, t: number): Point => ({
  x: p.x + (q.x - p.x) * t,
  y: p.y + (q.y - p.y) * t - 4 * rise * t * (1 - t),
});

// Points along a curve at most `step` apart, its ends included, with the t
// each was taken at. Its length is measured on a fine pass first.
export function samples(at: (t: number) => Point, step = 2): { t: number; p: Point }[] {
  // A curve can bunch up, so twice as many as its length asks for.
  const count = Math.max(1, Math.ceil((2 * lengthOf(at)) / step));
  return Array.from({ length: count + 1 }, (_, i) => ({ t: i / count, p: at(i / count) }));
}

export function lengthOf(at: (t: number) => Point): number {
  const fine = Array.from({ length: 65 }, (_, i) => at(i / 64));
  return fine.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - fine[i].x, p.y - fine[i].y), 0);
}
