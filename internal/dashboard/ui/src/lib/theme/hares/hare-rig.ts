import type { Point } from '../pointer';
import { beatsFor, flightAt, flightLift, gaitPhase, legsTo, onSoles, restingFeet, stepping, type Gait, type Landings, type Step } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { legsAround, lidLayers, turnAbout, turned, type ArtLeg, type Foot, type Frame, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { hash } from '../seed';
import { clamp } from '../spidergait';
import bodyArt from './hare-body.webp';
import earsArt from './hare-ears.webp';
import foreToesFurArt from './hare-fore-toes-fur.webp';
import foreToesArt from './hare-fore-toes.webp';
import headArt from './hare-head.webp';
import hindToesFurArt from './hare-hind-toes-fur.webp';
import hindToesArt from './hare-hind-toes.webp';
import legFurArt from './hare-leg-fur.webp';
import legArt from './hare-leg.webp';
import thighFurArt from './hare-thigh-fur.webp';
import thighArt from './hare-thigh.webp';

// The brown hare put together from its parts: a torso with its tail, chest
// and neck, a head over the neck's soft top, its ears behind the head, and
// four long legs, each made of furred leg art laid along a leg posed in
// code. Facing right, on the ledge at ANCHOR. The parts were cut from one
// drawing of the hare standing square (design-docs/hares/hare-standing.png),
// and every size and place below is in that drawing's units, as export.py
// prints them; every picture is on one scale, its eye's.
//
// Its legs are a hare's (design-docs/hares/README.md): a hind leg's hip up
// in the rump, the thigh down and forward to the stifle (the true knee) at
// the flank, the shank back down to the hock (the ankle, its point the
// heel), and the long hind foot from the hock to the toes; a foreleg's
// shoulder in the chest, the upper arm back to the elbow, the long forearm
// down to the wrist (the carpus), and the short forefoot. Sitting, grazing
// and boxing it rests on the whole long hind foot, sole down from the hock
// (onSoles); running, it is on its toes.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.5;
const GROUND = 23.26;
const ANCHOR = { x: 12, y: GROUND };
const FRAME: Frame = { width: 24.5, height: 24.4, anchor: ANCHOR, scale: SCALE };
const BODY = { x: 1, y: 6.72, width: 20.25, height: 11 };
const HEAD = { x: 16.6, y: 5.99, width: 6.83, height: 6.58 };
const EARS = { x: 14.44, y: 1.14, width: 5.83, height: 7.42 };
// The head turns about the top of the neck; the ears about their base.
const NECK = { x: 17.8, y: 10.6 };
const EAR_BASE = { x: 18.4, y: 7.6 };
const EYE = { x: 20.62, y: 8.6 };
const NOSE = { x: 23.1, y: 9.9 };
// The body turns about its hips.
const HIPS = { x: 7.4, y: 13.6 };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 22.5, height: 22.42 };

const FACE: Fur = { fill: '#d39552', outline: '#0b0503' };
const HIND_TOES: Foot = { src: hindToesArt, fur: hindToesFurArt, width: 2.58, height: 1, heel: { x: 0.41, y: 0.38 } };
const FORE_TOES: Foot = { src: foreToesArt, fur: foreToesFurArt, width: 1.67, height: 0.83, heel: { x: 0.33, y: 0.21 } };
const legArtOn = (foot: Foot): LimbArt => ({ bone: legArt, boneFur: legFurArt, knee: true, thigh: { src: thighArt, fur: thighFurArt }, foot });
const LEG_WIDTH = 1.25;
// A long foot laid flat rests its bone on the ledge, as thick as the leg,
// a pixel above its edge, on the rule's line: a row of tabs can start a
// fraction of a pixel above a heading's bottom edge, and is never touched,
// not even by a turned piece's box.
const FEET = GROUND - LEG_WIDTH / 2 - 0.7;

