import { clamp, mix, smooth } from '../math';
import type { Point } from '../pointer';
import { gazeFrom } from '../rig/gaze';
import { birdWalk, curledIn, feetLine, headBob, stepRise, type AirLegs, type BirdLeg } from '../rig/bird';
import { stepping } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { lidLayers, turnAbout, turned, type Frame, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { BIRD, head, picture, spine, tetrapod } from '../rig/skeleton/tetrapod';
import type { Goal, JointPose, PoseSpec } from '../rig/skeleton/types';
import { wingOf } from '../rig/skeleton/wing';
import { flaring, flapping, gliding, settling, takingOff, type Flap, type FlightPose, type WingArt, type WingPose } from '../rig/wings';
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
// fanned, and two wings each of an arm and a hand; all hung on its skeleton
// (rig/skeleton). Facing right, on the ledge at ANCHOR.
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
// legs need to reach through a stride. The tarsus bar runs on 0.25 units
// into the toes' picture, to where the toes part, which is its joint; the
// picture keeps of the tarsus only a knob round it (design-docs/art.py's
// knobbed), so it turns there without a stub standing out from the bar.
const TOES = { src: toesArt, fur: toesFurArt, width: 4.08, height: 1.92, heel: { x: 0.82, y: 0.57 } };
const CURLED = { src: curledArt, fur: curledFurArt, width: 2.17, height: 2.5, heel: { x: 0.48, y: 0.5 } };
const LEG_ART: LimbArt = {
  bone: tarsusArt, boneFur: tarsusFurArt, knee: true, inBody: true,
  thigh: { src: drumstickArt, fur: drumstickFurArt }, foot: TOES, curled: CURLED,
};
const LEG = {
  art: LEG_ART, width: 0.75, haunch: 0.92, thigh: 1.7, shin: 1.42, bend: 1, fore: false,
  walksOn: { kind: 'toes', length: 2.68, lean: 14, fold: 40 }, toes: { x: 3.26, y: 1.35 }, peel: 22,
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
// behind as a raptor's; reaching to land, its webbed toes spread forward and
// down to meet the ground (the flare drawing).
const GULL_AIR: AirLegs = {
  tucked: { ankle: { x: -0.25, y: 0.65 }, lean: 105 },
  trailing: { ankle: { x: -0.35, y: 0.85 }, lean: -30 },
  reaching: { ankle: { x: 0.25, y: 0.85 }, lean: 45, toes: -10 },
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
// How far the head turns down on the neck's top: turned further about the
// nape, its crown would rise out of that room.
const SKULL_DOWN = 10;
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

// Its bill open by `open` (0 to 1): the lower mandible turned down about
// the gape's corner, and the orange-red gape showing between.
const jawOf = (open: number): JointPose => ({ angle: open * BILL_OPEN });
const gapeOf = (open: number): Layer[] => (open > 0.02
  ? [{ kind: 'stroke', name: 'gape', points: [GAPE, UPPER_EDGE, turned(turnAbout(open * BILL_OPEN, GAPE), LOWER_EDGE)], width: 0.12, colour: '#7a2a12', fill: GAPE_FILL }]
  : []);

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
const planted = (hips: readonly Point[]): Goal[] => LEGS.map((leg, i) => ({ kind: 'plant', at: { x: hips[i].x + leg.reach, y: FEET } }));

// How it stands on the ledge: the body's turn; the neck's, which nods,
// stretches and bobs the head from its base; the head's own small turns on
// the neck's top at the nape (toward what it eyes, thrown back for the
// call); how far the bill is open; each foot's goal from where its hip is.
type Ground = { body: Turn; neck: JointPose; skull: JointPose; open: number; goals: (hips: readonly Point[]) => Goal[] };

// On the ledge: standing, strutting or foraging, eyeing something or giving
// the long call.
function onGround(gull: RigGull, look: GullLook): Ground {
  const breathe = look.still ? 0 : 0.12 * breath(gull.seed, look.now, 3600);
  const body = turnAbout(0, MIDDLE, 0, -breathe);
  if (look.still) return { body, neck: {}, skull: {}, open: 0, goals: planted };
  if (gull.pose === 'eye') {
    // The neck stretched up from its base; the head tilted, and turned to
    // what it eyes, on the neck's top, a look further down than that a nod
    // of the neck.
    const gaze = clamp(look.gaze ?? 0, GAZE.up, GAZE.down);
    const turn = Math.min(gaze, SKULL_DOWN);
    return { body, neck: { angle: gaze - turn, shift: { x: STRETCH.dx, y: STRETCH.dy } }, skull: { angle: EYE_TILT + turn }, open: 0, goals: planted };
  }
  if (gull.pose === 'call') {
    const { angle, lift, open } = callPose(gull.t);
    // Brought down about the neck, thrown back about the nape: either way
    // its crown stays down.
    const turn = { angle, shift: { x: STRETCH.dx * lift, y: 0 } };
    return { body, neck: angle > 0 ? turn : {}, skull: angle > 0 ? {} : turn, open, goals: planted };
  }
  if (gull.pose === 'stand') {
    return { body, neck: {}, skull: { angle: clamp(look.gaze ?? 0, GAZE.up, GAZE.down) / 2 }, open: 0, goals: planted };
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
    neck: { angle: forage ? 6 : 0, shift: { x: forage ? 0.6 * headBob(walked, gait, THRUST) : 0, y: rise } },
    skull: {},
    open: 0,
    goals: (hips) => feet(hips).map((at, i) => ({ kind: 'plant', at, step: steps[i], ground: GROUND })),
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


// Its skeleton: the body, which rolls about its middle and pitches about
// its hips; the neck's base on it, the head on the neck at the nape, the
// eye and the lower mandible on the head; the tail at its root, fanned
// further about it; each leg from its hip high in the body; and, in the
// air, the wings. The legs start inside the body: the far leg drawn behind
// it, the near outlined behind it too and its fur over its edge (or,
// tucked up in flight, into the belly feathers, behind it). In the air the
// far wing is behind it all, the near over it all, and the body is drawn
// without its folded wing, with a tail of its own.
const TIP = { x: -1.5, y: -18.2 };
const NEAR_WING = wingOf({ art: WING, side: 'near', parent: 'body', root: NEAR_SHOULDER, tip: TIP, z: 0 });
const FAR_WING = wingOf({ art: WING, side: 'far', parent: 'body', root: FAR_SHOULDER, tip: TIP, z: 0 });
const HEAD_PARTS = ['gape', picture('lower mandible', 'jaw', mandibleArt, MANDIBLE), picture('head', 'skull', headArt, HEAD), 'eyelid'];
const gullOf = (air: boolean) => tetrapod(BIRD, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: MIDDLE, name: 'body pivot (its middle, or its hips)' },
    { id: 'neck base', parent: 'body', role: spine(1), at: NECK, name: 'neck base' },
    { id: 'skull', parent: 'neck base', role: spine(0), at: NAPE, name: 'head joint (nape)' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'jaw', parent: 'skull', role: head(1), at: GAPE, name: 'jaw hinge (lower mandible)' },
    ...(air ? [
      { id: 'tail', parent: 'body', role: spine(3), at: TAIL_ROOT, name: 'tail root' },
      { id: 'tail fan', parent: 'tail', role: spine(4), at: TAIL_ROOT, name: 'tail, fanned (turned further about its root)' },
      ...FAR_WING.joints, ...NEAR_WING.joints,
    ] : []),
  ],
  bones: [
    // Its neck stretches and shortens as the head thrusts and bobs, eyes
    // something and calls.
    { from: 'skull', to: 'neck base', name: 'neck line', stretch: { min: 3.85, max: 4.1 } },
    { from: 'neck base', to: 'body', name: 'back line', stretch: { min: 3.8, max: 4.8 } },
    ...(air ? [{ from: 'body', to: 'tail', name: 'pelvis line (to the tail root)' }, ...FAR_WING.bones, ...NEAR_WING.bones] : []),
  ],
  legs: LEGS,
  ground: () => FEET,
  order: air
    ? [FAR_WING.pieces, picture('tail', 'tail', tailArt, TAIL), picture('tail, fanned', 'tail fan', tailFannedArt, TAIL_FANNED),
      picture('body', 'body', bodyArt, BODY), picture('body in flight', 'body', flightBodyArt, FLIGHT_BODY), ...HEAD_PARTS, NEAR_WING.pieces]
    : [picture('body', 'body', bodyArt, BODY), ...HEAD_PARTS],
  shapes: [{ id: 'gape', on: 'skull' }, { id: 'eyelid', on: 'skull' }],
  guides: (at) => [
    ...(air ? [{ name: 'shoulder', at: NEAR_WING.ids.shoulder }, { name: 'wrist', at: NEAR_WING.ids.wrist }, { name: 'wingtip', at: NEAR_WING.ids.tip }] : [{ name: 'eye', at: 'eye' }, { name: 'gape', at: 'jaw' }]),
    ...LEGS.flatMap((leg) => [0, 1, 2, 3].map((k) => ({ name: BIRD.legs.hind.joints[k], at: at(leg, k) }))),
  ],
});
const ON_GROUND = gullOf(false);
const IN_AIR = gullOf(true);

// Its toes drawn together while a foot swings (bird.ts's curledIn), or
// while a leg in the air is not reaching to land.
const curled = (goal: Goal) => (goal.kind === 'air' ? goal.reach < 0.6 : curledIn(goal.kind === 'plant' ? goal.step : undefined));
const feetShown = (goals: readonly Goal[]) => ON_GROUND.feet((_, i) => (curled(goals[i]) ? 'curled' : 'toes'));
const shapesOf = (gull: RigGull, look: GullLook, open: number) => ({ gape: gapeOf(open), eyelid: lidLayers(!look.still && blinking(gull.seed, look.now), EYE, 0.28, FACE) });

function flying(gull: RigGull, look: GullLook): RigPose {
  const pose = inAir(gull, look.now);
  const body = turnAbout(-pose.pitch, HIPS);
  const folded = pose.wings.fold > 120;
  const [far, near] = [FAR_WING.pose(pose.wings, 0, !folded), NEAR_WING.pose(pose.wings, 0, !folded)];
  const joints = { ...far.joints, ...near.joints, 'tail fan': { angle: -10 * pose.tail } };
  const hips = IN_AIR.hips({ root: body, joints });
  // Down until its feet leave; then stretched down and back as they push
  // off (GULL_AIR), close to where they stood, tucked, or reaching to land.
  const goals: Goal[] = pose.airborne ? LEGS.map(() => ({ kind: 'air', reach: pose.legs, legs: GULL_AIR, carried: true })) : planted(hips);
  // The body with its wing folded has its own tail, tucked under the
  // primaries: the flight tail behind it would show above them.
  const seen = (shown: boolean) => (shown ? 'drawn' : false);
  const show: PoseSpec['show'] = {
    ...far.show, ...near.show, ...feetShown(goals),
    tail: seen(!folded && pose.tail < 0.5), 'tail, fanned': seen(!folded && pose.tail >= 0.5), body: seen(folded), 'body in flight': seen(!folded),
  };
  // Tucked up in flight, a gull's legs are hidden in its belly feathers
  // (the seaside note), so even the near leg's fur goes behind the body.
  const tucked = pose.airborne && Math.abs(pose.legs) < 0.25;
  return compose(IN_AIR.body, () => ({ root: body, joints, limbs: IN_AIR.limbs(goals), show, z: tucked ? IN_AIR.furUnder('near') : {}, shapes: shapesOf(gull, look, 0) }), look.now);
}

const GROUNDED = new Set<GullPose>(['stand', 'strut', 'forage', 'eye', 'call']);

function standing(gull: RigGull, look: GullLook): RigPose {
  const { body, neck, skull, open, goals: goalsAt } = onGround(gull, look);
  const joints = { 'neck base': neck, skull, jaw: jawOf(open) };
  const goals = goalsAt(ON_GROUND.hips({ root: body, joints }));
  return compose(ON_GROUND.body, () => ({ root: body, joints, limbs: ON_GROUND.limbs(goals), show: feetShown(goals), z: {}, shapes: shapesOf(gull, look, open) }), look.now);
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
