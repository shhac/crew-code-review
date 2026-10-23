import { apart } from '../math';
import type { Point } from '../pointer';
import { gaitPhase, restingFeet, stepping, type Gait, type QuadLeg, type Step } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, breath, snuffle } from '../rig/life';
import { lidLayers, turnAbout, type Foot, type Frame, type Fur, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { rootsOf } from '../rig/skeleton/forward';
import { wholePicture } from '../rig/skeleton/picture';
import type { Body, JointSpec, LimbSpec, Piece, PoseSpec, Role } from '../rig/skeleton/types';
import { moving, type Hog } from './hedgehog';
import ballArt from './hedgehog-ball.webp';
import bodyArt from './hedgehog-body.webp';
import headArt from './hedgehog-head.webp';
import handFurArt from './hedgehog-hand-fur.webp';
import handArt from './hedgehog-hand.webp';
import hindFurArt from './hedgehog-hind-fur.webp';
import hindArt from './hedgehog-hind.webp';
import legFurArt from './hedgehog-leg-fur.webp';
import legArt from './hedgehog-leg.webp';

// The hedgehog put together from its parts: spines and belly, a head over
// their cream front (its soft back edge hides the join), and four legs, each
// a piece of leg art laid along a leg posed in code, all hung on its
// skeleton (rig/skeleton). Facing right, on the ledge at ANCHOR. The parts were cut from one drawing of it standing
// square (design-docs/bonfire/hedgehog-standing.png), and every size and
// place below is in that drawing's units, as export.py prints them; every
// picture is on one scale, its eye's, so the ball is the same hedgehog
// curled up.

// Page pixels per drawing unit, for every pose.
const SCALE = 1.52;
const GROUND = 17.43;
const ANCHOR = { x: 14.9, y: GROUND };
const FRAME: Frame = { width: 28, height: 17.6, anchor: ANCHOR, scale: SCALE };
const BODY = { x: 1.91, y: 1.27, width: 20.33, height: 14.58 };
const HEAD = { x: 13.69, y: 6.46, width: 11.67, height: 10.08 };
const NECK = { x: 17, y: 14 };
const EYE = { x: 20.1, y: 10.25 };
const NOSE = { x: 25.2, y: 11 };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 24.42, height: 16.58 };
const BALL = { name: 'ball', src: ballArt, width: 17, height: 16.58 };
// Too short to show a knee: one stubby piece, hip to heel, on its sole. The
// front feet are short and broad like little hands, the hind ones longer.
const HAND: Foot = { src: handArt, fur: handFurArt, width: 3.42, height: 2, heel: { x: 1.16, y: 0.65 } };
const HIND_FOOT: Foot = { src: hindArt, fur: hindFurArt, width: 4, height: 2, heel: { x: 1.16, y: 0.65 } };
const LEG_WIDTH = 2.6;
// Where each leg ends: its heel, as high as the foot under it stands.
const FEET = GROUND - (HIND_FOOT.height - HIND_FOOT.heel.y);
const FACE: Fur = { fill: '#fdd79b', outline: '#140c05' };

// Hips just inside the belly, over the feet as the drawing stands them; the
// far pair a little apart from the near, as it would be seen. Each foot's
// heel peels up over the tips of its toes as it pushes off.
const soleOf = (foot: Foot) => ({ kind: 'sole', toes: { x: foot.width - foot.heel.x, y: foot.height - foot.heel.y }, peel: 30 }) as const;
const HIND = { reach: 0, thigh: 1, shin: 1, bend: 1, fore: false, walksOn: soleOf(HIND_FOOT) } as const;
const FORE = { reach: 0.2, thigh: 1, shin: 1, bend: -1, fore: true, walksOn: soleOf(HAND) } as const;
// Each leg, by the code its limb has (lab/skeleton.ts's), and the foot it
// stands on. Gaits, feet and steps are in this order.
type Leg = QuadLeg & { code: string; foot: Foot };
const LEGS: readonly Leg[] = [
  { ...HIND, hip: { x: 5.9, y: 14.6 }, far: false, code: 'L2', foot: HIND_FOOT },
  { ...FORE, hip: { x: 15.5, y: 14.6 }, far: false, code: 'L0', foot: HAND },
  { ...HIND, hip: { x: 9.9, y: 14.8 }, far: true, code: 'L3', foot: HIND_FOOT },
  { ...FORE, hip: { x: 18.7, y: 14.4 }, far: true, code: 'L1', foot: HAND },
];
// Peeking, the foot it raises to creep out: its near fore.
const CREEPING = 1;

