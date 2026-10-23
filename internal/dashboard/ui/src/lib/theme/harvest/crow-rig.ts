import { clamp, smooth } from '../math';
import type { Point } from '../pointer';
import { birdWalk, curledIn, feetLine, headBob, stepRise, type AirLegs, type BirdLeg } from '../rig/bird';
import { stepping } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, breath } from '../rig/life';
import { lidLayers, turnAbout, type Frame, type Fur, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { BIRD, head, picture, spine, tetrapod } from '../rig/skeleton/tetrapod';
import type { Goal, JointPose, PoseSpec } from '../rig/skeleton/types';
import { wingOf } from '../rig/skeleton/wing';
import { flaring, flapping, gliding, settling, takingOff, type Flap, type FlightPose, type WingArt, type WingPose } from '../rig/wings';
import bodyArt from './crow-body.webp';
import drumstickFurArt from './crow-drumstick-fur.webp';
import drumstickArt from './crow-drumstick.webp';
import curledFurArt from './crow-foot-curled-fur.webp';
import curledArt from './crow-foot-curled.webp';
import footFurArt from './crow-foot-fur.webp';
import footArt from './crow-foot.webp';
import headArt from './crow-head.webp';
import rumpArt from './crow-rump.webp';
import tailArt from './crow-tail.webp';
import tarsusFurArt from './crow-tarsus-fur.webp';
import tarsusArt from './crow-tarsus.webp';
import armUnderArt from './crow-wing-arm-under.webp';
import armArt from './crow-wing-arm.webp';
import foldedArt from './crow-wing-folded.webp';
import handUnderArt from './crow-wing-hand-under.webp';
import handArt from './crow-wing-hand.webp';

// The carrion crow put together from its parts on the bird kit
// (rig/bird.ts's legs, walk and head bob; rig/wings.ts's wings and flight
// poses): a body with its folded wing over it and a head at its neck, on two
// legs posed in code; in the air, the folded wing put away and two spread
// wings each of an arm and a hand; all hung on its skeleton (rig/skeleton).
// Facing right, its feet on the ledge at ANCHOR.
//
// The parts were cut from one drawing of the crow standing square
// (design-docs/harvest/crow-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. The critters lab lays
// that drawing, and the key poses, over the rig to compare.

// Page pixels per drawing unit, for every pose: the reference stands 26.5px
// tall (design-docs/harvest/README.md).
export const SCALE = 1;

const GROUND = 27.75;
const ANCHOR = { x: 21.7, y: GROUND };
const FRAME: Frame = { width: 41, height: 28.8, anchor: ANCHOR, scale: SCALE };
export const REFERENCE = { x: 1, y: 1, width: 39, height: 27 };
const BODY = { x: 15.25, y: 5.66, width: 17.67, height: 16.33 };
// The rump and undertail coverts behind the body, drawn as one with it and
// cut away only so the body's box stays where its feathers are: running
// back over the tail's root, so no gap shows between the tail and the
// belly, standing or flying.
const RUMP = { x: 10.97, y: 12.38, width: 4.83, height: 9.33 };
const HEAD = { x: 24.96, y: 1.19, width: 14.83, height: 10.83 };
// Moved in from where the reference has it, so its root runs on under the
// rump.
const TAIL = { x: 2.6, y: 16.9, width: 14.58, height: 8.08 };
const FOLDED_WING = { x: 10.3, y: 8.41, width: 19.42, height: 10.17 };
export const EYE = { x: 32.17, y: 4.33 };
// The bill's tip, where a peck strikes.
const BILL = { x: 39.7, y: 6 };
const NECK = { x: 28, y: 9.5 };
const TAIL_ROOT = { x: 16.6, y: 18.3 };
// The body rolls about its middle, over the legs, and pitches about its
// hips, so pitched up to land its tail stays above the ledge.
const MIDDLE = { x: 23, y: 15 };
const HIPS = { x: 22.5, y: 18 };
// Pecking, it tips forward over its legs, crouching a little so neither leg
// is stretched past its reach.
const LEG_ROOTS = { x: 21.5, y: 17.75 };
// The head turns toward a cursor at most LOOK degrees, and up only LOOK_UP,
// so the crown stays inside the 27px the crow stands in.
const LOOK = 14;
const LOOK_UP = 2;
// The nictitating membrane: pale blue-grey, drawn across the eye.
const MEMBRANE: Fur = { fill: '#aab9c7', outline: '#0b0c0e' };

// The legs, as the reference's are: the hips high in the body, the femur
// forward and down to the knee in the belly feathers, the feathered
// drumstick down and back to the intertarsal joint where the trousers end,
// the bare tarsus leaning its foot end forward to the toes. Measured on the
// reference: the trousers end 21.8 units down, the toes' joint 25.55, the
// tarsus about 4 units, leaning 9 (far) to 28 (near) degrees, here 16.
const FOOT = { src: footArt, fur: footFurArt, width: 5.58, height: 2.5, heel: { x: 1.9, y: 0.3 } };
const CURLED = { src: curledArt, fur: curledFurArt, width: 2.42, height: 2.67, heel: { x: 0.95, y: 0.3 } };
const LEG_ART: LimbArt = {
  bone: tarsusArt, boneFur: tarsusFurArt, knee: true, inBody: true,
  thigh: { src: drumstickArt, fur: drumstickFurArt }, foot: FOOT, curled: CURLED,
};
const LEG = {
  art: LEG_ART, width: 0.85, haunch: 1.6, thigh: 2.5, shin: 2.4, bend: 1, fore: false,
  walksOn: { kind: 'toes', length: 3.9, lean: 16, fold: 40 }, toes: { x: 3.68, y: 2.2 }, peel: 22,
} as const;
const LEGS: BirdLeg[] = [
  { ...LEG, hip: { x: 20.4, y: 17.6 }, reach: -0.6, far: true },
  { ...LEG, hip: { x: 22.6, y: 17.9 }, reach: 0.9, far: false },
];
const FEET = feetLine(GROUND, FOOT);

// The walk: one foot after the other, each down for 0.6 of the stride, the
// head bobbing once a step, its thrust about 0.45 of it (0.15s of thrust to
// 0.2s of hold; the harvest note's research).
const WALK = birdWalk(4.2, 1.1);
const THRUST = 0.45;
// A sidle is a hurried walk, the same legs at a longer stride.
const SIDLE = birdWalk(5.2, 1.3);

// The wing, as drawn flat, its span up the picture: the shoulder where the
// arm's rounded root meets the body, the wrist at the arm's tip near its
// leading edge, the hand overlapping it there. Shoulder to the longest
// primary's tip is about the bird's length.
const WING: WingArt = {
  name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: -1.6, y: -14.2 },
  arm: { upper: armArt, under: armUnderArt, x: -6.6, y: -15.4, width: 9.42, height: 16.33 },
  hand: { upper: handArt, under: handUnderArt, x: -6, y: -34, width: 8.83, height: 20.67 },
};
const TIP = { x: -1.5, y: -33.6 };
const NEAR_SHOULDER = { x: 25.2, y: 10.6 };
const FAR_SHOULDER = { x: 26.6, y: 10 };
// A crow's stroke: full strokes 50 degrees above level to 40 below; skim
// strokes 15 either way (the note), the downstroke 55% of the beat.
const FLAP: Flap = { top: 50, bottom: -40, down: 0.55, fold: 70, sweep: 20 };
const SKIM: Flap = { top: 15, bottom: -15, down: 0.55, fold: 30, sweep: 10 };
// A stroke between a skim's and a full one.
const strokes = (depth: number): Flap => {
  const mixed = (k: keyof Flap) => SKIM[k] + (FLAP[k] - SKIM[k]) * depth;
  return { top: mixed('top'), bottom: mixed('bottom'), down: FLAP.down, fold: mixed('fold'), sweep: mixed('sweep') };
};
// How far a landing crow pitches up, braking.
const UPRIGHT = 26;
const GLIDE: WingPose = { lift: 4, sweep: 5, fold: 10 };
// Pushing off, a crow's legs stretch down and back; tucked up under it in
// flight; reaching forward to land.
const CROW_AIR: AirLegs = {
  tucked: { ankle: { x: -0.3, y: 0.6 }, lean: 105 },
  trailing: { ankle: { x: -0.45, y: 0.85 }, lean: -40 },
  reaching: { ankle: { x: 0.3, y: 0.85 }, lean: 40 },
};

