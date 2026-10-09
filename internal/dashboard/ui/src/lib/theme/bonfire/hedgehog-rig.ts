import type { Point } from '../pointer';
import { clamp } from '../spidergait';
import { gaitPhase, legsTo, restingFeet, steppingFeet, type Gait, type QuadLeg } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { legLayers, lidLayers, stillPicture, turnAbout, turned, type Frame, type Fur, type Layer, type RigPose } from '../rig/rig';
import { moving, type Hog } from './hedgehog';
import ballArt from './hedgehog-ball.webp';
import bodyArt from './hedgehog-body.webp';
import headArt from './hedgehog-head.webp';

// The hedgehog put together from its parts (design-docs/bonfire/export.py
// gives the art's display sizes): spines and belly, a head tucked behind
// their front, and four short legs drawn in code beneath. Facing right, on
// the ledge at ANCHOR.

const GROUND = 18.3;
const ANCHOR = { x: 17, y: GROUND };
const FRAME: Frame = { width: 34, height: 20, anchor: ANCHOR };
const BODY = { x: 2, y: 1, width: 20.5, height: 15 };
const HEAD = { x: 17.5, y: 5.6, width: 13, height: 8.5 };
const NECK = { x: 20, y: 11 };
const EYE = { x: 25.3, y: 9.1 };
const BALL = { width: 18.5, height: 18 };

const NEAR_FUR: Fur = { fill: '#f6cf92', outline: '#140c05' };
const FAR_FUR: Fur = { fill: '#d4a86c', outline: '#140c05' };
const FACE: Fur = { fill: '#fdd79b', outline: '#140c05' };

// Hips sit just inside the belly, so the legs' tops are hidden behind it.
// The far pair is set a little apart from the near, as it would be seen.
const LEGS: QuadLeg[] = [
  { hip: { x: 8.5, y: 14.3 }, reach: -0.3, thigh: 1.7, shin: 1.9, beat: 0, bend: -1, far: false },
  { hip: { x: 18, y: 14 }, reach: 0.3, thigh: 1.7, shin: 1.9, beat: 0.25, bend: 1, far: false },
  { hip: { x: 11.5, y: 14.5 }, reach: -0.3, thigh: 1.7, shin: 1.9, beat: 0.5, bend: -1, far: true },
  { hip: { x: 15.5, y: 14.4 }, reach: 0.3, thigh: 1.7, shin: 1.9, beat: 0.75, bend: 1, far: true },
];
// Quick short steps, three feet down at a time.
const WALK: Gait = { stride: 2.4, lift: 1, stance: 0.75 };
const LEG = { width: 1, paw: 0.5 };
// Feet stand this far above the ledge, so their outlines rest on it.
const FOOT = 0.9;

// How far the head turns toward a cursor, and from how far it notices one.
const LOOK = 14;
const LOOK_REACH = 160;

export type HogLook = { now: number; at: Point; cursor: Point | null; still: boolean };

const degrees = (rad: number) => (rad * 180) / Math.PI;

// The head's turn toward the cursor, in the drawing's own frame (facing
// right, so a cursor behind it is looked at over the shoulder only a little).
function lookAt(hog: Hog, look: HogLook): number {
  if (!look.cursor || look.still) return 0;
  const eye = { x: look.at.x + (EYE.x - ANCHOR.x) * hog.dir, y: look.at.y - (ANCHOR.y - EYE.y) };
  const dx = (look.cursor.x - eye.x) * hog.dir, dy = look.cursor.y - eye.y;
  if (Math.hypot(dx, dy) > LOOK_REACH) return 0;
  return clamp(degrees(Math.atan2(dy, Math.max(dx, 12))), -LOOK, LOOK);
}

// The head's turn: a nod with each step, nose down and twitching while
// sniffing, or toward a cursor.
function headAngle(hog: Hog, look: HogLook, phase: number): number {
  if (look.still) return 0;
  if (hog.mode === 'sniff') return 14 + 3 * Math.sin(look.now / 45) + lookAt(hog, look) / 3;
  if (moving(hog.mode)) return 2 * Math.sin(4 * Math.PI * phase);
  return lookAt(hog, look);
}

export function hogRig(hog: Hog, look: HogLook): RigPose {
  if (hog.mode === 'curled') return stillPicture(FRAME, { src: ballArt, ...BALL }, look.still ? 1 : 1 + 0.04 * breath(hog.seed, look.now, 2600));
  const phase = gaitPhase(hog.walked, WALK);
  const walking = moving(hog.mode) && !look.still;
  // A little nose-down while sniffing; a bob with each step.
  const tilt = hog.mode === 'sniff' && !look.still ? 2 : 0;
  const bob = walking ? -0.35 * Math.abs(Math.sin(4 * Math.PI * phase)) : 0;
  const body = turnAbout(tilt, ANCHOR, 0, bob);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = legsTo(LEGS, hips, walking ? steppingFeet(LEGS, hips, hog.walked, GROUND - FOOT, WALK) : restingFeet(LEGS, hips, GROUND - FOOT));
  const head: Layer = {
    kind: 'group', turn: turnAbout(headAngle(hog, look, phase), NECK),
    layers: [{ kind: 'image', src: headArt, ...HEAD }, ...lidLayers(!look.still && blinking(hog.seed, look.now), EYE, 0.95, FACE)],
  };
  return {
    ...FRAME,
    layers: [...legLayers(LEGS, legs, { near: NEAR_FUR, far: FAR_FUR }, LEG), { kind: 'group', turn: body, layers: [head, { kind: 'image', src: bodyArt, ...BODY }] }],
  };
}