// Measured against the standing drawing: the near hind leg's hip in the
// rump, stifle at the flank, hock well off the ground, and the long foot
// (the bone up from the toes) slanting down and forward to the toes; the
// near foreleg near upright from the shoulder, the elbow behind the chest,
// the wrist just off the ground. The far pair a little apart from the near,
// as they would be seen.
const HIND_LEG = { art: legArtOn(HIND_TOES), width: LEG_WIDTH, thigh: 3.1, shin: 4.8, bend: 1, fore: false, haunch: 3.8, taper: true, reach: 0.5, walksOn: { kind: 'toes', length: 4.6, lean: 35, fold: 40 } } as const;
const FORE_LEG = { art: legArtOn(FORE_TOES), width: LEG_WIDTH, thigh: 2.9, shin: 5, bend: -1, fore: true, haunch: 1.6, reach: -0.2, walksOn: { kind: 'toes', length: 1, lean: 30, fold: 45 } } as const;
const LEGS: ArtLeg[] = [
  { ...HIND_LEG, hip: { x: 5.8, y: 13.1 }, far: true },
  { ...FORE_LEG, hip: { x: 18.2, y: 13.9 }, far: true },
  { ...HIND_LEG, hip: { x: 7.4, y: 13.6 }, far: false },
  { ...FORE_LEG, hip: { x: 17.1, y: 14.2 }, far: false },
];

// Grazing it lopes (the slow hop): a forefoot, then the other, then the hind
// pair swung forward together, landing near them; no flight. Running it
// half-bounds: forefeet one after the other, the hind pair together landing
// ahead of where the forefeet were set, then a long flight stretched out
// after the hind feet push off. Beats in LEGS' order.
const LOPE_LANDINGS: Landings = { fore: { near: 0, far: 0.12 }, hind: { near: 0.5, far: 0.5 } };
const BOUND_LANDINGS: Landings = { fore: { near: 0, far: 0.07 }, hind: { near: 0.4, far: 0.4 } };
export const LOPE: Gait = { stride: 4, lift: 1.8, stance: 0.55, beats: beatsFor(LEGS, LOPE_LANDINGS) };
export const BOUND: Gait = { stride: 13, lift: 3.5, stance: 0.27, beats: beatsFor(LEGS, BOUND_LANDINGS) };
// How high the body flies in a bound's longest flight.
const FLIGHT = 1.5;
// Running, the body is carried lower than standing, its legs more bent.
const CROUCH = 3;

// How far the head turns toward a cursor, and from how far it notices one.
const LOOK = 14;
const LOOK_REACH = 160;

// What the hare is doing, as far as the drawing goes.
export type HarePose = 'stand' | 'graze' | 'sit' | 'alert' | 'lope' | 'bound' | 'leap' | 'box';
// walked: distance moved (page px), which drives its steps; seed: its own
// blinks and twitches; leapt: how far through a leap, 0 to 1.
export type RigHare = { pose: HarePose; walked: number; seed: number; leapt?: number };
// What the drawing needs besides the hare: the time, how far its head is
// turned toward the cursor (eased by the caller), and whether motion is
// reduced.
export type HareLook = { now: number; gaze: number; still: boolean };

const degrees = (rad: number) => (rad * 180) / Math.PI;

// How far the head would turn toward the cursor, standing at `at` on the
// page facing dir: in the drawing's own frame.
export function gazeAt(dir: 1 | -1, at: Point, cursor: Point | null): number {
  if (!cursor) return 0;
  const eye = { x: at.x + (EYE.x - ANCHOR.x) * SCALE * dir, y: at.y - (ANCHOR.y - EYE.y) * SCALE };
  const dx = (cursor.x - eye.x) * dir, dy = cursor.y - eye.y;
  if (Math.hypot(dx, dy) > LOOK_REACH) return 0;
  return clamp(degrees(Math.atan2(dy, Math.max(dx, 12))), -LOOK, LOOK);
}

// How the hare stands: its body's turn, its head's (positive turns the nose
// down), its ears' (negative lays them back), which legs (on their soles or
// toes), where its feet go, and where each is in its step.
type Stance = { body: Turn; head: number; ears: number; legs: readonly ArtLeg[]; feet: (hips: readonly Point[]) => Point[]; steps: Step[] };

