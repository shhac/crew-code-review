import { clamp, smooth } from '../math';
import type { Point } from '../pointer';
import { beatsFor, flightLift, gaitPhase, stepping, type Gait, type Step } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, snuffle } from '../rig/life';
import { lidLayers, turnAbout, type Foot, type Frame, type Fur, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { mixPose } from '../rig/skeleton/mix';
import { head, LEPORID, picture, spine, tetrapod, type HingedArtLeg } from '../rig/skeleton/tetrapod';
import type { Goal, PoseSpec } from '../rig/skeleton/types';
import bodyArt from './rabbit-body.webp';
import earsArt from './rabbit-ears.webp';
import footFurArt from './rabbit-foot-fur.webp';
import footArt from './rabbit-foot.webp';
import forelegFurArt from './rabbit-foreleg-fur.webp';
import forelegArt from './rabbit-foreleg.webp';
import haunchFurArt from './rabbit-haunch-fur.webp';
import haunchArt from './rabbit-haunch.webp';
import headArt from './rabbit-head.webp';
import legFurArt from './rabbit-leg-fur.webp';
import legArt from './rabbit-leg.webp';
import pawFurArt from './rabbit-paw-fur.webp';
import pawArt from './rabbit-paw.webp';
import tailArt from './rabbit-tail.webp';

// The European rabbit put together from its parts: a tail, a body, a head
// with its ears, on four legs, each made of furred leg art laid along a leg
// posed in code, all hung on its skeleton (rig/skeleton). Facing right, on the ledge at ANCHOR. The parts were cut
// from one drawing of it standing on all four feet
// (design-docs/easter/rabbit-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. Every picture is on
// one scale, its eye's.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.4;

const GROUND = 17.95;
const ANCHOR = { x: 11.2, y: GROUND };
const FRAME: Frame = { width: 24, height: 19.5, anchor: ANCHOR, scale: SCALE };
const TAIL = { x: 1, y: 7.84, width: 3.5, height: 4.58 };
const BODY = { x: 3.35, y: 6.81, width: 13.83, height: 8.33 };
const HEAD = { x: 13.78, y: 4.27, width: 7.67, height: 6.33 };
const EARS = { x: 13.67, y: 1, width: 4.58, height: 6.17 };
const TAIL_ROOT = { x: 4.4, y: 10.2 };
const NECK = { x: 15.8, y: 9.4 };
// The head nods at the back of its skull, where it meets the neck: turned
// far nose down about the throat, its back would swing out off the body.
const OCCIPUT = { x: 14, y: 7.3 };
const EAR_BASE = { x: 16.2, y: 6 };
const EYE = { x: 18.33, y: 6.98 };
const NOSE = { x: 21.2, y: 8.1 };
// The body turns about its hips.
const HIND = { x: 7, y: 12 };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 20.5, height: 17.17 };
const FACE: Fur = { fill: '#a89273', outline: '#120d09' };

// The long hind foot, standing flat from the hock to the toes, and the small
// forepaw; each with where its leg comes down onto it.
const FOOT: Foot = { src: footArt, fur: footFurArt, width: 4.42, height: 2.17, heel: { x: 0.62, y: 0.69 } };
const PAW: Foot = { src: pawArt, fur: pawFurArt, width: 1.92, height: 1.17, heel: { x: 0.46, y: 0.35 } };
const HIND_ART: LimbArt = {
  bone: legArt, boneFur: legFurArt, knee: true, overFoot: true,
  thigh: { src: haunchArt, fur: haunchFurArt },
  foot: FOOT,
};
const FORE_ART: LimbArt = { bone: forelegArt, boneFur: forelegFurArt, knee: true, foot: PAW };
// Where each leg ends: the hind leg on its heel, as high as the foot under it
// stands; a foreleg's toes on the ledge.
const HEEL = GROUND - (FOOT.height - FOOT.heel.y);
const TOES = GROUND - (PAW.height - PAW.heel.y);

