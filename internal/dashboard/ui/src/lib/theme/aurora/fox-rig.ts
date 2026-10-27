import type { Point } from '../pointer';
import { gaitPhase, restingFeet, stepping, type Gait, type Step } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { lidLayers, turnAbout, turned, type Frame, type Fur, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { wholePicture } from '../rig/skeleton/picture';
import { head, MAMMAL, picture, spine, tetrapod, type HingedArtLeg } from '../rig/skeleton/tetrapod';
import type { JointSpec } from '../rig/skeleton/types';
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
// code, all hung on its skeleton (rig/skeleton). Facing right, on the ledge at ANCHOR. Curled up asleep, or looking
// up from there, it is one picture. Every picture is on one scale, its
// eye's, so curled up it is the same fox.
//
// The parts were cut from one drawing of the fox standing square
// (design-docs/aurora/fox-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. The critters lab lays
// that drawing over the rig to compare.

// Page pixels per drawing unit, for every pose.
const SCALE = 1.5;

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
const LEG_ART: LimbArt = {
  bone: legArt, boneFur: legFurArt, knee: true,
  thigh: { src: haunchArt, fur: haunchFurArt },
  foot: TOES,
};
const LEG_WIDTH = 2.1;

// Where the legs are, as a fox's are (it stands on its toes): the hip
// joints in the haunch, back from the stifles, each femur sloping down and
// forward to the stifle (the true knee) at the belly, the shank back to the
// hock (the ankle, the joint that looks like a backward knee) well off the
// ground, its point showing behind, and the long metatarsus near upright to
// the toes; each shoulder joint (the point of the shoulder) in the chest,
// ahead of its elbow, the humerus about as long as the forearm (as a
// canid's are) running down and back to the elbow at the chest's foot, the
// forearm near straight down to the wrist (the carpus) just off the ground,
// and the short metacarpus to the toes. The shoulder hangs from its blade,
// the scapula, which swings about its top at the withers, carrying the
// shoulder forward as the paw reaches and back as it pushes off: the
// forelimb's chief motion in a trot (Fischer and Lilje; the beagle's
// forelimb in 3D). The hips ride the pelvis, which turns a little under
// each stride, so seen from the side each hip goes forward with its foot
// and back again. So the legs reach through a trot without a bone ever
// stretching; the haunch pieces are drawn as long as they ever were, held
// on the upper bones, their tops in the body. Those bottom bones fold back
// as the paw lifts, each turning against the bone above it
// (rig/skeleton/hinge.ts), as far as a trot folds it back and its planted
// lean tips it forward, a hock never opening past straight, lifted or
// planted; a planted wrist bears little fold, so with the forearm low (a
// play bow, a stalk) the paw comes down flat along it. The far pair a
// little behind and above the near, as they would be seen.
// Trotting, diagonal pairs move together: near fore with far hind, far fore
// with near hind.
// A trot's diagonal pairs never land quite together: the hind foot of each
// pair lands this much of a stride before its fore foot, as a trotter's
// tends to.
const HIND_FIRST = 0.06;
const FORE_ART: LimbArt = { ...LEG_ART, upperShown: 2.3 + 2.4 / 2 };
const HIND_ART: LimbArt = { ...LEG_ART, upperShown: 2.3 + 2.6 / 2, middleShown: 2.1 + (LEG_WIDTH * 1.15) / 2 };
const HIND_LEG = { art: HIND_ART, width: LEG_WIDTH, thigh: 2.8, shin: 2.8, bend: 1, fore: false, haunch: 2.6, taper: true, walksOn: { kind: 'toes', length: 1.5, lean: 10, fold: 70 }, paw: { limits: { min: -90, max: 35 }, planted: { min: -90, max: 35 } } } as const;
const FORE_LEG = { art: FORE_ART, width: LEG_WIDTH, thigh: 3.4, shin: 3.6, bend: -1, fore: true, haunch: 2.4, walksOn: { kind: 'toes', length: 0.7, lean: 8, fold: 100 }, paw: { limits: { min: -55, max: 105 }, planted: { min: -50, max: 10 } } } as const;
// Where each leg leaves the body as drawn, which every pose sets its feet
// from, and where its foot stands at rest below that, in LEGS' order.
const OUT: readonly Point[] = [{ x: 12.2, y: 11 }, { x: 21.9, y: 10.2 }, { x: 11.2, y: 11.2 }, { x: 21, y: 10.4 }];
const STANDS = [11.2, 22.2, 10.2, 21.3];
// The femur and humerus at rest, from the hip and the shoulder (degrees
// from straight down, back positive): measured on the standing drawing's
// stifles and elbows.
const placed = (knee: Point, length: number, slope: number): Point => ({ x: knee.x - length * Math.sin((slope * Math.PI) / 180), y: knee.y - length * Math.cos((slope * Math.PI) / 180) });
const HIPS = [{ x: 10.6, y: 11 }, placed({ x: 21.38, y: 12.44 }, 3.4, -45), { x: 9.6, y: 11.2 }, placed({ x: 20.13, y: 12.53 }, 3.4, -45)];
const LEGS: HingedArtLeg[] = [
  { ...HIND_LEG, hip: HIPS[0], reach: STANDS[0] - HIPS[0].x, far: true },
  { ...FORE_LEG, hip: HIPS[1], reach: STANDS[1] - HIPS[1].x, far: true },
  { ...HIND_LEG, hip: HIPS[2], reach: STANDS[2] - HIPS[2].x, far: false },
  { ...FORE_LEG, hip: HIPS[3], reach: STANDS[3] - HIPS[3].x, far: false },
];
// Each shoulder blade, from its top at the withers down and forward to the
// shoulder joint, as long as the humerus is near enough, and how far it
// swings either way; how far each hip goes with its stride.
const SCAPULA = 3;
const BLADE = 55;
const blade = (shoulder: Point): Point => ({ x: shoulder.x - SCAPULA * Math.cos((BLADE * Math.PI) / 180), y: shoulder.y - SCAPULA * Math.sin((BLADE * Math.PI) / 180) });
const SWING = 19;
const PELVIS = 0.3;
const girdle = (leg: HingedArtLeg) => `${leg.fore ? 'scapula' : 'pelvis'} ${leg.far ? 'far' : 'near'}`;
// Each foot down for a little over half the stride, so the pairs overlap;
// the beats in LEGS' order. A trot's stride is as long as these legs carry
// without a bone stretching: about 2.4 strides a second at its pace, as a
// fox-sized canid trots (Heglund and Taylor's scaling).
const TROT: Gait = { stride: 6, lift: 3.2, stance: 0.55, beats: [HIND_FIRST, 0.5, 0.5 + HIND_FIRST, 0] };
// Where each leg ends: on the toes' back, as high as they stand.
const FEET = GROUND - (TOES.height - TOES.heel.y);

export type FoxLook = { now: number; still: boolean };
// What the drawing reads of a fox.
export type RigFox = Pick<Fox, 'mode' | 'walked' | 'seed' | 'until' | 'ear' | 'look'>;

// Where the feet go, from where the hips and shoulders are and where each
// leg leaves the body, the body posed so.
type Feet = (at: { hips: readonly Point[]; outs: readonly Point[] }) => Point[];
// Leaping, as the pounce drawing holds its paws.
const LEAPING = { fore: { contact: 0, fold: 0, digits: 15 }, hind: { contact: 0, fold: 0.45, digits: 0 } } as const;
// steps: where each foot is in its step, when stepping (stepsOf); held:
// how a paw off the ground is held (free, how far folded, its toes).
type Held = { contact: number; fold: number; digits: number };
type Stance = { body: Turn; head: number; tail: number; feet: Feet; steps?: Step[]; held?: (leg: HingedArtLeg) => Held };

// How far each foot is ahead (1) or behind (-1) through its step, where its
// shoulder blade swings it and its hip goes with it.
const along = (step: Step) => (step.down ? 1 - 2 * step.t : 2 * step.t - 1);

// Feet planted on the ledge, fore and hind each set this far from where
// its leg leaves the body.
const planted = (foreBy: number, hindBy: number): Feet => ({ outs }) => outs.map((o, i) => ({ x: o.x + (LEGS[i].fore ? foreBy : hindBy), y: FEET }));
const standing = (tail: number): Stance => ({ body: turnAbout(0, HIND), head: 0, tail, feet: ({ hips }) => restingFeet(LEGS, hips, FEET) });

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
      const { feet, steps } = stepping(LEGS, walked, FEET, TROT);
      return { body, head: 0.8 * Math.sin(2 * Math.PI * phase), tail: 5 * Math.sin(2 * Math.PI * phase), feet: ({ hips }) => feet(hips), steps };
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
      const reach = (o: Point, i: number): Point => (LEGS[i].fore ? { x: o.x + 2 + 1.5 * t, y: o.y + 3.5 + 1.5 * t } : { x: o.x - 3 - 3 * t, y: o.y + 4.5 - 3 * t });
      // Its paws free in the air: the forepaws reaching on from straight
      // wrists, toes tipped down for the snow, the hind paws trailing out
      // behind from opened hocks, toes in line.
      return { body: turnAbout(-8 + 20 * t, HIND), head: 8 * t, tail: 10 - 15 * t, feet: ({ outs }) => outs.map(reach), held: (leg) => (leg.fore ? LEAPING.fore : LEAPING.hind) };
    }
    case 'dig': {
      // Nose in the snow, forepaws scrabbling turn about.
      const scrabble = (i: number) => Math.sin(look.now / 55 + (i === 1 ? Math.PI : 0));
      const paw = (o: Point, i: number): Point => (LEGS[i].fore ? { x: o.x + 2.5 + 1.2 * scrabble(i), y: FEET - Math.max(0, 1.4 * scrabble(i)) } : { x: o.x - 0.4, y: FEET });
      return { body: turnAbout(16, HIND), head: 38, tail: 2 + sway, feet: ({ outs }) => outs.map(paw) };
    }
    default:
      return standing(sway);
  }
}

