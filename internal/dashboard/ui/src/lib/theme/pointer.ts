// Passive decoration input never captures a gesture.
export type Point = { x: number; y: number };
export type Segment = { from: Point; to: Point; at: number };
// The last place the cursor moved to, and when.
export type Cursor = Point & { at: number };
// How near p comes to the stroke from a to b.
export function distance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
type Input = { pointerId: number; pointerType: string; buttons: number; pressure: number; clientX: number; clientY: number };
export function pointerTracker() {
  let origin: (Point & { id: number; type: string }) | null = null;
  return {
    reset() { origin = null; },
    move(e: Input, at: number): Segment | null {
      if (!['mouse', 'pen'].includes(e.pointerType) || e.buttons !== 0 || e.pressure !== 0
        || !Number.isFinite(e.clientX + e.clientY)) { origin = null; return null; }
      const previous = origin;
      origin = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
      if (!previous || previous.id !== e.pointerId || previous.type !== e.pointerType || (previous.x === origin.x && previous.y === origin.y)) return null;
      return { from: previous, to: origin, at };
    },
  };
}
export function observePointer(move: (e: PointerEvent) => void, reset: () => void): () => void {
  addEventListener('pointermove', move, { passive: true });
  const events = ['pointerdown', 'pointercancel', 'blur', 'pointerleave'] as const;
  events.forEach((name) => addEventListener(name, reset));
  const exit = (e: PointerEvent) => { if (!e.relatedTarget) reset(); };
  addEventListener('pointerout', exit);
  return () => {
    removeEventListener('pointermove', move);
    events.forEach((name) => removeEventListener(name, reset));
    removeEventListener('pointerout', exit);
  };
}
