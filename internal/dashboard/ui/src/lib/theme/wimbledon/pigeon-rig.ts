import { mix, smooth } from '../math';
import type { Point } from '../pointer';
import { AIR_LEGS, airLegsTo, birdLegsTo, birdWalk, BIRD_JOINTS, headBob, stepRise, type AirLegs, type BirdLeg } from '../rig/bird';
import { restingFeet, stepping, type Limb } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { legsAround, lidLayers, turnAbout, turned, type Frame, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { birdWing, flaring, flapping, settling, takingOff, wingPoint, type Flap, type FlightPose, type WingArt, type WingPose } from '../rig/wings';
import armUnderArt from './pigeon-arm-under.webp';
import armArt from './pigeon-arm.webp';
import bodyArt from './pigeon-body.webp';
import curledFurArt from './pigeon-foot-curled-fur.webp';
import curledArt from './pigeon-foot-curled.webp';
import footFurArt from './pigeon-foot-fur.webp';
import footArt from './pigeon-foot.webp';
import handUnderArt from './pigeon-hand-under.webp';
import handArt from './pigeon-hand.webp';
import headArt from './pigeon-head.webp';
import neckArt from './pigeon-neck.webp';
import shankFurArt from './pigeon-shank-fur.webp';
import shankArt from './pigeon-shank.webp';
import tailFanArt from './pigeon-tail-fan.webp';
import tailArt from './pigeon-tail.webp';
import thighFurArt from './pigeon-thigh-fur.webp';
import thighArt from './pigeon-thigh.webp';
import foldedArt from './pigeon-wing.webp';

// A feral pigeon put together from its parts on the bird kit (rig/bird.ts's
// legs and walk with its head bob, rig/wings.ts's wings and flight poses):
// a body with the folded wing laid over it, a head over its neck, a tail
// closed or fanned, two legs posed in code, and in the air two wings each of
// an arm and a hand. Facing right, on the ledge at ANCHOR.
//
// The parts were cut from one drawing of the pigeon standing square
// (design-docs/wimbledon/pigeon-standing-2.png), and the drawing units are
// that drawing's: export.py prints where each part sat in it, which is
// where it sits here, and the legs are measured from its legs. The critters
// lab lays that drawing, and the key poses, over the rig to compare.

// Page pixels per drawing unit, for every pose: the alert pose, the tallest
// on the ledge, then stands inside the 27px every ledge animal has (the
// note's "Sizes").
export const SCALE = 1.4;

const GROUND = 17.91;
const ANCHOR = { x: 11.6, y: GROUND };
const FRAME: Frame = { width: 22.2, height: 19, anchor: ANCHOR, scale: SCALE };
export const REFERENCE = { x: 1, y: 1, width: 20.17, height: 17 };
const BODY = { x: 8.02, y: 4.36, width: 12.17, height: 10.17 };
const FOLDED_WING = { x: 3.98, y: 5.75, width: 12.42, height: 6.92 };
const TAIL = { x: 1, y: 10.04, width: 7.92, height: 4.17 };
const TAIL_FAN = { x: 1, y: 7.64, width: 7.92, height: 8.92 };
const TAIL_ROOT = { x: 8.6, y: 12.1 };
const HEAD = { x: 13.45, y: 1, width: 7.67, height: 6.67 };
export const EYE = { x: 18.11, y: 2.94 };
// Where the head meets the neck, what it nods and pecks about.
const NECK = { x: 16.4, y: 5.6 };
const MIDDLE = { x: 12.5, y: 10 };
const HIPS = { x: 13.1, y: 12.6 };
// The blink is the nictitating membrane, pale across the eye.
const MEMBRANE: Fur = { fill: '#dfe6ea', outline: '#5b6670' };

// The legs, as the reference's are: the hips high in the body under the
// folded wing, the femur hidden running forward to the knee in the belly
// feathers, the drumstick down and back to the intertarsal joint just below
// them, and the bare coral tarsus leaning its foot end a little forward to
// the toes, three forward and the hallux back. Measured on the reference's
// near leg (53 source pixels to a unit): the tarsus 1.25 units, leaning
// 6 degrees, its top 1.7 units below the hips; the femur, never seen, as
// long as the legs need to reach through a stride.
const TOES = { src: footArt, fur: footFurArt, width: 4.67, height: 2.42, heel: { x: 1.59, y: 0.72 } };
const CURLED = { src: curledArt, fur: curledFurArt, width: 2.83, height: 2.75, heel: { x: 1.13, y: 0.41 } };
const LEG_ART: LimbArt = {
  bone: shankArt, boneFur: shankFurArt, knee: true, inBody: true,
  thigh: { src: thighArt, fur: thighFurArt }, foot: TOES, curled: CURLED,
};
const LEG = {
  art: LEG_ART, width: 0.45, haunch: 1.4, thigh: 2, shin: 1, bend: 1, fore: false,
  walksOn: { kind: 'toes', length: 1.25, lean: 6, fold: 45 }, toes: { x: 3.08, y: 1.7 }, peel: 25,
} as const;
const LEGS: BirdLeg[] = [
  { ...LEG, hip: { x: 13.3, y: 12.5 }, reach: -0.6, far: true },
  { ...LEG, hip: { x: 13, y: 12.7 }, reach: 0.9, far: false },
];
// Where each leg ends: on the toes' back, as high as they stand.
const FEET = GROUND - (TOES.height - TOES.heel.y);

// The walk: the feet half a cycle apart, each down for 0.6 of it (the
// note: a bipedal walk with double support), the stride as long as the
// drawn legs reach; the head thrust over just under half of each step.
export const WALK = birdWalk(3, 0.9);
const THRUST = 0.45;

// The wing, drawn flat with its span up the picture: the shoulder where the
// arm's root meets the body, the wrist at the arm's tip, the hand
// overlapping it there.
const WING: WingArt = {
  name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: -0.9, y: -8 },
  arm: { upper: armArt, under: armUnderArt, x: -3.9, y: -9.2, width: 5.58, height: 9.42 },
  hand: { upper: handArt, under: handUnderArt, x: -4, y: -16.6, width: 5.67, height: 10 },
};
const TIP = { x: -1.6, y: -16.2 };
const NEAR_SHOULDER = { x: 14.2, y: 7.6 };
const FAR_SHOULDER = { x: 15.3, y: 7 };
// A pigeon's stroke is deep: about 65 degrees above level to 50 below, the
// downstroke a little over half the beat, the hand flexed back hard on the
// upstroke at slow speeds (the tip-reversal upstroke doves use; Tobalske,
// Hedrick and Biewener 2003). Taking off, the wings meet over its back.
export const FLAP: Flap = { top: 40, bottom: -40, down: 0.55, fold: 90, sweep: 30 };
const CLAP = 90;
const LIFTING_BOTTOM = 25;
// The take-off's deep strokes ease into the plain flap over this many
// beats: quickly, since the air over a card is low (the note's "Sizes").
export const TAKEOFF_BEATS = 1.6;
// Braking to land, the body swings this far up.
const UPRIGHT = 25;
// Reaching to land, a pigeon's feet come down nearly flat under it, so its
// toes meet the ledge as it touches down rather than claws first.
// Tucked in flight, they are drawn up into the belly feathers, out of sight.
const PIGEON_AIR: AirLegs = {
  ...AIR_LEGS,
  tucked: { ankle: { x: -0.15, y: 0.42 }, lean: 110 },
  reaching: { ankle: { x: 0.15, y: 0.7 }, lean: 12 },
};
const RAISED: WingPose = { lift: 26, sweep: -10, fold: 15 };
// Wingbeats a second: 7 for the first three after take-off and landing,
// 5.5 in level flight (the note's research).
export const BEATS = { quick: 7, cruise: 5.5 };

