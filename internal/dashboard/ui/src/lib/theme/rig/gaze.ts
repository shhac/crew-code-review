import { clamp, degrees } from '../math';
import type { Point } from '../pointer';
import { easeTo } from './life';

// An animal's head turning toward a cursor close by: worked out in the
// drawing's own frame, facing right, so a cursor behind it is looked at over
// the shoulder only a little.

// Where its eye is in its drawing, the point there standing on the ledge,
// its page scale, how far its head turns at most (degrees), and from how far
// (page px) it notices a cursor.
export type Gazer = { eye: Point; anchor: Point; scale: number; look: number; reach: number };

// How far the head would turn toward the cursor (degrees, nose down
// positive), standing at `at` on the page facing dir.
export const gazeFrom = ({ eye, anchor, scale, look, reach }: Gazer) => (dir: 1 | -1, at: Point, cursor: Point | null): number => {
  if (!cursor) return 0;
  const from = { x: at.x + (eye.x - anchor.x) * scale * dir, y: at.y - (anchor.y - eye.y) * scale };
  const dx = (cursor.x - from.x) * dir, dy = cursor.y - from.y;
  if (Math.hypot(dx, dy) > reach) return 0;
  return clamp(degrees(Math.atan2(dy, Math.max(dx, 12))), -look, look);
};

// How long a head takes to turn, about: smoothly rather than snapping.
export const GAZE_EASE = 220;

// Each animal's head turn, by its id, eased from where it was toward where
// it would look now; dt in milliseconds.
export const easeGazes = <T>(animals: readonly T[], idOf: (animal: T) => number, toward: (animal: T) => number, gazes: ReadonlyMap<number, number>, dt: number): ReadonlyMap<number, number> =>
  new Map(animals.map((animal) => [idOf(animal), easeTo(gazes.get(idOf(animal)) ?? 0, toward(animal), dt, GAZE_EASE)]));
