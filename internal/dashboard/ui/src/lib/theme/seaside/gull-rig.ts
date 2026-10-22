import { clamp, mix, smooth } from '../math';
import type { Point } from '../pointer';
import { gazeFrom } from '../rig/gaze';
import { airLegsTo, birdJointGuides, birdLegsTo, birdWalk, feetLine, headBob, plantedLegs, stepRise, type AirLegs, type BirdLeg } from '../rig/bird';
import { stepping, type Limb } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { imageLayer, legsAround, lidLayers, turnAbout, turned, type Frame, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { birdWing, flaring, flapping, gliding, settling, takingOff, wingPoint, type Flap, type FlightPose, type WingArt, type WingPose } from '../rig/wings';
import armUnderArt from './gull-arm-under.webp';
import armArt from './gull-arm.webp';
import bodyArt from './gull-body.webp';
import drumstickFurArt from './gull-drumstick-fur.webp';
import drumstickArt from './gull-drumstick.webp';
import flightBodyArt from './gull-flight-body.webp';
import handUnderArt from './gull-hand-under.webp';
import handArt from './gull-hand.webp';
import headArt from './gull-head-upper.webp';
import mandibleArt from './gull-mandible.webp';
import tailFannedArt from './gull-tail-fanned.webp';
import tailArt from './gull-tail.webp';
import tarsusFurArt from './gull-tarsus-fur.webp';
import tarsusArt from './gull-tarsus.webp';
import curledFurArt from './gull-toes-curled-fur.webp';
import curledArt from './gull-toes-curled.webp';
import toesFurArt from './gull-toes-fur.webp';
import toesArt from './gull-toes.webp';

// The herring gull put together from its parts, on the bird kit
// (rig/bird.ts's legs and walk, rig/wings.ts's wings and flight poses): a
// body with its folded wing and a head over its breast, its lower mandible
// a piece of its own that opens for the long call, on two legs posed in
// code; in the air, the body without its folded wing, a tail closed or
// fanned, and two wings each of an arm and a hand. Facing right, on the
// ledge at ANCHOR.
//
// The parts were cut from one drawing of the gull standing square
// (design-docs/seaside/gull-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. The critters lab lays
// that drawing, and the key poses, over the rig to compare.

// Page pixels per drawing unit, for every pose: the reference stands 25.5px
// tall, as design-docs/seaside/README.md sets it.
export const SCALE = 1.5;

const GROUND = 18;
const ANCHOR = { x: 13.75, y: GROUND };
const FRAME: Frame = { width: 26.7, height: 19.2, anchor: ANCHOR, scale: SCALE };
export const REFERENCE = { x: 1, y: 1, width: 24.67, height: 17.33 };
const BODY = { x: 1.89, y: 5.34, width: 19.5, height: 8.17 };
const FLIGHT_BODY = { x: 4.21, y: 5.45, width: 18.08, height: 8.33 };
const HEAD = { x: 16.39, y: 1.19, width: 9.33, height: 9.83 };
// The lower mandible, as it sits closed under the upper, and the corner of
// the gape it opens about.
const MANDIBLE = { x: 21.98, y: 2.82, width: 3.75, height: 1.83 };
const GAPE = { x: 22.15, y: 3.05 };
// Where the upper mandible's edge runs to near its hooked tip, and the
// lower's, closed: the gape between them is drawn in code, orange-red, as
// a herring gull's mouth is.
const UPPER_EDGE = { x: 24.9, y: 3.35 };
const LOWER_EDGE = { x: 24.9, y: 3.4 };
const GAPE_FILL = '#e4572e';
const TAIL = { x: 0.3, y: 7.3, width: 5.67, height: 3.17 };
const TAIL_FANNED = { x: 0.15, y: 6.6, width: 5.83, height: 5.5 };
const TAIL_ROOT = { x: 5.4, y: 8.9 };
export const EYE = { x: 21.46, y: 2.45 };
const NECK = { x: 18.5, y: 8 };
// The body rolls about its middle, over the legs, and pitches about its
// hips, so pitched up to land its tail stays above the ledge.
const MIDDLE = { x: 15, y: 10.5 };
const HIPS = { x: 16.6, y: 11.9 };
const FACE: Fur = { fill: '#e9edf0', outline: '#1a1a1a' };

// The legs, as the reference's are: the hips high in the body above them,
// the femur running forward and down to the knee in the belly feathers, the
// drumstick down and back to the intertarsal joint just below the belly,
// the tarsus leaning its foot end a little forward to the toes. Measured on
// the reference's near leg: drumstick 1.42 and tarsus 2.43 drawing units,
// the tarsus leaning 14 degrees; the femur, never seen, is as long as the
// legs need to reach through a stride.
const TOES = { src: toesArt, fur: toesFurArt, width: 4.08, height: 1.92, heel: { x: 0.69, y: 0.33 } };
const CURLED = { src: curledArt, fur: curledFurArt, width: 2.17, height: 2.5, heel: { x: 0.43, y: 0.25 } };
const LEG_ART: LimbArt = {
  bone: tarsusArt, boneFur: tarsusFurArt, knee: true, inBody: true,
  thigh: { src: drumstickArt, fur: drumstickFurArt }, foot: TOES, curled: CURLED,
};
const LEG = {
  art: LEG_ART, width: 0.75, haunch: 0.92, thigh: 1.7, shin: 1.42, bend: 1, fore: false,
  walksOn: { kind: 'toes', length: 2.43, lean: 14, fold: 40 }, toes: { x: 3.39, y: 1.59 }, peel: 22,
} as const;
const LEGS: BirdLeg[] = [
  { ...LEG, hip: { x: 16.5, y: 11.8 }, reach: -0.8, far: true },
  { ...LEG, hip: { x: 16.8, y: 12 }, reach: 1.1, far: false },
];
const FEET = feetLine(GROUND, TOES);

// The walk: the feet half a cycle apart, each down for 0.6 of it, the
// stride as long as the drawn legs reach.
const STRUT = birdWalk(4.4, 1.4);
// Foraging, slow and long-strided, a gull now and then bobs its head as a
// pigeon does (Fujita 2006; Lisney and Troje), the thrust about half a step.
const FORAGE = birdWalk(4.4, 1.2);
const THRUST = 0.5;

// The wing, as drawn flat, its span up the picture: the shoulder where the
// arm's root meets the body, the wrist at the arm's tip, the hand overlapping
// it there.
const WING: WingArt = {
  name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: -1.2, y: -9.1 },
  arm: { upper: armArt, under: armUnderArt, x: -4.2, y: -10.3, width: 5.75, height: 10.5 },
  hand: { upper: handArt, under: handUnderArt, x: -5.2, y: -18.6, width: 4.92, height: 11.5 },
};
const NEAR_SHOULDER = { x: 15.2, y: 7.2 };
const FAR_SHOULDER = { x: 17.4, y: 6.6 };
// A herring gull's stroke: about 50 degrees above level to 35 below at
// cruise (the seaside note), the downstroke a little over half the beat.
const FLAP: Flap = { top: 50, bottom: -35, down: 0.55, fold: 70, sweep: 20 };
// How far a landing gull pitches up, its body braking against the air.
const UPRIGHT = 34;
// The dive: wings half folded and swept back, wrists forward.
const STOOP: WingPose = { lift: 25, sweep: 75, fold: 40 };
const SOAR: WingPose = { lift: 6, sweep: 0, fold: 8 };
// Pushing off, a gull's legs are stretched down and back, not trailed out
// behind as a raptor's.
const GULL_AIR: AirLegs = {
  tucked: { ankle: { x: -0.25, y: 0.65 }, lean: 105 },
  trailing: { ankle: { x: -0.35, y: 0.85 }, lean: -30 },
  reaching: { ankle: { x: 0.25, y: 0.85 }, lean: 45 },
};