// Feet planted on the ledge, fore and hind each set this far from its hip.
const planted = (foreBy: number, hindBy: number) => (hips: readonly Point[]) => hips.map((h, i) => ({ x: h.x + (LEGS[i].fore ? foreBy : hindBy), y: FEET }));
const still = (body: Turn, head: number, ears: number, legs: readonly ArtLeg[] = LEGS, feet = (hips: readonly Point[]) => restingFeet(LEGS, hips, FEET)): Stance =>
  ({ body, head, ears, legs, feet, steps: [] });

// An ear flick now and then, grazing: a quick twitch at a seeded moment in
// each 3.1s, still in between.
function flick(seed: number, now: number): number {
  const n = Math.floor(now / 3100);
  const t = (now - n * 3100 - hash(seed * 53 + n) * 2600) / 260;
  return t < 0 || t > 1 ? 0 : -9 * Math.sin(Math.PI * t);
}

// In a bound's long flight, after the hind feet push off, the hare flies
// stretched out: hind legs trailing far behind, forelegs reaching for the
// ground ahead (design-docs/hares/hare-pose-bound-reach.png). The swinging
// feet are drawn toward that, most at mid-flight.
const TRAIL = { x: -8, y: 5 };
const REACH = { x: 6, y: 6 };
function stretched(feet: readonly Point[], hips: readonly Point[], phase: number): Point[] {
  const flight = flightAt(phase, BOUND);
  if (!flight || flight.length < 0.2) return [...feet];
  const w = Math.sin(Math.PI * flight.t);
  return feet.map((f, i) => {
    const to = LEGS[i].fore ? REACH : TRAIL;
    return { x: f.x + (hips[i].x + to.x - f.x) * w, y: f.y + (hips[i].y + to.y - f.y) * w };
  });
}

// Flying between ledges, the hind legs stream out behind, the long foot in
// line with the shank rather than standing up from the toes.
const TRAILING: ArtLeg[] = LEGS.map((s) => (s.fore || s.walksOn?.kind !== 'toes' ? s : { ...s, walksOn: { ...s.walksOn, lean: -70 } }));

// Each tuned against its key pose (design-docs/hares/hare-pose-*.png, laid
// over the rig in the critters lab).
function stance(hare: RigHare, look: HareLook): Stance {
  const walked = hare.walked / SCALE;
  switch (hare.pose) {
    case 'graze': {
      // Low on its folded hind legs, nose to the grass, its jaw working.
      const chew = 1.5 * Math.sin(look.now / 140);
      return still(turnAbout(12, HIPS, 0, 2.2), 48 + chew, -26 + flick(hare.seed, look.now), onSoles(LEGS, 1), planted(1.2, 2.6));
    }
    case 'sit':
      // Up on its haunches, the long hind feet flat, forelegs straight.
      return still(turnAbout(-34, HIPS, 0, 2.6), 30 + look.gaze, -6 - look.gaze, onSoles(LEGS, 1), planted(0.3, 3.2));
    case 'alert':
      // Crouched low and still, ears up, head toward what it heard.
      return still(turnAbout(-4, HIPS, 0, 5), -4 + look.gaze, -22 - look.gaze, onSoles(LEGS, 1), planted(1.6, 2.4));
    case 'lope': {
      const phase = gaitPhase(walked, LOPE);
      const arch = Math.sin(2 * Math.PI * phase);
      return { body: turnAbout(3 * arch, HIPS, 0, 2.2 - 0.4 * Math.abs(arch)), head: 6 - 3 * arch, ears: -80, legs: LEGS, ...stepping(LEGS, walked, FEET, LOPE) };
    }
    case 'bound': {
      // Nose down as the forefeet take the landing, up as the hind feet
      // drive; the head steadied against it; ears laid back along the back.
      const phase = gaitPhase(walked, BOUND);
      const pitch = 5 * Math.sin(2 * Math.PI * (phase - 0.1));
      const { feet, steps } = stepping(LEGS, walked, FEET, BOUND);
      return { body: turnAbout(pitch, HIPS, 0, CROUCH - flightLift(phase, BOUND, FLIGHT)), head: -0.7 * pitch, ears: -88, legs: LEGS, feet: (hips) => stretched(feet(hips), hips, phase), steps };
    }
    case 'leap': {
      // Stretched out through the flight: nose up as it leaves, down as it
      // comes to land, forelegs reaching and hind legs trailing.
      const t = hare.leapt ?? 0.5;
      const reach = (h: Point, i: number): Point => (LEGS[i].fore
        ? { x: h.x + 4.5 - 2 * t, y: h.y + 4.6 - 1.2 * t }
        : { x: h.x - 10 + 5 * t, y: h.y + 3.5 - t });
      return { body: turnAbout(-8 + 16 * t, HIPS, 0, CROUCH), head: 6 - 10 * t, ears: -88, legs: TRAILING, feet: (hips) => hips.map(reach), steps: LEGS.map((s) => ({ down: !s.fore, t: s.fore ? 0.9 : 0 })) };
    }
    case 'box': {
      // Reared up on the long hind feet, forepaws striking in turn.
      const beat = (i: number) => 0.5 + 0.5 * Math.sin(look.now / 170 + (i === 1 ? Math.PI : 0) + hare.seed);
      const paw = (h: Point, i: number): Point => (LEGS[i].fore
        ? { x: h.x + 1.5 + 3 * beat(i), y: h.y + 0.5 - 1.5 * beat(i) }
        : { x: h.x + 2.6, y: FEET });
      return still(turnAbout(-70, HIPS, 0, 2.2), 62, -55, onSoles(LEGS, 1), (hips) => hips.map(paw));
    }
    default:
      return still(turnAbout(0, HIPS), look.gaze, 0);
  }
}