// The legs as a rabbit's: a hind leg's hip in the haunch, its thigh running
// down and forward to the stifle (the knee) at the belly, the shank back
// down to the hock, tapering to its point, and the long hind foot from the
// hock to the toes, flat on the ground when it sits and standing; pushing
// off, the heel peels up over the toes (it walks on its soles and hops on
// its toes). A foreleg's shoulder in the chest, the upper arm back to the
// elbow, the forearm down to the wrist (the carpus), and a short bone, the
// metacarpus, sloping down and forward from it to the forepaw (35 degrees,
// as the standing skeleton's), which folds back as it swings, its toes
// then hanging on from it near in line, as a held-up paw droops. The far pair
// a little apart.
//
// Placed against the skeleton (design-docs/easter/README.md): the shoulder
// low at the front of the chest, the hip in the haunch. Between hops (REST)
// the hind feet have just landed and the forefeet are about to lift, so
// each reach is set for where the feet stand then, as a sitting rabbit's
// do: the hock on the ledge under the hip, the long foot running forward,
// and the forepaws under the chest, the elbows tucked back behind the
// shoulders. Thigh to shank 1:1.1 and upper arm to forearm 1:1, as the
// rabbit's bones measure. Each joint turns against the bone above it
// (rig/skeleton/hinge.ts), so no bone is stretched to reach a foot: a knee
// within its limits (a hind leg straightens as it pushes off), the wrist
// from the forearm back as far as its paw folds and forward as far as it
// stands planted (bearing little fold, so a forearm brought low lays the
// paw down flat along it), the long hind foot from the shank as far as its heel
// peels up as it pushes off.
const HIND_LEG = {
  art: HIND_ART, width: 1.9, thigh: 3.3, shin: 3.6, bend: 1, jointLimits: { min: 25, max: 180 }, fore: false, haunch: 3.2, taper: true, reach: -3.1,
  walksOn: { kind: 'sole', toes: { x: FOOT.width - FOOT.heel.x, y: FOOT.height - FOOT.heel.y }, peel: 62 }, paw: { limits: { min: -15, max: 135 } },
} as const;
const FORE_LEG = { art: FORE_ART, width: 1.45, thigh: 2.6, shin: 2.6, bend: -1, jointLimits: { min: 30, max: 175 }, fore: true, haunch: 1.7, reach: 1.8, walksOn: { kind: 'toes', length: 0.8, lean: 35, fold: 89 }, paw: { limits: { min: -70, max: 95 }, planted: { min: -70, max: -12 } }, digits: -15 } as const;
const LEGS: HingedArtLeg[] = [
  { ...HIND_LEG, hip: { x: 7.6, y: 11.4 }, far: true },
  { ...FORE_LEG, hip: { x: 15.8, y: 12.8 }, far: true },
  { ...HIND_LEG, hip: { x: 6.4, y: 11.6 }, far: false },
  { ...FORE_LEG, hip: { x: 15, y: 13 }, far: false },
];

// The slow half-bound (design-docs/easter/README.md): the hind feet land
// together at the start of each hop, the forefeet still down; the forefeet
// lift, the hind feet push off and the rabbit flies, then the forefeet land
// one after the other, the near first, and it gathers its hind feet under it
// for the next. Each hop is one cycle; the rabbit rests between hops where
// the cycle starts, all four feet down.
const HOP: Gait = {
  stride: 6.4, lift: 1.6, stance: 0.45,
  beats: beatsFor(LEGS, { hind: { near: 0, far: 0 }, fore: { near: 0.6, far: 0.66 } }),
};
// Where in the cycle a hop begins and ends: all four feet down.
export const REST = 0.02;
// How far the body rises through the flight, at most.
const RISE = 0.9;
// One hop's length, on the page.
export const HOP_LENGTH = (HOP.stride / HOP.stance) * SCALE;

export type Pose = 'sit' | 'alert' | 'groom' | 'hop' | 'nudge' | 'thump';
// What the drawing reads of a rabbit: what it is doing, how far it has
// hopped (page pixels), how long it has been doing it, its seed, and
// whether it is fleeing (ears flat, scut up); and the pose it was in, which
// it eases out of over its first EASE ms.
export type RigRabbit = { pose: Pose; walked: number; since: number; seed: number; bolting?: boolean; was?: Pose };
export type RabbitLook = { now: number; gaze: number; still: boolean };