export type GullPose = 'stand' | 'strut' | 'forage' | 'eye' | 'call' | 'takeoff' | 'flap' | 'glide' | 'stoop' | 'flare' | 'settle';
// What the drawing reads of a gull: its pose, how far it has walked, its
// wingbeats so far (`beat`) and how far through a flare, a settle or a long
// call it is (`t`, 0 to 1).
export type RigGull = { pose: GullPose; walked: number; seed: number; beat: number; t: number };
// When it is drawn; whether it is still (reduced motion); and how far its
// head turns toward what it eyes (degrees, nose down positive, eased by the
// layer). Turning round is the layer's: it narrows the whole drawing.
type GullLook = { now: number; still: boolean; gaze?: number };

// Eyeing something, a gull stands tall, its neck stretched up and its head
// raised (the eye key pose), turning a little further toward what it eyes:
// further down than up, so its head stays inside the 27px every ledge
// animal has (the key pose's full lift would need 31).
const EYE_TILT = -2;
const GAZE = { up: -4, down: 20 };
const STRETCH = { dx: 0.35, dy: -0.3 };
// The long call, over its 1.6s (the seaside note): the bill brought down
// and forward for 0.3s, the head swung up over 0.25s, held 0.8s with the
// bill wide open and three small pulses of the head, then closed and
// lowered over 0.25s (All About Birds; Filchagov).
const CALL = { down: 0.3 / 1.6, up: 0.55 / 1.6, hold: 1.35 / 1.6 };
const CALL_DOWN = 12;
const CALL_UP = -10;
// The call throws the head back about the top of the neck, where a gull's
// skull meets it, so the bill rises without the crown rising with it.
const NAPE = { x: 20.4, y: 4.6 };
const BILL_OPEN = 26;