export type PigeonPose = 'stand' | 'walk' | 'peck' | 'alert' | 'takeoff' | 'fly' | 'land' | 'settle';
// What the drawing reads of a pigeon: its pose, how far it has walked, its
// wingbeats so far (`beat`), how far through a peck, a landing or a settle
// it is (`t`, 0 to 1).
export type RigPigeon = { pose: PigeonPose; walked: number; seed: number; beat: number; t: number };
export type PigeonLook = { now: number; still: boolean };

const image = (name: string, src: string, box: { x: number; y: number; width: number; height: number }, hidden = false): Layer =>
  ({ kind: 'image', name, src, ...box, hidden });

// The neck: a piece of its feathers laid from the base of the neck in the
// body to where it meets the head, wherever the head has gone, so the head
// thrust out in a walk or down in a peck stays joined to the body. It runs
// under the body's soft top and the head's soft lower edge, so no outline
// crosses either join.
const NECK_BASE = { x: 15.8, y: 7.2 };
const NECK_TOP = { x: 16.2, y: 6.2 };
const NECK_THICK = 3.6;
function neckLayer(head: Turn): Layer {
  const top = turned(head, NECK_TOP);
  const length = Math.hypot(top.x - NECK_BASE.x, top.y - NECK_BASE.y);
  const angle = (Math.atan2(top.y - NECK_BASE.y, top.x - NECK_BASE.x) * 180) / Math.PI;
  return {
    kind: 'group', turn: turnAbout(angle, { x: 0, y: 0 }, NECK_BASE.x, NECK_BASE.y),
    layers: [image('neck', neckArt, { x: -NECK_THICK / 2, y: -NECK_THICK / 2, width: length + NECK_THICK, height: NECK_THICK })],
  };
}

