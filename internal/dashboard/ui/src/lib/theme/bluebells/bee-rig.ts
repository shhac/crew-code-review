import { clamp } from '../math';
import type { Point } from '../pointer';
import { antennaLayer, flicking, turnedBy, type Antenna } from '../rig/antennae';
import { airGoals, insectGait, legLayers, podAlong, standingGoals, walkingGoals, type InsectLeg, type LegLook, type Limb } from '../rig/hexapod';
import { hangAt, hoverBob, pitchAt, type Pitching } from '../rig/insect-flight';
import { breath } from '../rig/life';
import { turnAbout, turned, type Layer, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { insect, localized, sprawledLegs, type Segments } from '../rig/skeleton/insect';
import type { Goal, PoseSpec } from '../rig/skeleton/types';
import { wingBlur, type BlurWing, type WingBeat } from '../rig/wing-blur';
import abdomenArt from './bee-abdomen.webp';
import headArt from './bee-head.webp';
import thoraxArt from './bee-thorax.webp';
import wingsArt from './bee-wings.webp';

// A buff-tailed bumblebee queen put together from her parts: abdomen, thorax
// and head from one drawing (design-docs/bluebells/bee-standing.png), the
// near pair of wings as one piece (the hooks between fore and hind wing
// hold them as one in flight), and six legs and two antennae drawn in code
// on the insect rig (rig/hexapod.ts, rig/antennae.ts), all hung on her
// skeleton (rig/skeleton). Facing right. The
// drawing units are the reference's as export.py prints them, and a unit is
// a page pixel, so she is 18px from her jaws to the tip of her tail. Her
// anchor is the middle of her thorax, the point a model moves: standing,
// her feet are on the ground GROUND below it.

export const SCALE = 1;

export const ANCHOR = { x: 12.72, y: 6.19 };
export const GROUND = 12.2;
const FRAME = { width: 24, height: 16, anchor: ANCHOR, scale: SCALE };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 21.67, height: 13.67 };
// The golden collar at the front of her thorax, where the lab lines each key
// pose up with the rig (export.py's printed collar).
const COLLAR = { x: 14.73, y: 5.96 };
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

// Six legs, all from the thorax's underside, the sockets measured off the
// reference's. A bee's legs lengthen front to back, about 0.38, 0.43 and
// 0.55 of her body, the hind tibia long and broad, bearing the pollen
// basket; a honeybee's hind leg runs femur, tibia, whole tarsus about
// 1 : 1.1 : 1.3 (AL-Kahtani and Taha 2021). Each pair's legs are alike, the
// far side's seen past her body; each sprawls out to the side as she
// stands (insect.ts's sprawled), its tarsus lying out along the bell.
const SEGMENTS: Segments = {
  fore: { coxa: 0.5, femur: 1.9, tibia: 1.7, tarsus: 2.7, lean: 70, curl: 25, out: 0.8 },
  mid: { coxa: 0.5, femur: 2.1, tibia: 2.2, tarsus: 2.9, lean: 70, curl: 20, out: 0.8 },
  hind: { coxa: 0.6, femur: 2.5, tibia: 3, tarsus: 3.8, lean: 70, curl: 20, out: 0.85 },
};
const LEGS: readonly InsectLeg[] = sprawledLegs([
  { pair: 'fore', far: false, hip: { x: 14.75, y: 8.59 } },
  { pair: 'fore', far: true, hip: { x: 14.45, y: 8.45 } },
  { pair: 'mid', far: false, hip: { x: 13.35, y: 8.88 } },
  { pair: 'mid', far: true, hip: { x: 12.6, y: 8.75 } },
  { pair: 'hind', far: false, hip: { x: 10.54, y: 8.74 } },
  { pair: 'hind', far: true, hip: { x: 9.6, y: 8.4 } },
], SEGMENTS, GROUND);
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
// The stroke plane is nearly level with the body, so from the side the
// wings sweep along her back rather than up over it: the fan and its
// ghosts are drawn flattened about the hinge, as a level circle is seen
// from a little above.
const STROKE_FLAT = 0.55;
// How far a bonk throws her nose up (degrees), how fast she swings and how
// soon it dies away (s).
const KNOCK = 25;
const KNOCK_HZ = 3;
const KNOCK_SETTLE = 0.3;
// Knocked, her wings check their forward sweep: the stroke's front end is
// drawn this much further back, so the head meets the wall, not the blur.
const KNOCKED_STROKE = -40;
// Nose up hovering, nearly level at her cruising speed (page px/s).
const PITCHING: Pitching = { hover: -38, cruise: -8, speed: 70 };

// Walking on a flower: a slow tetrapod crawl (four feet down, diagonal
// pairs stepping in turn), and a quicker tripod scurry.
const CRAWL = insectGait(LEGS, 'tetrapod', 3.6, 0.55);
const SCURRY = insectGait(LEGS, 'tripod', 3.8, 0.7);

