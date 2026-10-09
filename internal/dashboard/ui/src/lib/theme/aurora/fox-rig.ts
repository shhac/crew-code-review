import type { Point } from '../pointer';
import { gaitPhase, legsTo, restingFeet, steppingFeet, swingsOf, type Gait, type QuadLeg } from '../rig/gait';
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
// chest, on four legs, each made of furred leg art laid along a leg posed in
// code. Facing right, on the ledge at ANCHOR. Curled up asleep, or looking
// up from there, it is one picture. Every picture is on one scale, its
// eye's, so curled up it is the same fox.
//
// The parts were cut from one drawing of the fox standing square
// (design-docs/aurora/fox-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. The critters lab lays
// that drawing over the rig to compare.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.5;

const GROUND = 17.66;
const ANCHOR = { x: 15.6, y: GROUND };
const FRAME: Frame = { width: 31.5, height: 19, anchor: ANCHOR, scale: SCALE };
const TAIL = { x: 1, y: 1.56, width: 11.83, height: 10.25 };
const TAIL_ROOT = { x: 12, y: 8 };
const TORSO = { x: 9.95, y: 5.91, width: 15.42, height: 7.75 };
const HEAD = { x: 19.91, y: 1, width: 10.33, height: 9.75 };
const PICTURES = { curled: { name: 'curled', src: curledArt, width: 15.33, height: 12.42 }, alert: { name: 'looking up', src: alertArt, width: 15.33, height: 14.17 } };
const NECK = { x: 21.8, y: 8.8 };
const EYE = { x: 27.2, y: 5.15 };
// The body turns about its hips.
const HIND = { x: 11.5, y: 11.5 };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 29.25, height: 16.83 };

const FACE: Fur = { fill: '#fbfcfc', outline: '#0a0809' };
// A fox stands on its toes. Each leg: a haunch from hip to knee (shoulder
// to elbow), thick where it meets the body; the leg on down to the hock (or
// wrist); a bone from there to the toes, which stand on the ledge.
const TOES = { src: toesArt, fur: toesFurArt, width: 3.33, height: 1.42, heel: { x: 1, y: 0.42 } };
const LEG_ART: LegArt = {
  bone: legArt, boneFur: legFurArt, knee: true,
  thigh: { src: haunchArt, fur: haunchFurArt },
  feet: { fore: TOES, hind: TOES },
};
const LEG_WIDTH = 2.1;

// Where the legs are, as a fox's are (it stands on its toes): the hips up in
// the rump, each thigh running down and forward to the stifle (the true
// knee) at the belly, the shank back to the hock (the ankle, the joint that
// looks like a backward knee) well off the ground, its point showing behind,
// and the long metatarsus near upright to the toes; the shoulders in the
// chest, the upper arm back to the elbow at the chest's foot, the forearm
// near straight down to the wrist (the carpus) just off the ground, and the
// short metacarpus to the toes. Those bottom bones fold back as the paw lifts. The
// far pair a little behind and above the near, as they would be seen.
// Trotting, diagonal pairs move together: near fore with far hind, far fore
// with near hind.
// A trot's diagonal pairs never land quite together: the hind foot of each
// pair lands this much of a stride before its fore foot, as a trotter's
// tends to.
const HIND_FIRST = 0.06;
const HIND_LEG = { thigh: 2.3, shin: 2.1, bend: 1, fore: false, haunch: 2.6, taper: true, reach: -1, toes: { length: 1.5, lean: 10, fold: 70 } } as const;
const FORE_LEG = { thigh: 2.3, shin: 3.6, bend: -1, fore: true, haunch: 2.4, reach: 0.3, toes: { length: 0.7, lean: 8, fold: 100 } } as const;
const LEGS: QuadLeg[] = [
  { ...HIND_LEG, hip: { x: 12.2, y: 11 }, beat: HIND_FIRST, far: true },
  { ...FORE_LEG, hip: { x: 21.9, y: 10.2 }, beat: 0.5, far: true },
  { ...HIND_LEG, hip: { x: 11.2, y: 11.2 }, beat: 0.5 + HIND_FIRST, far: false },
  { ...FORE_LEG, hip: { x: 21, y: 10.4 }, beat: 0, far: false },
];
const FAR = { name: 'far legs', far: true };
const NEAR = { name: 'near legs', far: false };
// Each foot down for a little over half the stride, so the pairs overlap.
const TROT: Gait = { stride: 8, lift: 3.2, stance: 0.55 };
// Where each leg ends: on the toes' back, as high as they stand.
const FEET = GROUND - (TOES.height - TOES.heel.y);