// The head, turned as `head` says (nodded, slid along the body), its eye
// blinking, its bill open by `open` (0 to 1): the lower mandible turned down
// about the gape's corner, the orange-red gape showing between.
function headLayer(gull: RigGull, look: GullLook, head: Turn, open = 0): Layer {
  const jaw = turnAbout(open * BILL_OPEN, GAPE);
  const gape: Layer[] = open > 0.02 ? [{ kind: 'stroke', name: 'gape', points: [GAPE, UPPER_EDGE, turned(jaw, LOWER_EDGE)], width: 0.12, colour: '#7a2a12', fill: GAPE_FILL }] : [];
  return {
    kind: 'group', turn: head,
    layers: [
      ...gape,
      { kind: 'group', turn: jaw, layers: [imageLayer('lower mandible', mandibleArt, MANDIBLE)] },
      imageLayer('head', headArt, HEAD),
      ...lidLayers(!look.still && blinking(gull.seed, look.now), EYE, 0.28, FACE),
    ],
  };
}

// Where the head is through the long call, t of the way: its nod (nose down
// positive), how far it is lifted, and how far the bill is open.
function callPose(t: number): { angle: number; lift: number; open: number } {
  if (t < CALL.down) return { angle: CALL_DOWN * smooth(t / CALL.down), lift: 0, open: 0 };
  if (t < CALL.up) {
    const u = smooth((t - CALL.down) / (CALL.up - CALL.down));
    return { angle: mix(CALL_DOWN, CALL_UP, u), lift: u, open: smooth((u - 0.4) / 0.6) };
  }
  if (t < CALL.hold) {
    // Three pulses, one for each note.
    const pulse = Math.sin((3 * Math.PI * (t - CALL.up)) / (CALL.hold - CALL.up)) ** 2;
    return { angle: CALL_UP - 2 * pulse, lift: 1, open: 1 - 0.15 * pulse };
  }
  const u = smooth((t - CALL.hold) / (1 - CALL.hold));
  return { angle: mix(CALL_UP, 0, u), lift: 1 - u, open: 1 - smooth(u / 0.6) };
}

