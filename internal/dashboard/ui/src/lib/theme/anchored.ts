import { shiftPath, type Path } from './curves';
import type { Ledge, PageMap } from './floors';
import { clamp01 } from './math';
import type { Point } from './pointer';

// Things in the air held relative to a ledge (offsets from its left end and
// its line), so they ride with the page on scroll: a cupid's spot and its
// flight, an arrow on its way to the ledge it will land in.

export type Anchored = { floor: number; dx: number; dy: number };

// Nearest ledge to p, by how far p is from the ledge's line.
export function anchor(page: PageMap, p: Point): Anchored | null {
  const best = [...page.floors].reduce<{ id: number; f: Ledge; d: number } | null>((b, [id, f]) => {
    const x = Math.max(f.left, Math.min(f.right, p.x));
    const d = Math.hypot(p.x - x, p.y - f.y);
    return b && b.d <= d ? b : { id, f, d };
  }, null);
  return best && { floor: best.id, dx: p.x - best.f.left, dy: p.y - best.f.y };
}

// Where an anchored point is now, or null with its ledge gone.
export function placed(page: PageMap, a: Anchored): Point | null {
  const f = page.floors.get(a.floor);
  return f ? { x: f.left + a.dx, y: f.y + a.dy } : null;
}

// What a ledge's offsets are measured from: its left end, on its line.
function ledgeOrigin(page: PageMap, floor: number): Point | null {
  const f = page.floors.get(floor);
  return f ? { x: f.left, y: f.y } : null;
}

// A path on the page as held by a ledge, and a held one back on the page
// now; either null with the ledge gone.
export function toLedge<T extends Path>(page: PageMap, floor: number, path: T): T | null {
  const o = ledgeOrigin(page, floor);
  return o && shiftPath(path, { x: -o.x, y: -o.y });
}
export function fromLedge<T extends Path>(page: PageMap, floor: number, path: T): T | null {
  const o = ledgeOrigin(page, floor);
  return o && shiftPath(path, o);
}

// How far through its time something under way is, from 0 to 1.
export const progress = (held: { start: number; duration: number }, now: number) => clamp01((now - held.start) / held.duration);