export type FoxLook = { now: number; still: boolean };
// What the drawing reads of a fox.
export type RigFox = Pick<Fox, 'mode' | 'walked' | 'seed' | 'until' | 'ear' | 'look'>;

type Feet = (hips: readonly Point[]) => Point[];
// swings: how far through its swing each foot is, when stepping (swingsOf).
type Stance = { body: Turn; head: number; tail: number; feet: Feet; swings?: number[] };

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
      return { body, head: 0.8 * Math.sin(2 * Math.PI * phase), tail: 5 * Math.sin(2 * Math.PI * phase), feet: (hips) => steppingFeet(LEGS, hips, walked, FEET, TROT), swings: swingsOf(LEGS, walked, TROT) };
    }
    // Each tuned against its key pose (design-docs/aurora/fox-pose-*.png,
    // laid over the rig in the critters lab). A positive head turns the nose
    // down; a positive tail lifts it.
    case 'stretch':
      // A play bow: the front sinks onto forelegs reaching forward.
      return { body: turnAbout(16, HIND), head: 8, tail: 6, feet: planted(5, -0.3) };
    case 'crouch':
      // Stalking: low, head down and forward, tail low, legs gathered.
      return { body: turnAbout(4, HIND, 0, 2.5), head: 28, tail: -22, feet: planted(1.5, -1.5) };
    case 'leap': {
      // Nose up as it springs, nose down as it lands: hind legs trail, then
      // the forelegs reach for the snow.
      const t = leapt(fox, look.now);
      const reach = (h: Point, i: number): Point => (LEGS[i].fore ? { x: h.x + 2 + 1.5 * t, y: h.y + 3.5 + 1.5 * t } : { x: h.x - 3 - 3 * t, y: h.y + 4.5 - 3 * t });
      return { body: turnAbout(-8 + 20 * t, HIND), head: 8 * t, tail: 10 - 15 * t, feet: (hips) => hips.map(reach) };
    }
    case 'dig': {
      // Nose in the snow, forepaws scrabbling turn about.
      const scrabble = (i: number) => Math.sin(look.now / 55 + (i === 1 ? Math.PI : 0));
      const paw = (h: Point, i: number): Point => (LEGS[i].fore ? { x: h.x + 2.5 + 1.2 * scrabble(i), y: FEET - Math.max(0, 1.4 * scrabble(i)) } : { x: h.x - 0.4, y: FEET });
      return { body: turnAbout(16, HIND), head: 38, tail: 2 + sway, feet: (hips) => hips.map(paw) };
    }
    default:
      return standing(sway);
  }
}

export function foxRig(fox: RigFox, look: FoxLook): RigPose {
  const pose = poseOf(fox, look.now);
  // Curled up asleep, or looking up from there, breathing slowly.
  if (pose === 'curled' || pose === 'alert') return stillPicture(FRAME, PICTURES[pose], look.still ? 1 : 1 + 0.035 * breath(fox.seed, look.now, 3400));
  const { body, head, tail, feet, swings } = stance(fox, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = legsTo(LEGS, hips, feet(hips), swings);
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
              ...lidLayers(!look.still && blinking(fox.seed, look.now), EYE, 0.85, FACE),
            ],
          },
        ],
      },
      legsLayer(LEGS, legs, LEG_ART, LEG_WIDTH, NEAR, true),
    ],
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'tail root', at: turned(body, TAIL_ROOT) }, { name: 'neck', at: turned(body, NECK) },
      { name: 'eye', at: turned(body, turned(nod, EYE)) }, ...hips.map((at, i) => ({ name: LEGS[i].fore ? 'shoulder' : 'hip', at })),
      ...legs.flatMap((l, i) => (LEGS[i].fore
        ? [{ name: 'elbow', at: l.knee }, { name: 'wrist (carpus)', at: l.ankle }, { name: 'toes', at: l.foot }]
        : [{ name: 'stifle (knee)', at: l.knee }, { name: 'hock (ankle)', at: l.ankle }, { name: 'toes', at: l.foot }])),
    ],
  };
}