// Stood on the ledge (or taking off before its feet leave it, or settled
// after touchdown): each foot planted under its hip.
const planted = (hips: readonly Point[]) => plantedLegs(LEGS, hips, FEET);

type Ground = { body: Turn; head: Turn; open: number; limbs: (hips: readonly Point[]) => Limb[] };

// On the ledge: standing, strutting or foraging, eyeing something or giving
// the long call.
function onGround(gull: RigGull, look: GullLook): Ground {
  const breathe = look.still ? 0 : 0.12 * breath(gull.seed, look.now, 3600);
  const body = turnAbout(0, MIDDLE, 0, -breathe);
  if (look.still) return { body, head: turnAbout(0, NECK), open: 0, limbs: planted };
  if (gull.pose === 'eye') {
    const angle = EYE_TILT + clamp(look.gaze ?? 0, GAZE.up, GAZE.down);
    return { body, head: turnAbout(angle, NECK, STRETCH.dx, STRETCH.dy), open: 0, limbs: planted };
  }
  if (gull.pose === 'call') {
    const { angle, lift, open } = callPose(gull.t);
    // Brought down about the neck, thrown back about the nape: either way
    // its crown stays down.
    return { body, head: turnAbout(angle, angle > 0 ? NECK : NAPE, STRETCH.dx * lift, 0), open, limbs: planted };
  }
  if (gull.pose === 'stand') {
    return { body, head: turnAbout(clamp(look.gaze ?? 0, GAZE.up, GAZE.down) / 2, NECK), open: 0, limbs: planted };
  }
  const gait = gull.pose === 'forage' ? FORAGE : STRUT;
  const walked = gull.walked / SCALE;
  // The body vaults over each planted leg; the strut's head stays steady
  // over the ground as the body rises and falls under it, the forager's,
  // held a little low, bobs.
  const rise = 0.3 * stepRise(walked, gait);
  const forage = gull.pose === 'forage';
  const { feet, steps } = stepping(LEGS, walked, FEET, gait);
  return {
    body: turnAbout(0, MIDDLE, 0, -rise),
    head: turnAbout(forage ? 6 : 0, NECK, forage ? 0.6 * headBob(walked, gait, THRUST) : 0, rise),
    open: 0,
    limbs: (hips) => birdLegsTo(LEGS, hips, feet(hips), steps, GROUND),
  };
}

// In the air, by its pose: the wings, the body's pitch, the legs and tail.
function inAir(gull: RigGull, now: number): FlightPose {
  const cruise = (wings: WingPose): FlightPose => ({ wings, pitch: 0, legs: 0, tail: 0, airborne: true });
  switch (gull.pose) {
    case 'takeoff': return takingOff(gull.beat, { ...FLAP, top: 70 }, 80, 2);
    case 'glide': return cruise(gliding(SOAR, now, 2));
    case 'stoop': return { ...cruise(gliding(STOOP, now, 1, 900)), pitch: -12 };
    case 'flare': return flaring(gull.t, gull.beat, FLAP, UPRIGHT);
    case 'settle': return settling(gull.t, { lift: 70, sweep: -10, fold: 10 }, UPRIGHT / 2);
    default: return cruise(flapping(gull.beat, FLAP));
  }
}