const headLayer = (pigeon: RigPigeon, look: PigeonLook, head: Turn): Layer => ({
  kind: 'group', turn: head,
  layers: [image('head', headArt, HEAD), ...lidLayers(!look.still && blinking(pigeon.seed, look.now), EYE, 0.45, MEMBRANE)],
});

// A peck, `t` through it: the head goes down in steps, stopping to fixate,
// then a last quick thrust to the ground, and back up (Ostheim et al.
// 2020); the body tips forward over the legs.
function pecking(t: number): { body: number; head: number; down: number } {
  const lower = 0.55 * smooth(t / 0.25) + 0.45 * smooth((t - 0.35) / 0.15);
  const up = smooth((t - 0.7) / 0.3);
  const k = lower * (1 - up);
  return { body: 25 * k, head: 45 * k, down: k };
}

type Ground = { body: Turn; head: Turn; limbs: (hips: readonly Point[]) => Limb[]; tail: number };
const planted = (hips: readonly Point[]) => birdLegsTo(LEGS, hips, restingFeet(LEGS, hips, FEET));

// On the ledge: standing, walking with the head bob, pecking or alert.
function onGround(pigeon: RigPigeon, look: PigeonLook): Ground {
  const breathe = look.still ? 0 : 0.1 * breath(pigeon.seed, look.now, 3200);
  if (look.still || pigeon.pose === 'stand' || pigeon.pose === 'settle') {
    return { body: turnAbout(0, MIDDLE, 0, -breathe), head: turnAbout(0, NECK), limbs: planted, tail: 0 };
  }
  if (pigeon.pose === 'alert') {
    // Standing tall and sleek, the neck stretched up.
    return { body: turnAbout(-4, HIPS), head: turnAbout(-4, NECK, 0.3, -1.5), limbs: planted, tail: 0 };
  }
  if (pigeon.pose === 'peck') {
    const p = pecking(pigeon.t);
    // The head and its neck swing down together from the base of the neck,
    // the neck stretching to reach the ground.
    return { body: turnAbout(p.body, HIPS), head: turnAbout(p.head, NECK_BASE, 2.5 * p.down, 2.9 * p.down), limbs: planted, tail: -6 * p.down };
  }
  const walked = pigeon.walked / SCALE;
  // The body rides up over each planted leg; the head thrusts forward just
  // after a foot lands and holds still over the ground while the body walks
  // on under it.
  const rise = 0.2 * stepRise(walked, WALK);
  const { feet, steps } = stepping(LEGS, walked, FEET, WALK);
  return {
    body: turnAbout(0, MIDDLE, 0, -rise),
    head: turnAbout(0, NECK, headBob(walked, WALK, THRUST), rise),
    limbs: (hips) => birdLegsTo(LEGS, hips, feet(hips), steps, GROUND),
    tail: 0,
  };
}

// In the air, by its pose: the wings, the body's pitch, the legs and tail.
function inAir(pigeon: RigPigeon): FlightPose {
  switch (pigeon.pose) {
    // Its first strokes kept above the ledge it leaves, deepening as it
    // climbs clear of it.
    case 'takeoff': return takingOff(pigeon.beat, { ...FLAP, bottom: mix(LIFTING_BOTTOM, FLAP.bottom, smooth(pigeon.beat / TAKEOFF_BEATS)) }, CLAP, TAKEOFF_BEATS);
    case 'land': return flaring(pigeon.t, pigeon.beat, FLAP, UPRIGHT);
    case 'settle': return settling(pigeon.t, RAISED, UPRIGHT / 2);
    default: return { wings: flapping(pigeon.beat, FLAP), pitch: 0, legs: 0, tail: 0, airborne: true };
  }
}