// Walking, a lateral-sequence walk, as small mammals and pygmy hedgehogs
// walk slowly: a hind foot, then the forefoot on its side, then the other
// side's, evenly spaced, three feet always down. Hurrying, it trots, the
// diagonal pairs together, its body lifted higher on straighter legs.
// (Beats are in LEGS' order.)
const WALKING = { gait: { stride: 2.6, lift: 0.7, stance: 0.75, beats: [0.75, 0.5, 0.25, 0] } satisfies Gait, raised: 0 };
const TROTTING = { gait: { stride: 3.4, lift: 0.9, stance: 0.5, beats: [0.5, 0, 0, 0.5] } satisfies Gait, raised: 0.5 };

// How far the head turns toward a cursor, and from how far it notices one;
// sniffing, how far the nose dips at most, which keeps the drawing inside
// the hedgehog's footprint; peeking, how far it lifts its nose to test the
// air and stretches its neck out.
const LOOK = 14;
const LOOK_REACH = 160;
const DIP = 26;
const TEST_AIR = -8;
const STRETCH = 1.2;

// What the drawing needs besides the hedgehog: the time, how far its head is
// turned toward the cursor (eased by the caller, see gazeAt), and whether
// motion is reduced.
export type HogLook = { now: number; gaze: number; still: boolean };

// How far the head would turn toward the cursor, standing at `at` on the
// page (see gazeFrom).
const gaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: LOOK, reach: LOOK_REACH });
export const gazeAt = (hog: Pick<Hog, 'dir'>, at: Point, cursor: Point | null) => gaze(hog.dir, at, cursor);

// On the move: a slight rise and fall with each stride, a slow rock of the
// body every four strides, and the head nodding a little behind it. Its
// strides are short and quick (about four a second), so the rock and nod go
// at a quarter of their pace: slow and small, a waddle at page size, not a
// flicker.
const sway = (phase: number) => ({ bob: -0.2 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase)), rock: 1.2 * Math.sin((Math.PI * phase) / 2), nod: 2 * Math.sin((Math.PI * phase) / 2 - 0.8) });

// How the hedgehog stands: its body's turn, its head's, how far its neck
// stretches forward, where its feet go, and where each is in its step.
type Stance = { body: Turn; head: number; neck: number; feet: (hips: readonly Point[]) => Point[]; steps: Step[] };
const resting = (body: Turn, head: number, neck = 0): Stance => ({ body, head, neck, feet: (hips) => restingFeet(LEGS, hips, FEET), steps: [] });

// Each tuned against its key pose (design-docs/bonfire/hedgehog-pose-*.png,
// laid over the rig in the critters lab). A positive head turns the nose
// down.
function stance(hog: Hog, look: HogLook): Stance {
  if (look.still) return resting(turnAbout(0, ANCHOR), 0);
  const walked = hog.walked / SCALE;
  if (moving(hog.mode)) {
    const { gait, raised } = hog.mode === 'flee' ? TROTTING : WALKING;
    const step = sway(gaitPhase(walked, gait));
    return { body: turnAbout(step.rock, ANCHOR, 0, step.bob - raised), head: step.nod, neck: 0, ...stepping(LEGS, walked, FEET, gait) };
  }
  if (hog.mode === 'sniff') {
    // Nose to the ground, the front of the body dipped a little, snuffling.
    return resting(turnAbout(4, ANCHOR), Math.min(DIP, 22 + 2 * Math.sin(look.now / 380) + snuffle(hog.seed, look.now) + look.gaze / 3));
  }
  if (hog.mode === 'peek') {
    // Low and wary at the pile's mouth, its neck stretched out and nose
    // lifted to test the air, a forefoot raised to creep out.
    const creep: Stance = resting(turnAbout(0, ANCHOR, 0, 0.3), TEST_AIR + look.gaze, STRETCH);
    const raise = (hips: readonly Point[]) => restingFeet(LEGS, hips, FEET).map((at, i) => (i === CREEPING ? { x: hips[i].x + 0.9, y: FEET - 0.5 } : at));
    return { ...creep, feet: raise, steps: LEGS.map((_, i) => (i === CREEPING ? { down: false, t: 0.35 } : { down: true, t: 0 })) };
  }
  return resting(turnAbout(0, ANCHOR), look.gaze);
}

