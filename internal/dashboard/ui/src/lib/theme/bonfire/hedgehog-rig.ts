import type { Point } from '../pointer';
import { gaitPhase, legsTo, restingFeet, steppingFeet, type Gait, type QuadLeg } from '../rig/gait';
import { blinking, breath, snuffle } from '../rig/life';
import { legsLayer, lidLayers, stillPicture, turnAbout, turned, type Frame, type Fur, type LegArt, type Layer, type RigPose } from '../rig/rig';
import { clamp } from '../spidergait';
import { moving, type Hog } from './hedgehog';
import ballArt from './hedgehog-ball.webp';
import bodyArt from './hedgehog-body.webp';
import headArt from './hedgehog-head.webp';
import legFurArt from './hedgehog-leg-fur.webp';
import legArt from './hedgehog-leg.webp';
import pawFurArt from './hedgehog-paw-fur.webp';
import pawArt from './hedgehog-paw.webp';

// The hedgehog put together from its parts: spines and belly, a head over
// their cream front (its soft back edge hides the join), and four legs, each
// a piece of leg art laid along a leg posed in code. Facing right, on the
// ledge at ANCHOR. Every picture is on one scale, its eye's
// (design-docs/bonfire/export.py, which prints the sizes below in drawing
// units), so the ball is the same hedgehog curled up.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.375;
const GROUND = 19.4;
const ANCHOR = { x: 17, y: GROUND };
const FRAME: Frame = { width: 34, height: 20, anchor: ANCHOR, scale: SCALE };
const BODY = { x: 2, y: 1, width: 22.25, height: 15.67 };
const HEAD = { x: 20.5, y: 6, width: 11.67, height: 8.92 };
const NECK = { x: 22, y: 12.5 };
const EYE = { x: 27, y: 9.75 };
const BALL = { name: 'ball', src: ballArt, width: 17, height: 16.58 };
// Too short to show a knee: one piece, hip to ankle, on a small paw.
const LEG_ART: LegArt = {
  bone: legArt, boneFur: legFurArt, knee: false,
  foot: { src: pawArt, fur: pawFurArt, width: 4, height: 2.33, ankle: { x: 1.39, y: 0.64 } },
};
const LEG_WIDTH = 2.3;
// Where each leg ends: its ankle, as high as the paw under it stands.
const FEET = GROUND - (LEG_ART.foot.height - LEG_ART.foot.ankle.y);
const FACE: Fur = { fill: '#fdd79b', outline: '#140c05' };

// Hips sit just inside the belly, so the legs' tops are hidden behind it.
// The far pair is set a little apart from the near, as it would be seen.
const LEGS: QuadLeg[] = [
  { hip: { x: 8.5, y: 15 }, reach: -0.3, thigh: 1.7, shin: 2, beat: 0, bend: -1, far: false },
  { hip: { x: 19.5, y: 14.6 }, reach: 0.3, thigh: 1.7, shin: 2, beat: 0.25, bend: 1, far: false },
  { hip: { x: 11, y: 15 }, reach: -0.3, thigh: 1.7, shin: 2, beat: 0.5, bend: -1, far: true },
  { hip: { x: 16.5, y: 15 }, reach: 0.3, thigh: 1.7, shin: 2, beat: 0.75, bend: 1, far: true },
];
// Quick short steps, three feet down at a time.
const WALK: Gait = { stride: 2.4, lift: 1, stance: 0.75 };

// How far the head turns toward a cursor, and from how far it notices one;
// sniffing, how far the nose dips at most, which keeps the drawing inside
// the hedgehog's footprint.
const LOOK = 14;
const LOOK_REACH = 160;
const DIP = 18;

// What the drawing needs besides the hedgehog: the time, how far its head is
// turned toward the cursor (eased by the caller, see gazeAt), and whether
// motion is reduced.
export type HogLook = { now: number; gaze: number; still: boolean };

const degrees = (rad: number) => (rad * 180) / Math.PI;

// How far the head would turn toward the cursor, standing at `at` on the
// page: in the drawing's own frame (facing right, so a cursor behind is
// looked at over the shoulder only a little).
export function gazeAt(hog: Pick<Hog, 'dir'>, at: Point, cursor: Point | null): number {
  if (!cursor) return 0;
  const eye = { x: at.x + (EYE.x - ANCHOR.x) * SCALE * hog.dir, y: at.y - (ANCHOR.y - EYE.y) * SCALE };
  const dx = (cursor.x - eye.x) * hog.dir, dy = cursor.y - eye.y;
  if (Math.hypot(dx, dy) > LOOK_REACH) return 0;
  return clamp(degrees(Math.atan2(dy, Math.max(dx, 12))), -LOOK, LOOK);
}

// On the move: a slight rise and fall with each stride, a slow rock of the
// body every four strides, and the head nodding a little behind it. Its
// strides are short and quick (about four a second walking, eight in a
// hurry), so the rock and nod go at a quarter of their pace: slow and small,
// a waddle at page size, not a flicker.
const sway = (phase: number) => ({ bob: -0.22 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase)), rock: 1.2 * Math.sin((Math.PI * phase) / 2), nod: 2 * Math.sin((Math.PI * phase) / 2 - 0.8) });

// The head's turn: nodding on the move; nose down and snuffling while
// sniffing; otherwise toward a cursor.
function headAngle(hog: Hog, look: HogLook): number {
  if (look.still) return 0;
  if (moving(hog.mode)) return sway(gaitPhase(hog.walked / SCALE, WALK)).nod;
  if (hog.mode === 'sniff') return Math.min(DIP, 14 + 2 * Math.sin(look.now / 380) + snuffle(hog.seed, look.now) + look.gaze / 3);
  return look.gaze;
}

export function hogRig(hog: Hog, look: HogLook): RigPose {
  if (hog.mode === 'curled') return stillPicture(FRAME, BALL, look.still ? 1 : 1 + 0.04 * breath(hog.seed, look.now, 2600));
  const walking = moving(hog.mode) && !look.still;
  const walked = hog.walked / SCALE;
  const step = walking ? sway(gaitPhase(walked, WALK)) : { bob: 0, rock: 0 };
  // A little nose-down while sniffing.
  const body = turnAbout(step.rock + (hog.mode === 'sniff' && !look.still ? 2 : 0), ANCHOR, 0, step.bob);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = legsTo(LEGS, hips, walking ? steppingFeet(LEGS, hips, walked, FEET, WALK) : restingFeet(LEGS, hips, FEET));
  const nod = turnAbout(headAngle(hog, look), NECK);
  const head: Layer = {
    kind: 'group', turn: nod,
    layers: [{ kind: 'image', name: 'head', src: headArt, ...HEAD }, ...lidLayers(!look.still && blinking(hog.seed, look.now), EYE, 0.95, FACE)],
  };
  return {
    ...FRAME,
    layers: [
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, true, false),
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, true, true),
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, false, false),
      { kind: 'group', turn: body, layers: [{ kind: 'image', name: 'body', src: bodyArt, ...BODY }, head] },
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, false, true),
    ],
    guides: [{ name: 'stands here', at: ANCHOR }, { name: 'neck', at: turned(body, NECK) }, { name: 'eye', at: turned(body, turned(nod, EYE)) }, ...hips.map((at) => ({ name: 'hip', at }))],
  };
}
