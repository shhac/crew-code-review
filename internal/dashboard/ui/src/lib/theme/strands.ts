// What the Halloween layer draws besides the spiders themselves, and how it
// counts their steps: pure functions of the walker's world, kept out of the
// component so they can be tested.
import { clamp } from './spidergait';
import { LINE_FADE, LINE_LIFE, USED_LINE_FADE, tiePoint, type Floors, type Line, type Pose } from './spiderwalk';

// bend is how far the strand's middle sits off the straight line between
// its ends, sideways: a slack thread curves, a taut one does not.
export type Strand = { key: string; x1: number; y1: number; x2: number; y2: number; opacity: number; bend: number };

// A dragline lying idle: clear for a moment after its spider has come down
// it, then fading to barely there for the rest of its life, then gone.
const FRESH = 0.8;
const SETTLE = 3;
const IDLE_OPACITY = 0.16;

export function lineOpacity(age: number): number {
  const settled = age <= FRESH ? 1 : 1 + (IDLE_OPACITY - 1) * clamp((age - FRESH) / SETTLE, 0, 1);
  return settled * clamp((LINE_LIFE - age) / LINE_FADE, 0, 1);
}

// Slack silk stirs in the draught: its middle drifts a few pixels either
// side, each line out of step with the rest.
const DRIFT = { px: 3.5, period: 5.5 };
const drift = (id: number, seconds: number) => DRIFT.px * Math.sin((2 * Math.PI * seconds) / DRIFT.period + id * 1.7);

// The strand as an SVG path: straight, or curved through its bent middle.
export function strandPath(s: Strand): string {
  const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  // A quadratic's middle sits halfway to its control point, so the control
  // goes twice as far out as the bend.
  const cx = (s.x1 + s.x2) / 2 - ((s.y2 - s.y1) / length) * s.bend * 2;
  const cy = (s.y1 + s.y2) / 2 + ((s.x2 - s.x1) / length) * s.bend * 2;
  return `M${s.x1} ${s.y1} Q${cx} ${cy} ${s.x2} ${s.y2}`;
}

// The draglines left lying about (slack, stirring, fading), and any thread a
// spider is on (hanging or climbing: taut, so straight and clear).
export function strands(lines: readonly Line[], poses: readonly (Pose | null)[], floors: Floors, seconds: number): Strand[] {
  const left = lines.flatMap((l) => {
    const top = tiePoint(l.top, floors);
    const bottom = tiePoint(l.bottom, floors);
    if (!top || !bottom) return [];
    const climber = poses.find((p) => p?.dragline === l.id);
    if (climber) {
      // Above the feet the line is taut. Below them the used length remains
      // tied to the lower card, bowing and stirring as the spider swings.
      const length = Math.hypot(bottom.x - climber.x, bottom.y - climber.y);
      return [{ key: `line-${l.id}`, x1: climber.x, y1: climber.y, x2: bottom.x, y2: bottom.y, opacity: 1, bend: drift(l.id, seconds) + Math.min(12, length * 0.06) }];
    }
    const opacity = l.claimed ? clamp(1 - (l.released ?? 0) / USED_LINE_FADE, 0, 1) : lineOpacity(l.age);
    const settling = l.claimed ? Math.min(12, Math.hypot(bottom.x - top.x, bottom.y - top.y) * 0.06) * clamp(1 - (l.released ?? 0) / SETTLE, 0, 1) : 0;
    return [{ key: `line-${l.id}`, x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y, opacity, bend: drift(l.id, seconds) + settling }];
  });
  const held = poses.flatMap((p, i) => (p?.silk ? [{ key: `held-${i}`, x1: p.silk.x, y1: p.silk.y, x2: p.x, y2: p.y, opacity: 1, bend: 0 }] : []));
  return [...left, ...held];
}

// Ground a spider's feet covered between two frames, in any direction (a
// floor, a wall, a thread): its legs step by this, so they never slide. Only
// on foot; and capped, since a landing or a re-measured floor can move it
// further in one frame than any step could.
export function stepped(from: Pose | null, to: Pose | null): number {
  if (!from || !to || from.drawing !== 'walk' || to.drawing !== 'walk') return 0;
  return Math.min(4, Math.hypot(to.x - from.x, to.y - from.y));
}

// The pointer, but only while it is moving: one that has sat still for this
// long startles nothing.
export const STILL_AFTER = 300;
export type Pointer = { x: number; y: number; at: number };

export function movingPointer(pointer: Pointer, now: number): { x: number; y: number } | undefined {
  return now - pointer.at < STILL_AFTER ? { x: pointer.x, y: pointer.y } : undefined;
}
