import { clamp } from '../math';
import type { Point } from '../pointer';
import { antennaLayer, flicking, turnedBy, type Antenna } from '../rig/antennae';
import { airGoals, insectGait, legLayers, standingGoals, strideFor, walkingGoals, type InsectLeg, type LegLook, type Limb } from '../rig/hexapod';
import { hangAt, hoverBob, pitchAt, type Pitching } from '../rig/insect-flight';
import { breath } from '../rig/life';
import { turnAbout, turned, type Layer, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { insect, localized, sprawledLegs, type Segments } from '../rig/skeleton/insect';
import type { Goal, PoseSpec } from '../rig/skeleton/types';
import { shimmer, wingBlur, type BlurWing, type WingBeat } from '../rig/wing-blur';
import type { WaspPose } from './footprints';
import foldedArt from './wasp-wing-folded.webp';
import gasterArt from './wasp-gaster.webp';
import headArt from './wasp-head.webp';
import thoraxArt from './wasp-thorax.webp';
import wingArt from './wasp-wing.webp';

// A worker common wasp put together from her parts: gaster, thorax, head and
// folded wings cut from one drawing (design-docs/fete/wasp-standing.png),
// the open wing (fore and hind wing hooked together as one) cut from the
// hovering key pose, and six legs and two elbowed antennae drawn in code on
// the insect rig. Facing right, in the reference's drawing units as
// export.py prints them; SCALE makes her 16px from her jaws to the tip of
// her gaster. Her anchor, the point a model moves, is the middle of her
// body's length at the waist's height, so she reaches about as far either
// way and turning about does not move her; standing, her claws are on the
// ground GROUND below it.

export const SCALE = 16 / 22.7;

export const ANCHOR = { x: 15, y: 6 };
export const GROUND = 14.9;
const FRAME = { width: 31, height: 18, anchor: ANCHOR, scale: SCALE };
// The standing drawing, for the lab to lay over the rig, and her eye's
// middle, where the lab lines each key pose up with her.
export const REFERENCE = { x: 1, y: 1, width: 29.58, height: 14.08 };
export const EYE = { x: 21.88, y: 5.23 };
const GASTER = { x: 1.72, y: 3.97, width: 12.08, height: 6.08 };
const THORAX = { x: 13.17, y: 1.2, width: 7.42, height: 6.08 };
const HEAD = { x: 19.65, y: 2.73, width: 4.83, height: 6.83 };
const FOLDED = { x: 4.26, y: 1.92, width: 13.08, height: 2.58 };
// The waist (the petiole), where the gaster pivots on the thorax; the neck,
// where the head turns; the wings' hinge at the tegula.
const WAIST = { x: 12.7, y: 6.9 };
const NECK = { x: 20.3, y: 5.9 };
const HINGE = { x: 15.8, y: 3.4 };
// The open wing as cut: its box (drawing units on the hover pose's scale),
// its hinge in that box, and its long axis, hinge to forewing tip. It is
// drawn so the forewing is WING long, about three fifths of her body, as a
// worker's is (the hover pose drew it longer).
const OPEN = { width: 21.92, height: 13.25, hinge: { x: 20.71, y: 12.1 }, axis: -150, length: 23 };
const WING = 12;
const SHRINK = WING / OPEN.length;
const OPEN_AT = { x: HINGE.x - OPEN.hinge.x * SHRINK, y: HINGE.y - OPEN.hinge.y * SHRINK, width: OPEN.width * SHRINK, height: OPEN.height * SHRINK };
// The far wing, seen past the body, rides a little steeper.
const FAR_TILT = 8;

const INK = '#111111';

// Six legs from the thorax's underside, the sockets measured off the
// reference's. A wasp's legs lengthen front to back, about 0.45, 0.55 and
// 0.7 of her body; a vespid's front tibia is shorter than its femur, the
// middle about as long, the hind longer (Silveira et al. 2024), and a whole
// tarsus about 1.3 femurs (a honeybee's hind leg: AL-Kahtani and Taha
// 2021). Each pair's legs are alike, the far side's seen past her body;
// each sprawls out to the side as she stands (insect.ts's sprawled), its
// tarsus lying out along the surface.
const SEGMENTS: Segments = {
  fore: { coxa: 0.8, femur: 3, tibia: 2.6, tarsus: 3.8, lean: 70, curl: 25 },
  mid: { coxa: 0.9, femur: 3.4, tibia: 3.4, tarsus: 4.4, lean: 70, curl: 20 },
  hind: { coxa: 1.1, femur: 4, tibia: 4.8, tarsus: 5.2, lean: 70, curl: 20 },
};
const LEGS: readonly InsectLeg[] = sprawledLegs([
  { pair: 'fore', far: false, hip: { x: 19.6, y: 7.4 } },
  { pair: 'fore', far: true, hip: { x: 17, y: 8 } },
  { pair: 'mid', far: false, hip: { x: 14, y: 8 } },
  { pair: 'mid', far: true, hip: { x: 15, y: 8.2 } },
  { pair: 'hind', far: false, hip: { x: 12.3, y: 7.8 } },
  { pair: 'hind', far: true, hip: { x: 13, y: 8.2 } },
], SEGMENTS, GROUND);
// Yellow legs, darker at the femur's root as the drawing's are.
const LOOK: LegLook = {
  widths: [0.95, 0.8, 0.55], outline: 0.2, ink: INK,
  near: ['#e2b20c', '#f4cb1c', '#f4cb1c'], far: ['#9c7a08', '#ad8a10', '#ad8a10'], claw: 0.7,
};

// Elbowed antennae from the top of the face: the scape up and forward, the
// flagellum curving down ahead of her, the far one held higher.
const NEAR_ANTENNA: Antenna = { base: { x: 23.3, y: 4.5 }, scape: 1.9, flagellum: 5, angle: -40, elbow: 62, curve: 50 };
const FAR_ANTENNA: Antenna = { base: { x: 23.5, y: 3.9 }, scape: 2.2, flagellum: 4.6, angle: -55, elbow: 64, curve: 50 };
const ANTENNA_WIDTH = 0.6;
const ANTENNA = '#2c2c2c';

// Her wingbeat as a blur: a stroke of about 110 degrees, with a third,
// shimmering wing at a seeded place in it each frame (rig/wing-blur.ts).
const BEAT: WingBeat = { front: -25, back: -128, ghost: 0.32, fan: 0.12, colour: '#f3dca8', mid: { at: 0.5, opacity: 0.5 } };
const FAR_BEAT: WingBeat = { ...BEAT, front: BEAT.front + FAR_TILT, back: BEAT.back + FAR_TILT, ghost: 0.26, fan: 0.08 };
// Flying fast, the stroke sweeps further back, over her gaster.
const SWEPT = 70;
// About 35 degrees nose up hovering, 10 at her cruising speed (page px/s).
const PITCHING: Pitching = { hover: -30, cruise: -10, speed: 160 };
export const CRUISE = 200;

// Shuffling on the cake, a tripod: each shuffle (wasp.ts's) one tripod's
// step, SHUFFLE page px, half the gait's cycle, so every foot is down
// before and after it.
export const SHUFFLE = 4;
const SHUFFLING = insectGait(LEGS, 'tripod', strideFor('tripod', (2 * SHUFFLE) / SCALE), 0.6);

// What she is doing, as far as the drawing cares.
export type RigWasp = {
  pose: WaspPose;
  seed: number;
  // How far she has shuffled feeding, drawing units.
  walked: number;
  // Flying, her speed (page px/s), which sets her pitch and legs.
  speed: number;
  // How far her antennae lean toward a cursor, degrees (up negative).
  lean: number;
  // Her wings, 0 folded to 1 beating: lifting off, the blur fades in.
  wings: number;
};
type WaspLook = { now: number; still: boolean };

type Hold = { swept: number; pitch: number; bob: number; gaster: number; head: number; legs: (hips: readonly Point[]) => Goal[]; taps: [number, number] };

// Feeding, her antennae tap the sugar in turn, each every 0.3 to 0.6s: how
// far down each is, 0 to 1, near then far.
function tapping(seed: number, now: number): [number, number] {
  const every = 300 + 300 * ((seed * 0.618) % 1);
  const tap = (phase: number) => Math.max(0, Math.sin((Math.PI * now) / every + phase)) ** 4;
  return [tap(0), tap(Math.PI / 2)];
}

function hold(w: RigWasp, now: number): Hold {
  switch (w.pose) {
    case 'feed':
      // Head down, jaws to the sugar, the front of her lowered a little.
      return { swept: 0, pitch: 7, bob: 2.5, gaster: 2, head: 30, taps: tapping(w.seed, now), legs: (hips) => walkingGoals(LEGS, hips, w.walked, GROUND, SHUFFLING) };
    case 'hover': {
      const pitch = pitchAt(PITCHING, 0);
      return { swept: 0, pitch, bob: hoverBob(w.seed, now, 0.8, 2), gaster: -2, head: 10, taps: [0, 0], legs: (hips) => airGoals(LEGS, hips, { hang: 0.45, reach: 0, pitch }) };
    }
    case 'cruise': {
      const pitch = pitchAt(PITCHING, w.speed || CRUISE);
      const hang = hangAt(w.speed || CRUISE, CRUISE);
      return { swept: SWEPT * (1 - hang), pitch, bob: hoverBob(w.seed, now, 0.5, 1.5), gaster: -2, head: 6, taps: [0, 0], legs: (hips) => airGoals(LEGS, hips, { hang, reach: 0, pitch }) };
    }
    case 'land': {
      const pitch = -25;
      return { swept: 0, pitch, bob: 0, gaster: 0, head: 8, taps: [0, 0], legs: (hips) => airGoals(LEGS, hips, { hang: 0.8, reach: 0.7, pitch }) };
    }
    default:
      return { swept: 0, pitch: 0, bob: 0, gaster: 0, head: 0, taps: [0, 0], legs: (hips) => standingGoals(LEGS, hips, GROUND) };
  }
}

const image = (name: string, src: string, at: typeof HEAD, far = false): Layer => ({ kind: 'image', name, src, ...at, far });
const blurWing = (far: boolean): BlurWing => ({ picture: image(far ? 'far wing' : 'wing', wingArt, OPEN_AT, far), hinge: HINGE, axis: OPEN.axis, length: WING });

// One side's wings: folded along the back, fading out as the blur fades in;
// the third wing at a new place in the stroke each frame.
function wingsOf(far: boolean, beating: number, swept: number, seed: number, now: number, still: boolean): Layer[] {
  const side = far ? FAR_BEAT : BEAT;
  const beat = { ...side, front: side.front - swept, back: side.back - swept / 2 };
  const shimmering = { ...beat, mid: { at: still ? 0.5 : shimmer(seed + (far ? 3 : 0), now), opacity: beat.mid?.opacity ?? 0 } };
  const folded: Layer = { kind: 'group', turn: turnAbout(far ? -4 : 0, HINGE), opacity: beating > 0 ? 1 - beating : undefined, layers: [image(far ? 'far folded wings' : 'folded wings', foldedArt, FOLDED, far)] };
  const blur = wingBlur(blurWing(far), shimmering, beating, far ? 'far wing blur' : 'wing blur');
  return beating >= 1 ? blur : [folded, ...blur];
}

// An antenna drawn as the legs are: its outline, then its colour.
const antenna = (name: string, a: Antenna): Layer[] =>
  [antennaLayer(name, a, ANTENNA_WIDTH + 2 * LOOK.outline, INK), antennaLayer(name, a, ANTENNA_WIDTH, ANTENNA)];

const picture = (id: string, on: string, src: string, box: typeof HEAD) => ({ id, art: { drawn: { src, box } }, at: { kind: 'joint', to: on }, draws: [{ id, z: 0 }] }) as const;

// Her skeleton: the body turning about where she moves, the gaster on its
// petiole and the head on its neck, the antennae's sockets on the head, the
// wings' hinge on the thorax, and six legs from the thorax's underside.
// Drawn with the far wings, legs and antenna behind her, the near legs over
// her edge and the near wings over all.
const WASP = insect({
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: { part: 'spine', index: 1 }, at: ANCHOR, name: 'thorax (where she moves)' },
    { id: 'head', parent: 'body', role: { part: 'spine', index: 0 }, at: NECK, name: 'head joint (neck)' },
    { id: 'gaster', parent: 'body', role: { part: 'spine', index: 2 }, at: WAIST, name: 'petiole' },
    { id: 'scape', parent: 'head', role: { part: 'head', index: 0 }, at: NEAR_ANTENNA.base, name: 'scape' },
    { id: 'hinge', parent: 'body', role: { part: 'wing', side: 'near', index: 0 }, at: HINGE, name: 'wing hinge (tegula)' },
  ],
  bones: [
    { from: 'head', to: 'body', name: 'thorax line (head joint to where she moves)' }, { from: 'body', to: 'gaster', name: 'thorax line (to the petiole)' },
    { from: 'scape', to: 'head', name: 'head' },
  ],
  legs: LEGS,
  ground: GROUND,
  order: [
    { shape: 'far wings', on: 'body' }, { shape: 'far legs', on: 'body' }, { shape: 'far antenna', on: 'head' },
    picture('gaster', 'gaster', gasterArt, GASTER), picture('thorax', 'body', thoraxArt, THORAX), picture('head', 'head', headArt, HEAD),
    { shape: 'near antenna', on: 'head' }, { shape: 'near legs', on: 'body' }, { shape: 'wings', on: 'body' },
  ],
  stands: 'body (moves here)',
  guides: (code) => [
    { name: 'petiole', at: 'gaster' }, { name: 'neck', at: 'head' }, { name: 'wing hinge (tegula)', at: 'hinge' }, { name: 'scape', at: 'scape' },
    ...LEGS.flatMap((leg) => ['coxa', 'trochanter', 'knee', 'tibiotarsal joint', 'claws'].map((name, k) => ({ name, at: code(leg, k) }))),
  ],
});

