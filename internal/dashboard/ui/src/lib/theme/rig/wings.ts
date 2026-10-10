import { smooth } from '../math';
import type { Point } from '../pointer';
import { turnAbout, turned, type Layer } from './rig';

// A beating wing: a picture turned about its root through each stroke,
// broad on the downstroke and turned edge-on on the upstroke.

// The wing's stroke at this point of the beat: the angle it is turned from
// as drawn (negative sweeps it down and back), how far it is squashed across
// its length (turned edge-on on the upstroke), and the root's small rise and
// fall, which makes the tip trace a flattened figure-eight. `top` is where
// the stroke starts, `arc` how far down it sweeps.
export type Stroke = { angle: number; squash: number; lift: number };
export function wingStroke(beat: number, top: number, arc: number): Stroke {
  const phase = ((beat % 1) + 1) % 1;
  const down = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const up = phase >= 0.5 ? Math.sin(2 * Math.PI * (phase - 0.5)) : 0;
  return { angle: top - arc * down, squash: 1 - 0.45 * up, lift: 0.3 * Math.sin(4 * Math.PI * phase) };
}

// The wing's picture at this point of its stroke, about its root; `axis` is
// its long axis as drawn, root to tip (degrees), across which it is
// squashed: turned so its length lies level, squashed, and turned back.
export function wingLayer(picture: Layer, root: Point, axis: number, stroke: Stroke): Layer {
  const edgeOn: Layer = { kind: 'group', turn: turnAbout(-axis - 180, root), layers: [picture] };
  const squashed: Layer = { kind: 'group', turn: turnAbout(axis + 180, root), scaleY: stroke.squash, layers: [edgeOn] };
  return { kind: 'group', turn: turnAbout(stroke.angle, root, 0, stroke.lift), layers: [squashed] };
}

// A bird's wing (July's pigeons and hawk, August's gulls, September's
// crows), in two pieces as a bird's is: the arm, from the shoulder to the
// wrist (the humerus, and the forearm carrying the secondaries), and the
// hand beyond the wrist (the carpometacarpus and digits, carrying the
// primaries). Each piece is drawn flat, as seen from above (or, for its
// underside, from below), the span pointing up the picture and the leading
// edge to the right, true to length: a wing from shoulder to tip is about
// as long as the bird.
//
// Seen from the side, a wing beating about the body's long axis shows its
// chord as drawn and its span shortened to the sine of its angle above
// level (the harvest note's research), so the rig turns each piece in the
// wing's own plane (swept back at the shoulder, folded back at the wrist)
// and then foreshortens the whole wing across by that sine, flipping it
// below the body on the downstroke.

// How a wing is held: `lift` its angle above level (degrees, about the
// body's long axis; negative below), `sweep` how far the arm is swung back
// from straight out in the wing's plane (negative: forward), and `fold` how
// far the hand is folded back about the wrist.
export type WingPose = { lift: number; sweep: number; fold: number };

// A wing's stroke: from `top` (degrees above level) to `bottom`, the
// downstroke taking `down` of each beat (a crow's 55%); `fold`, how far
// the hand folds back through the upstroke; `sweep`, how far the arm
// swings back with it.
export type Flap = { top: number; bottom: number; down: number; fold: number; sweep: number };

const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const fract = (n: number) => n - Math.floor(n);
const mixPose = (a: WingPose, b: WingPose, t: number): WingPose =>
  ({ lift: a.lift + (b.lift - a.lift) * t, sweep: a.sweep + (b.sweep - a.sweep) * t, fold: a.fold + (b.fold - a.fold) * t });

// Flapping flight, `beat` counting wingbeats (a month's own rate times the
// time), 0 at the top of each stroke. The downstroke is made with the wing
// spread and a little forward; on the upstroke the wing flexes at the
// elbow and wrist, the hand drawn in and back, and spreads again at the top
// (Tobalske 2007; Crandell and Tobalske 2015; the doves' tip-reversal
// upstroke in slow flight, Tobalske, Hedrick and Biewener 2003).
export function flapping(beat: number, flap: Flap): WingPose {
  const p = fract(beat);
  if (p < flap.down) {
    const t = p / flap.down;
    return { lift: flap.top + (flap.bottom - flap.top) * ease(t), sweep: -0.3 * flap.sweep * Math.sin(Math.PI * t), fold: 0 };
  }
  const t = (p - flap.down) / (1 - flap.down);
  const flex = Math.sin(Math.PI * t);
  return { lift: flap.bottom + (flap.top - flap.bottom) * ease(t), sweep: flap.sweep * flex, fold: flap.fold * flex };
}

