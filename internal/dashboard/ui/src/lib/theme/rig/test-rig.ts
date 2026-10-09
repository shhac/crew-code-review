// Queries over a rig's drawing, shared by the animals' rig tests.
import type { Point } from '../pointer';
import { OUTLINE, turned, type Layer, type RigPose } from './rig';

export const flatLayers = (layers: readonly Layer[]): Layer[] => layers.flatMap((l) => (l.kind === 'group' ? [l, ...flatLayers(l.layers)] : [l]));
export const legsOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' ? l.legs : []));
export const lidsOf = (pose: RigPose) => flatLayers(pose.layers).filter((l) => l.kind === 'lid');
export const imagesOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' ? [l.src] : []));

// The first moment in the first four seconds the eye is shut, if any.
export const firstShut = (poseAt: (now: number) => RigPose) => Array.from({ length: 4000 }, (_, t) => t).find((t) => lidsOf(poseAt(t)).length > 0);

const corners = (x0: number, y0: number, x1: number, y1: number): Point[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }];

// The points a layer's drawing reaches, in its own group's coordinates.
function reach(l: Exclude<Layer, { kind: 'group' }>): Point[] {
  switch (l.kind) {
    case 'image': return corners(l.x, l.y, l.x + l.width, l.y + l.height);
    case 'lid': return corners(l.at.x - l.r, l.at.y - l.r, l.at.x + l.r, l.at.y + l.r);
    case 'patch': return corners(l.at.x - l.rx, l.at.y - l.ry, l.at.x + l.rx, l.at.y + l.ry);
    case 'legs': {
      // Widened by half the stroke, outline included.
      const pad = l.width / 2 + OUTLINE;
      return l.legs.flatMap((leg) => [leg.hip, leg.knee, leg.foot, { x: leg.foot.x + l.paw, y: leg.foot.y }]).flatMap((p) => corners(p.x - pad, p.y - pad, p.x + pad, p.y + pad));
    }
  }
}

// The box a pose's drawing covers, in its own coordinates, through the
// groups' turns (a group's squash is ignored; it is a breath, under a pixel).
export function rigBounds(pose: RigPose): { left: number; right: number; top: number; bottom: number } {
  const points = (layers: readonly Layer[], place: (p: Point) => Point): Point[] =>
    layers.flatMap((l) => (l.kind === 'group' ? points(l.layers, (p) => place(turned(l.turn, p))) : reach(l).map(place)));
  const all = points(pose.layers, (p) => p);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