// Moving poses held still become the crouch; under reduced motion nothing
// keeps time, so the jaw, the ears and the forepaws are held too.
const MOVING: readonly HarePose[] = ['lope', 'bound', 'leap', 'box'];

export function hareRig(hare: RigHare, look: HareLook): RigPose {
  const held = look.still ? { ...look, now: 0, gaze: 0 } : look;
  const { body, head, ears, legs: specs, feet, steps } = stance(look.still && MOVING.includes(hare.pose) ? { ...hare, pose: 'alert' } : hare, held);
  const hips = specs.map((s) => turned(body, s.hip));
  const legs = legsTo(specs, hips, feet(hips), steps);
  const nod = turnAbout(head, NECK);
  const breathing = hare.pose === 'sit' || hare.pose === 'alert' ? 1 + (look.still ? 0 : 0.02 * breath(hare.seed, look.now, 2400)) : 1;
  const headLayer: Layer = {
    kind: 'group', turn: nod,
    layers: [
      { kind: 'group', turn: turnAbout(ears, EAR_BASE), layers: [{ kind: 'image', name: 'ears', src: earsArt, ...EARS }] },
      { kind: 'image', name: 'head', src: headArt, ...HEAD },
      ...lidLayers(!look.still && blinking(hare.seed, look.now), EYE, 0.75, FACE),
    ],
  };
  return {
    ...FRAME,
    layers: legsAround(specs, legs, { kind: 'group', turn: body, scaleY: breathing, layers: [{ kind: 'image', name: 'body', src: bodyArt, ...BODY }, headLayer] }),
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'neck', at: turned(body, NECK) }, { name: 'ear base', at: turned(body, turned(nod, EAR_BASE)) },
      { name: 'eye', at: turned(body, turned(nod, EYE)) }, { name: 'nose', at: turned(body, turned(nod, NOSE)) },
      ...hips.map((at, i) => ({ name: specs[i].fore ? 'shoulder' : 'hip', at })),
      ...legs.flatMap((l, i) => (specs[i].fore
        ? [{ name: 'elbow', at: l.knee }, { name: 'wrist (carpus)', at: l.ankle }, { name: 'toes', at: l.foot }]
        : [{ name: 'stifle (knee)', at: l.knee }, { name: 'hock (ankle)', at: l.ankle }, { name: 'toes', at: l.foot }])),
    ],
  };
}
