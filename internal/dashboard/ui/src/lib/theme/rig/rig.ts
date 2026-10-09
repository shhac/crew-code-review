import type { Point } from '../pointer';
import type { Leg } from '../spidergait';
import type { QuadLeg } from './gait';

// An animal drawn from parts: generated images for the body, head and tail,
// with legs and eyelids drawn in code. Each animal turns its state into a
// RigPose with a pure function, and Rig.svelte draws it. Coordinates are the
// drawing's own, facing right, with `anchor` the point standing on the ledge.

// Turned by angle degrees about pivot, then moved by (dx, dy).
export type Turn = { angle: number; pivot: Point; dx: number; dy: number };
export type Fur = { fill: string; outline: string };

export type Layer =
  | { kind: 'image'; src: string; x: number; y: number; width: number; height: number }
  // width: the leg's fur, inside its outline; paw: how far the paw reaches.
  | { kind: 'legs'; legs: readonly Leg[]; fur: Fur; width: number; paw: number }
  | { kind: 'lid'; at: Point; r: number; fur: Fur }
  // Fur painted over where two parts' outlines would otherwise show a seam.
  | { kind: 'patch'; at: Point; rx: number; ry: number; fill: string }
  | { kind: 'group'; turn: Turn; scaleY?: number; layers: readonly Layer[] };

export type RigPose = { width: number; height: number; anchor: Point; layers: readonly Layer[] };
// A rig's box and the point in it standing on the ledge.
export type Frame = Pick<RigPose, 'width' | 'height' | 'anchor'>;

// About the art's own outline at display size, so drawn legs match it.
export const OUTLINE = 0.45;

export const turnAbout = (angle: number, pivot: Point, dx = 0, dy = 0): Turn => ({ angle, pivot, dx, dy });

// Where a point drawn inside a turned group ends up: needed for the hips,
// since the legs are drawn outside the body's group to keep feet planted.
export function turned(turn: Turn, p: Point): Point {
  const a = (turn.angle * Math.PI) / 180;
  const x = p.x - turn.pivot.x, y = p.y - turn.pivot.y;
  return { x: turn.pivot.x + x * Math.cos(a) - y * Math.sin(a) + turn.dx, y: turn.pivot.y + x * Math.sin(a) + y * Math.cos(a) + turn.dy };
}

export const transformOf = (turn: Turn, scaleY = 1) => {
  const { x, y } = turn.pivot;
  const squash = scaleY === 1 ? '' : ` translate(${x} ${y}) scale(1 ${scaleY}) translate(${-x} ${-y})`;
  return `translate(${turn.dx} ${turn.dy}) rotate(${turn.angle} ${x} ${y})${squash}`;
};

// A leg as one path: hip to knee to foot, then a short paw forward.
export const legPath = (leg: Leg, paw: number) =>
  `M${leg.hip.x} ${leg.hip.y}L${leg.knee.x} ${leg.knee.y}L${leg.foot.x} ${leg.foot.y}l${paw} 0`;

// The legs as two layers, the far pair first so the near pair is drawn over
// it.
export const legLayers = (specs: readonly QuadLeg[], legs: readonly Leg[], fur: { near: Fur; far: Fur }, size: { width: number; paw: number }): Layer[] =>
  [true, false].map((far) => ({ kind: 'legs', legs: legs.filter((_, i) => specs[i].far === far), fur: far ? fur.far : fur.near, ...size }));

// An eyelid over the eye at `at`, while the eye is shut.
export const lidLayers = (shut: boolean, at: Point, r: number, fur: Fur): Layer[] => (shut ? [{ kind: 'lid', at, r, fur }] : []);

// One picture standing on the frame's anchor, squashed by a breath.
export function stillPicture(frame: Frame, art: { src: string; width: number; height: number }, squash: number): RigPose {
  const image: Layer = { kind: 'image', x: frame.anchor.x - art.width / 2, y: frame.anchor.y - art.height, ...art };
  return { ...frame, layers: [{ kind: 'group', turn: turnAbout(0, frame.anchor), scaleY: squash, layers: [image] }] };
}
