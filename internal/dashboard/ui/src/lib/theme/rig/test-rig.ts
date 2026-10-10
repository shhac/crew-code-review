// Queries over a rig's drawing, shared by the animals' rig tests.
import type { Point } from '../pointer';
import { degrees } from '../math';
import { bone, footBox, footInUse, piecesOf, turnAbout, turned, type DrawnLeg, type Layer, type RigPose } from './rig';

export const flatLayers = (layers: readonly Layer[]): Layer[] => layers.flatMap((l) => (l.kind === 'group' ? [l, ...flatLayers(l.layers)] : [l]));
// Each leg once (from the outlined pass, not again from the fur over it),
// in the order the rig lists its legs' layers.
export const legsOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? l.legs.map((d) => d.limb) : []));
export const lidsOf = (pose: RigPose) => flatLayers(pose.layers).filter((l) => l.kind === 'lid');
export const imagesOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' ? [l.src] : []));

// The first moment in the first four seconds the eye is shut, if any.
export const firstShut = (poseAt: (now: number) => RigPose) => Array.from({ length: 4000 }, (_, t) => t).find((t) => lidsOf(poseAt(t)).length > 0);

const corners = (x0: number, y0: number, x1: number, y1: number): Point[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }];

// A foot's box's corners (the one in use, where it has a curled one too),
// turned as its paw folds or its sole rolls.
function footCorners(leg: DrawnLeg): Point[] {
  const b = footBox(leg, footInUse(leg));
  const turn = turnAbout(leg.limb.paw, leg.limb.foot);
  return corners(b.x, b.y, b.x + b.width, b.y + b.height).map((p) => turned(turn, p));
}

// How low each foot reaches, in the order legsOf lists the legs.
export const solesOf = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? l.legs.map((leg) => Math.max(...footCorners(leg).map((c) => c.y))) : []));

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
      const pieces = l.legs.flatMap(piecesOf);
      const joints = pieces.flatMap((p) => {
        if (!p.anchors) return [p.from, p.to].flatMap((at) => corners(at.x - p.width / 2, at.y - p.width / 2, at.x + p.width / 2, at.y + p.width / 2));
        const box = bone(p.from, p.to, p.width, false, p.anchors);
        const turn = turnAbout(degrees(Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x)), { x: 0, y: 0 }, p.from.x, p.from.y);
        return corners(box.x, box.y, box.x + box.width, box.y + box.height).map((at) => turned(turn, at));
      });
      const feet = l.legs.flatMap(footCorners);
      return [...joints, ...feet];
    }
  }
}

// A point in a foreshortened group, scaled across about its pivot.
const slanted = (l: Extract<Layer, { kind: 'group' }>, p: Point): Point =>
  (l.foreshorten === undefined ? p : { x: p.x, y: l.turn.pivot.y + (p.y - l.turn.pivot.y) * l.foreshorten });

// The box a pose's drawing covers, in drawing units, through the groups'
// turns and foreshortening (a group's squash is ignored; it is a breath,
// under a pixel), leaving out pictures drawn unseen.
export function rigBounds(pose: RigPose): { left: number; right: number; top: number; bottom: number } {
  const points = (layers: readonly Layer[], place: (p: Point) => Point): Point[] =>
    layers.flatMap((l) => {
      if (l.kind === 'group') return points(l.layers, (p) => place(turned(l.turn, slanted(l, p))));
      if (l.kind === 'image' && l.hidden) return [];
      return reach(l).map(place);
    });
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
