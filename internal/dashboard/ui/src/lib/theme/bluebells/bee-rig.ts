import { clamp } from '../math';
import type { Point } from '../pointer';
import { antennaLayer, flicking, turnedBy, type Antenna } from '../rig/antennae';
import { airLegs, insectGait, legLayers, podAlong, standingLegs, walkingLegs, type InsectLeg, type LegLook, type Limb } from '../rig/hexapod';
import { hangAt, hoverBob, pitchAt, type Pitching } from '../rig/insect-flight';
import { breath } from '../rig/life';
import { turnAbout, turned, type Layer, type RigPose, type Turn } from '../rig/rig';
import { wingBlur, type BlurWing, type WingBeat } from '../rig/wing-blur';
import abdomenArt from './bee-abdomen.webp';
import headArt from './bee-head.webp';
import thoraxArt from './bee-thorax.webp';
import wingsArt from './bee-wings.webp';

// A buff-tailed bumblebee queen put together from her parts: abdomen, thorax
// and head from one drawing (design-docs/bluebells/bee-standing.png), the
// near pair of wings as one piece (the hooks between fore and hind wing
// hold them as one in flight), and six legs and two antennae drawn in code
// on the insect rig (rig/hexapod.ts, rig/antennae.ts). Facing right. The
// drawing units are the reference's as export.py prints them, and a unit is
// a page pixel, so she is 18px from her jaws to the tip of her tail. Her
// anchor is the middle of her thorax, the point a model moves: standing,
// her feet are on the ground GROUND below it.

export const SCALE = 1;

export const ANCHOR = { x: 12.72, y: 6.19 };
export const GROUND = 14.2;
const FRAME = { width: 24, height: 16, anchor: ANCHOR, scale: SCALE };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 21.67, height: 13.67 };
// The golden collar at the front of her thorax, where the lab lines each key
// pose up with the rig (export.py's printed collar).
export const COLLAR = { x: 14.73, y: 5.96 };
const ABDOMEN = { x: 1, y: 4.45, width: 8.42, height: 6.67 };
const THORAX = { x: 8.72, y: 2.9, width: 8, height: 6.58 };
const HEAD = { x: 14.78, y: 4.33, width: 4.83, height: 5.83 };
const WINGS = { x: 1.86, y: 1, width: 11.17, height: 4.17 };
// The waist, where the abdomen pivots under the thorax's back edge; the
// neck, where the head turns under its front.
const WAIST = { x: 9.4, y: 7 };
const NECK = { x: 16.2, y: 6.8 };
// The wings' hinge on the thorax (the tegula), and their long axis from the
// hinge to the forewing's tip as drawn.
const HINGE = { x: 12.95, y: 4.1 };
const WING_AXIS = -164;
const WING_LENGTH = 11.1;
// The far pair, seen past the body, rides a little higher and steeper.
const FAR_TILT = 8;

const INK = '#101010';
const POLLEN = '#f2a516';

// Six legs, all from the thorax's underside, measured off the reference's
// legs: fore legs reaching forward with their knees forward, hind legs
// reaching back with their knees back, the far side a little behind and
// above the near so each shows past the other.
const LEGS: readonly InsectLeg[] = [
  { pair: 'fore', far: false, hip: { x: 14.75, y: 8.59 }, femur: 2.5, tibia: 2.3, tarsus: 2.2, reach: 4.2, bend: 1, lean: 43, curl: 25 },
  { pair: 'fore', far: true, hip: { x: 14.45, y: 8.45 }, femur: 2.4, tibia: 2.2, tarsus: 2.1, reach: 2.6, bend: 1, lean: 40, curl: 25 },
  { pair: 'mid', far: false, hip: { x: 13.35, y: 8.88 }, femur: 2.05, tibia: 2.15, tarsus: 1.95, reach: 2.6, bend: 1, lean: 40, curl: 20 },
  { pair: 'mid', far: true, hip: { x: 12.6, y: 8.75 }, femur: 2.05, tibia: 2.1, tarsus: 1.9, reach: 0.5, bend: 1, lean: 20, curl: 20 },
  { pair: 'hind', far: false, hip: { x: 10.54, y: 8.74 }, femur: 1.85, tibia: 2.9, tarsus: 2, reach: -3.8, bend: -1, lean: -41, curl: 20 },
  { pair: 'hind', far: true, hip: { x: 9.6, y: 8.4 }, femur: 2.6, tibia: 2.5, tarsus: 2.3, reach: -4.9, bend: -1, lean: -45, curl: 20 },
];
const NEAR_HIND = 4;
const LOOK: LegLook = {
  widths: [0.62, 0.55, 0.36], outline: 0.14, ink: INK,
  near: ['#46464a', '#46464a', '#5a4a32'], far: ['#303033', '#303033', '#43372a'], claw: 0.55,
};

