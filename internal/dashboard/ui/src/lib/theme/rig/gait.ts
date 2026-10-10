import type { Point } from '../pointer';
import { clamp, cycleLength, footOf, kneeToward, rotate, stepAt, type Leg, type LegSpec, type Step } from '../spidergait';

export type { Step };

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

// A toe walker's bone up from the toes: its length, how far its foot end
// sits ahead of the joint above standing (degrees from straight down), and
// how far the wrist or hock folds it back as the paw swings through a step.
export type Toes = { kind: 'toes'; length: number; lean: number; fold: number };
// A sole walker's foot: where its toes press the ground, from the heel
// (where the leg comes down), and how far (degrees) the heel peels up over
// them as the foot pushes off.
export type Sole = { kind: 'sole'; toes: Point; peel: number };

// When each leg steps is the gait's (a walk and a trot move the same legs in
// different orders), so a leg has no beat of its own.
export type QuadLeg = Omit<LegSpec, 'beat'> & {
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
  // What it stands on, beyond a plain foot at the leg's end.
  walksOn?: Toes | Sole;
};
// A leg posed: hip (or shoulder); knee (the stifle on a hind leg, the elbow
// on a foreleg); ankle (the hock, or the wrist; the foot itself where there
// is no bone up from the toes); foot; and how far the paw is turned from
// flat (degrees, toes down), as the bone above it folds.
export type Limb = Leg & { ankle: Point; paw: number };
// stance: the share of each cycle a foot is down. A walk keeps three feet
// down (0.75, four beats); a trot moves diagonal pairs together (about 0.5).
// beats: when in the cycle each leg steps, 0 to 1, in the rig's order of
// legs; a later beat sets its foot down sooner.
export type Gait = { stride: number; lift: number; stance: number; beats: readonly number[] };

// How far through its stride cycle an animal is: what its feet step to, and
// what its body's bob and nod keep time with.
export const gaitPhase = (walked: number, gait: Gait) => walked / cycleLength(gait.stride, gait.stance);

// Where each foot is in its step, this far into the walk.
export function stepsOf(walked: number, gait: Gait): Step[] {
  const phase = gaitPhase(walked, gait);
  return gait.beats.map((beat) => stepAt(phase, beat, gait.stance));
}

export const steppingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], steps: readonly Step[], ground: number, gait: Gait): Point[] =>
  specs.map((s, i) => footOf(hips[i].x + s.reach, steps[i], ground, gait.stride, gait.lift));

// Stepping this far into the walk: where the feet go from wherever the body
// has moved the hips, and each foot's step, for legsTo to fold or roll it.
export function stepping(specs: readonly QuadLeg[], walked: number, ground: number, gait: Gait) {
  const steps = stepsOf(walked, gait);
  return { feet: (hips: readonly Point[]) => steppingFeet(specs, hips, steps, ground, gait), steps };
}

// Stood still: every foot down at its resting reach.
export const restingFeet = (specs: readonly QuadLeg[], hips: readonly Point[], ground: number): Point[] =>
  specs.map((s, i) => ({ x: hips[i].x + s.reach, y: ground }));

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
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
// How far a sole walker's foot is rolled up onto its toes (0 flat, 1 its
// full peel): flat through most of its time down, the heel peeling up as it
// pushes off, then flattening again low through the swing so it lands flat.
export function roll(step?: Step): number {
  if (!step) return 0;
  return step.down ? smooth((step.t - 0.6) / 0.4) : 1 - smooth(step.t / 0.8);
}

// Where the bone up from the toes starts, folded `fold` degrees back from
// standing: rotating it that way swings the paw back behind the joint.
function ankleOf(toes: Toes, foot: Point, fold: number): Point {
  const angle = ((toes.lean - fold) * Math.PI) / 180;
  return { x: foot.x - toes.length * Math.sin(angle), y: foot.y - toes.length * Math.cos(angle) };
}

// One leg posed from its hip to its foot. A sole walker's heel is turned up
// about its toe tips, which stay planted, as the foot rolls; a toe walker's
// bone up from the toes folds back as the paw swings.
function limbOf(spec: QuadLeg, hip: Point, foot: Point, step?: Step): Limb {
  const knee = (to: Point) => kneeToward(hip, to, spec.thigh, spec.shin, spec.bend);
  const on = spec.walksOn;
  if (!on) return { hip, knee: knee(foot), ankle: foot, foot, paw: 0 };
  if (on.kind === 'sole') {
    const paw = on.peel * roll(step);
    const heel = rotate(foot, { x: foot.x + on.toes.x, y: foot.y + on.toes.y }, paw);
    return { hip, knee: knee(heel), ankle: heel, foot: heel, paw };
  }
  const fold = on.fold * flexion(step);
  const ankle = ankleOf(on, foot, fold);
  return { hip, knee: knee(ankle), ankle, foot, paw: fold };
}