// Its skeleton: the body turning about where it stands, the head on its
// neck with the eye and nose on it, and each leg from its hip (or
// shoulder): too short to show a knee, it is one piece from there to the
// heel, the knee and ankle inside it, and the foot flat on its sole.
const spine = (index: number): Role => ({ part: 'spine', index });
const head = (index: number): Role => ({ part: 'head', index });
const NAMES = {
  fore: { joints: ['shoulder', 'elbow (inside the leg)', 'wrist', 'forefoot (its heel)'], bones: ['humerus (inside the one piece)', 'radius and ulna (inside the one piece)'], foot: 'forefoot (metacarpus and toes)' },
  hind: { joints: ['hip', 'knee (inside the leg)', 'ankle', 'hind foot (its heel)'], bones: ['femur (inside the one piece)', 'tibia and fibula (inside the one piece)'], foot: 'hind foot (metatarsus and toes)' },
} as const;
const legJoints = (leg: Leg): JointSpec[] => {
  const role = (index: 0 | 1 | 2 | 3 | 4): Role => ({ part: 'limb', pair: leg.fore ? 0 : 1, side: leg.far ? 'far' : 'near', index });
  const names = NAMES[leg.fore ? 'fore' : 'hind'].joints;
  const toes = { x: leg.hip.x + leg.reach + leg.foot.width - leg.foot.heel.x, y: FEET + leg.foot.height - leg.foot.heel.y };
  const owned = ([1, 2, 3] as const).map((k): JointSpec => ({ id: `${leg.code}J${k}`, parent: `${leg.code}J${k - 1}`, role: role(k), at: leg.hip, name: names[k], derived: true }));
  return [{ id: `${leg.code}J0`, parent: 'body', role: role(0), at: leg.hip, name: names[0] }, ...owned, { id: `${leg.code}J4`, parent: `${leg.code}J3`, role: role(4), at: toes, name: 'toe tip', derived: true }];
};
const legBones = (leg: Leg) => {
  const names = NAMES[leg.fore ? 'fore' : 'hind'];
  return [
    { from: `${leg.code}J0`, to: `${leg.code}J1`, name: names.bones[0] }, { from: `${leg.code}J1`, to: `${leg.code}J2`, name: names.bones[1] },
    { from: `${leg.code}J3`, to: `${leg.code}J4`, name: names.foot },
  ];
};
const limbOf = (leg: Leg): LimbSpec => ({
  id: leg.code, pair: leg.fore ? 0 : 1, side: leg.far ? 'far' : 'near', ground: FEET, solve: 'quad',
  joints: { root: `${leg.code}J0`, middle: `${leg.code}J1`, lower: `${leg.code}J2`, end: `${leg.code}J3`, tip: `${leg.code}J4` },
  leg: { reach: leg.reach, thigh: leg.thigh, shin: leg.shin, bend: leg.bend, walksOn: leg.walksOn },
});
// The legs as drawn and as tests list them: the far pair, then the near,
// hind before fore.
const DRAWN = [LEGS[2], LEGS[3], LEGS[0], LEGS[1]];
const SKELETON = {
  joints: [
    { id: 'body', parent: null, role: spine(1), at: ANCHOR, name: 'body (turns about where it stands)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint (neck)' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'nose', parent: 'skull', role: head(1), at: NOSE, name: 'nose' },
    ...DRAWN.flatMap(legJoints),
  ],
  bones: [
    // Peeking, the neck stretches out: the head joint moves forward on it.
    { from: 'skull', to: 'body', name: 'neck and back line (head joint to where the body turns)', stretch: { min: apart(NECK, ANCHOR), max: apart({ x: NECK.x + STRETCH, y: NECK.y }, ANCHOR) } },
    { from: 'nose', to: 'skull', name: 'skull' },
    ...DRAWN.flatMap(legBones),
  ],
  limbs: DRAWN.map(limbOf),
};