// Its skeleton: the body turning about its hips, the tail at its root, the
// head on its neck with the eye on it, and each leg from its hip (or
// shoulder), the legs starting inside the body, its hips high in the rump
// and its shoulders in the chest. Drawn with the far legs behind it, then
// the tail, the torso and the head, the near legs' fur over its edge.
const FOX = tetrapod(MAMMAL, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: HIND, name: 'pelvis (the body turns about its hips)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint (neck)' },
    { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    ...LEGS.map((leg, i): JointSpec => (leg.fore
      ? { id: girdle(leg), parent: 'body', role: { part: 'other', index: i }, at: blade(leg.hip), name: `${leg.far ? 'far' : 'near'} shoulder blade (its top, at the withers)` }
      : { id: girdle(leg), parent: 'body', role: { part: 'other', index: i }, at: leg.hip, name: `${leg.far ? 'far' : 'near'} side of the pelvis` })),
  ],
  bones: [
    { from: 'skull', to: 'body', name: 'neck line (head joint to the hips)' }, { from: 'body', to: 'tail', name: 'pelvis line (hips to tail root)' },
    { from: 'eye', to: 'skull', name: 'skull' },
    ...LEGS.filter((leg) => leg.fore).map((leg) => ({ from: girdle(leg), to: `L${leg.far ? 1 : 0}J0`, name: 'scapula (shoulder blade)' })),
  ],
  legs: LEGS,
  ground: () => FEET,
  hung: girdle,
  order: [picture('tail', 'tail', tailArt, TAIL), picture('torso', 'body', torsoArt, TORSO), picture('head', 'skull', headArt, HEAD), 'eyelid'],
  shapes: [{ id: 'eyelid', on: 'skull' }],
  guides: (at) => [
    { name: 'tail root', at: 'tail' }, { name: 'neck', at: 'skull' }, { name: 'eye', at: 'eye' },
    ...LEGS.map((leg) => ({ name: leg.fore ? 'shoulder' : 'hip', at: at(leg, 0) })),
    ...LEGS.flatMap((leg) => (leg.fore ? ['elbow', 'wrist (carpus)', 'toes'] : ['stifle (knee)', 'hock (ankle)', 'toes']).map((name, k) => ({ name, at: at(leg, k + 1) }))),
  ],
});
// Curled up asleep, or looking up from there, it is one picture.
const CURLED = wholePicture(FRAME, PICTURES.curled);
const LOOKING_UP = wholePicture(FRAME, PICTURES.alert);

