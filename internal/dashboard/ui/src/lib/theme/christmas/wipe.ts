import type { Ledge } from '../floors';
import type { Point, Segment } from '../pointer';
import { footClearance, snowProfile, type Sample } from './snow';
export type Snow = Sample & { seed: number; wiped: number; at: number };
export function distance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function depth(s: Snow, now: number): number {
  return s.seed - (s.seed - s.wiped) * 2 ** (-Math.max(0, now - s.at - 1500) / 4000);
}
export function reconcileSnow(floors: ReadonlyMap<number, Ledge>, old: ReadonlyMap<number, Snow[]> = new Map()): Map<number, Snow[]> {
  return new Map([...floors].map(([id, f]) => {
    const previous = new Map(old.get(id)?.map((s) => [s.x, s]));
    return [id, snowProfile(id, f).map((s) => {
      const held = previous.get(s.x);
      return held && held.seed === s.depth ? held : { ...s, seed: s.depth, wiped: s.depth, at: 0 };
    })];
  }));
}
export function wipeSnow(snow: ReadonlyMap<number, Snow[]>, floors: ReadonlyMap<number, Ledge>, stroke: Segment): Map<number, Snow[]> {
  return new Map([...snow].map(([id, samples]) => {
    const f = floors.get(id);
    if (!f) return [id, samples];
    return [id, samples.map((s) => {
      const strength = Math.max(0, Math.min(1, (32 - distance({ x: f.left + s.x, y: f.y - s.seed / 2 }, stroke.from, stroke.to)) / 8));
      if (!strength || !s.seed) return s;
      return { ...s, wiped: Math.min(depth(s, stroke.at), s.seed * (1 - strength)), at: stroke.at };
    })];
  }));
}
export function renderSnow(samples: readonly Snow[], now: number, foot?: number | readonly number[]): Sample[] {
  return samples.map((s) => ({ x: s.x, depth: depth(s, now) * footClearance(s.x, foot) }));
}