export type CrowPose = 'stand' | 'walk' | 'sidle' | 'peck' | 'alert' | 'takeoff' | 'flap' | 'skim' | 'glide' | 'flare' | 'settle';
const GROUND_POSES: readonly CrowPose[] = ['stand', 'walk', 'sidle', 'peck', 'alert'];
// What the drawing reads of a crow: its pose, how far it has walked, its
// wingbeats so far (`beat`), and how far through a peck, a flare or a
// settle it is (`t`, 0 to 1). `depth` sets its strokes from a skim's (0)
// to full (1), flapping, taking off and landing alike; `climb` pitches its
// body with the route's slope (degrees, nose up).
export type RigCrow = { pose: CrowPose; walked: number; seed: number; beat: number; t: number; depth?: number; climb?: number };
// gaze: how far its head is turned toward a cursor (degrees, nose down).
type CrowLook = { now: number; still: boolean; gaze: number };

// The tail about its root: lifted (degrees, up positive) and fanned.
const tailOf = (lift: number, fan: number): JointPose => ({ angle: lift, squash: { by: 1 + 0.4 * fan } });

const planted = (hips: readonly Point[]): Goal[] => LEGS.map((leg, i) => ({ kind: 'plant', at: { x: hips[i].x + leg.reach, y: FEET } }));

