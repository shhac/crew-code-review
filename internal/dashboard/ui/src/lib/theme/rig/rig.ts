import type { Leg, Point } from '../spidergait';

// An animal drawn from parts: generated images for the body, head and tail,
// with legs and eyelids drawn in code. Each animal turns its state into a
// RigPose with a pure function, and Rig.svelte draws it. Coordinates are the
// drawing's own, facing right, with `anchor` the point standing on the ledge.

// Turned by angle degrees about pivot, then moved by (dx, dy).
export type Turn = { angle: number; pivot: Point; dx?: number; dy?: number };
export type Fur = { fill: string; outline: string };

export type Layer =
  | { kind: 'image'; src: string; x: number; y: number; width: number; height: number }
  // width: the leg's fur, inside its outline; paw: how far the paw reaches.
  | { kind: 'legs'; legs: readonly Leg[]; fur: Fur; width: number; paw: number }
  | { kind: 'lid'; at: Point; r: number; fur: Fur }
  | { kind: 'group'; turn: Turn; scaleY?: number; layers: readonly Layer[] };

export type RigPose = { width: number; height: number; anchor: Point; layers: readonly Layer[] };

export const turnAbout = (angle: number, pivot: Point, dx = 0, dy = 0): Turn => ({ angle, pivot, dx, dy });

// Where a point drawn inside a turned group ends up: needed for the hips,
// since the legs are drawn outside the body's group to keep feet planted.
export function turned(turn: Turn, p: Point): Point {
  const a = (turn.angle * Math.PI) / 180;
  const x = p.x - turn.pivot.x, y = p.y - turn.pivot.y;
  return { x: turn.pivot.x + x * Math.cos(a) - y * Math.sin(a) + (turn.dx ?? 0), y: turn.pivot.y + x * Math.sin(a) + y * Math.cos(a) + (turn.dy ?? 0) };
}

export const transformOf = (turn: Turn, scaleY = 1) => {
  const { x, y } = turn.pivot;
  const squash = scaleY === 1 ? '' : ` translate(${x} ${y}) scale(1 ${scaleY}) translate(${-x} ${-y})`;
  return `translate(${turn.dx ?? 0} ${turn.dy ?? 0}) rotate(${turn.angle} ${x} ${y})${squash}`;
};

// A leg as one path: hip to knee to foot, then a short paw forward.
export const legPath = (leg: Leg, paw: number) =>
  `M${leg.hip.x} ${leg.hip.y}L${leg.knee.x} ${leg.knee.y}L${leg.foot.x} ${leg.foot.y}l${paw} 0`;
