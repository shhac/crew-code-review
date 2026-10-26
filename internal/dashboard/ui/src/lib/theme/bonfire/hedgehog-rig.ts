import { apart } from '../math';
import type { Point } from '../pointer';
import { gaitPhase, restingFeet, stepping, type Gait, type Step } from '../rig/gait';
import { gazeFrom } from '../rig/gaze';
import { blinking, breath, snuffle } from '../rig/life';
import { lidLayers, turnAbout, type ArtLeg, type Foot, type Frame, type Fur, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { wholePicture } from '../rig/skeleton/picture';
import { head, MAMMAL, picture, spine, tetrapod } from '../rig/skeleton/tetrapod';
import type { PoseSpec } from '../rig/skeleton/types';
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
const legArtOn = (foot: Foot): LimbArt => ({ bone: legArt, boneFur: legFurArt, knee: false, overFoot: true, foot });
const LEG_WIDTH = 2.6;
// Where each leg ends: its heel, as high as the foot under it stands.
const FEET = GROUND - (HIND_FOOT.height - HIND_FOOT.heel.y);
const FACE: Fur = { fill: '#fdd79b', outline: '#140c05' };

// Hips just inside the belly, over the feet as the drawing stands them; the
// far pair a little apart from the near, as it would be seen. Each foot's
// heel peels up over the tips of its toes as it pushes off.
const soleOf = (foot: Foot) => ({ kind: 'sole', toes: { x: foot.width - foot.heel.x, y: foot.height - foot.heel.y }, peel: 30 }) as const;
const HIND = { reach: 0, thigh: 1, shin: 1, bend: 1, fore: false, art: legArtOn(HIND_FOOT), width: LEG_WIDTH, walksOn: soleOf(HIND_FOOT) } as const;
const FORE = { reach: 0.2, thigh: 1, shin: 1, bend: -1, fore: true, art: legArtOn(HAND), width: LEG_WIDTH, walksOn: soleOf(HAND) } as const;
const LEGS: ArtLeg[] = [
  { ...HIND, hip: { x: 5.9, y: 14.6 }, far: false },
  { ...FORE, hip: { x: 15.5, y: 14.6 }, far: false },
  { ...HIND, hip: { x: 9.9, y: 14.8 }, far: true },
  { ...FORE, hip: { x: 18.7, y: 14.4 }, far: true },
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
// Peeking, how far ahead of its shoulder and above where it stands the
// raised forefoot's heel is held.
const RAISED = { x: 0.7, y: 0.7 };

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
    // lifted to test the air, a forefoot raised out ahead to creep out, a
    // little above level, the paw hanging from it toes down (the peek
    // drawing), as it does just off the ground in a step.
    const creep: Stance = resting(turnAbout(0, ANCHOR, 0, 0.3), TEST_AIR + look.gaze, STRETCH);
    const raise = (hips: readonly Point[]) => restingFeet(LEGS, hips, FEET).map((at, i) => (i === CREEPING ? { x: hips[i].x + RAISED.x, y: FEET - RAISED.y } : at));
    return { ...creep, feet: raise, steps: LEGS.map((_, i) => (i === CREEPING ? { down: false, t: 0.05 } : { down: true, t: 0 })) };
  }
  return resting(turnAbout(0, ANCHOR), look.gaze);
}

// Its skeleton: the body turning about where it stands, the head on its
// neck with the eye and nose on it, and each leg from its hip (or
// shoulder): too short to show a knee, it is one piece from there to the
// heel, the knee and ankle inside it, and the foot flat on its sole. Drawn
// with the far legs behind it, the near legs' fur over its edge.
const oneLeg = (joints: readonly [string, string, string, string, string], bones: readonly [string, string], foot: string) => ({ joints, bones: [...bones, '', foot] as const });
const HOG = tetrapod({ ...MAMMAL, legs: {
  fore: oneLeg(['shoulder', 'elbow (inside the leg)', 'wrist', 'forefoot (its heel)', 'toe tip'], ['humerus (inside the one piece)', 'radius and ulna (inside the one piece)'], 'forefoot (metacarpus and toes)'),
  hind: oneLeg(['hip', 'knee (inside the leg)', 'ankle', 'hind foot (its heel)', 'toe tip'], ['femur (inside the one piece)', 'tibia and fibula (inside the one piece)'], 'hind foot (metatarsus and toes)'),
} }, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(1), at: ANCHOR, name: 'body (turns about where it stands)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint (neck)' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'nose', parent: 'skull', role: head(1), at: NOSE, name: 'nose' },
  ],
  bones: [
    // Peeking, the neck stretches out: the head joint moves forward on it.
    { from: 'skull', to: 'body', name: 'neck and back line (head joint to where the body turns)', stretch: { min: apart(NECK, ANCHOR), max: apart({ x: NECK.x + STRETCH, y: NECK.y }, ANCHOR) } },
    { from: 'nose', to: 'skull', name: 'skull' },
  ],
  legs: LEGS,
  ground: () => FEET,
  order: [picture('body', 'body', bodyArt, BODY), picture('head', 'skull', headArt, HEAD), 'eyelid'],
  shapes: [{ id: 'eyelid', on: 'skull' }],
  guides: (at) => [
    { name: 'neck', at: { on: 'body', at: NECK } }, { name: 'eye', at: 'eye' }, { name: 'nose', at: 'nose' },
    ...LEGS.map((leg) => ({ name: leg.fore ? 'shoulder' : 'hip', at: at(leg, 0) })), ...LEGS.map((leg) => ({ name: leg.fore ? 'wrist' : 'ankle', at: at(leg, 3) })),
  ],
});
const BALL_PICTURE = wholePicture(FRAME, BALL);

// The pose its stance makes: each foot set from where its hip is now.
function poseOf(hog: Hog, look: HogLook): PoseSpec {
  const { body, head: angle, neck, feet, steps } = stance(hog, look);
  const joints = { skull: { angle, shift: { x: neck, y: 0 } } };
  const at = feet(HOG.hips({ root: body, joints }));
  return {
    root: body, joints, limbs: HOG.limbs(at.map((p, i) => ({ kind: 'plant', at: p, step: steps[i] }))), show: {}, z: {},
    shapes: { eyelid: lidLayers(!look.still && blinking(hog.seed, look.now), EYE, 0.95, FACE) },
  };
}

export function hogRig(hog: Hog, look: HogLook): RigPose {
  if (hog.mode === 'curled') return BALL_PICTURE(look.still ? 1 : 1 + 0.04 * breath(hog.seed, look.now, 2600));
  return compose(HOG.body, (now) => poseOf(hog, { ...look, now }), look.now);
}
