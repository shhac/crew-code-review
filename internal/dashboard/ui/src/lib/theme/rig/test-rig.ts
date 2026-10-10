// Queries over a rig's drawing, shared by the animals' rig tests.
import type { Point } from '../pointer';
import { footBox, piecesOf, turnAbout, turned, type DrawnLeg, type Layer, type LegArt, type RigPose } from './rig';

export const flatLayers = (layers: readonly Layer[]): Layer[] => layers.flatMap((l) => (l.kind === 'group' ? [l, ...flatLayers(l.layers)] : [l]));
// Each leg once (from the outlined pass, not again from the fur over it),
// in the order the rig lists its legs' layers.
export const legsOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? l.legs.map((d) => d.limb) : []));
export const lidsOf = (pose: RigPose) => flatLayers(pose.layers).filter((l) => l.kind === 'lid');
export const imagesOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' ? [l.src] : []));

// The first moment in the first four seconds the eye is shut, if any.
export const firstShut = (poseAt: (now: number) => RigPose) => Array.from({ length: 4000 }, (_, t) => t).find((t) => lidsOf(poseAt(t)).length > 0);

const corners = (x0: number, y0: number, x1: number, y1: number): Point[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }];

// A foot's box's corners, turned as its paw folds or its sole rolls.
function footCorners(leg: DrawnLeg, art: LegArt): Point[] {
  const b = footBox(leg, art);
  const turn = turnAbout(leg.limb.paw, leg.limb.foot);
  return corners(b.x, b.y, b.x + b.width, b.y + b.height).map((p) => turned(turn, p));
}

// How low each foot reaches, in the order legsOf lists the legs.
export const solesOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? l.legs.map((leg) => Math.max(...footCorners(leg, l.art).map((c) => c.y))) : []));

export const guideAt = (pose: RigPose, name: string) => pose.guides?.find((g) => g.name === name)?.at;

// The points a layer's drawing reaches, in its own group's coordinates.
function reach(l: Exclude<Layer, { kind: 'group' }>): Point[] {
  switch (l.kind) {
    case 'image': return corners(l.x, l.y, l.x + l.width, l.y + l.height);
    case 'lid': return corners(l.at.x - l.r, l.at.y - l.r, l.at.x + l.r, l.at.y + l.r);
    // Round joins and ends reach half the width past each point.
    case 'stroke': return l.points.flatMap((p) => corners(p.x - l.width / 2, p.y - l.width / 2, p.x + l.width / 2, p.y + l.width / 2));
    case 'legs': {
      // Each piece runs half its thickness past its joints, every way; each
      // foot is its own box.
      const pieces = l.legs.flatMap((leg) => piecesOf(leg, l.art, l.width));
      const joints = pieces.flatMap((p) => [p.from, p.to].flatMap((at) => corners(at.x - p.width / 2, at.y - p.width / 2, at.x + p.width / 2, at.y + p.width / 2)));
      const feet = l.legs.flatMap((leg) => footCorners(leg, l.art));
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

// How far a pose's drawing reaches from where it stands, in page pixels:
// what a footprint, on the page, must hold.
export function pageReach(pose: RigPose): { left: number; right: number; top: number } {
  const b = rigBounds(pose);
  return { left: (pose.anchor.x - b.left) * pose.scale, right: (b.right - pose.anchor.x) * pose.scale, top: (pose.anchor.y - b.top) * pose.scale };
}