// The antennae from the face, elbowed: the near one's flagellum hanging
// down ahead of the jaws, the far one's held higher, as in the reference.
const NEAR_ANTENNA: Antenna = { base: { x: 18.94, y: 6.25 }, scape: 1.15, flagellum: 3.8, angle: -14, elbow: 68, curve: 30 };
const FAR_ANTENNA: Antenna = { base: { x: 18.9, y: 6.2 }, scape: 1.45, flagellum: 3.5, angle: -35, elbow: 78, curve: 30 };
const ANTENNA_WIDTH = 0.3;
const ANTENNA = '#4a4a50';

// Her wingbeat as a blur (rig/wing-blur.ts): the 120 degree stroke of a
// buff-tailed bumblebee, nearly level with the body, so tilted with it.
const BEAT: WingBeat = { front: -5, back: -125, ghost: 0.35, fan: 0.12, colour: '#f4e6c6' };
const FAR_BEAT: WingBeat = { ...BEAT, front: BEAT.front + 8, back: BEAT.back + 8, ghost: 0.3, fan: 0.08 };
// Nose up hovering, nearly level at her cruising speed (page px/s).
export const PITCHING: Pitching = { hover: -38, cruise: -8, speed: 70 };

// Walking on a flower: a slow tetrapod crawl (four feet down, diagonal
// pairs stepping in turn), and a quicker tripod scurry.
const CRAWL = insectGait(LEGS, 'tetrapod', 1.3, 0.55);
const SCURRY = insectGait(LEGS, 'tripod', 1.8, 0.7);

// What she is doing, as far as the drawing cares.
export type BeePose = 'perch' | 'crawl' | 'scurry' | 'hover' | 'fly' | 'land';
export type RigBee = {
  pose: BeePose;
  seed: number;
  // How far she has walked (crawling or scurrying), drawing units.
  walked: number;
  // Flying, her speed (page px/s), which sets her pitch and her legs.
  speed: number;
  // How far her antennae lean toward a cursor, degrees (up negative).
  lean: number;
  // How far her wings are going, 0 folded to 1 beating: lifting off, the
  // blur fades in as the folded wings fade out.
  wings: number;
};
export type BeeLook = { now: number; still: boolean };

type Hold = { pitch: number; bob: number; abdomen: number; head: number; legs: (hips: readonly Point[]) => Limb[] };

function hold(b: RigBee, now: number): Hold {
  const standing = (hips: readonly Point[]) => standingLegs(LEGS, hips, GROUND);
  switch (b.pose) {
    case 'crawl':
    case 'scurry': {
      const gait = b.pose === 'crawl' ? CRAWL : SCURRY;
      // Head down to the flower, the body near level.
      return { pitch: 3, bob: 0, abdomen: 2, head: 4, legs: (hips) => walkingLegs(LEGS, hips, b.walked, GROUND, gait) };
    }
    case 'hover': {
      // Nose up, legs hanging, the hind pair trailing, the abdomen hanging a
      // little below the line of the body, bobbing slowly.
      const pitch = pitchAt(PITCHING, 0);
      return { pitch, bob: hoverBob(b.seed, now, 1.5, 1.8), abdomen: -6, head: 6, legs: (hips) => airLegs(LEGS, hips, { hang: 1, reach: 0, pitch }) };
    }
    case 'fly': {
      // Flatter with speed, legs drawn up, the abdomen trailing in line.
      const pitch = pitchAt(PITCHING, b.speed);
      const hang = hangAt(b.speed, 60);
      return { pitch, bob: hoverBob(b.seed, now, 0.8, 1.3), abdomen: -6 * hang + 2, head: 8 * hang, legs: (hips) => airLegs(LEGS, hips, { hang, reach: 0, pitch }) };
    }
    case 'land': {
      // The last moment before touching down: legs stretched down and
      // forward to meet the bell.
      const pitch = -18;
      return { pitch, bob: 0, abdomen: -4, head: 4, legs: (hips) => airLegs(LEGS, hips, { hang: 1, reach: 0.85, pitch }) };
    }
    default:
      return { pitch: 0, bob: 0, abdomen: 0, head: 0, legs: standing };
  }
}

const image = (name: string, src: string, at: typeof HEAD, far = false): Layer => ({ kind: 'image', name, src, ...at, far });
const nearWings = image('near wings', wingsArt, WINGS);
const farWings = image('far wings', wingsArt, WINGS, true);
const blurWing = (picture: Layer): BlurWing => ({ picture, hinge: HINGE, axis: WING_AXIS, length: WING_LENGTH });

// One side's wings: folded along the back, fading out as the blur fades in.
function wingsOf(far: boolean, beating: number): Layer[] {
  const picture = far ? farWings : nearWings;
  const folded: Layer = { kind: 'group', turn: turnAbout(far ? FAR_TILT : 0, HINGE), opacity: beating > 0 ? 1 - beating : undefined, layers: [picture] };
  const blur = wingBlur(blurWing(picture), far ? FAR_BEAT : BEAT, beating, far ? 'far wing blur' : 'wing blur');
  return beating >= 1 ? blur : [folded, ...blur];
}

