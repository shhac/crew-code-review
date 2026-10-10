import { degrees, mixPoint, rad, smooth } from '../math';
import type { Point } from '../pointer';
import { cycleLength, rotate } from '../spidergait';
import { flexion, gaitPhase, type Gait, type Limb, type Step, type Toes } from './gait';
import { jointBeside } from './limb';
import type { ArtLeg, Foot } from './rig';

// A bird's two legs (July's pigeons, August's gulls, September's crows). A
// bird stands on its toes, and its leg has a mammal's hind-leg joints, most
// of them out of sight (Wikipedia, Bird feet and legs; birds-online.de on
// the hidden knee):
//
// - the hip, high in the body, and the femur, short, running forward to the
//   knee, both inside the body's feathers and never drawn;
// - the knee, pointing forward, and below it the tibiotarsus (the
//   drumstick), running down and back to
// - the intertarsal joint, the ankle: the joint that points backward and is
//   taken for a backward knee;
// - the tarsometatarsus (the tarsus, the bare scaly shank) from the ankle
//   down and a little forward to the metatarsophalangeal joint, where
// - the toes stand flat on the ground: three forward and the hallux back
//   (a gull's raised, small and high).
//
// So a bird's leg is a rig leg (rig.ts's ArtLeg) read this way: `thigh` is
// the femur and `shin` the drumstick, solved between the hip and the ankle
// with the knee kept forward (limb.ts's jointBeside); `walksOn` toes is the
// tarsus (its length, how far its foot end leans ahead of the ankle
// standing, and how far the ankle folds it back as the foot swings); and the
// limb's `foot` is the metatarsophalangeal joint, where the toes' picture
// stands. Its art has `inBody` (the femur never drawn) and a `curled` foot.

export type BirdLeg = ArtLeg & {
  walksOn: Toes;
  // Where the toe tips press the ground, from the metatarsophalangeal
  // joint (ahead of it and down to the ground), and how far (degrees) that
  // joint peels up over them as the foot leaves: a foot lifts heel first,
  // its toes peeling off the ground from the joint out (PeerJ 2023, on the
  // mallard's webbed foot).
  toes: Point;
  peel: number;
};

// The knee is forward of the line from the hip to the ankle: on its left as
// the leg points down (limb.ts's sides).
const KNEE: 1 | -1 = -1;

// How far a foot is peeled up over its toes: flat through most of its time
// down, the heel rising as it pushes off, then laid flat again early in the
// swing as the toes leave the ground.
export function peeled(step?: Step): number {
  if (!step) return 0;
  return step.down ? smooth((step.t - 0.6) / 0.4) : 1 - smooth(step.t / 0.3);
}

// Whether the toes are drawn together: through the swing once they are off
// the ground, spread again before the foot lands (a gull's webbed toes
// close as they swing and open to land; a pigeon's and a crow's curl).
export const curledIn = (step?: Step): boolean => !!step && !step.down && step.t > 0.15 && step.t < 0.8;

// How far (degrees) the leg as a whole is swung forward of standing: the
// tarsus swings with it, like a pendulum from the foot, so the bones above
// keep their fold through a step instead of straightening.
const swungBy = (spec: BirdLeg, hip: Point, foot: Point) => degrees(Math.atan2(foot.x - (hip.x + spec.reach), foot.y - hip.y));

// Where the ankle is, the tarsus running up from the metatarsophalangeal
// joint at `lean` degrees from straight down, its foot end ahead.
const ankleAbove = (spec: BirdLeg, mtp: Point, lean: number): Point =>
  ({ x: mtp.x - spec.walksOn.length * Math.sin(rad(lean)), y: mtp.y - spec.walksOn.length * Math.cos(rad(lean)) });

// The two bones above the ankle, the knee forward.
const kneeOf = (spec: BirdLeg, hip: Point, ankle: Point) => jointBeside(hip, ankle, spec.thigh, spec.shin, KNEE);

