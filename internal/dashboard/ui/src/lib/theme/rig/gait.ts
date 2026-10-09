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
// that joint. One that walks on its soles (a hedgehog) has none: its foot
// rolls instead, the heel peeling up over the planted toes as it pushes off.

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
  // A sole walker's foot: where its toes press the ground, from the heel
  // (where the leg comes down), and how far (degrees) the heel peels up
  // over them as the foot pushes off.
  sole?: { toes: Point; peel: number };
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

// Where a foot is in its step: down, 0 setting down to 1 lifting off, or
// swinging, 0 lifting off to 1 landing.
export type Step = { down: boolean; t: number };
export function stepsOf(specs: readonly QuadLeg[], walked: number, gait: Gait): Step[] {
  const phase = gaitPhase(walked, gait);
  return specs.map((s) => {
    const p = phase + s.beat - Math.floor(phase + s.beat);
    return p < gait.stance ? { down: true, t: p / gait.stance } : { down: false, t: (p - gait.stance) / (1 - gait.stance) };
  });
}

// How far a paw is folded through its swing (from stepsOf): the wrist or
// hock flexes as it lifts, folding the paw back with its toes down, then
// unfolds through the second half and tips it toes-up just before it lands
// flat.
export function flexion(step?: Step): number {
  if (!step || step.down) return 0;
  if (step.t < 0.75) return Math.sin((Math.PI * step.t) / 0.75);
  return -0.2 * Math.sin((Math.PI * (step.t - 0.75)) / 0.25);
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
// How far a sole walker's foot is rolled up onto its toes (0 flat, 1 its
// full peel): flat through most of its time down, the heel peeling up as it
// pushes off, then flattening again low through the swing so it lands flat.
export function roll(step?: Step): number {
  if (!step) return 0;
  return step.down ? smooth((step.t - 0.6) / 0.4) : 1 - smooth(step.t / 0.8);
}

// Where a rolled foot's heel is: turned `angle` degrees up about its toes,
// which stay where they were.
function peeled(heel: Point, toes: Point, angle: number): Point {
  const a = (angle * Math.PI) / 180;
  return { x: heel.x + toes.x - toes.x * Math.cos(a) + toes.y * Math.sin(a), y: heel.y + toes.y - toes.x * Math.sin(a) - toes.y * Math.cos(a) };
}

// Where the bone up from the toes starts, folded `fold` degrees back from
// standing: rotating it that way swings the paw back behind the joint.
function ankleOf(spec: QuadLeg, foot: Point, fold: number): Point {
  if (!spec.toes) return foot;
  const angle = ((spec.toes.lean - fold) * Math.PI) / 180;
  return { x: foot.x - spec.toes.length * Math.sin(angle), y: foot.y - spec.toes.length * Math.cos(angle) };
}

// Each leg posed from its hip to its foot; `steps` (from stepsOf), when
// stepping, fold the bones up from the toes as they swing, or roll a sole
// walker's feet.
export function legsTo(specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[], steps: readonly Step[] = []): Limb[] {
  return specs.map((s, i) => {
    if (s.sole) {
      const paw = s.sole.peel * roll(steps[i]);
      const foot = peeled(feet[i], s.sole.toes, paw);
      return { hip: hips[i], knee: kneeToward(hips[i], foot, s.thigh, s.shin, s.bend), ankle: foot, foot, paw };
    }
    const fold = s.toes ? s.toes.fold * flexion(steps[i]) : 0;
    const ankle = ankleOf(s, feet[i], fold);
    return { hip: hips[i], knee: kneeToward(hips[i], ankle, s.thigh, s.shin, s.bend), ankle, foot: feet[i], paw: fold };
  });
}
