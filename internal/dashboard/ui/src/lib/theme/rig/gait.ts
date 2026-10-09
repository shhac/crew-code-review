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
// from the toes up to the hock on a hind leg, to the wrist on a foreleg. Its
// lean is set from the toes; the two bones above are solved between the hip
// (or shoulder) and that joint. One that walks on its soles (a hedgehog), or
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
  // The bone up from the toes: its length, how far it leans back from
  // upright standing (degrees), and how much further it folds back as the
  // paw lifts off.
  toes?: { length: number; lean: number; fold: number };
};
// A leg posed: hip (or shoulder), knee (or elbow), ankle (hock or wrist; the
// foot itself where there is no bone up from the toes), and foot.
export type Limb = Leg & { ankle: Point };
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

// Where the bone up from the toes ends, for a foot `lifted` (0 down, 1 at
// the top of its step).
function ankleOf(spec: QuadLeg, foot: Point, lifted: number): Point {
  if (!spec.toes) return foot;
  const lean = ((spec.toes.lean + spec.toes.fold * lifted) * Math.PI) / 180;
  return { x: foot.x - spec.toes.length * Math.sin(lean), y: foot.y - spec.toes.length * Math.cos(lean) };
}

// Each leg posed from its hip to its foot; `ground` and `lift` tell how far
// each foot is off the ground, which folds the bone up from its toes.
export function legsTo(specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[], ground: number, lift = 1): Limb[] {
  return specs.map((s, i) => {
    const lifted = Math.max(0, Math.min(1, (ground - feet[i].y) / lift));
    const ankle = ankleOf(s, feet[i], lifted);
    return { hip: hips[i], knee: kneeToward(hips[i], ankle, s.thigh, s.shin, s.bend), ankle, foot: feet[i] };
  });
}
