import { apart, mix, smooth } from '../math';
import type { Point } from '../pointer';
import { AIR_LEGS, birdWalk, curledIn, feetLine, headBob, stepRise, type AirLegs, type BirdLeg } from '../rig/bird';
import { stepping, type Step } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, breath } from '../rig/life';
import { lidLayers, turnAbout, type Frame, type Fur, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { BIRD, head, picture, spine, tetrapod } from '../rig/skeleton/tetrapod';
import type { Goal, JointPose, Piece, PoseSpec } from '../rig/skeleton/types';
import { wingOf } from '../rig/skeleton/wing';
import { flaring, flapping, settling, takingOff, type Flap, type FlightPose, type WingArt, type WingPose } from '../rig/wings';
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
import neckFurArt from './pigeon-neck-fur.webp';
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
// an arm and a hand, all hung on its skeleton (rig/skeleton). Facing
// right, on the ledge at ANCHOR.
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
const BODY = { x: 6.23, y: 4.43, width: 13.83, height: 9.92 };
const FOLDED_WING = { x: 3.98, y: 5.75, width: 12.42, height: 6.92 };
const TAIL = { x: 1, y: 10.04, width: 7.92, height: 4.17 };
const TAIL_FAN = { x: 1, y: 7.64, width: 7.92, height: 8.92 };
const TAIL_ROOT = { x: 8.6, y: 12.1 };
const HEAD = { x: 13.45, y: 1, width: 7.67, height: 6.67 };
export const EYE = { x: 18.11, y: 2.94 };
// Where the head meets the neck, what it nods about, and the base of the
// neck, what it swings down from in a peck.
const NECK = { x: 16.4, y: 5.6 };
const NECK_BASE = { x: 15.8, y: 7.2 };
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
const FEET = feetLine(GROUND, TOES);

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
const FLAP: Flap = { top: 40, bottom: -40, down: 0.55, fold: 90, sweep: 30 };
const CLAP = 90;
const LIFTING_BOTTOM = 25;
// The take-off's deep strokes ease into the plain flap over this many
// beats: quickly, since the air over a card is low (the note's "Sizes").
const TAKEOFF_BEATS = 1.6;
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
// `gaze` turns its head (degrees, nose down positive) toward what it is
// looking at, standing or alert; eased by the layer.
export type RigPigeon = { pose: PigeonPose; walked: number; seed: number; beat: number; t: number; gaze?: number };
type PigeonLook = { now: number; still: boolean };

// The neck: the feathers between the body's shoulders and the head, cut
// from where they sat (the body and the head are each cut short of them),
// and stretched to the head wherever it has gone, so the head thrust out in
// a walk or down in a peck stays joined to the body by its own neck. Like a
// leg piece it is drawn twice: outlined under the body, its base outlined
// where it ends there, and as fur alone over the body's outlined cut, so
// standing it is the drawing as it was, and turned out from under the body
// its base is outlined and no line crosses the join. It runs under the
// head's soft lower edge.
const NECK_PIECE = { x: 13.5, y: 4.1, width: 7, height: 5.25 };
// It turns about a root deep in the body behind the shoulders, not at
// them: swung down to peck it then turns nearer as far as the head does, and
// its base stays down on the body rather than rising over the back.
const NECK_ROOT = { x: 14.5, y: 9.5 };
// Where it meets the head (in the head's drawing), and the middle of the
// body's cut, which stays where it is as the neck stretches.
const NECK_TOP = { x: 17.05, y: 4.7 };
const NECK_FROM = { x: 16.9, y: 7.35 };
const NECK_HELD = ((NECK_FROM.x - NECK_ROOT.x) * (NECK_TOP.x - NECK_ROOT.x) + (NECK_FROM.y - NECK_ROOT.y) * (NECK_TOP.y - NECK_ROOT.y)) / apart(NECK_ROOT, NECK_TOP);

// Stood along the line from its root to its top, stretched along it from
// the body's cut, and turned to where the head has gone: a span from the
// body to the head.
const NECK_SPAN: Piece = {
  id: 'neck', art: { drawn: { src: neckArt, fur: neckFurArt, box: NECK_PIECE } },
  at: { kind: 'span', from: { on: 'body', at: NECK_ROOT }, to: { on: 'skull', at: NECK_TOP }, art: { from: NECK_ROOT, to: NECK_TOP }, fixed: NECK_HELD },
  draws: [{ id: 'neck', z: 0 }, { id: 'neck, fur', z: 0, fur: true }],
};

// A peck, `t` through it: the head goes down in steps, stopping to fixate,
// then a last quick thrust to the ground, and back up (Ostheim et al.
// 2020); the body tips forward over the legs.
function pecking(t: number): { body: number; head: number; down: number } {
  const lower = 0.55 * smooth(t / 0.25) + 0.45 * smooth((t - 0.35) / 0.15);
  const up = smooth((t - 0.7) / 0.3);
  const k = lower * (1 - up);
  return { body: 25 * k, head: 45 * k, down: k };
}

// How it stands on the ledge: the body's turn, the head's (at its neck)
// or, pecking, the head and neck's together (at the neck's base), each
// foot's goal from where its hip is, and the tail's turn.
type Ground = { body: Turn; skull: JointPose; neck: JointPose; goals: (hips: readonly Point[]) => Goal[]; tail: number };
const planted = (hips: readonly Point[]): Goal[] => LEGS.map((leg, i) => ({ kind: 'plant', at: { x: hips[i].x + leg.reach, y: FEET } }));

// On the ledge: standing, walking with the head bob, pecking or alert.
function onGround(pigeon: RigPigeon, look: PigeonLook): Ground {
  const breathe = look.still ? 0 : 0.1 * breath(pigeon.seed, look.now, 3200);
  // Looking up it tips its bill only a little, so it stays inside the
  // room it has under whatever is above it.
  const gaze = look.still ? 0 : Math.max(-LOOK_UP, pigeon.gaze ?? 0);
  if (look.still || pigeon.pose === 'stand' || pigeon.pose === 'settle') {
    return { body: turnAbout(0, MIDDLE, 0, -breathe), skull: { angle: gaze }, neck: {}, goals: planted, tail: 0 };
  }
  if (pigeon.pose === 'alert') {
    // Standing tall and sleek, the neck stretched up as far as the ledge's
    // room allows, so it looks only down.
    return { body: turnAbout(-4, HIPS), skull: { angle: Math.max(0, gaze) - 4, shift: { x: 0.3, y: -1.5 } }, neck: {}, goals: planted, tail: 0 };
  }
  if (pigeon.pose === 'peck') {
    const p = pecking(pigeon.t);
    // The head and its neck swing down together from the base of the neck,
    // the neck stretching to reach the ground.
    return { body: turnAbout(p.body, HIPS), skull: {}, neck: { angle: p.head, shift: { x: 2.5 * p.down, y: 2.9 * p.down } }, goals: planted, tail: -6 * p.down };
  }
  const walked = pigeon.walked / SCALE;
  // The body rides up over each planted leg; the head thrusts forward just
  // after a foot lands and holds still over the ground while the body walks
  // on under it.
  const rise = 0.2 * stepRise(walked, WALK);
  const { feet, steps } = stepping(LEGS, walked, FEET, WALK);
  return {
    body: turnAbout(0, MIDDLE, 0, -rise),
    skull: { angle: 0, shift: { x: headBob(walked, WALK, THRUST), y: rise } },
    neck: {},
    goals: (hips) => feet(hips).map((at, i) => ({ kind: 'plant', at, step: steps[i], ground: GROUND })),
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

// Its skeleton: the body, which turns about its middle or its hips; the
// neck's base on it, the head on the neck, the eye on the head; the tail
// at its root, its fanned feathers turning further about the same point;
// each leg from its hip high in the body; and, in the air, the wings. The
// legs start inside the body: the far leg drawn behind it, the near
// outlined behind it too and its fur over its edge (or, tucked up in
// flight, into the belly feathers, behind it). In the air the far wing is
// behind it all, the near over it all.
const NEAR_WING = wingOf({ art: WING, side: 'near', parent: 'body', root: NEAR_SHOULDER, tip: TIP, z: 0 });
const FAR_WING = wingOf({ art: WING, side: 'far', parent: 'body', root: FAR_SHOULDER, tip: TIP, z: 0 });
const PARTS = [
  picture('tail', 'tail', tailArt, TAIL), picture('tail, fanned', 'tail fan', tailFanArt, TAIL_FAN), 'neck', picture('body', 'body', bodyArt, BODY), 'neck, fur',
  picture('folded wing', 'body', foldedArt, FOLDED_WING), picture('head', 'skull', headArt, HEAD), 'eyelid',
];
const pigeonOf = (wings: boolean) => tetrapod(BIRD, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: MIDDLE, name: 'body pivot (its middle, or its hips)' },
    { id: 'neck base', parent: 'body', role: spine(1), at: NECK_BASE, name: 'neck base' },
    { id: 'skull', parent: 'neck base', role: spine(0), at: NECK, name: 'head joint' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
    { id: 'tail fan', parent: 'tail', role: spine(4), at: TAIL_ROOT, name: 'tail, fanned (turned further about its root)' },
    ...(wings ? [...FAR_WING.joints, ...NEAR_WING.joints] : []),
  ],
  bones: [
    { from: 'skull', to: 'neck base', name: 'neck line' }, { from: 'neck base', to: 'body', name: 'back line' }, { from: 'body', to: 'tail', name: 'pelvis line (to the tail root)' },
    ...(wings ? [...FAR_WING.bones, ...NEAR_WING.bones] : []),
  ],
  legs: LEGS,
  ground: () => FEET,
  order: wings ? [FAR_WING.pieces, ...PARTS, NEAR_WING.pieces] : PARTS,
  pieces: [NECK_SPAN],
  shapes: [{ id: 'eyelid', on: 'skull' }],
  guides: (at) => [
    ...(wings ? [{ name: 'shoulder', at: NEAR_WING.ids.shoulder }, { name: 'wrist', at: NEAR_WING.ids.wrist }, { name: 'wingtip', at: NEAR_WING.ids.tip }] : [{ name: 'eye', at: 'eye' }]),
    ...LEGS.flatMap((leg) => [0, 1, 2, 3].map((k) => ({ name: BIRD.legs.hind.joints[k], at: at(leg, k) }))),
  ],
});
const ON_GROUND = pigeonOf(false);
const IN_AIR = pigeonOf(true);

// Its toes drawn together while a foot swings (bird.ts's curledIn), or
// while a leg in the air is not reaching to land.
const curled = (goal: Goal) => (goal.kind === 'air' ? goal.reach < 0.6 : curledIn(goal.kind === 'plant' ? goal.step : undefined));
const feetShown = (goals: readonly Goal[]) => ON_GROUND.feet((_, i) => (curled(goals[i]) ? 'curled' : 'toes'));
const eyelid = (pigeon: RigPigeon, look: PigeonLook) => ({ eyelid: lidLayers(!look.still && blinking(pigeon.seed, look.now), EYE, 0.45, MEMBRANE) });

function flying(pigeon: RigPigeon, look: PigeonLook): RigPose {
  const pose = inAir(pigeon);
  const body = turnAbout(-pose.pitch, HIPS);
  const folded = pose.wings.fold > 120;
  const [far, near] = [FAR_WING.pose(pose.wings, 0, !folded), NEAR_WING.pose(pose.wings, 0, !folded)];
  // The tail is turned back against the body's pitch (a little more than
  // all of it), so a body swung up to brake keeps its tail out over the
  // ledge rather than through it, and fanned as far as the pose has it.
  const joints = { ...far.joints, ...near.joints, tail: { angle: 1.3 * pose.pitch }, 'tail fan': { angle: -2 * pose.tail } };
  const hips = IN_AIR.hips({ root: body, joints });
  const goals: Goal[] = pose.airborne ? LEGS.map(() => ({ kind: 'air', reach: pose.legs, legs: PIGEON_AIR, carried: true })) : planted(hips);
  const tucked = pose.airborne && Math.abs(pose.legs) < 0.25;
  const show: PoseSpec['show'] = { ...far.show, ...near.show, ...feetShown(goals), tail: pose.tail >= 0.5 ? false : 'drawn', 'tail, fanned': pose.tail < 0.5 ? false : 'drawn', 'folded wing': folded ? 'drawn' : false };
  return compose(IN_AIR.body, () => ({ root: body, joints, limbs: IN_AIR.limbs(goals), show, z: tucked ? IN_AIR.furUnder('near') : {}, shapes: eyelid(pigeon, look) }), look.now);
}

export function pigeonRig(pigeon: RigPigeon, look: PigeonLook): RigPose {
  const grounded = ['stand', 'walk', 'peck', 'alert'].includes(pigeon.pose);
  if (!grounded && !look.still) return flying(pigeon, look);
  const { body, skull, neck, goals: goalsAt, tail } = onGround(pigeon, look);
  const joints = { 'neck base': neck, skull, tail: { angle: tail } };
  const goals = goalsAt(ON_GROUND.hips({ root: body, joints }));
  const show: PoseSpec['show'] = { ...feetShown(goals), 'tail, fanned': false };
  return compose(ON_GROUND.body, () => ({ root: body, joints, limbs: ON_GROUND.limbs(goals), show, z: {}, shapes: eyelid(pigeon, look) }), look.now);
}

// How far its head turns toward something close by: a cursor, or a ball
// bouncing near it.
export const LOOK = 20;
const LOOK_UP = 4;
export const gazeAt = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: LOOK, reach: 150 });

// The lab's speeds: the pigeon's walk, and its brisk shy.
export const WALK_SPEED = 18;
export const SHY_SPEED = 35;
// The box each pose's drawing stays inside through its whole motion (page
// px, standing on the anchor; `down` below it), as pigeon-rig.test.ts
// measures them.
export type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<PigeonPose, Footprint> = {
  stand: { width: 30.5, height: 25 }, walk: { width: 30, height: 24 }, peck: { width: 42.5, height: 24 }, alert: { width: 30.5, height: 27 },
  takeoff: { width: 34, height: 39.5, down: 1 }, fly: { width: 31, height: 30.5, down: 1 }, land: { width: 45.5, height: 36.5, down: 1.2 }, settle: { width: 31, height: 27 },
};