// Held still under reduced motion: standing, wings folded, nothing moving.
const STILL: Omit<RigWasp, 'seed'> = { pose: 'standing', walked: 0, speed: 0, lean: 0, wings: 0 };

// The pose her hold makes: each foot set from where its coxa is now.
function poseOf(w: RigWasp, now: number, still: boolean): PoseSpec {
  const h = hold(w, now);
  const root: Turn = turnAbout(h.pitch, ANCHOR, 0, h.bob);
  // At rest her gaster pulses slowly as she breathes; her antennae flick now
  // and then, lean toward a cursor close by and, feeding, tap the surface
  // in turn.
  const resting = (w.pose === 'standing' || w.pose === 'feed') && !still;
  const pulse = resting ? 1 + 0.04 * breath(w.seed, now, 1400) : 1;
  const flick = still ? 0 : -12 * flicking(w.seed, now);
  const lean = clamp(w.lean, -15, 15) + flick;
  const joints = { head: { angle: h.head + clamp(w.lean / 3, -5, 5) }, gaster: { angle: h.gaster, squash: { by: pulse } } };
  const hips = WASP.hips({ root, joints });
  const goals = h.legs(hips);
  const legs = ({ limb }: { limb: (id: string) => Limb }) => legLayers(LEGS, WASP.legs(limb), LOOK, hips);
  return {
    root, joints: { ...joints, ...WASP.coxae({ root, joints }, goals) }, limbs: WASP.limbs(goals), show: {}, z: {},
    shapes: {
      'far wings': wingsOf(true, w.wings, h.swept, w.seed, now, still),
      'far legs': (posed) => localized(legs(posed).far, posed.local),
      'far antenna': antenna('far antenna', turnedBy(FAR_ANTENNA, lean + 10 * h.taps[1])),
      'near antenna': antenna('near antenna', turnedBy(NEAR_ANTENNA, lean + 10 * h.taps[0])),
      'near legs': (posed) => localized(legs(posed).near, posed.local),
      wings: wingsOf(false, w.wings, h.swept, w.seed, now, still),
    },
  };
}

export function waspRig(wasp: RigWasp, look: WaspLook): RigPose {
  const w = look.still ? { ...STILL, seed: wasp.seed } : wasp;
  const now = look.still ? 0 : look.now;
  return compose(WASP.body, (t) => poseOf(w, t, look.still), now);
}

// Where her eye is in a pose, for the lab to line a key pose up by.
export const eyeOf = (wasp: RigWasp): Point => {
  const h = hold(wasp, 0);
  return turned(turnAbout(h.pitch, ANCHOR, 0, h.bob), turned(turnAbout(h.head, NECK), EYE));
};
