import { cycleLength, footAt, kneeToward, type Leg, type LegSpec, type Point } from '../spidergait';

// A four-legged animal's legs: the spider's stepping (spidergait.ts), driven
// by distance walked so a planted foot never slides, with each knee bending
// the way that animal's does and a gait setting how long feet stay down.
// In the drawing's own coordinates: x right, y down, facing right.

export type QuadLeg = LegSpec & {
  // Fore knees bend forward (1), hind hocks back (-1).
  bend: 1 | -1;
  // The far side, drawn behind and a shade darker.
  far: boolean;
};
// stance: the share of each cycle a foot is down. A walk keeps three feet
// down (0.75, four beats); a trot moves diagonal pairs together (about 0.5).
export type Gait = { stride: number; lift: number; stance: number };

const legTo = (spec: QuadLeg, hip: Point, foot: Point): Leg => ({ hip, knee: kneeToward(hip, foot, spec.thigh, spec.shin, spec.bend), foot });

export function walkingLegs(specs: readonly QuadLeg[], walked: number, ground: number, gait: Gait): Leg[] {
  const phase = walked / cycleLength(gait.stride, gait.stance);
  return specs.map((s) => legTo(s, s.hip, footAt(s, phase, ground, gait.stride, gait.lift, gait.stance)));
}

// Stood still: every foot down at its resting reach.
export const standingLegs = (specs: readonly QuadLeg[], ground: number): Leg[] =>
  specs.map((s) => legTo(s, s.hip, { x: s.hip.x + s.reach, y: ground }));

// Legs reaching from moved hips (a body tilted or lifted) to chosen feet.
export const reachingLegs = (specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[]): Leg[] =>
  specs.map((s, i) => legTo(s, hips[i], feet[i]));