// How far its head turns toward a cursor, and from how far it notices one.
const LOOK = 10;
const LOOK_REACH = 160;

// How far the head would turn toward the cursor, standing at `at` on the
// page facing dir (see gazeFrom).
export const gazeAt = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: LOOK, reach: LOOK_REACH });

// How the rabbit stands: its body's turn, its head's (positive nose down),
// its ears' (positive back), its tail's (positive up), where its feet go and
// where each is in its step; its forepaws held up off the ledge, folded at
// the wrist; washing, how far from the muzzle they are held; and how far its
// head nods at the back of its skull (positive nose down).
type Stance = { body: Turn; head: number; ears: number; tail: number; feet: (hips: readonly Point[]) => Point[]; steps: Step[]; held?: boolean; groom?: Point; nod?: number };

const fore = (i: number) => LEGS[i].fore;
// The feet as they stand at rest between hops: every pose that is not a hop
// keeps them there, so nothing slides as it stops and sits.
const restSteps = (() => {
  const s = stepping(LEGS, REST * (HOP.stride / HOP.stance), HEEL, HOP);
  const hips = LEGS.map((l) => l.hip);
  return s.feet(hips).map((f, i) => (fore(i) ? { x: f.x, y: TOES } : f));
})();
const resting = () => restSteps;

// How far a forepaw is lifted in its swing, besides the gait's arc: a
// little more all the way, and enough as it tips its toes up to land that
// its heel never dips into the ledge.
function paws(step: Step): number {
  if (step.down) return 0;
  const tip = step.t > 0.75 ? Math.sin((Math.PI * (step.t - 0.75)) / 0.25) : 0;
  return 0.6 * Math.sqrt(Math.sin(Math.PI * step.t)) + 0.2 * tip;
}

// Hopping, this far into its hops (drawing units): the feet stepping by the
// shared gait, the forefeet stood on their toes; the body rising through the
// flight, pitching nose up as it pushes and nose down onto the forefeet;
// the ears back and the scut up in the air.
function hopping(walked: number): Stance {
  const phase = gaitPhase(walked, HOP);
  const p = phase - Math.floor(phase);
  const s = stepping(LEGS, walked, HEEL, HOP);
  const lift = flightLift(phase, HOP, RISE);
  const pitch = -7 * Math.sin(Math.PI * clamp((p - 0.15) / 0.45, 0, 1)) + 8 * Math.sin(Math.PI * clamp((p - 0.55) / 0.4, 0, 1));
  const air = Math.sin(Math.PI * clamp((p - 0.1) / 0.8, 0, 1));
  // Pushed off, the hind legs stay stretched out behind for the first of
  // their swing before they fold and come forward under the body.
  const trail = (step: Step) => (step.down ? 0 : Math.sin(Math.PI * clamp(step.t / 0.6, 0, 1)));
  const foot = (f: Point, i: number): Point => {
    if (fore(i)) return { x: f.x, y: f.y - HEEL + TOES - paws(s.steps[i]) };
    const k = trail(s.steps[i]);
    return { x: f.x - 1.4 * k, y: f.y - 0.8 * k };
  };
  return {
    body: turnAbout(pitch, HIND, 0, -lift - 0.4 * air),
    head: -pitch * 0.6, ears: 26 * air, tail: 24 * air,
    // Set from where the hips stand at rest, not where the pitching body
    // carries them, so a planted foot stays put as the body rocks over it.
    feet: () => s.feet(LEGS.map((l) => l.hip)).map(foot),
    steps: s.steps,
  };
}

const still = (body: Turn, head: number, ears: number, tail: number): Stance => ({ body, head, ears, tail, feet: resting, steps: [] });

// The forepaws off the ledge, each where `at` puts it from its shoulder, the
// hind feet where they rest.
const forepawsAt = (at: (hip: Point) => Point) => (hips: readonly Point[]): Point[] =>
  resting().map((f, i) => (fore(i) ? { x: hips[i].x + at(hips[i]).x, y: hips[i].y + at(hips[i]).y } : f));