// The draw order, as the legs go round the body: they start inside it, so
// the far legs are drawn behind it, outlined, then as fur alone so no line
// crosses where their foot and leg meet; the near legs outlined behind it
// too, their fur then over its edge. Each foot is drawn first, under its
// leg's rounded end, its heel.
const Z = { farLegs: 0, farFur: 1, nearLegs: 2, body: 3, head: 4, eyelid: 5, nearFur: 6 } as const;
const legPieces = (leg: Leg): Piece[] => {
  const side = leg.far ? 'far' : 'near';
  const [outlined, fur] = leg.far ? [Z.farLegs, Z.farFur] : [Z.nearLegs, Z.nearFur];
  const draws = (id: string, flush: boolean) => [{ id, z: outlined, part: `${side} legs` }, { id: `${id}, fur`, z: fur, fur: true, flush, part: `${side} legs, fur` }];
  const { foot } = leg;
  return [
    { id: `${leg.code} foot`, side, art: { drawn: { src: foot.src, fur: foot.fur, box: { x: -foot.heel.x, y: -foot.heel.y, width: foot.width, height: foot.height } } }, at: { kind: 'joint', to: `${leg.code}J3`, local: true }, draws: draws(`${leg.code} foot`, false) },
    { id: `${leg.code} leg`, side, art: { drawn: { src: legArt, fur: legFurArt } }, at: { kind: 'bar', from: `${leg.code}J0`, to: `${leg.code}J3`, thick: LEG_WIDTH }, draws: draws(`${leg.code} leg`, true) },
  ];
};
const HOG_BODY: Body = {
  frame: FRAME,
  skeleton: SKELETON,
  pieces: [
    ...DRAWN.flatMap(legPieces),
    { id: 'body', art: { drawn: { src: bodyArt, box: BODY } }, at: { kind: 'joint', to: 'body' }, draws: [{ id: 'body', z: Z.body }] },
    { id: 'head', art: { drawn: { src: headArt, box: HEAD } }, at: { kind: 'joint', to: 'skull' }, draws: [{ id: 'head', z: Z.head }] },
  ],
  shapes: [{ id: 'eyelid', on: 'skull', z: Z.eyelid }],
  guides: [
    { name: 'neck', at: { on: 'body', at: NECK } }, { name: 'eye', at: 'eye' }, { name: 'nose', at: 'nose' },
    ...LEGS.map((leg) => ({ name: leg.fore ? 'shoulder' : 'hip', at: `${leg.code}J0` })),
    ...LEGS.map((leg) => ({ name: leg.fore ? 'wrist' : 'ankle', at: `${leg.code}J3` })),
  ],
};
const BALL_PICTURE = wholePicture(FRAME, BALL);

// The pose its stance makes: each foot set from where its hip is now.
function poseOf(hog: Hog, look: HogLook): PoseSpec {
  const { body, head: angle, neck, feet, steps } = stance(hog, look);
  const joints = { skull: { angle, shift: { x: neck, y: 0 } } };
  const roots = rootsOf(SKELETON, { root: body, joints });
  const hips = LEGS.map((leg) => roots.get(leg.code) ?? leg.hip);
  const at = feet(hips);
  return {
    root: body,
    joints,
    limbs: Object.fromEntries(LEGS.map((leg, i) => [leg.code, { kind: 'plant', at: at[i], step: steps[i] }] as const)),
    show: {},
    z: {},
    shapes: { eyelid: lidLayers(!look.still && blinking(hog.seed, look.now), EYE, 0.95, FACE) },
  };
}

export function hogRig(hog: Hog, look: HogLook): RigPose {
  if (hog.mode === 'curled') return BALL_PICTURE(look.still ? 1 : 1 + 0.04 * breath(hog.seed, look.now, 2600));
  return compose(HOG_BODY, (now) => poseOf(hog, { ...look, now }), look.now);
}
