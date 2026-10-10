import type { Point } from '../pointer';
import { rotate } from '../spidergait';
import type { Limb, QuadLeg } from './gait';

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
// A foot (a paw, toes, a little hand), standing flat, toes forward; `heel`
// is where the leg's end meets it, in its own box.
export type Foot = { src: string; fur: string; width: number; height: number; heel: Point };
// A leg's art: a bone piece (straight, lying along x, rounded at both ends)
// laid along each bone, and a foot standing at the leg's end, the fore and
// hind feet each their own. Each comes twice: as drawn, and as fur alone
// with the outline taken out, which is drawn over the outlined pieces so
// the outlines only show round the leg's silhouette, not where its pieces
// meet. Legs too short to show a knee are one bone, hip to foot.
export type LegArt = {
  bone: string;
  boneFur: string;
  // The upper bone's own piece (thick at the hip, tapering to the knee), if
  // the leg has one; drawn as thick as each leg's haunch.
  thigh?: { src: string; fur: string };
  feet: { fore: Foot; hind: Foot };
  knee: boolean;
  // A sole walker's leg is drawn over its foot, its rounded end the heel,
  // hiding the foot's back; otherwise the foot is drawn over the leg's end.
  overFoot?: boolean;
};
// One leg as drawn: its pose, how thick its upper piece is, which foot, and
// whether its shank tapers to the hock (see QuadLeg).
export type DrawnLeg = { limb: Limb; haunch: number; fore: boolean; taper: boolean };

export type Layer =
  // `far`: on the far side, seen past the body, a shade darker.
  | { kind: 'image'; name: string; src: string; x: number; y: number; width: number; height: number; far?: boolean }
  // Each bone drawn with a piece of leg art `width` thick, then its foot;
  // the far side shaded; `fur` for the pass of fur alone.
  | { kind: 'legs'; name: string; legs: readonly DrawnLeg[]; art: LegArt; width: number; far: boolean; fur: boolean }
  | { kind: 'lid'; at: Point; r: number; fur: Fur }
  // A line drawn in code through points (a bow's stave, its string), or
  // with `fill` a closed shape (an arrow's heart).
  | { kind: 'stroke'; name: string; points: readonly Point[]; width: number; colour: string; fill?: string }
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
  const at = rotate(p, turn.pivot, turn.angle);
  return { x: at.x + turn.dx, y: at.y + turn.dy };
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

// One side's legs, outlined or as fur alone.
function legsLayer(specs: readonly QuadLeg[], limbs: readonly Limb[], art: LegArt, width: number, far: boolean, fur: boolean): Layer {
  const legs = specs.flatMap((s, i) => (s.far === far ? [{ limb: limbs[i], haunch: s.haunch ?? width, fore: s.fore, taper: !!s.taper }] : []));
  return { kind: 'legs', name: far ? 'far legs' : 'near legs', legs, art, width, far, fur };
}

// The legs round the body, each where it belongs against it: they start
// inside it, so the far legs are drawn behind it, outlined, then as fur
// alone so no line crosses where their pieces meet; the near legs outlined
// behind it too, their fur then over its edge, so they grow out of it with
// no line across.
export function legsAround(specs: readonly QuadLeg[], limbs: readonly Limb[], art: LegArt, width: number, body: Layer): Layer[] {
  const side = (far: boolean, fur: boolean) => legsLayer(specs, limbs, art, width, far, fur);
  return [side(true, false), side(true, true), side(false, false), body, side(false, true)];
}

// The pieces a leg is drawn with: a piece of art laid along each bone, as
// thick as it is drawn, outlined and as fur alone.
export type Piece = { from: Point; to: Point; width: number; src: string; fur: string };
export function piecesOf(leg: DrawnLeg, art: LegArt, width: number): Piece[] {
  const { hip, knee, ankle, foot } = leg.limb;
  const plain = { src: art.bone, fur: art.boneFur };
  if (!art.knee) return [{ from: hip, to: foot, width, ...plain }];
  const upper = { from: hip, to: knee, width: leg.haunch, ...(art.thigh ?? plain) };
  const toes = ankle.x === foot.x && ankle.y === foot.y ? [] : [{ from: ankle, to: foot, width, ...plain }];
  // A hind shank tapers to a narrow hock.
  const shank = leg.taper ? { from: knee, to: ankle, width: width * 1.15, ...(art.thigh ?? plain) } : { from: knee, to: ankle, width, ...plain };
  return [upper, shank, ...toes];
}

export const footOf = (leg: DrawnLeg, art: LegArt) => (leg.fore ? art.feet.fore : art.feet.hind);
// A foot's box, and its turn about the heel as the bone above it folds.
export function footBox(leg: DrawnLeg, art: LegArt) {
  const foot = footOf(leg, art);
  const { x, y } = leg.limb.foot;
  return { x: x - foot.heel.x, y: y - foot.heel.y, width: foot.width, height: foot.height, transform: `rotate(${leg.limb.paw} ${x} ${y})` };
}

// A leg's images in the order they are drawn, outlined or as fur alone: a
// piece of art stretched along each bone (in the fur pass the first runs
// flush from the hip, see bone), then the foot over the leg's end; or, for
// a sole walker, the foot first, under the leg's rounded end, its heel.
export type LegImage = { href: string; stretch: boolean; x: number; y: number; width: number; height: number; transform: string };
export function legImages(leg: DrawnLeg, art: LegArt, width: number, fur: boolean): LegImage[] {
  const pieces = piecesOf(leg, art, width).map((p, i) => ({ href: fur ? p.fur : p.src, stretch: true, ...bone(p.from, p.to, p.width, fur && i === 0) }));
  const drawn = footOf(leg, art);
  const foot = { href: fur ? drawn.fur : drawn.src, stretch: false, ...footBox(leg, art) };
  return art.overFoot ? [foot, ...pieces] : [...pieces, foot];
}

// An eyelid over the eye at `at`, while the eye is shut.
export const lidLayers = (shut: boolean, at: Point, r: number, fur: Fur): Layer[] => (shut ? [{ kind: 'lid', at, r, fur }] : []);

// One picture standing on the frame's anchor, squashed by a breath.
export function stillPicture(frame: Frame, art: { name: string; src: string; width: number; height: number }, squash: number): RigPose {
  const image: Layer = { kind: 'image', x: frame.anchor.x - art.width / 2, y: frame.anchor.y - art.height, ...art };
  return { ...frame, layers: [{ kind: 'group', turn: turnAbout(0, frame.anchor), scaleY: squash, layers: [image] }], guides: [{ name: 'stands here', at: frame.anchor }] };
}

// What a layer is called in the lab: an image or a stroke by its part, the
// rest by what they draw.
export function layerName(layer: Exclude<Layer, { kind: 'group' }>): string {
  switch (layer.kind) {
    case 'image': return layer.name;
    case 'legs': return `${layer.name}${layer.fur ? ', fur' : ''}`;
    case 'lid': return 'eyelid';
    case 'stroke': return layer.name;
  }
}