// Gliding: the wings held as `shape` (level and spread for the hawk, half
// folded and swept back for a gull's dive), rocking `sway` degrees either
// way over `period` ms as the air moves them.
export const gliding = (shape: WingPose, now: number, sway = 0, period = 1600): WingPose =>
  ({ ...shape, lift: shape.lift + sway * Math.sin((2 * Math.PI * now) / period) });

// What the rest of the bird does in a flight pose: the body's `pitch`
// (degrees, nose up), its legs (bird.ts's airLegsTo reach: -1 trailing, 0
// tucked, 1 reaching forward), how far its tail is fanned (0 closed, 1
// spread), and whether its feet are off the ground.
export type FlightPose = { wings: WingPose; pitch: number; legs: number; tail: number; airborne: boolean };

// How a wing lies folded at rest along the body: drawn as the body's own
// folded wing, so the flight wing is only ever seen opening or closing.
export const FOLDED: WingPose = { lift: 0, sweep: 50, fold: 150 };

// Taking off, `beat` counting wingbeats from the top of the first
// downstroke. Before it (from -0.5) the wings open from folded and rise to
// `clap` (a pigeon's meet over its back, about 90 degrees: "as the birds'
// feet left the perch, their wings were in the overhead clap position",
// Heppner and Anderson 1985), the body nose a little up. A bird jumps into
// the air (its legs give over 90% of the speed at lift-off, Provini et al.
// 2012) and its feet leave about halfway through the first downstroke
// (Tobalske et al.); the first strokes are the deepest, their plane tilted
// steeply so they drive it forward, the body near level (Berg and Biewener
// 2010), easing into the plain flap over `beats` beats as the legs trail
// behind and then tuck.
export function takingOff(beat: number, flap: Flap, clap: number, beats = 3): FlightPose {
  if (beat < 0) {
    const t = smooth(1 + beat / 0.5);
    return { wings: mixPose(FOLDED, { lift: clap, sweep: 0, fold: 0 }, t), pitch: 10 * t, legs: -1, tail: 0.6 * t, airborne: false };
  }
  const settled = smooth(beat / beats);
  const deep: Flap = { ...flap, top: clap + (flap.top - clap) * settled, bottom: flap.bottom - 15 * (1 - settled) };
  const stroke = flapping(beat, deep);
  // The stroke plane tilted: the downstroke reaching further forward.
  const tilt = fract(beat) < flap.down ? 25 * (1 - settled) * Math.sin((Math.PI * fract(beat)) / flap.down) : 0;
  return { wings: { ...stroke, sweep: stroke.sweep - tilt }, pitch: 10 * (1 - settled), legs: -1 + settled, tail: 0.6 * (1 - settled), airborne: beat >= flap.down / 2 };
}

// The landing flare, `t` from 0 (starting it, over the last stretch before
// touchdown) to 1 (feet on the ledge), the wings still beating (`beat`):
// the body, tail and wings swing from near level toward upright to brake,
// the stroke tilted up and the wings swept forward so the last strong beats
// push air ahead, the tail fanned and pressed down, the legs swung forward
// to take the ground (Berg and Biewener 2010; Provini et al. 2014). The
// body swings up to `upright` and, as the legs reach the ground and take
// the rest, lets back down to half of it (settling's `upright`).
export function flaring(t: number, beat: number, flap: Flap, upright = 60): FlightPose {
  const braking = smooth(t / 0.6);
  const stroke = flapping(beat, flap);
  const wings = { ...stroke, lift: stroke.lift + 15 * braking, sweep: stroke.sweep - 45 * braking };
  const pitch = upright * braking * (1 - 0.5 * smooth((t - 0.6) / 0.4));
  return { wings, pitch, legs: smooth((t - 0.15) / 0.6), tail: smooth(t), airborne: t < 1 };
}

