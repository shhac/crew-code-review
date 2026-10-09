// Queries over a rig's drawing, shared by the animals' rig tests.
import type { Point } from '../pointer';
import { footBox, piecesOf, turned, type Layer, type RigPose } from './rig';

export const flatLayers = (layers: readonly Layer[]): Layer[] => layers.flatMap((l) => (l.kind === 'group' ? [l, ...flatLayers(l.layers)] : [l]));
// Each leg once: from the outlined pass, not again from the fur over it.
export const legsOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? l.legs : []));
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
      // Each piece runs half its thickness past its joints, every way; each
      // foot is its own box.
      const pieces = l.legs.flatMap((leg, i) => piecesOf(leg, l.art, l.width, l.haunches[i]));
      const joints = pieces.flatMap((p) => [p.from, p.to].flatMap((at) => corners(at.x - p.width / 2, at.y - p.width / 2, at.x + p.width / 2, at.y + p.width / 2)));
      const feet = l.legs.map((leg) => footBox(leg, l.art)).flatMap((b) => corners(b.x, b.y, b.x + b.width, b.y + b.height));
      return [...joints, ...feet];
    }
  }
}

// The box a pose's drawing covers, in drawing units, through the
// groups' turns (a group's squash is ignored; it is a breath, under a pixel).
export function rigBounds(pose: RigPose): { left: number; right: number; top: number; bottom: number } {
  const points = (layers: readonly Layer[], place: (p: Point) => Point): Point[] =>
    layers.flatMap((l) => (l.kind === 'group' ? points(l.layers, (p) => place(turned(l.turn, p))) : reach(l).map(place)));
  const all = points(pose.layers, (p) => p);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