// How far below the metatarsophalangeal joint a foot's drawing reaches,
// turned `paw` degrees about it.
function depth(foot: Foot, paw: number): number {
  const corners = [0, foot.width].flatMap((x) => [0, foot.height].map((y) => ({ x: x - foot.heel.x, y: y - foot.heel.y })));
  return Math.max(...corners.map((c) => rotate(c, { x: 0, y: 0 }, paw).y));
}

// One leg on the ground or stepping, from its hip to where its foot goes
// (the metatarsophalangeal joint's place before any peel). Given the
// ground, a swinging foot is lifted as far as it must be for its toes to
// clear it.
function birdLimb(spec: BirdLeg, hip: Point, foot: Point, step?: Step, ground?: number): Limb {
  const peel = spec.peel * peeled(step);
  // The heel rises about the planted toe tips, which stay where they are.
  const peeledTo = peel ? rotate(foot, { x: foot.x + spec.toes.x, y: foot.y + spec.toes.y }, peel) : foot;
  const fold = spec.walksOn.fold * flexion(step);
  const swung = swungBy(spec, hip, foot);
  // Planted, the toes lie flat however the tarsus leans over them; lifted,
  // they hang from it and turn with it, flat again to land. Drawn together,
  // they are drawn hanging already.
  const hanging = step && !step.down ? smooth(step.t / 0.3) * (1 - smooth((step.t - 0.7) / 0.3)) : 0;
  const curled = curledIn(step) && !!spec.art.curled;
  const paw = curled ? -swung * hanging : peel + fold - swung * hanging;
  const drawn = (curled && spec.art.curled) || spec.art.foot;
  const clear = ground === undefined || step?.down !== false ? 0 : Math.max(0, peeledTo.y + depth(drawn, paw) - ground);
  const mtp = { x: peeledTo.x, y: peeledTo.y - clear };
  const ankle = ankleAbove(spec, mtp, spec.walksOn.lean - fold + swung);
  return { hip, knee: kneeOf(spec, hip, ankle), ankle, foot: mtp, paw, curled: curledIn(step) };
}

// Each leg posed from its hip to its foot, as gait.ts's legsTo does for a
// four-legged animal; `steps` (gait.ts's stepsOf, or stepping's) peel the
// feet as they push off, fold the ankles and draw the toes together as they
// swing; `ground`, where the toes stand, keeps every swinging foot's
// drawing above it.
export const birdLegsTo = (specs: readonly BirdLeg[], hips: readonly Point[], feet: readonly Point[], steps: readonly Step[] = [], ground?: number): Limb[] =>
  specs.map((s, i) => birdLimb(s, hips[i], feet[i], steps[i], ground));

// A bird's walk: two legs half a cycle apart, each foot down for more than
// half the stride, so both are down for a moment at each change (Gatesy and
// Biewener 1991; a walk's duty factor is over a half). The gull's, the
// pigeon's and the crow's notes all take 0.6. Beats in the rig's order of
// its two legs.
export const BIRD_STANCE = 0.6;
export const birdWalk = (stride: number, lift: number, stance = BIRD_STANCE): Gait => ({ stride, lift, stance, beats: [0, 0.5] });

const fract = (n: number) => n - Math.floor(n);

// How far through its current step the walk is, 0 as a foot lands to 1 as
// the next does: what a head bob and a body's rise keep time with.
export function stepPhase(walked: number, gait: Gait): number {
  const p = fract(gaitPhase(walked, gait));
  const landings = gait.beats.map((b) => fract(1 - b)).sort((a, b) => a - b);
  const last = [...landings].reverse().find((l) => l <= p) ?? landings[landings.length - 1] - 1;
  const next = landings.find((l) => l > p) ?? landings[0] + 1;
  return (p - last) / (next - last);
}

// How far the body moves in one step: a stride cycle shared between the
// feet.
export const stepLength = (gait: Gait) => cycleLength(gait.stride, gait.stance) / gait.beats.length;