// Where its forepaws wash: just under the nose.
const MUZZLE = { x: 19.6, y: 9.6 };

// Sitting: the rump down on its heels, the back curved, the chest up.
const SIT = still(turnAbout(-20, HIND, 0.4, 1.7), 18, 6, -6);
// Nudging an egg, how far its head nods: its nose down at the egg.
const NOD = 32;

function stance(rabbit: RigRabbit, look: RabbitLook): Stance {
  if (look.still) return SIT;
  const walked = rabbit.walked / SCALE;
  const nose = snuffle(rabbit.seed, look.now);
  switch (rabbit.pose) {
    case 'hop': {
      const hop = hopping(walked);
      return rabbit.bolting ? { ...hop, ears: 30, tail: 26 } : hop;
    }
    case 'alert': {
      // Sat up on its haunches, ears pricked, nose still, the forepaws
      // lifted off the ledge and held to its chest.
      const body = turnAbout(-30, HIND, 0.6, 1.4);
      return { ...still(body, 24, -4, -8), feet: forepawsAt(() => ({ x: 0.5, y: 2.7 })), held: true };
    }
    case 'groom': {
      // Sat up, washing its face: both forepaws at the muzzle, stroking up
      // over it as the head bobs down to them.
      const stroke = Math.sin((Math.PI * rabbit.since) / 450) ** 2;
      return { ...still(turnAbout(-24, HIND, 0.6, 1.4), 22 + 10 * stroke, 10, 0), groom: { x: -0.4, y: 0.6 - 0.8 * stroke }, held: true };
    }
    case 'nudge': {
      // Head down to the ledge, nose pushing the egg along, rump up; the
      // head nodded down at the back of its skull, so it stays on its neck.
      const push = Math.max(0, Math.sin((Math.PI * rabbit.since) / 300));
      return { ...still(turnAbout(20, HIND, 0.5 * push, -1.2), 0, 2, -4), nod: NOD };
    }
    case 'thump': {
      // Crouched and tense, ears up, the hind feet stamping.
      return still(turnAbout(4, HIND, 0, 0.6), 4, -6, 18);
    }
    default:
      return { ...SIT, head: SIT.head + nose * 0.8 + look.gaze, ears: SIT.ears + 3 * Math.sin(look.now / 900 + rabbit.seed) };
  }
}

// The thump lifts both hind heels and slams them down, twice.
function stamping(rabbit: RigRabbit): Step[] {
  if (rabbit.pose !== 'thump') return [];
  const t = (rabbit.since % 250) / 250;
  const up = t < 0.6 ? { down: true, t: 0.6 + 0.4 * (t / 0.6) } : { down: true, t: 0 };
  return LEGS.map((l) => (l.fore ? { down: true, t: 0 } : up));
}

