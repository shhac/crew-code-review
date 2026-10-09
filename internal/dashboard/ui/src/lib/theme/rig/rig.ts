import type { Point } from '../pointer';
import type { Leg } from '../spidergait';
import type { QuadLeg } from './gait';

// An animal drawn from parts: generated images for the body, head and tail,
// and for leg pieces stretched along legs posed in code, with eyelids drawn
// in code. Each animal turns its state into a RigPose with a pure function,
// and Rig.svelte draws it. Coordinates are the drawing's own (drawing units),
// facing right, with `anchor` the point standing on the ledge; `scale` is
// page pixels per drawing unit, one for every pose of an animal, so it is
// the same size whatever it does.

// Turned by angle degrees about pivot, then moved by (dx, dy).
export type Turn = { angle: number; pivot: Point; dx: number; dy: number };
export type Fur = { fill: string; outline: string };
// A leg's art: a bone piece (straight, lying along x, rounded at both ends)
// laid along each bone, and a foot standing flat at the leg's end, its
// ankle (in the foot's own box) on the leg's end. Each comes twice: as drawn,
// and as fur alone with the outline taken out, which is drawn over the
// outlined pieces so the outlines only show round the leg's silhouette, not
// where its pieces meet. Legs too short to show a knee are one bone, hip to
// ankle.
export type LegArt = {
  bone: string;
  boneFur: string;
  // The upper bone's own piece (thick at the hip, tapering to the knee), if
  // the leg has one; drawn as thick as each leg's haunch.
  thigh?: { src: string; fur: string };
  foot: { src: string; fur: string; width: number; height: number; ankle: Point };
  knee: boolean;
};

export type Layer =
  | { kind: 'image'; name: string; src: string; x: number; y: number; width: number; height: number }
  // Each bone drawn with a piece of leg art `width` thick, then its foot;
  // the far pair shaded; `fur` for the pass of fur alone.
  | { kind: 'legs'; legs: readonly Leg[]; haunches: readonly number[]; art: LegArt; width: number; far: boolean; fur: boolean }
  | { kind: 'lid'; at: Point; r: number; fur: Fur }
  // Fur painted over where two parts' outlines would otherwise show a seam.
  | { kind: 'patch'; at: Point; rx: number; ry: number; fill: string }
  | { kind: 'group'; turn: Turn; scaleY?: number; layers: readonly Layer[] };

// Guides: where its joints are, for the lab and the debug overlay to mark.
export type Guide = { name: string; at: Point };
export type RigPose = { width: number; height: number; anchor: Point; scale: number; layers: readonly Layer[]; guides?: readonly Guide[] };
// A rig's box, the point in it standing on the ledge, and its page scale.
export type Frame = Pick<RigPose, 'width' | 'height' | 'anchor' | 'scale'>;

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

// A piece of leg art laid along a bone: centred on it and running half its
// thickness past each end, so the rounded ends overlap at the joints; or,
// from the joint exactly (flush), as fur laid over a body's edge from a hip
// just inside it, which must not spread up over the body.
export function bone(from: Point, to: Point, thick: number, flush = false) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const start = flush ? 0 : thick / 2;
  return { x: -start, y: -thick / 2, width: length + start + thick / 2, height: thick, transform: `translate(${from.x} ${from.y}) rotate(${angle})` };
}

// One pair of legs (far or near), outlined or as fur alone. A rig draws the
// far pair outlined then as fur, then the near pair outlined, behind the
// body; then the body; then the near pair's fur over the body's edge, so
// those legs grow out of it with no line across.
export function legsLayer(specs: readonly QuadLeg[], legs: readonly Leg[], art: LegArt, width: number, far: boolean, fur: boolean): Layer {
  const mine = specs.flatMap((s, i) => (s.far === far ? [{ leg: legs[i], haunch: s.haunch ?? width }] : []));
  return { kind: 'legs', legs: mine.map((m) => m.leg), haunches: mine.map((m) => m.haunch), art, width, far, fur };
}

// The pieces a leg is drawn with: a piece of art laid along each bone, as
// thick as it is drawn, outlined and as fur alone.
export type Piece = { from: Point; to: Point; width: number; src: string; fur: string };
export function piecesOf(leg: Leg, art: LegArt, width: number, haunch: number): Piece[] {
  const plain = { src: art.bone, fur: art.boneFur };
  if (!art.knee) return [{ from: leg.hip, to: leg.foot, width, ...plain }];
  return [{ from: leg.hip, to: leg.knee, width: haunch, ...(art.thigh ?? plain) }, { from: leg.knee, to: leg.foot, width, ...plain }];
}
export const footBox = (leg: Leg, art: LegArt) => ({ x: leg.foot.x - art.foot.ankle.x, y: leg.foot.y - art.foot.ankle.y, width: art.foot.width, height: art.foot.height });

// An eyelid over the eye at `at`, while the eye is shut.
export const lidLayers = (shut: boolean, at: Point, r: number, fur: Fur): Layer[] => (shut ? [{ kind: 'lid', at, r, fur }] : []);

// One picture standing on the frame's anchor, squashed by a breath.
export function stillPicture(frame: Frame, art: { name: string; src: string; width: number; height: number }, squash: number): RigPose {
  const image: Layer = { kind: 'image', x: frame.anchor.x - art.width / 2, y: frame.anchor.y - art.height, ...art };
  return { ...frame, layers: [{ kind: 'group', turn: turnAbout(0, frame.anchor), scaleY: squash, layers: [image] }], guides: [{ name: 'stands here', at: frame.anchor }] };
}

// What a layer is called in the lab: an image by its part, the rest by what
// they draw.
export function layerName(layer: Exclude<Layer, { kind: 'group' }>): string {
  switch (layer.kind) {
    case 'image': return layer.name;
    case 'legs': return `${layer.far ? 'far' : 'near'} legs${layer.fur ? ', fur' : ''}`;
    case 'lid': return 'eyelid';
    case 'patch': return 'seam';
  }
}
