import type { Point } from '../pointer';
import { gaitPhase, legsTo, restingFeet, steppingFeet, type Gait, type QuadLeg } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { legsLayer, lidLayers, stillPicture, turnAbout, turned, type Frame, type Fur, type LegArt, type RigPose, type Turn } from '../rig/rig';
import { leapt, poseOf, type Fox } from './fox';
import alertArt from './fox-alert.webp';
import curledArt from './fox-curled.webp';
import haunchFurArt from './fox-haunch-fur.webp';
import haunchArt from './fox-haunch.webp';
import headArt from './fox-head.webp';
import legFurArt from './fox-leg-fur.webp';
import legArt from './fox-leg.webp';
import tailArt from './fox-tail.webp';
import toesFurArt from './fox-toes-fur.webp';
import toesArt from './fox-toes.webp';
import torsoArt from './fox-torso.webp';

// The fox put together from its parts: a tail, a torso and a head over its
// chest, on four legs, each a piece of furred leg art laid along a leg posed
// in code. Facing right, on the ledge at ANCHOR. Curled up asleep, or
// looking up from there, it is one picture. Every picture is on one scale,
// its eye's (design-docs/aurora/export.py, which prints the sizes below in
// drawing units), so curled up it is the same fox.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.28;

const GROUND = 22;
const ANCHOR = { x: 15, y: GROUND };
const FRAME: Frame = { width: 30, height: 23, anchor: ANCHOR, scale: SCALE };
const TAIL = { x: 1, y: 3, width: 10.75, height: 11.17 };
const TAIL_ROOT = { x: 10, y: 12.5 };
const TORSO = { x: 9, y: 10.5, width: 13.08, height: 7.58 };
const HEAD = { x: 17.5, y: 5.5, width: 10.33, height: 10 };
const PICTURES = { curled: { name: 'curled', src: curledArt, width: 15.33, height: 12.42 }, alert: { name: 'looking up', src: alertArt, width: 15.33, height: 14.17 } };
const NECK = { x: 20.5, y: 12.5 };
const EYE = { x: 24.5, y: 10 };
// Where the head's back outline crosses the chest, painted over.
const SEAM = { x: 18.4, y: 13.2 };
const HIND = { x: 12.5, y: 16 };

const FACE: Fur = { fill: '#fbfcfc', outline: '#0a0809' };
// A fox stands on its toes. Each leg: a haunch from hip to knee (shoulder
// to elbow), thick where it meets the body; the leg on down to the hock (or
// wrist); a bone from there to the toes, which stand on the ledge.
const TOES = { src: toesArt, fur: toesFurArt, width: 3, height: 1.25, heel: { x: 0.9, y: 0.38 } };
const LEG_ART: LegArt = {
  bone: legArt, boneFur: legFurArt, knee: true,
  thigh: { src: haunchArt, fur: haunchFurArt },
  feet: { fore: TOES, hind: TOES },
};
const LEG_WIDTH = 1.9;

// Where the legs are, as a fox's are: the hips up in the rump, each thigh
// running down and forward to a knee at the belly, the shin back to a hock
// well off the ground, and a long bone near upright to the toes; the
// shoulders high in the chest, the upper arm back to an elbow at the chest's
// foot, the forearm near straight down to a wrist just off the ground, and a
// short bone to the toes. Those bottom bones fold back as the paw lifts. The
// far pair a little behind and above the near, as they would be seen.
// Trotting, diagonal pairs move together: near fore with far hind, far fore
// with near hind.
const HIND_LEG = { thigh: 3, shin: 3.1, bend: 1, fore: false, haunch: 3.4, reach: -0.4, toes: { length: 2.5, lean: 10, fold: 55 } } as const;
const FORE_LEG = { thigh: 2.9, shin: 4.3, bend: -1, fore: true, haunch: 2.4, reach: 0.4, toes: { length: 0.9, lean: 12, fold: 75 } } as const;
const LEGS: QuadLeg[] = [
  { ...HIND_LEG, hip: { x: 13, y: 13.8 }, beat: 0, far: true },
  { ...FORE_LEG, hip: { x: 20.4, y: 13 }, beat: 0.5, far: true },
  { ...HIND_LEG, hip: { x: 12, y: 14 }, beat: 0.5, far: false },
  { ...FORE_LEG, hip: { x: 19.6, y: 13.2 }, beat: 0, far: false },
];
const FAR = { name: 'far legs', far: true };
const NEAR = { name: 'near legs', far: false };
const TROT: Gait = { stride: 5, lift: 1.8, stance: 0.5 };
// Where each leg ends: on the toes' back, as high as they stand.
const FEET = GROUND - (TOES.height - TOES.heel.y);