// The pollen load in the basket on her near hind tibia, as a filled
// stroke; the far one is hidden behind her, as in the reference.
function pollen(limbs: readonly Limb[]): Layer {
  const leg = limbs[NEAR_HIND];
  return { kind: 'stroke', name: 'pollen', points: podAlong(leg.knee, leg.ankle, 0.42, 1.75, 1.4), width: LOOK.outline * 1.4, colour: INK, fill: POLLEN };
}

// An antenna drawn as the legs are: its outline, then its colour.
const antenna = (name: string, a: Antenna): Layer[] =>
  [antennaLayer(name, a, ANTENNA_WIDTH + 2 * LOOK.outline, INK), antennaLayer(name, a, ANTENNA_WIDTH, ANTENNA)];

// Held still under reduced motion: perched, wings folded, no flick.
const STILL: Omit<RigBee, 'seed'> = { pose: 'perch', walked: 0, speed: 0, lean: 0, wings: 0 };

export function beeRig(bee: RigBee, look: BeeLook): RigPose {
  const b = look.still ? { ...STILL, seed: bee.seed } : bee;
  const now = look.still ? 0 : look.now;
  const h = hold(b, now);
  const body: Turn = turnAbout(h.pitch, ANCHOR, 0, h.bob);
  const at = (p: Point) => turned(body, p);
  const limbs = h.legs(LEGS.map((l) => at(l.hip)));
  const legs = legLayers(LEGS, limbs, LOOK);
  // Perched, her abdomen pumps as she breathes; her antennae flick now and
  // then, and lean toward a cursor close by.
  const pump = b.pose === 'perch' && !look.still ? 1 + 0.03 * breath(b.seed, now, 1000 / 1.2) : 1;
  const flick = look.still ? 0 : -14 * flicking(b.seed, now);
  const lean = clamp(b.lean, -15, 15) + flick;
  const nod = turnAbout(h.head + clamp(b.lean / 3, -5, 5), NECK);
  const abdomen: Layer = { kind: 'group', turn: turnAbout(h.abdomen, WAIST), scaleY: pump, layers: [image('abdomen', abdomenArt, ABDOMEN)] };
  const beating = b.wings;
  return {
    ...FRAME,
    layers: [
      { kind: 'group', turn: body, layers: wingsOf(true, beating) },
      ...legs.far,
      { kind: 'group', turn: body, layers: [{ kind: 'group', turn: nod, layers: antenna('far antenna', turnedBy(FAR_ANTENNA, lean)) }] },
      {
        kind: 'group', turn: body, layers: [
          abdomen,
          { kind: 'group', turn: nod, layers: [image('head', headArt, HEAD), ...antenna('near antenna', turnedBy(NEAR_ANTENNA, lean))] },
          image('thorax', thoraxArt, THORAX),
        ],
      },
      ...legs.near,
      pollen(limbs),
      { kind: 'group', turn: body, layers: wingsOf(false, beating) },
    ],
    guides: [
      { name: 'thorax (moves here)', at: at(ANCHOR) }, { name: 'waist (petiole)', at: at(WAIST) }, { name: 'neck', at: at(NECK) },
      { name: 'wing hinge (tegula)', at: at(HINGE) }, { name: 'antenna socket', at: at(turned(nod, NEAR_ANTENNA.base)) },
      ...limbs.flatMap((l) => [{ name: 'coxa', at: l.hip }, { name: 'knee', at: l.knee }, { name: 'tibiotarsal joint', at: l.ankle }, { name: 'claws', at: l.foot }]),
    ],
  };
}

// How far each pose's drawing reaches from her anchor (page px), at every
// moment of its motion: wing ghosts and fan, bob, hanging legs, antennae
// leaning and flicking (bee-rig.test.ts samples each whole cycle). Behind
// is toward her tail; mirrored when she faces left.
export type Reach = { behind: number; ahead: number; up: number; down: number };
export const REACH: Record<BeePose, Reach> = {
  perch: { behind: 12, ahead: 10.5, up: 7, down: 9 },
  crawl: { behind: 12.5, ahead: 10.5, up: 7.5, down: 9 },
  scurry: { behind: 12.5, ahead: 10.5, up: 7.5, down: 9 },
  hover: { behind: 12.5, ahead: 10, up: 14, down: 13.5 },
  fly: { behind: 12.5, ahead: 12, up: 13.5, down: 12.5 },
  land: { behind: 12, ahead: 11, up: 12.5, down: 11 },
};

// Where her collar is in a pose, for the lab to line a key pose up by.
export const collarOf = (bee: RigBee): Point => turned(turnAbout(hold(bee, 0).pitch, ANCHOR), COLLAR);

// Her eye, which a cursor is looked at from.
export const EYE = { x: 17.94, y: 6.85 };