function flying(gull: RigGull, look: GullLook): RigPose {
  const pose = inAir(gull, look.now);
  const body = turnAbout(-pose.pitch, HIPS);
  const hips = LEGS.map((s) => turned(body, s.hip));
  // Down until its feet leave; then stretched down and back as they push
  // off (GULL_AIR), close to where they stood, tucked, or reaching to land.
  const limbs = pose.airborne ? airLegsTo(LEGS, hips, pose.legs, GULL_AIR) : planted(hips);
  const folded = pose.wings.fold > 120;
  // The body with its wing folded has its own tail, tucked under the
  // primaries: the flight tail behind it would show above them.
  const tail = (fanned: boolean, box: typeof TAIL, src: string, name: string) =>
    ({ kind: 'group', turn: turnAbout(fanned ? -10 * pose.tail : 0, TAIL_ROOT), layers: [imageLayer(name, src, box, folded || (fanned ? pose.tail < 0.5 : pose.tail >= 0.5))] } satisfies Layer);
  const bodyLayers: Layer[] = [
    birdWing(WING, pose.wings, FAR_SHOULDER, true, 0, !folded),
    tail(false, TAIL, tailArt, 'tail'), tail(true, TAIL_FANNED, tailFannedArt, 'tail, fanned'),
    imageLayer('body', bodyArt, BODY, !folded), imageLayer('body in flight', flightBodyArt, FLIGHT_BODY, folded),
    headLayer(gull, look, turnAbout(0, NECK)),
    birdWing(WING, pose.wings, NEAR_SHOULDER, false, 0, !folded),
  ];
  const tip = wingPoint(WING, pose.wings, NEAR_SHOULDER, { x: -1.5, y: -18.2 }, true);
  // Tucked up in flight, a gull's legs are hidden in its belly feathers
  // (the seaside note), so even the near leg's fur goes behind the body.
  const [farLegs, farFur, nearLegs, drawn, nearFur] = legsAround(LEGS, limbs, { kind: 'group', turn: body, layers: bodyLayers });
  const tucked = pose.airborne && Math.abs(pose.legs) < 0.25;
  return {
    ...FRAME,
    layers: tucked ? [farLegs, farFur, nearLegs, nearFur, drawn] : [farLegs, farFur, nearLegs, drawn, nearFur],
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'shoulder', at: turned(body, NEAR_SHOULDER) },
      { name: 'wrist', at: turned(body, wingPoint(WING, pose.wings, NEAR_SHOULDER, WING.wrist, false)) },
      { name: 'wingtip', at: turned(body, tip) }, ...birdJointGuides(limbs),
    ],
  };
}

const GROUNDED = new Set<GullPose>(['stand', 'strut', 'forage', 'eye', 'call']);

function standing(gull: RigGull, look: GullLook): RigPose {
  const { body, head, open, limbs } = onGround(gull, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const legs = limbs(hips);
  return {
    ...FRAME,
    // The legs start inside the body, the hips high in it.
    layers: legsAround(LEGS, legs, { kind: 'group', turn: body, layers: [imageLayer('body', bodyArt, BODY), headLayer(gull, look, head, open)] }),
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'eye', at: turned(body, turned(head, EYE)) },
      { name: 'gape', at: turned(body, turned(head, GAPE)) }, ...birdJointGuides(legs),
    ],
  };
}

export function gullRig(gull: RigGull, look: GullLook): RigPose {
  if (!GROUNDED.has(gull.pose) && !look.still) return flying(gull, look);
  return standing(gull, look);
}

// How far its head turns toward what it eyes, from how far away: a gull
// eyes a cursor 360px off (the seaside note).
export const gazeAt = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: 20, reach: 360 });

// The lab's speeds: a strut about three steps a second, foraging two.
export const STRUT_SPEED = 20;
export const FORAGE_SPEED = 13;
// The box each pose's drawing stays inside through its whole motion (page
// px, standing on the anchor; `down` below it), as gull-rig.test.ts
// measures them.
type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<GullPose, Footprint> = {
  stand: { width: 39.5, height: 26.5 }, strut: { width: 36.5, height: 26 }, forage: { width: 41.5, height: 26 },
  eye: { width: 42.5, height: 27 }, call: { width: 44.5, height: 27 },
  takeoff: { width: 44, height: 45, down: 6 }, flap: { width: 41, height: 39 }, glide: { width: 41, height: 26 },
  stoop: { width: 48, height: 26 }, flare: { width: 48, height: 44, down: 6 }, settle: { width: 44, height: 44 },
};