export type FoxLook = { now: number; still: boolean };
// What the drawing reads of a fox.
export type RigFox = Pick<Fox, 'mode' | 'walked' | 'seed' | 'until' | 'ear' | 'look'>;

type Feet = (hips: readonly Point[]) => Point[];
type Stance = { body: Turn; head: number; tail: number; feet: Feet };

// Feet planted on the ledge, fore and hind each set this far from its hip.
const planted = (foreBy: number, hindBy: number): Feet => (hips) => hips.map((h, i) => ({ x: h.x + (LEGS[i].fore ? foreBy : hindBy), y: FEET }));
const standing = (tail: number): Stance => ({ body: turnAbout(0, HIND), head: 0, tail, feet: (hips) => restingFeet(LEGS, hips, FEET) });

// The body's turn and where the feet go, for each way the fox stands.
function stance(fox: RigFox, look: FoxLook): Stance {
  if (look.still) return standing(0);
  const sway = 4 * Math.sin(look.now / 700);
  switch (fox.mode) {
    case 'trot':
    case 'exit':
    case 'enter': {
      // A gentle bounce with each pair's push, a slow nod and swish with each
      // stride: quicker, and the small head and tail flicker.
      const walked = fox.walked / SCALE;
      const phase = gaitPhase(walked, TROT);
      const body = turnAbout(0, HIND, 0, -0.3 * Math.abs(Math.sin(2 * Math.PI * phase)));
      return { body, head: 0.8 * Math.sin(2 * Math.PI * phase), tail: 5 * Math.sin(2 * Math.PI * phase), feet: (hips) => steppingFeet(LEGS, hips, walked, FEET, TROT) };
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
      const reach = (h: Point, i: number): Point => (LEGS[i].fore ? { x: h.x + 1.5 + 2.5 * t, y: h.y + 4 + 2.5 * t } : { x: h.x - 4 + t, y: h.y + 4.5 - t });
      return { body: turnAbout(-28 + 56 * t, HIND), head: 10 * t, tail: -25 + 30 * t, feet: (hips) => hips.map(reach) };
    }
    case 'dig': {
      // Nose in the snow, forepaws scrabbling turn about.
      const scrabble = (i: number) => Math.sin(look.now / 55 + (i === 1 ? Math.PI : 0));
      const paw = (h: Point, i: number): Point => (LEGS[i].fore ? { x: h.x + 2.5 + 1.2 * scrabble(i), y: FEET - Math.max(0, 1.4 * scrabble(i)) } : { x: h.x - 0.4, y: FEET });
      return { body: turnAbout(10, HIND), head: 22, tail: -18 + sway, feet: (hips) => hips.map(paw) };
    }
    default:
      return standing(sway);
  }
}

export function foxRig(fox: RigFox, look: FoxLook): RigPose {
  const pose = poseOf(fox, look.now);
  // Curled up asleep, or looking up from there, breathing slowly.
  if (pose === 'curled' || pose === 'alert') return stillPicture(FRAME, PICTURES[pose], look.still ? 1 : 1 + 0.035 * breath(fox.seed, look.now, 3400));
  const { body, head, tail, feet } = stance(fox, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = legsTo(LEGS, hips, feet(hips), FEET, TROT.lift);
  const nod = turnAbout(head, NECK);
  return {
    ...FRAME,
    layers: [
      // The legs start inside the body, its hips high in the rump and its
      // shoulders in the chest: the far legs behind the torso, outlined,
      // then as fur alone so no line crosses a joint; the near legs
      // outlined behind it too, their fur then over its edge, so they grow
      // out of it with no line across.
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, FAR, false),
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, FAR, true),
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, NEAR, false),
      {
        kind: 'group', turn: body,
        layers: [
          { kind: 'group', turn: turnAbout(tail, TAIL_ROOT), layers: [{ kind: 'image', name: 'tail', src: tailArt, ...TAIL }] },
          { kind: 'image', name: 'torso', src: torsoArt, ...TORSO },
          {
            kind: 'group', turn: nod,
            layers: [
              { kind: 'image', name: 'head', src: headArt, ...HEAD },
              { kind: 'patch', at: SEAM, rx: 1.1, ry: 2, fill: FACE.fill },
              ...lidLayers(!look.still && blinking(fox.seed, look.now), EYE, 0.85, FACE),
            ],
          },
        ],
      },
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, NEAR, true),
    ],
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'tail root', at: turned(body, TAIL_ROOT) }, { name: 'neck', at: turned(body, NECK) },
      { name: 'eye', at: turned(body, turned(nod, EYE)) }, ...hips.map((at) => ({ name: 'hip', at })),
      ...legs.flatMap((l) => [{ name: 'knee', at: l.knee }, { name: 'ankle', at: l.ankle }, { name: 'toes', at: l.foot }]),
    ],
  };
}
