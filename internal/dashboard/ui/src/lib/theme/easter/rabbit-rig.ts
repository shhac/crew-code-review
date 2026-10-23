import { clamp, smooth } from '../math';
import type { Point } from '../pointer';
import { beatsFor, flightLift, gaitPhase, stepping, type Gait, type QuadLeg, type Step } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, snuffle } from '../rig/life';
import { lidLayers, turnAbout, type Foot, type Frame, type Fur, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { rootsOf } from '../rig/skeleton/forward';
import { mixPose } from '../rig/skeleton/mix';
import type { Body, Goal, JointSpec, LimbSpec, Piece, PoseSpec, Role } from '../rig/skeleton/types';
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
// Each leg's pieces, hip down: a hind leg's haunch and its tapering shank
// both drawn with the haunch's art, standing over its long foot, whose back
// the shank's rounded end hides; a foreleg's upper arm, forearm and
// metacarpus with the foreleg's, over its forepaw.
const HIND_ART = { bone: { src: haunchArt, fur: haunchFurArt }, foot: FOOT } as const;
const FORE_ART = { bone: { src: forelegArt, fur: forelegFurArt }, foot: PAW } as const;
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
// as the standing skeleton's), which folds back as it swings. The far pair
// a little apart.
//
// Placed against the skeleton (design-docs/easter/README.md): the shoulder
// low at the front of the chest, the hip in the haunch. Between hops (REST)
// the hind feet have just landed and the forefeet are about to lift, so
// each reach is set for where the feet stand then, as a sitting rabbit's
// do: the hock on the ledge under the hip, the long foot running forward,
// and the forepaws under the chest, the elbows tucked back behind the
// shoulders. Thigh to shank 1:1.1 and upper arm to forearm 1:1, as the
// rabbit's bones measure; each limb hinges on its own side (bendFrame), so
// no bone is stretched to reach a foot.
const HIND_LEG = {
  art: HIND_ART, width: 1.9, thigh: 3.3, shin: 3.6, bend: 1, bendFrame: 'limb', jointLimits: { min: 30, max: 175 }, fore: false, haunch: 3.2, taper: true, reach: -3.1,
  walksOn: { kind: 'sole', toes: { x: FOOT.width - FOOT.heel.x, y: FOOT.height - FOOT.heel.y }, peel: 62 },
} as const;
const FORE_LEG = { art: FORE_ART, width: 1.45, thigh: 2.6, shin: 2.6, bend: -1, bendFrame: 'limb', jointLimits: { min: 30, max: 175 }, fore: true, haunch: 1.7, reach: 1.8, walksOn: { kind: 'toes', length: 0.8, lean: 35, fold: 89 } } as const;
// Each leg by the code its limb has (lab/skeleton.ts's), in the order the
// gait's beats, the feet and the steps list them, and the legs are drawn.
type Leg = QuadLeg & { code: string; art: typeof HIND_ART | typeof FORE_ART; width: number; haunch: number };
const LEGS: readonly Leg[] = [
  { ...HIND_LEG, hip: { x: 7.6, y: 11.4 }, far: true, code: 'L3' },
  { ...FORE_LEG, hip: { x: 15.8, y: 12.8 }, far: true, code: 'L1' },
  { ...HIND_LEG, hip: { x: 6.4, y: 11.6 }, far: false, code: 'L2' },
  { ...FORE_LEG, hip: { x: 15, y: 13 }, far: false, code: 'L0' },
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
// where each is in its step; and, washing, how far from the muzzle its
// forepaws are held.
type Stance = { body: Turn; head: number; ears: number; tail: number; feet: (hips: readonly Point[]) => Point[]; steps: Step[]; groom?: Point };

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
// hind feet where they rest; and those forepaws folded back at the wrist.
const forepawsAt = (at: (hip: Point) => Point) => (hips: readonly Point[]): Point[] =>
  resting().map((f, i) => (fore(i) ? { x: hips[i].x + at(hips[i]).x, y: hips[i].y + at(hips[i]).y } : f));
const LIFTED: Step[] = LEGS.map((l) => (l.fore ? { down: false, t: 0.4 } : { down: true, t: 0 }));
// Where its forepaws wash: just under the nose.
const MUZZLE = { x: 19.6, y: 9.6 };

// Sitting: the rump down on its heels, the back curved, the chest up.
const SIT = still(turnAbout(-20, HIND, 0.4, 1.7), 18, 6, -6);

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
      return { ...still(body, 24, -4, -8), feet: forepawsAt(() => ({ x: 0.5, y: 2.7 })), steps: LIFTED };
    }
    case 'groom': {
      // Sat up, washing its face: both forepaws at the muzzle, stroking up
      // over it as the head bobs down to them.
      const stroke = Math.sin((Math.PI * rabbit.since) / 450) ** 2;
      return { ...still(turnAbout(-24, HIND, 0.6, 1.4), 22 + 10 * stroke, 10, 0), groom: { x: -0.4, y: 0.6 - 0.8 * stroke }, steps: LIFTED };
    }
    case 'nudge': {
      // Head down to the ledge, nose pushing the egg along, rump up.
      const push = Math.max(0, Math.sin((Math.PI * rabbit.since) / 300));
      return still(turnAbout(20, HIND, 0.5 * push, -1.2), 52, 2, -4);
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

// A forepaw's fold part way from one step to another: the step whose fold
// (gait.ts's flexion) is that mix of the two, so a paw lifting off the
// ledge folds as it rises rather than all at once at the ledge: late as it
// lifts, early as it comes down, so its toes never dip into the ledge.
function foldBetween(a: Step | undefined, b: Step | undefined, f: number): Step {
  const folded = (s?: Step) => (!s || s.down ? 0 : s.t < 0.75 ? Math.sin((Math.PI * s.t) / 0.75) : 0);
  const g = folded(b) > folded(a) ? f * f : 1 - (1 - f) * (1 - f);
  const k = clamp(folded(a) + (folded(b) - folded(a)) * g, 0, 1);
  return k === 0 ? { down: true, t: 0 } : { down: false, t: (0.75 * Math.asin(k)) / Math.PI };
}

// Its skeleton: the body turning about its hips, the tail at its root,
// the head on its neck with the ears, eye and nose on it, and each leg from
// its hip (or shoulder). A hind leg stands on its sole: its hock is its
// heel, where the long foot starts.
const spine = (index: number): Role => ({ part: 'spine', index });
const head = (index: number): Role => ({ part: 'head', index });
const NAMES = {
  fore: { joints: ['shoulder', 'elbow', 'wrist (carpus)', 'forepaw'], bones: ['humerus', 'radius and ulna', 'metacarpus', 'toes (phalanges)'] },
  hind: { joints: ['hip', 'stifle (knee)', 'hock (heel)', 'hind foot (its heel)'], bones: ['femur', 'tibia and fibula', '', 'hind foot (metatarsus and toes)'] },
} as const;
const ground = (leg: Leg) => (leg.fore ? TOES : HEEL);
const legJoints = (leg: Leg): JointSpec[] => {
  const role = (index: 0 | 1 | 2 | 3 | 4): Role => ({ part: 'limb', pair: leg.fore ? 0 : 1, side: leg.far ? 'far' : 'near', index });
  const names = NAMES[leg.fore ? 'fore' : 'hind'].joints;
  const { foot } = leg.art;
  const toes = { x: leg.hip.x + leg.reach + foot.width - foot.heel.x, y: ground(leg) + foot.height - foot.heel.y };
  const owned = ([1, 2, 3] as const).map((k): JointSpec => ({ id: `${leg.code}J${k}`, parent: `${leg.code}J${k - 1}`, role: role(k), at: leg.hip, name: names[k], derived: true }));
  return [{ id: `${leg.code}J0`, parent: 'body', role: role(0), at: leg.hip, name: names[0] }, ...owned, { id: `${leg.code}J4`, parent: `${leg.code}J3`, role: role(4), at: toes, name: 'toe tip', derived: true }];
};
// Each bone of a leg; a hind leg has none from its hock to its heel.
const legBones = (leg: Leg) => NAMES[leg.fore ? 'fore' : 'hind'].bones.flatMap((name, k) => (name ? [{ from: `${leg.code}J${k}`, to: `${leg.code}J${k + 1}`, name }] : []));
const limbOf = (leg: Leg): LimbSpec => ({
  id: leg.code, pair: leg.fore ? 0 : 1, side: leg.far ? 'far' : 'near', ground: ground(leg), solve: 'quad',
  joints: { root: `${leg.code}J0`, middle: `${leg.code}J1`, lower: `${leg.code}J2`, end: `${leg.code}J3`, tip: `${leg.code}J4` },
  leg: { reach: leg.reach, thigh: leg.thigh, shin: leg.shin, bend: leg.bend, bendFrame: leg.bendFrame, jointLimits: leg.jointLimits, walksOn: leg.walksOn },
});
const SKELETON = {
  joints: [
    { id: 'body', parent: null, role: spine(2), at: HIND, name: 'pelvis (the body turns about its hips)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint (neck)' },
    { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
    { id: 'ears', parent: 'skull', role: head(0), at: EAR_BASE, name: 'ear base' },
    { id: 'eye', parent: 'skull', role: head(1), at: EYE, name: 'eye' },
    { id: 'nose', parent: 'skull', role: head(2), at: NOSE, name: 'nose' },
    ...LEGS.flatMap(legJoints),
  ],
  bones: [
    { from: 'skull', to: 'body', name: 'neck line (head joint to the hips)' }, { from: 'body', to: 'tail', name: 'pelvis line (hips to tail root)' },
    { from: 'nose', to: 'skull', name: 'skull' }, ...LEGS.flatMap(legBones),
  ],
  limbs: LEGS.map(limbOf),
};

// The draw order, as the legs go round the body: they start inside it, so
// the far legs are drawn behind it, outlined, then as fur alone so no line
// crosses where their pieces meet; the near legs outlined behind it too,
// their fur then over its edge. A hind foot is drawn under its leg's
// rounded end, a forepaw over its leg's.
const Z = { farLegs: 0, farFur: 1, nearLegs: 2, tail: 3, body: 4, ears: 5, head: 6, eyelid: 7, nearFur: 8 } as const;
function legPieces(leg: Leg): Piece[] {
  const side = leg.far ? 'far' : 'near';
  const [outlined, fur] = leg.far ? [Z.farLegs, Z.farFur] : [Z.nearLegs, Z.nearFur];
  const draws = (id: string, flush = false) => [{ id, z: outlined, part: `${side} legs` }, { id: `${id}, fur`, z: fur, fur: true, flush, part: `${side} legs, fur` }];
  const bar = (k: number, thick: number, flush = false): Piece => ({
    id: `${leg.code}B${k}`, side, art: { drawn: leg.art.bone }, at: { kind: 'bar', from: `${leg.code}J${k}`, to: `${leg.code}J${k + 1}`, thick }, draws: draws(`${leg.code}B${k}`, flush),
  });
  const { foot } = leg.art;
  const footPiece: Piece = {
    id: `${leg.code} foot`, side, art: { drawn: { src: foot.src, fur: foot.fur, box: { x: -foot.heel.x, y: -foot.heel.y, width: foot.width, height: foot.height } } },
    at: { kind: 'joint', to: `${leg.code}J3`, local: true }, draws: draws(`${leg.code} foot`),
  };
  // A hind shank tapers to a narrow hock.
  if (!leg.fore) return [footPiece, bar(0, leg.haunch, true), bar(1, leg.width * 1.15)];
  return [bar(0, leg.haunch, true), bar(1, leg.width), bar(2, leg.width), footPiece];
}
const RABBIT: Body = {
  frame: FRAME,
  skeleton: SKELETON,
  pieces: [
    ...LEGS.flatMap(legPieces),
    { id: 'tail', art: { drawn: { src: tailArt, box: TAIL } }, at: { kind: 'joint', to: 'tail' }, draws: [{ id: 'tail', z: Z.tail }] },
    { id: 'body', art: { drawn: { src: bodyArt, box: BODY } }, at: { kind: 'joint', to: 'body' }, draws: [{ id: 'body', z: Z.body }] },
    { id: 'ears', art: { drawn: { src: earsArt, box: EARS } }, at: { kind: 'joint', to: 'ears' }, draws: [{ id: 'ears', z: Z.ears }] },
    { id: 'head', art: { drawn: { src: headArt, box: HEAD } }, at: { kind: 'joint', to: 'skull' }, draws: [{ id: 'head', z: Z.head }] },
  ],
  shapes: [{ id: 'eyelid', on: 'skull', z: Z.eyelid }],
  guides: [
    { name: 'tail root', at: 'tail' }, { name: 'neck', at: 'skull' }, { name: 'ear base', at: 'ears' }, { name: 'eye', at: 'eye' }, { name: 'nose', at: 'nose' },
    ...LEGS.map((leg) => ({ name: leg.fore ? 'shoulder' : 'hip', at: `${leg.code}J0` })),
    ...LEGS.flatMap((leg) => (leg.fore
      ? [{ name: 'elbow', at: `${leg.code}J1` }, { name: 'wrist (carpus)', at: `${leg.code}J2` }, { name: 'forepaw', at: `${leg.code}J3` }]
      : [{ name: 'stifle (knee)', at: `${leg.code}J1` }, { name: 'hock (heel)', at: `${leg.code}J2` }])),
  ],
};

// A stance as a pose: each foot set from where its hip is in it, a washing
// forepaw reaching for the muzzle.
function poseOf(s: Stance): PoseSpec {
  const joints = { skull: { angle: s.head }, ears: { angle: -s.ears }, tail: { angle: s.tail } };
  const roots = rootsOf(SKELETON, { root: s.body, joints });
  const feet = s.feet(LEGS.map((leg) => roots.get(leg.code) ?? leg.hip));
  const goal = (leg: Leg, i: number): Goal => (s.groom && leg.fore
    ? { kind: 'reach', to: { on: 'skull', at: MUZZLE }, by: s.groom, step: s.steps[i] }
    : { kind: 'plant', at: feet[i], step: s.steps[i] });
  return { root: s.body, joints, limbs: Object.fromEntries(LEGS.map((leg, i) => [leg.code, goal(leg, i)])), show: {}, z: {} };
}

// From one pose into the next: the body, head, ears and tail turn, and the
// feet move, smoothly over EASE ms, so nothing snaps. The feet every pose
// plants are the same, so none slides. A lifted paw eases between where
// each pose holds it against its own shoulders: carried on the shoulders in
// between, a paw held to the chest would sink into the ledge as they drop
// into a nudge; and it folds between its two steps (foldBetween).
const EASE = 260;
const FOLDING = { steps: Object.fromEntries(LEGS.flatMap((leg) => (leg.fore ? [[leg.code, foldBetween]] : []))) };
function eased(rabbit: RigRabbit, look: RabbitLook): PoseSpec {
  const next = poseOf(stance(rabbit, look));
  if (look.still || !rabbit.was || rabbit.was === rabbit.pose || rabbit.since >= EASE) return next;
  const before = poseOf(stance({ ...rabbit, pose: rabbit.was }, look));
  return mixPose(SKELETON, before, next, smooth(rabbit.since / EASE), FOLDING);
}

export function rabbitRig(rabbit: RigRabbit, look: RabbitLook): RigPose {
  const posed = (now: number): PoseSpec => {
    const at = { ...look, now };
    const pose = eased(rabbit, at);
    const stamp = at.still ? [] : stamping(rabbit);
    // Thumping, the hind heels stamp whatever each foot is easing from.
    const stamped = (goal: Goal | undefined, i: number): Goal | undefined => (goal && goal.kind !== 'air' && stamp.length ? { ...goal, step: stamp[i] } : goal);
    const limbs = Object.fromEntries(LEGS.map((leg, i) => [leg.code, stamped(pose.limbs[leg.code], i)]));
    return { ...pose, limbs, shapes: { eyelid: lidLayers(!at.still && blinking(rabbit.seed, now), EYE, 0.8, FACE) } };
  };
  return compose(RABBIT, posed, look.now);
}