// The tail, closed or fanned; `level` turns it back against the body's
// pitch (a little more than all of it), so a body swung up to brake keeps
// its tail out over the ledge rather than through it.
const tailLayers = (fan: number, level = 0): Layer[] => [
  { kind: 'group', turn: turnAbout(level, TAIL_ROOT), layers: [image('tail', tailArt, TAIL, fan >= 0.5)] },
  { kind: 'group', turn: turnAbout(level - 2 * fan, TAIL_ROOT), layers: [image('tail, fanned', tailFanArt, TAIL_FAN, fan < 0.5)] },
];

const jointGuides = (limbs: readonly Limb[]) => limbs.flatMap((l) => [
  { name: BIRD_JOINTS.hip, at: l.hip }, { name: BIRD_JOINTS.knee, at: l.knee }, { name: BIRD_JOINTS.ankle, at: l.ankle }, { name: BIRD_JOINTS.foot, at: l.foot },
]);

function flying(pigeon: RigPigeon, look: PigeonLook): RigPose {
  const pose = inAir(pigeon);
  const body = turnAbout(-pose.pitch, HIPS);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const limbs = pose.airborne ? airLegsTo(LEGS, hips, pose.legs, PIGEON_AIR) : planted(hips);
  const folded = pose.wings.fold > 120;
  const bodyLayers: Layer[] = [
    birdWing(WING, pose.wings, FAR_SHOULDER, true, 0, !folded),
    ...tailLayers(pose.tail, 1.3 * pose.pitch),
    neckLayer(turnAbout(0, NECK)),
    image('body', bodyArt, BODY),
    image('folded wing', foldedArt, FOLDED_WING, !folded),
    headLayer(pigeon, look, turnAbout(0, NECK)),
    birdWing(WING, pose.wings, NEAR_SHOULDER, false, 0, !folded),
  ];
  const [farLegs, farFur, nearLegs, drawn, nearFur] = legsAround(LEGS, limbs, { kind: 'group', turn: body, layers: bodyLayers });
  // Tucked up in flight, its feet are drawn into the belly feathers.
  const tucked = pose.airborne && Math.abs(pose.legs) < 0.25;
  return {
    ...FRAME,
    layers: tucked ? [farLegs, farFur, nearLegs, nearFur, drawn] : [farLegs, farFur, nearLegs, drawn, nearFur],
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'shoulder', at: turned(body, NEAR_SHOULDER) },
      { name: 'wrist', at: turned(body, wingPoint(WING, pose.wings, NEAR_SHOULDER, WING.wrist, false)) },
      { name: 'wingtip', at: turned(body, wingPoint(WING, pose.wings, NEAR_SHOULDER, TIP, true)) }, ...jointGuides(limbs),
    ],
  };
}

export function pigeonRig(pigeon: RigPigeon, look: PigeonLook): RigPose {
  const grounded = ['stand', 'walk', 'peck', 'alert'].includes(pigeon.pose);
  if (!grounded && !look.still) return flying(pigeon, look);
  const { body, head, limbs, tail } = onGround(pigeon, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = limbs(hips);
  const layers: Layer[] = [
    { kind: 'group', turn: turnAbout(tail, TAIL_ROOT), layers: tailLayers(0) },
    neckLayer(head), image('body', bodyArt, BODY), image('folded wing', foldedArt, FOLDED_WING), headLayer(pigeon, look, head),
  ];
  return {
    ...FRAME,
    // The legs start inside the body, the hips high in it.
    layers: legsAround(LEGS, legs, { kind: 'group', turn: body, layers }),
    guides: [{ name: 'stands here', at: ANCHOR }, { name: 'eye', at: turned(body, turned(head, EYE)) }, ...jointGuides(legs)],
  };
}

// The lab's speeds: the pigeon's walk, and its brisk shy.
export const WALK_SPEED = 18;
export const SHY_SPEED = 35;
// The box each pose's drawing stays inside through its whole motion (page
// px, standing on the anchor; `down` below it), as pigeon-rig.test.ts
// measures them.
export type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<PigeonPose, Footprint> = {
  stand: { width: 30, height: 24 }, walk: { width: 30, height: 24 }, peck: { width: 42.5, height: 24 }, alert: { width: 30.5, height: 27 },
  takeoff: { width: 34, height: 39.5, down: 1 }, fly: { width: 31, height: 30.5, down: 1 }, land: { width: 45.5, height: 36.5, down: 1.2 }, settle: { width: 31, height: 27 },
};