// How it stands on the ledge: the body's turn, the head's at its neck, the
// tail's, and each foot's goal from where its hip is.
type Ground = { body: Turn; head: JointPose; tail: number; goals: (hips: readonly Point[]) => Goal[] };

// A peck's dip, 0 to 1: down to strike 0.6 of the way through, a moment
// held, then lifted.
const dip = (t: number) => (t < 0.6 ? smooth(t / 0.6) : 1 - smooth((t - 0.7) / 0.3));

// On the ledge, by pose. The body pitches about the hips (forward to peck,
// back to stand alert), the head turns at the neck.
function onGround(crow: RigCrow, look: CrowLook): Ground {
  // Looking up turns the crown over the box it stands in; down, the bill.
  const gaze = look.still ? 0 : clamp(look.gaze, -LOOK_UP, LOOK);
  const breathe = look.still ? 0 : 0.1 * breath(crow.seed, look.now, 3200);
  if (look.still || crow.pose === 'stand') {
    return { body: turnAbout(0, MIDDLE, 0, -breathe), head: { angle: gaze }, tail: 0, goals: planted };
  }
  if (crow.pose === 'alert') {
    // Body up, neck stretched, sleeked.
    return { body: turnAbout(-12, HIPS, 0, -breathe), head: { angle: gaze - 6, shift: { x: 0.4, y: -1.1 } }, tail: 10, goals: planted };
  }
  if (crow.pose === 'peck') {
    // Tipped forward from the hips between pecks, further at each strike,
    // the neck reaching down and the tail lifting behind.
    const d = dip(crow.t);
    return { body: turnAbout(24 + 10 * d, LEG_ROOTS, 0, 0.5), head: { angle: 26 + 26 * d, shift: { x: -1.2 * d, y: 1.6 * d } }, tail: -4 + 4 * d, goals: planted };
  }
  const gait = crow.pose === 'sidle' ? SIDLE : WALK;
  const walked = crow.walked / SCALE;
  const rise = 0.25 * stepRise(walked, gait);
  const { feet, steps } = stepping(LEGS, walked, FEET, gait);
  return {
    body: turnAbout(0, MIDDLE, 0, -rise),
    head: { angle: gaze, shift: { x: headBob(walked, gait, THRUST), y: rise } },
    tail: 0,
    goals: (hips) => feet(hips).map((at, i) => ({ kind: 'plant', at, step: steps[i], ground: GROUND })),
  };
}

// In the air, by its pose: the wings, the body's pitch, the legs and tail.
function inAir(crow: RigCrow, now: number): FlightPose {
  // Low in the air (a skim's take-off or landing), it pitches up less too.
  const depth = crow.depth ?? 1;
  const upright = UPRIGHT * (0.3 + 0.7 * depth);
  const cruise = (wings: WingPose): FlightPose => ({ wings, pitch: 0, legs: 0, tail: 0, airborne: true });
  switch (crow.pose) {
    // The first strokes kept from sweeping below the ledge it leaves; where
    // the air is low (depth 0) it springs off with its wings only half
    // raised and skims away.
    case 'takeoff': return takingOff(crow.beat, { ...strokes(depth), bottom: -15 - 10 * depth }, 20 + 55 * depth, 2);
    case 'skim': return cruise(flapping(crow.beat, SKIM));
    case 'glide': return cruise(gliding(GLIDE, now, 2));
    case 'flare': {
      // A crow's long wings swept as far forward as the kit's flare would
      // cover its head; it brakes with them raised and less far forward,
      // as the landing key pose has them.
      // Landing low, it brakes without the kit's raised stroke either.
      const flare = flaring(crow.t, crow.beat, strokes(depth), upright);
      const braking = smooth(crow.t / 0.6);
      return { ...flare, wings: { ...flare.wings, lift: flare.wings.lift - 15 * (1 - depth) * braking, sweep: flare.wings.sweep + 30 * braking } };
    }
    case 'settle': return settling(crow.t, { lift: 15 + 45 * depth, sweep: -10, fold: 10 }, upright / 2);
    default: return cruise(flapping(crow.beat, strokes(crow.depth ?? 1)));
  }
}