export function foxRig(fox: RigFox, look: FoxLook): RigPose {
  const pose = poseOf(fox, look.now);
  // Curled up asleep, or looking up from there, breathing slowly.
  if (pose === 'curled' || pose === 'alert') return (pose === 'curled' ? CURLED : LOOKING_UP)(look.still ? 1 : 1 + 0.035 * breath(fox.seed, look.now, 3400));
  const { body, head: angle, tail, feet, steps = [], held } = stance(fox, look);
  const base = { skull: { angle }, tail: { angle: tail } };
  const at = feet({ hips: FOX.hips({ root: body, joints: base }), outs: OUT.map((o) => turned(body, o)) });
  // Each shoulder blade swung, each hip carried, with its foot's step; the
  // feet set before, so a planted one never slides.
  const girdles = Object.fromEntries(LEGS.map((leg, i) => {
    const f = steps[i] ? along(steps[i]) : 0;
    return [girdle(leg), leg.fore ? { angle: -SWING * f } : { shift: { x: PELVIS * f, y: 0 } }];
  }));
  const joints = { ...base, ...girdles };
  // A paw off the ground is kept clear of the snow its toes would dip into.
  const limbs = FOX.limbs(at.map((p, i) => ({ kind: 'plant', at: p, step: steps[i], ground: GROUND, ...held?.(LEGS[i]) })));
  const shapes = { eyelid: lidLayers(!look.still && blinking(fox.seed, look.now), EYE, 0.85, FACE) };
  return compose(FOX.body, () => ({ root: body, joints, limbs, show: {}, z: {}, shapes }), look.now);
}
