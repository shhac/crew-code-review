import type { Point } from '../pointer';
import { fore, gaitPhase, legsTo, restingFeet, steppingFeet, type Gait, type QuadLeg } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { legLayers, lidLayers, stillPicture, turnAbout, turned, type Frame, type Fur, type RigPose, type Turn } from '../rig/rig';
import { leapt, poseOf, POSES, type Fox } from './fox';
import alertArt from './fox-alert.webp';
import curledArt from './fox-curled.webp';
import headArt from './fox-head.webp';
import tailArt from './fox-tail.webp';
import torsoArt from './fox-torso.webp';

// The fox put together from its parts (design-docs/aurora/export.py gives
// the art's display sizes): a tail, a torso and a head over its chest, on
// four legs drawn in code. Facing right, on the ledge at
// ANCHOR. Curled up asleep, or looking up from there, it is one picture.

const GROUND = 22;
const ANCHOR = { x: 15, y: GROUND };
const FRAME: Frame = { width: 30, height: 23, anchor: ANCHOR };
const TAIL = { x: 1, y: 3, width: 10.5, height: 11 };
const TAIL_ROOT = { x: 10, y: 12.5 };
const TORSO = { x: 9, y: 10.5, width: 13, height: 7.5 };
const HEAD = { x: 17.5, y: 5.5, width: 10.5, height: 10 };
const NECK = { x: 20.5, y: 12.5 };
const EYE = { x: 24.5, y: 10 };
// Where the head's back outline crosses the chest, painted over.
const SEAM = { x: 18.4, y: 13.2 };
const HIND = { x: 12.5, y: 16 };

const OUTLINE = '#0a0809';
const NEAR_FUR: Fur = { fill: '#f4f7fb', outline: OUTLINE };
const FAR_FUR: Fur = { fill: '#c3cfdd', outline: OUTLINE };
const FACE: Fur = { fill: '#fbfcfc', outline: OUTLINE };

// Hips just inside the torso's underside; the far pair a little behind and
// above the near, as they would be seen. Trotting, diagonal pairs move
// together: near fore with far hind, far fore with near hind.
const LEGS: QuadLeg[] = [
  { hip: { x: 13.2, y: 15.8 }, reach: -0.3, thigh: 2.7, shin: 2.8, beat: 0, bend: -1, far: true },
  { hip: { x: 20.2, y: 15.8 }, reach: 0.3, thigh: 2.7, shin: 2.8, beat: 0.5, bend: 1, far: true },
  { hip: { x: 12, y: 16 }, reach: -0.3, thigh: 2.7, shin: 2.8, beat: 0.5, bend: -1, far: false },
  { hip: { x: 19, y: 16 }, reach: 0.3, thigh: 2.7, shin: 2.8, beat: 0, bend: 1, far: false },
];
const TROT: Gait = { stride: 5, lift: 1.8, stance: 0.5 };
const LEG = { width: 1.1, paw: 0.6 };
const FOOT = 0.9;
const FEET = GROUND - FOOT;

export type FoxLook = { now: number; still: boolean };
// What the drawing reads of a fox.
export type RigFox = Pick<Fox, 'mode' | 'walked' | 'seed' | 'until' | 'ear' | 'look'>;

type Feet = (hips: readonly Point[]) => Point[];
type Stance = { body: Turn; head: number; tail: number; feet: Feet };

// Feet planted on the ledge, fore and hind each set this far from its hip.
const planted = (foreBy: number, hindBy: number): Feet => (hips) => hips.map((h, i) => ({ x: h.x + (fore(LEGS[i]) ? foreBy : hindBy), y: FEET }));
const standing = (tail: number): Stance => ({ body: turnAbout(0, HIND), head: 0, tail, feet: (hips) => restingFeet(LEGS, hips, FEET) });

// The body's turn and where the feet go, for each way the fox stands.
function stance(fox: RigFox, look: FoxLook): Stance {
  if (look.still) return standing(0);
  const sway = 4 * Math.sin(look.now / 700);
  switch (fox.mode) {
    case 'trot':
    case 'exit':
    case 'enter': {
      const phase = gaitPhase(fox.walked, TROT);
      const body = turnAbout(0, HIND, 0, -0.4 * Math.abs(Math.sin(2 * Math.PI * phase)));
      return { body, head: 1.5 * Math.sin(4 * Math.PI * phase), tail: 7 * Math.sin(2 * Math.PI * phase), feet: (hips) => steppingFeet(LEGS, hips, fox.walked, FEET, TROT) };
    }
    case 'stretch':
      // A play bow: the front sinks onto forelegs reaching forward.
      return { body: turnAbout(16, HIND), head: -12, tail: -22, feet: planted(5, -0.3) };
    case 'crouch':
      return { body: turnAbout(-4, HIND, 0, 1.6), head: 4, tail: -10, feet: planted(1, -1) };
    case 'leap': {
      // Nose up as it springs, nose down as it lands: hind legs trail, then
      // the forelegs reach for the snow.
      const t = leapt(fox, look.now);
      const reach = (h: Point, i: number): Point => (fore(LEGS[i]) ? { x: h.x + 1.5 + 2 * t, y: h.y + 2.5 + 2 * t } : { x: h.x - 3.5 + t, y: h.y + 3 - t });
      return { body: turnAbout(-28 + 56 * t, HIND), head: 10 * t, tail: -25 + 30 * t, feet: (hips) => hips.map(reach) };
    }
    case 'dig': {
      // Nose in the snow, forepaws scrabbling turn about.
      const scrabble = (i: number) => Math.sin(look.now / 55 + (i === 1 ? Math.PI : 0));
      const paw = (h: Point, i: number): Point => (fore(LEGS[i]) ? { x: h.x + 2.5 + 1.2 * scrabble(i), y: FEET - Math.max(0, 1.4 * scrabble(i)) } : { x: h.x - 0.3, y: FEET });
      return { body: turnAbout(10, HIND), head: 22, tail: -18 + sway, feet: (hips) => hips.map(paw) };
    }
    default:
      return standing(sway);
  }
}

export function foxRig(fox: RigFox, look: FoxLook): RigPose {
  const pose = poseOf(fox, look.now);
  // Curled up asleep, or looking up from there, breathing slowly.
  if (pose === 'curled' || pose === 'alert') {
    return stillPicture(FRAME, { src: pose === 'alert' ? alertArt : curledArt, ...POSES[pose] }, look.still ? 1 : 1 + 0.035 * breath(fox.seed, look.now, 3400));
  }
  const { body, head, tail, feet } = stance(fox, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = legsTo(LEGS, hips, feet(hips));
  return {
    ...FRAME,
    layers: [
      // Every leg starts behind the torso, so no hip shows on its fur; the
      // head sits in front, its ruff over the chest, so no seam crosses
      // the neck.
      ...legLayers(LEGS, legs, { near: NEAR_FUR, far: FAR_FUR }, LEG),
      {
        kind: 'group', turn: body,
        layers: [
          { kind: 'group', turn: turnAbout(tail, TAIL_ROOT), layers: [{ kind: 'image', src: tailArt, ...TAIL }] },
          { kind: 'image', src: torsoArt, ...TORSO },
          {
            kind: 'group', turn: turnAbout(head, NECK),
            layers: [
              { kind: 'image', src: headArt, ...HEAD },
              { kind: 'patch', at: SEAM, rx: 1.1, ry: 2, fill: FACE.fill },
              ...lidLayers(!look.still && blinking(fox.seed, look.now), EYE, 0.85, FACE),
            ],
          },
        ],
      },
    ],
  };
}