// Each leg posed from its hip to its foot; `steps` (from stepsOf), when
// stepping, fold the bones up from the toes as they swing, or roll a sole
// walker's feet.
export const legsTo = (specs: readonly QuadLeg[], hips: readonly Point[], feet: readonly Point[], steps: readonly Step[] = []): Limb[] =>
  specs.map((s, i) => limbOf(s, hips[i], feet[i], steps[i]));

// Hares and rabbits do not walk or trot: they bound. Their gaits are
// asymmetrical (Hildebrand 1977), named by when each foot lands: a bound
// lands each pair together; a half-bound its hind pair together and its
// forefeet one after the other; the slow hop of a grazing hare or a rabbit
// sets its forefeet down one then the other and swings its hind pair
// forward together to land near them. Faster, the hind feet land ahead of
// where the forefeet were set, and the body flies between the hind feet
// pushing off and the forefeet landing (an extended suspension).

// When in the cycle (0 to 1) each foot lands, the near and the far of each
// pair.
export type Landings = { fore: { near: number; far: number }; hind: { near: number; far: number } };

const fract = (n: number) => n - Math.floor(n);

// The beats (stepsOf's) that land each foot when Landings says, in the
// rig's order of legs.
export const beatsFor = (specs: readonly QuadLeg[], landings: Landings): number[] =>
  specs.map((s) => {
    const pair = s.fore ? landings.fore : landings.hind;
    return fract(1 - (s.far ? pair.far : pair.near));
  });

// A stretch of the cycle when no foot is down: where it starts (0 to 1) and
// how long it lasts, as shares of the cycle.
export type Flight = { from: number; length: number };

// A gait's flights: none for a walk or a slow hop.
export function flightsOf(gait: Gait): Flight[] {
  // Each foot's time down, unwrapped a cycle either way so the ones running
  // past the cycle's end merge with those at its start.
  const downs = gait.beats.flatMap((b) => [-1, 0, 1].map((k) => fract(1 - b) + k)).sort((a, b) => a - b);
  const merged = downs.reduce<{ from: number; to: number }[]>((all, from) => {
    const last = all.at(-1);
    const to = from + gait.stance;
    return last && from <= last.to ? [...all.slice(0, -1), { from: last.from, to: Math.max(last.to, to) }] : [...all, { from, to }];
  }, []);
  return merged.slice(1).flatMap((next, i) => {
    const end = merged[i].to;
    return end >= 0 && end < 1 && next.from - end > 1e-9 ? [{ from: end, length: next.from - end }] : [];
  });
}

// Where in a flight the animal is at this phase of its cycle (0 leaving the
// ground to 1 landing), and that flight's length; null while a foot is down.
export function flightAt(phase: number, gait: Gait): { t: number; length: number } | null {
  const p = fract(phase);
  const flight = flightsOf(gait).find((f) => fract(p - f.from) < f.length);
  return flight ? { t: fract(p - flight.from) / flight.length, length: flight.length } : null;
}

// How far the body rises at this phase: a parabola over each flight, its
// peak `height` for the longest flight and lower for shorter ones, so a gait
// with a flight phase carries its body up off the ground and down again.
export function flightLift(phase: number, gait: Gait, height: number): number {
  const at = flightAt(phase, gait);
  if (!at) return 0;
  const longest = Math.max(...flightsOf(gait).map((f) => f.length));
  return height * (at.length / longest) * 4 * at.t * (1 - at.t);
}

// Toe walkers let down onto their whole foot by `amount`: 0 on their toes
// as specified, 1 flat, the bone up from the toes laid along the ground
// behind them from the hock to the toes. A hare or rabbit sits so, on its
// long hind feet, and runs on its toes. By default the hind legs only.
export const onSoles = (specs: readonly QuadLeg[], amount: number, which: (s: QuadLeg) => boolean = (s) => !s.fore): QuadLeg[] =>
  specs.map((s) => {
    const on = s.walksOn;
    if (on?.kind !== 'toes' || !which(s)) return s;
    return { ...s, walksOn: { ...on, lean: on.lean + (90 - on.lean) * clamp(amount, 0, 1) } };
  });
