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
  // Fur painted over where two parts' outlines would otherwise show a seam.
  | { kind: 'patch'; at: Point; rx: number; ry: number; fill: string }
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

// The box a pose's drawing covers, in its own coordinates: every image's
// corners and every leg's joints, through the groups' turns (a group's
// squash is ignored; it is a breath, under a pixel). Legs are widened by
// half their stroke.
export function rigBounds(pose: RigPose): { left: number; right: number; top: number; bottom: number } {
  const points = (layers: readonly Layer[], place: (p: Point) => Point): Point[] => layers.flatMap((l) => {
    if (l.kind === 'image') return [{ x: l.x, y: l.y }, { x: l.x + l.width, y: l.y }, { x: l.x, y: l.y + l.height }, { x: l.x + l.width, y: l.y + l.height }].map(place);
    if (l.kind === 'legs') {
      const pad = l.width / 2 + 0.45;
      return l.legs.flatMap((leg) => [leg.hip, leg.knee, leg.foot, { x: leg.foot.x + l.paw, y: leg.foot.y }])
        .flatMap((p) => [{ x: p.x - pad, y: p.y - pad }, { x: p.x + pad, y: p.y + pad }]).map(place);
    }
    if (l.kind === 'lid') return [{ x: l.at.x - l.r, y: l.at.y - l.r }, { x: l.at.x + l.r, y: l.at.y + l.r }].map(place);
    if (l.kind === 'patch') return [{ x: l.at.x - l.rx, y: l.at.y - l.ry }, { x: l.at.x + l.rx, y: l.at.y + l.ry }].map(place);
    return points(l.layers, (p) => place(turned(l.turn, p)));
  });
  const all = points(pose.layers, (p) => p);
  return { left: Math.min(...all.map((p) => p.x)), right: Math.max(...all.map((p) => p.x)), top: Math.min(...all.map((p) => p.y)), bottom: Math.max(...all.map((p) => p.y)) };
}
