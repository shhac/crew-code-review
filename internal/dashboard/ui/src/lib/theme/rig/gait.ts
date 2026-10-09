import type { Point } from '../pointer';
import { cycleLength, footAt, kneeToward, type Leg, type LegSpec } from '../spidergait';

// A four-legged animal's legs: the spider's stepping (spidergait.ts), driven
// by distance walked so a planted foot never slides, with each knee bending
// the way that animal's does and a gait setting how long feet stay down.
// In the drawing's own coordinates: x right, y down, facing right. A rig
// moves the hips with the body, picks where the feet go, then solves the
// knees between them (legsTo).

export type QuadLeg = LegSpec & {
  // Fore knees bend forward (1), hind hocks back (-1).
  bend: 1 | -1;
  // The far side, drawn behind and a shade darker.
  far: boolean;
};
// stance: the share of each cycle a foot is down. A walk keeps three feet
// down (0.75, four beats); a trot moves diagonal pairs together (about 0.5).
export type Gait = { stride: number; lift: number; stance: number };

export const fore = (spec: QuadLeg) => spec.bend === 1;

// How far through its stride cycle an animal is: what its feet step to, and
// what its body's bob and nod keep time with.
export const gaitPhase = (walked: number, gait: Gait) => walked / cycleLength(gait.stride, gait.stance);

export const steppingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], walked: number, ground: number, gait: Gait): Point[] =>
  specs.map((s, i) => footAt({ ...s, hip: hips[i] }, gaitPhase(walked, gait), ground, gait.stride, gait.lift, gait.stance));

// Stood still: every foot down at its resting reach.
export const restingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], ground: number): Point[] =>
  specs.map((s, i) => ({ x: hips[i].x + s.reach, y: ground }));

export const legsTo = (specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[]): Leg[] =>
  specs.map((s, i) => ({ hip: hips[i], knee: kneeToward(hips[i], feet[i], s.thigh, s.shin, s.bend), foot: feet[i] }));
