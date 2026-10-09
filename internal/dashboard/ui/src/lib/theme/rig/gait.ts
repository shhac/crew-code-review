import type { Point } from '../pointer';
import { cycleLength, footAt, kneeToward, type Leg, type LegSpec } from '../spidergait';

// A four-legged animal's legs: the spider's stepping (spidergait.ts), driven
// by distance walked so a planted foot never slides, with each leg's joints
// bending the way that animal's do and a gait setting how long feet stay
// down. In the drawing's own coordinates: x right, y down, facing right. A
// rig moves the hips with the body, picks where the feet go, then poses the
// legs between them (legsTo).
//
// An animal that walks on its toes (a fox) has a third bone in each leg:
// from the toes up to the hock on a hind leg (the ankle; the joint that
// looks like a backward knee, the true knee, the stifle, being up by the
// belly), to the wrist (the carpus) on a foreleg. Its lean is set from the
// toes; the two bones above are solved between the hip (or shoulder) and
// that joint. One that walks on its soles (a hedgehog), or
// whose legs are too short to show it, has none.

export type QuadLeg = LegSpec & {
  fore: boolean;
  // Which way the middle joint points: a hind knee forward (1), a fore elbow
  // back (-1).
  bend: 1 | -1;
  // The far side, drawn behind and a shade darker.
  far: boolean;
  // How thick its upper piece is drawn, where that differs from the rest of
  // the leg: a haunch is thick where it meets the body.
  haunch?: number;
  // On a hind leg, the shank (stifle to hock) drawn tapering, so the hock is
  // narrow and sharp rather than a rounded join.
  taper?: boolean;
  // The bone up from the toes: its length, how far its foot end sits ahead
  // of the joint above standing (degrees from straight down), and how far
  // the wrist or hock folds it back as the paw swings through a step.
  toes?: { length: number; lean: number; fold: number };
};
// A leg posed: hip (or shoulder); knee (the stifle on a hind leg, the elbow
// on a foreleg); ankle (the hock, or the wrist; the foot itself where there
// is no bone up from the toes); foot; and how far the paw is turned from
// flat (degrees, toes down), as the bone above it folds.
export type Limb = Leg & { ankle: Point; paw: number };
// stance: the share of each cycle a foot is down. A walk keeps three feet
// down (0.75, four beats); a trot moves diagonal pairs together (about 0.5).
export type Gait = { stride: number; lift: number; stance: number };

// How far through its stride cycle an animal is: what its feet step to, and
// what its body's bob and nod keep time with.
export const gaitPhase = (walked: number, gait: Gait) => walked / cycleLength(gait.stride, gait.stance);

export const steppingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], walked: number, ground: number, gait: Gait): Point[] =>
  specs.map((s, i) => footAt({ ...s, hip: hips[i] }, gaitPhase(walked, gait), ground, gait.stride, gait.lift, gait.stance));

// Stood still: every foot down at its resting reach.
export const restingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], ground: number): Point[] =>
  specs.map((s, i) => ({ x: hips[i].x + s.reach, y: ground }));

// How far through its swing each foot is, 0 lifting off to 1 landing, or
// -1 while it is down.
export function swingsOf(specs: readonly QuadLeg[], walked: number, gait: Gait): number[] {
  const phase = gaitPhase(walked, gait);
  return specs.map((s) => {
    const p = phase + s.beat - Math.floor(phase + s.beat);
    return p < gait.stance ? -1 : (p - gait.stance) / (1 - gait.stance);
  });
}

// How far a paw is folded through its swing (t from swingsOf): the wrist or
// hock flexes as it lifts, folding the paw back with its toes down, then
// unfolds through the second half and tips it toes-up just before it lands
// flat.
export function flexion(t: number): number {
  if (t < 0) return 0;
  if (t < 0.75) return Math.sin((Math.PI * t) / 0.75);
  return -0.2 * Math.sin((Math.PI * (t - 0.75)) / 0.25);
}

// Where the bone up from the toes starts, folded `fold` degrees back from
// standing: rotating it that way swings the paw back behind the joint.
function ankleOf(spec: QuadLeg, foot: Point, fold: number): Point {
  if (!spec.toes) return foot;
  const angle = ((spec.toes.lean - fold) * Math.PI) / 180;
  return { x: foot.x - spec.toes.length * Math.sin(angle), y: foot.y - spec.toes.length * Math.cos(angle) };
}

// Each leg posed from its hip to its foot; `swings` (from swingsOf), when
// stepping, fold the bones up from the toes as they swing.
export function legsTo(specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[], swings: readonly number[] = []): Limb[] {
  return specs.map((s, i) => {
    const fold = s.toes ? s.toes.fold * flexion(swings[i] ?? -1) : 0;
    const ankle = ankleOf(s, feet[i], fold);
    return { hip: hips[i], knee: kneeToward(hips[i], ankle, s.thigh, s.shin, s.bend), ankle, foot: feet[i], paw: fold };
  });
}