// The head bob of a walking pigeon or crow (gulls do not bob): how far
// forward of where it sits standing the head is, along the body, in
// drawing units. It moves in two phases, one bob per step (Necker's review,
// after Frost 1978 and Troje and Frost 2000): a quick forward thrust, which
// starts in double support just after the front foot lands, then a hold
// through the single support that follows, in which the head stays still in
// space while the body walks on beneath it, so against the body it slides
// back. `thrust` is the thrust's share of a step (a crow's is about 0.45:
// 0.15s of thrust to 0.2s of hold); a faster walk shortens the hold, so a
// month may raise it with speed. Centred, so standing and walking share the
// head's middle place.
export function headBob(walked: number, gait: Gait, thrust: number): number {
  const length = stepLength(gait);
  const s = stepPhase(walked, gait);
  // Against the ground, the head jumps a whole step forward in the thrust
  // and holds in the rest; the body moves on steadily under it.
  const ahead = s < thrust ? smooth(s / thrust) : 1;
  return length * (ahead - s) - (length * (1 - thrust)) / 2;
}

// How high the body rides through a step, 0 to 1: lowest as a foot lands,
// highest midway through the single support, as the body vaults over the
// planted leg; a gull's strut rises and falls so once a step.
export const stepRise = (walked: number, gait: Gait): number => (1 - Math.cos(2 * Math.PI * stepPhase(walked, gait))) / 2;

// Legs in the air: from tucked up under the body (0) to trailing back
// after pushing off (-1, as a raptor's do for its first beats) or reaching
// forward and down to take the ground (1: a landing bird swings its legs
// forward to meet it; Berg and Biewener 2010; Provini et al. 2014). Each is
// where the ankle goes from the hip, in shares of the two bones above it,
// and the tarsus's lean (degrees from straight down, its foot end ahead):
// tucked, folded forward along the belly; trailing, laid out behind;
// reaching, angled forward to the ground.
export type AirLeg = { ankle: Point; lean: number };
export type AirLegs = { tucked: AirLeg; trailing: AirLeg; reaching: AirLeg };
export const AIR_LEGS: AirLegs = {
  tucked: { ankle: { x: -0.25, y: 0.65 }, lean: 105 },
  trailing: { ankle: { x: -0.8, y: 0.45 }, lean: -100 },
  reaching: { ankle: { x: 0.25, y: 0.85 }, lean: 45 },
};

// The leg's place in the air, `reach` from -1 (trailing) through 0
// (tucked) to 1 (reaching).
function airLeg(reach: number, at: AirLegs): AirLeg {
  const to = reach < 0 ? at.trailing : at.reaching;
  const t = Math.min(1, Math.abs(reach));
  return { ankle: mixPoint(at.tucked.ankle, to.ankle, t), lean: at.tucked.lean + (to.lean - at.tucked.lean) * t };
}

// One leg in the air, the knee forward of it, the toes drawn together until
// it reaches to land, their picture turned with the tarsus from where it
// stands.
function airLimb(spec: BirdLeg, hip: Point, reach: number, at: AirLegs): Limb {
  const { ankle: share, lean } = airLeg(reach, at);
  const above = spec.thigh + spec.shin;
  const ankle = { x: hip.x + share.x * above, y: hip.y + share.y * above };
  const foot = { x: ankle.x + spec.walksOn.length * Math.sin(rad(lean)), y: ankle.y + spec.walksOn.length * Math.cos(rad(lean)) };
  return { hip, knee: kneeOf(spec, hip, ankle), ankle, foot, paw: spec.walksOn.lean - lean, curled: reach < 0.6 };
}

// Where a foot in the air is.
export const airFoot = (spec: BirdLeg, hip: Point, reach: number, at: AirLegs = AIR_LEGS): Point => airLimb(spec, hip, reach, at).foot;

export const airLegsTo = (specs: readonly BirdLeg[], hips: readonly Point[], reach: number, at: AirLegs = AIR_LEGS): Limb[] =>
  specs.map((s, i) => airLimb(s, hips[i], reach, at));

// The lab's joints view names a bird's joints by these.
export const BIRD_JOINTS = { hip: 'hip', knee: 'knee', ankle: 'intertarsal joint (ankle)', foot: 'toes (metatarsophalangeal joint)' } as const;
