// Boxes on the page, in viewport px: what a drawing takes up, what it must
// keep off and the room it has. The algebra every month checks its animals
// with, so each check reads the same everywhere.
export type Box = { left: number; right: number; top: number; bottom: number };

const spans = (a: { left: number; right: number }, b: { left: number; right: number }) => a.left < b.right && b.left < a.right;
// Whether two boxes overlap; touching edges do not.
export const meets = (a: Box, b: Box) => spans(a, b) && a.top < b.bottom && b.top < a.bottom;

// The box covering both.
export const union = (a: Box, b: Box): Box => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) });

// A box widened by `by` on every side (narrowed, for a negative by).
export const grow = (b: Box, by: number): Box => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });

// Whether inner lies wholly inside outer, edges included.
export const holds = (outer: Box, inner: Box) => outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom;

// The part of a inside b; null where they do not overlap.
export function clip(a: Box, b: Box): Box | null {
  const c = { left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) };
  return c.left < c.right && c.top < c.bottom ? c : null;
}

// Whether every side is a number: a box measured from a broken layout, or
// worked out from one, is never clear.
export const finite = (b: Box) => [b.left, b.right, b.top, b.bottom].every(Number.isFinite);