// How far the body tips forward from its standing slant to fly level: a
// crow stands at about 30 degrees and flies with its body near level. It
// tips as it leaves the ledge and rises again through the flare, so a
// flight's poses run on from the ground's without a jump.
const LEVEL = 22;
function levelled(crow: RigCrow): number {
  switch (crow.pose) {
    case 'takeoff': return LEVEL * smooth((crow.beat + 0.2) / 0.8);
    case 'flare': return LEVEL * (1 - smooth(crow.t));
    case 'settle': return 0;
    default: return LEVEL;
  }
}

// Its skeleton: the body, which rolls about its middle, pitches about its
// hips and tips forward over its legs to peck; the head on its neck, the
// eye and the bill on it; the tail at its root; each leg from its hip high
// in the body; and, in the air, the wings. The legs start inside the body:
// the far leg drawn behind it, the near outlined behind it too and its fur
// over its edge (or, tucked up in flight, into the belly feathers, behind
// it). In the air the far wing is behind it all, the near over it all.
const NEAR_WING = wingOf({ art: WING, side: 'near', parent: 'body', root: NEAR_SHOULDER, tip: TIP, z: 0 });
const FAR_WING = wingOf({ art: WING, side: 'far', parent: 'body', root: FAR_SHOULDER, tip: TIP, z: 0 });
const PARTS = [
  picture('tail', 'tail', tailArt, TAIL), picture('rump', 'body', rumpArt, RUMP), picture('body', 'body', bodyArt, BODY),
  picture('folded wing', 'body', foldedArt, FOLDED_WING), picture('head', 'skull', headArt, HEAD), 'eyelid',
];
const crowOf = (air: boolean) => tetrapod(BIRD, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: MIDDLE, name: 'body pivot (its middle, its hips, or over its legs)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'bill', parent: 'skull', role: head(1), at: BILL, name: 'bill' },
    { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
    ...(air ? [...FAR_WING.joints, ...NEAR_WING.joints] : []),
  ],
  bones: [
    // Its neck stretches and shortens as the head bobs, stretches up alert
    // and reaches down to peck.
    { from: 'skull', to: 'body', name: 'neck and back line', stretch: { min: 5.4, max: 8.6 } }, { from: 'body', to: 'tail', name: 'pelvis line (to the tail root)' },
    ...(air ? [...FAR_WING.bones, ...NEAR_WING.bones] : []),
  ],
  legs: LEGS,
  ground: () => FEET,
  order: air ? [FAR_WING.pieces, ...PARTS, NEAR_WING.pieces] : PARTS,
  shapes: [{ id: 'eyelid', on: 'skull' }],
  guides: (at) => [
    ...(air
      ? [{ name: 'shoulder', at: NEAR_WING.ids.shoulder }, { name: 'wrist', at: NEAR_WING.ids.wrist }, { name: 'wingtip', at: NEAR_WING.ids.tip }, { name: 'eye', at: 'eye' }]
      : [{ name: 'eye', at: 'eye' }, { name: 'bill', at: 'bill' }]),
    ...LEGS.flatMap((leg) => [0, 1, 2, 3].map((k) => ({ name: BIRD.legs.hind.joints[k], at: at(leg, k) }))),
  ],
});
const ON_GROUND = crowOf(false);
const IN_AIR = crowOf(true);