// What she is doing, as far as the drawing cares.
export type BeePose = 'perch' | 'crawl' | 'scurry' | 'hover' | 'fly' | 'land' | 'bonk';
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
  // Bonked, how long since her head met the wall (ms): she recoils nose up
  // and settles.
  knocked?: number;
};
type BeeLook = { now: number; still: boolean };

type Hold = { pitch: number; bob: number; abdomen: number; head: number; legs: (hips: readonly Point[]) => Goal[] };

function hold(b: RigBee, now: number): Hold {
  const standing = (hips: readonly Point[]) => standingGoals(LEGS, hips, GROUND);
  switch (b.pose) {
    case 'crawl':
    case 'scurry': {
      const gait = b.pose === 'crawl' ? CRAWL : SCURRY;
      // Head down to the flower, the body near level.
      return { pitch: 3, bob: 0, abdomen: 2, head: 4, legs: (hips) => walkingGoals(LEGS, hips, b.walked, GROUND, gait) };
    }
    case 'hover': {
      // Nose up, legs hanging, the hind pair trailing, the abdomen hanging a
      // little below the line of the body, bobbing slowly.
      const pitch = pitchAt(PITCHING, 0);
      return { pitch, bob: hoverBob(b.seed, now, 1.5, 1.8), abdomen: -6, head: 6, legs: (hips) => airGoals(LEGS, hips, { hang: 1, reach: 0, pitch }) };
    }
    case 'fly': {
      // Flatter with speed, legs drawn up, the abdomen trailing in line.
      const pitch = pitchAt(PITCHING, b.speed);
      const hang = hangAt(b.speed, 60);
      return { pitch, bob: hoverBob(b.seed, now, 0.8, 1.3), abdomen: -6 * hang + 2, head: 8 * hang, legs: (hips) => airGoals(LEGS, hips, { hang, reach: 0, pitch }) };
    }
    case 'bonk': {
      // Knocked back off a wall: level as she meets it, then nose up 25
      // degrees a twelfth of a second later, settling in a damped swing at
      // 3Hz; legs splayed, the abdomen swinging down.
      const t = (b.knocked ?? 0) / 1000;
      const pitch = -KNOCK * (Math.exp(-t / KNOCK_SETTLE) * Math.sin(2 * Math.PI * KNOCK_HZ * t)) / Math.exp(-1 / (4 * KNOCK_HZ) / KNOCK_SETTLE);
      return { pitch, bob: 0, abdomen: -8, head: 4, legs: (hips) => airGoals(LEGS, hips, { hang: 1, reach: 0.5, pitch }) };
    }
    case 'land': {
      // The last moment before touching down: legs stretched down and
      // forward to meet the bell.
      const pitch = -18;
      return { pitch, bob: 0, abdomen: -4, head: 4, legs: (hips) => airGoals(LEGS, hips, { hang: 1, reach: 0.85, pitch }) };
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
function wingsOf(far: boolean, beating: number, knocked: boolean): Layer[] {
  const picture = far ? farWings : nearWings;
  const folded: Layer = { kind: 'group', turn: turnAbout(far ? FAR_TILT : 0, HINGE), opacity: beating > 0 ? 1 - beating : undefined, layers: [picture] };
  const beat = far ? FAR_BEAT : BEAT;
  const blur = wingBlur(blurWing(picture), knocked ? { ...beat, front: beat.front + KNOCKED_STROKE } : beat, beating, far ? 'far wing blur' : 'wing blur');
  const flat: Layer[] = blur.length ? [{ kind: 'group', turn: turnAbout(0, HINGE), foreshorten: STROKE_FLAT, layers: blur }] : [];
  return beating >= 1 ? flat : [folded, ...flat];
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

const picture = (id: string, on: string, src: string, box: typeof HEAD) => ({ id, art: { drawn: { src, box } }, at: { kind: 'joint', to: on }, draws: [{ id, z: 0 }] }) as const;

// Her skeleton: the body turning about her thorax's middle, where she
// moves, the abdomen on its waist and the head on its neck, the antennae's
// sockets on the face, the wings' hinge on the thorax, and six legs from
// the thorax's underside. Drawn with the far wings, legs and antenna behind
// her, the near legs over her edge, the pollen on them and the near wings
// over all.
const BEE = insect({
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: { part: 'spine', index: 1 }, at: ANCHOR, name: 'thorax (where she moves)' },
    { id: 'head', parent: 'body', role: { part: 'spine', index: 0 }, at: NECK, name: 'head joint (neck)' },
    { id: 'abdomen', parent: 'body', role: { part: 'spine', index: 2 }, at: WAIST, name: 'waist (petiole)' },
    { id: 'socket', parent: 'head', role: { part: 'head', index: 0 }, at: NEAR_ANTENNA.base, name: 'antenna socket' },
    { id: 'hinge', parent: 'body', role: { part: 'wing', side: 'near', index: 0 }, at: HINGE, name: 'wing hinge (tegula)' },
  ],
  bones: [
    { from: 'head', to: 'body', name: 'thorax line (head joint to where she moves)' }, { from: 'body', to: 'abdomen', name: 'thorax line (to the waist)' },
    { from: 'socket', to: 'head', name: 'head' },
  ],
  legs: LEGS,
  ground: GROUND,
  order: [
    { shape: 'far wings', on: 'body' }, { shape: 'far legs', on: 'body' }, { shape: 'far antenna', on: 'head' },
    picture('abdomen', 'abdomen', abdomenArt, ABDOMEN), picture('head', 'head', headArt, HEAD), { shape: 'near antenna', on: 'head' },
    picture('thorax', 'body', thoraxArt, THORAX), { shape: 'near legs', on: 'body' }, { shape: 'pollen', on: 'body' }, { shape: 'wings', on: 'body' },
  ],
  stands: 'thorax (moves here)',
  guides: (code) => [
    { name: 'waist (petiole)', at: 'abdomen' }, { name: 'neck', at: 'head' }, { name: 'wing hinge (tegula)', at: 'hinge' }, { name: 'antenna socket', at: 'socket' },
    ...LEGS.flatMap((leg) => ['coxa', 'trochanter', 'knee', 'tibiotarsal joint', 'claws'].map((name, k) => ({ name, at: code(leg, k) }))),
  ],
});

// Held still under reduced motion: perched, wings folded, no flick.
const STILL: Omit<RigBee, 'seed'> = { pose: 'perch', walked: 0, speed: 0, lean: 0, wings: 0 };

// The pose her hold makes: each foot set from where its coxa is now.
function poseOf(b: RigBee, now: number, still: boolean): PoseSpec {
  const h = hold(b, now);
  const root: Turn = turnAbout(h.pitch, ANCHOR, 0, h.bob);
  // Perched, her abdomen pumps as she breathes; her antennae flick now and
  // then, and lean toward a cursor close by.
  const pump = b.pose === 'perch' && !still ? 1 + 0.03 * breath(b.seed, now, 1000 / 1.2) : 1;
  const flick = still ? 0 : -14 * flicking(b.seed, now);
  const lean = clamp(b.lean, -15, 15) + flick;
  const joints = { head: { angle: h.head + clamp(b.lean / 3, -5, 5) }, abdomen: { angle: h.abdomen, squash: { by: pump } } };
  const hips = BEE.hips({ root, joints });
  const goals = h.legs(hips);
  const legs = (limb: (id: string) => Limb) => legLayers(LEGS, BEE.legs(limb), LOOK, hips);
  const knocked = b.pose === 'bonk';
  return {
    root, joints: { ...joints, ...BEE.coxae({ root, joints }, goals) }, limbs: BEE.limbs(goals), show: {}, z: {},
    shapes: {
      'far wings': wingsOf(true, b.wings, knocked),
      'far legs': ({ limb, local }) => localized(legs(limb).far, local),
      'far antenna': antenna('far antenna', turnedBy(FAR_ANTENNA, lean)),
      'near antenna': antenna('near antenna', turnedBy(NEAR_ANTENNA, lean)),
      'near legs': ({ limb, local }) => localized(legs(limb).near, local),
      pollen: ({ limb, local }) => localized([pollen(BEE.legs(limb))], local),
      wings: wingsOf(false, b.wings, knocked),
    },
  };
}

export function beeRig(bee: RigBee, look: BeeLook): RigPose {
  const b = look.still ? { ...STILL, seed: bee.seed } : bee;
  const now = look.still ? 0 : look.now;
  return compose(BEE.body, (t) => poseOf(b, t, look.still), now);
}

// How far each pose's drawing reaches from her anchor (page px), at every
// moment of its motion: wing ghosts and fan, bob, hanging legs, antennae
// leaning and flicking (bee-rig.test.ts samples each whole cycle). Behind
// is toward her tail; mirrored when she faces left, so unlike the kit's
// reaches it faces a way.
export type FacingReach = { behind: number; ahead: number; up: number; down: number };
export const REACH: Record<BeePose, FacingReach> = {
  perch: { behind: 12, ahead: 10.5, up: 7, down: 7 },
  crawl: { behind: 12.25, ahead: 10.25, up: 7.5, down: 7 },
  scurry: { behind: 12.25, ahead: 10.25, up: 7.5, down: 7 },
  hover: { behind: 10.75, ahead: 9.75, up: 11.75, down: 13.25 },
  fly: { behind: 12, ahead: 11.5, up: 11, down: 12.5 },
  land: { behind: 12, ahead: 10.75, up: 8.5, down: 9.25 },
  bonk: { behind: 12.25, ahead: 10.75, up: 9.75, down: 10.5 },
};

// Where her collar is in a pose, for the lab to line a key pose up by.
export const collarOf = (bee: RigBee): Point => turned(turnAbout(hold(bee, 0).pitch, ANCHOR), COLLAR);

// Her eye, which a cursor is looked at from.
export const EYE = { x: 17.94, y: 6.85 };