// Its skeleton: the body turning about its hips, the tail at its root,
// the head on its neck with the ears, eye and nose on it, and each leg from
// its hip (or shoulder). A hind leg stands on its sole: its hock is its
// heel, where the long foot starts. Drawn with the far legs behind it, then
// the tail, the body, the ears behind the head, the near legs' fur over its
// edge.
const RABBIT = tetrapod(LEPORID, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: HIND, name: 'pelvis (the body turns about its hips)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'neck (the head turns on it)' },
    { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
    { id: 'occiput', parent: 'skull', role: head(3), at: OCCIPUT, name: 'head joint (back of the skull)' },
    { id: 'ears', parent: 'occiput', role: head(0), at: EAR_BASE, name: 'ear base' },
    { id: 'eye', parent: 'occiput', role: head(1), at: EYE, name: 'eye' },
    { id: 'nose', parent: 'occiput', role: head(2), at: NOSE, name: 'nose' },
  ],
  bones: [
    { from: 'skull', to: 'body', name: 'neck line (neck to the hips)' }, { from: 'body', to: 'tail', name: 'pelvis line (hips to tail root)' },
    { from: 'nose', to: 'occiput', name: 'skull' }, { from: 'occiput', to: 'skull', name: 'nape (head joint to neck)' },
  ],
  legs: LEGS,
  ground: (leg) => (leg.fore ? TOES : HEEL),
  order: [picture('tail', 'tail', tailArt, TAIL), picture('body', 'body', bodyArt, BODY), picture('ears', 'ears', earsArt, EARS), picture('head', 'occiput', headArt, HEAD), 'eyelid'],
  shapes: [{ id: 'eyelid', on: 'occiput' }],
  guides: (at) => [
    { name: 'tail root', at: 'tail' }, { name: 'neck', at: 'skull' }, { name: 'head joint', at: 'occiput' }, { name: 'ear base', at: 'ears' }, { name: 'eye', at: 'eye' }, { name: 'nose', at: 'nose' },
    ...LEGS.map((leg) => ({ name: leg.fore ? 'shoulder' : 'hip', at: at(leg, 0) })),
    ...LEGS.flatMap((leg) => (leg.fore
      ? [{ name: 'elbow', at: at(leg, 1) }, { name: 'wrist (carpus)', at: at(leg, 2) }, { name: 'forepaw', at: at(leg, 3) }]
      : [{ name: 'stifle (knee)', at: at(leg, 1) }, { name: 'hock (heel)', at: at(leg, 2) }])),
  ],
});

// A stance as a pose: each foot set from where its hip is in it, a washing
// forepaw reaching for the muzzle, a held one free of the ledge and folded.
function poseOf(s: Stance): PoseSpec {
  const joints = { skull: { angle: s.head }, occiput: { angle: s.nod ?? 0 }, ears: { angle: -s.ears }, tail: { angle: s.tail } };
  const feet = s.feet(RABBIT.hips({ root: s.body, joints }));
  const held = (leg: HingedArtLeg) => (s.held && leg.fore ? { contact: 0, fold: 1 } : {});
  const goals = LEGS.map((leg, i): Goal => (s.groom && leg.fore
    ? { kind: 'reach', to: { on: 'occiput', at: MUZZLE }, by: s.groom, step: s.steps[i], ...held(leg) }
    : { kind: 'plant', at: feet[i], step: s.steps[i], ...held(leg) }));
  return { root: s.body, joints, limbs: RABBIT.limbs(goals), show: {}, z: {} };
}

// From one pose into the next: the body, head, ears and tail turn, and the
// feet move, smoothly over EASE ms, so nothing snaps. The feet every pose
// plants are the same, so none slides. A lifted paw eases between where
// each pose holds it against its own shoulders: carried on the shoulders in
// between, a paw held to the chest would sink into the ledge as they drop
// into a nudge; and it folds, and takes its weight, as far between the two
// poses as it is.
const EASE = 260;
function eased(rabbit: RigRabbit, look: RabbitLook): PoseSpec {
  const next = poseOf(stance(rabbit, look));
  if (look.still || !rabbit.was || rabbit.was === rabbit.pose || rabbit.since >= EASE) return next;
  const before = poseOf(stance({ ...rabbit, pose: rabbit.was }, look));
  return mixPose(RABBIT.body.skeleton, before, next, smooth(rabbit.since / EASE));
}

export function rabbitRig(rabbit: RigRabbit, look: RabbitLook): RigPose {
  const posed = (now: number): PoseSpec => {
    const at = { ...look, now };
    const pose = eased(rabbit, at);
    const stamp = at.still ? [] : stamping(rabbit);
    // Thumping, the hind heels stamp whatever each foot is easing from.
    const stamped = (goal: Goal | undefined, i: number): Goal | undefined => (goal && (goal.kind === 'plant' || goal.kind === 'reach') && stamp.length ? { ...goal, step: stamp[i] } : goal);
    const limbs = Object.fromEntries(RABBIT.codes.map((code, i) => [code, stamped(pose.limbs[code], i)]));
    return { ...pose, limbs, shapes: { eyelid: lidLayers(!at.still && blinking(rabbit.seed, now), EYE, 0.8, FACE) } };
  };
  return compose(RABBIT.body, posed, look.now);
}