// Its toes drawn together while a foot swings (bird.ts's curledIn), or
// while a leg in the air is not reaching to land.
const curled = (goal: Goal) => (goal.kind === 'air' ? goal.reach < 0.6 : curledIn(goal.kind === 'plant' ? goal.step : undefined));
const feetShown = (goals: readonly Goal[]) => ON_GROUND.feet((_, i) => (curled(goals[i]) ? 'curled' : 'toes'));
const eyelid = (crow: RigCrow, look: CrowLook) => ({ eyelid: lidLayers(!look.still && blinking(crow.seed, look.now), EYE, 0.62, MEMBRANE) });

function flying(crow: RigCrow, look: CrowLook): RigPose {
  const pose = inAir(crow, look.now);
  const level = levelled(crow);
  const body = turnAbout(level - pose.pitch - (crow.climb ?? 0), HIPS);
  const folded = pose.wings.fold > 120;
  const [far, near] = [FAR_WING.pose(pose.wings, 0, !folded), NEAR_WING.pose(pose.wings, 0, !folded)];
  // Pitched up to brake, the long tail is lifted so it stays clear of the
  // ledge, fanned and pressed down a little against the air; the head held
  // level as the body tips forward under it.
  const joints = { ...far.joints, ...near.joints, tail: tailOf(0.75 * Math.max(0, pose.pitch - level) - 4 * pose.tail, pose.tail), skull: { angle: -0.8 * level } };
  const hips = IN_AIR.hips({ root: body, joints });
  const goals: Goal[] = pose.airborne ? LEGS.map(() => ({ kind: 'air', reach: pose.legs, legs: CROW_AIR })) : planted(hips);
  const show: PoseSpec['show'] = { ...far.show, ...near.show, ...feetShown(goals), 'folded wing': folded ? 'drawn' : false };
  // Tucked up in flight, the legs are hidden in the belly feathers, so even
  // the near leg's fur goes behind the body.
  const tucked = pose.airborne && Math.abs(pose.legs) < 0.25;
  return compose(IN_AIR.body, () => ({ root: body, joints, limbs: IN_AIR.limbs(goals), show, z: tucked ? IN_AIR.furUnder('near') : {}, shapes: eyelid(crow, look) }), look.now);
}

export const grounded = (pose: CrowPose) => GROUND_POSES.includes(pose);

export function crowRig(crow: RigCrow, look: CrowLook): RigPose {
  if (!grounded(crow.pose) && !look.still) return flying(crow, look);
  const { body, head: skull, tail, goals: goalsAt } = onGround(crow, look);
  const joints = { skull, tail: tailOf(tail, 0) };
  const goals = goalsAt(ON_GROUND.hips({ root: body, joints }));
  return compose(ON_GROUND.body, () => ({ root: body, joints, limbs: ON_GROUND.limbs(goals), show: feetShown(goals), z: {}, shapes: eyelid(crow, look) }), look.now);
}

// How far the head turns toward a cursor: at most 14 degrees, from 160px.
export const crowGaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: LOOK, reach: 160 });

// The lab's speeds: the walk about three steps a second at 20px/s.
export const WALK_SPEED = 20;
export const SIDLE_SPEED = 45;
// The box each pose's drawing stays inside through its whole motion (page
// px, standing on the anchor; `down` below it), as crow-rig.test.ts
// measures them. On the ledge the little `down` is the clear corner of a
// picture's box (the breast's, tipped forward to peck; a lifted foot's),
// never the drawing; in the air, the wings below the line it flies along.
export type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<CrowPose, Footprint> = {
  stand: { width: 40, height: 27.5 }, walk: { width: 42, height: 27.5, down: 0.2 }, sidle: { width: 42.5, height: 27.5, down: 0.2 },
  peck: { width: 46.5, height: 24, down: 0.45 }, alert: { width: 38, height: 32.5 },
  takeoff: { width: 51.5, height: 51.5, down: 4.5 }, flap: { width: 52, height: 44, down: 6 }, skim: { width: 48, height: 28.5 },
  glide: { width: 48, height: 27 }, flare: { width: 45.5, height: 50, down: 3.5 }, settle: { width: 47.5, height: 48.5, down: 3 },
};
// Taking off, landing and settling low (depth 0), where only a skim fits.
export const LOW_FOOTPRINTS: Record<'takeoff' | 'flare' | 'settle', Footprint> = {
  takeoff: { width: 51, height: 30.5, down: 1 }, flare: { width: 43.5, height: 28.5, down: 1.5 }, settle: { width: 47.5, height: 28, down: 1.5 },
};