// Landed: the wings held up a moment, then folded away, `t` from 0
// (touchdown) to 1 (folded), as a gull's are; the body settles level from
// the flare's `upright`, and the fanned tail closes.
export function settling(t: number, raised: WingPose, upright = 60): FlightPose {
  return { wings: mixPose(raised, FOLDED, smooth((t - 0.35) / 0.65)), pitch: upright * (1 - smooth(t / 0.5)), legs: 1, tail: 1 - smooth(t), airborne: false };
}

// Which side of a wing faces the eye. Raised, the near wing's upper side
// turns up and in, away from a side-on eye, which sees its underside;
// lowered, its upper side; the far wing the other way about. `view` is how
// far above level the eye looks from (degrees): seen a little from above,
// a near wing shows its upper side until it is raised past that.
export const wingFace = (lift: number, far: boolean, view = 0): 'upper' | 'under' =>
  ((far ? lift > -view : lift < view) ? 'upper' : 'under');

// A wing's art: each piece's upper side and underside, as images placed in
// the wing's own flat drawing (drawing units), with the shoulder and the
// wrist where they sit in it.
export type WingPiece = { upper: string; under: string; x: number; y: number; width: number; height: number };
export type WingArt = { name: string; arm: WingPiece; hand: WingPiece; shoulder: Point; wrist: Point };

// The smallest share of its span a wing is drawn at, seen nearly edge-on,
// so it never thins to a hairline.
const EDGE_ON = 0.12;

// How far a wing at this lift is foreshortened across: the sine of its
// angle, kept to at least EDGE_ON either way.
export function foreshortening(lift: number): number {
  const s = Math.sin((lift * Math.PI) / 180);
  if (Math.abs(s) >= EDGE_ON) return s;
  return s < 0 ? -EDGE_ON : EDGE_ON;
}

// The groups a wing is turned through, outermost first: moved to its root
// and foreshortened about its shoulder; swept about the shoulder; the hand
// folded about the wrist.
const placing = (art: WingArt, pose: WingPose, root: Point) => ({
  placed: turnAbout(0, art.shoulder, root.x - art.shoulder.x, root.y - art.shoulder.y),
  swept: turnAbout(-pose.sweep, art.shoulder),
  folded: turnAbout(-pose.fold, art.wrist),
});

// A wing drawn at `root` (where its shoulder joins the body, in the rig's
// drawing), held as `pose`: the hand under the arm (its cut end hidden
// beneath the arm's rounded wrist), each piece's upper side and underside
// both drawn and only the facing one seen. `far` for the far wing, behind
// the body and a shade darker. Not `shown` (folded away into the body's own
// folded wing), every piece is still drawn, unseen, so it is never reloaded
// as it opens.
export function birdWing(art: WingArt, pose: WingPose, root: Point, far = false, view = 0, shown = true): Layer {
  const face = wingFace(pose.lift, far, view);
  const sides = (piece: WingPiece, part: string): Layer[] => (['upper', 'under'] as const).map((side) => ({
    kind: 'image', name: `${art.name} ${part}${side === 'under' ? ', underside' : ''}`, src: piece[side],
    x: piece.x, y: piece.y, width: piece.width, height: piece.height, far, hidden: !shown || side !== face,
  }));
  const { placed, swept, folded } = placing(art, pose, root);
  const hand: Layer = { kind: 'group', turn: folded, layers: sides(art.hand, 'hand') };
  return { kind: 'group', turn: placed, foreshorten: foreshortening(pose.lift), layers: [{ kind: 'group', turn: swept, layers: [hand, ...sides(art.arm, 'arm')] }] };
}

// Where a point of the wing's flat drawing is drawn (on the hand, or on the
// arm), with the wing held as `pose` at `root`: for guides and tests.
export function wingPoint(art: WingArt, pose: WingPose, root: Point, p: Point, onHand: boolean): Point {
  const { placed, swept, folded } = placing(art, pose, root);
  const inPlane = turned(swept, onHand ? turned(folded, p) : p);
  const s = foreshortening(pose.lift);
  return turned(placed, { x: inPlane.x, y: art.shoulder.y + (inPlane.y - art.shoulder.y) * s });
}
