import type { Point } from '../pointer';
import { beatsFor, flightLift, gaitPhase, legsTo, stepping, type Gait, type QuadLeg, type Step } from '../rig/gait';
import { blinking, snuffle } from '../rig/life';
import { lidLayers, turnAbout, turned, type DrawnLeg, type Foot, type Frame, type Fur, type Layer, type LegArt, type RigPose, type Turn } from '../rig/rig';
import { clamp } from '../spidergait';
import bodyArt from './rabbit-body.webp';
import earsArt from './rabbit-ears.webp';
import footFurArt from './rabbit-foot-fur.webp';
import footArt from './rabbit-foot.webp';
import forelegFurArt from './rabbit-foreleg-fur.webp';
import forelegArt from './rabbit-foreleg.webp';
import haunchFurArt from './rabbit-haunch-fur.webp';
import haunchArt from './rabbit-haunch.webp';
import headArt from './rabbit-head.webp';
import legFurArt from './rabbit-leg-fur.webp';
import legArt from './rabbit-leg.webp';
import pawFurArt from './rabbit-paw-fur.webp';
import pawArt from './rabbit-paw.webp';
import tailArt from './rabbit-tail.webp';

// The European rabbit put together from its parts: a tail, a body, a head
// with its ears, on four legs, each made of furred leg art laid along a leg
// posed in code. Facing right, on the ledge at ANCHOR. The parts were cut
// from one drawing of it standing on all four feet
// (design-docs/easter/rabbit-standing.png), and the drawing units are that
// drawing's: export.py prints where each part sat in it, which is where it
// sits here, and the legs are measured from its legs. Every picture is on
// one scale, its eye's.

// Page pixels per drawing unit, for every pose.
export const SCALE = 1.4;

const GROUND = 17.95;
const ANCHOR = { x: 11.2, y: GROUND };
const FRAME: Frame = { width: 24, height: 19.5, anchor: ANCHOR, scale: SCALE };
const TAIL = { x: 1, y: 7.84, width: 3.5, height: 4.58 };
const BODY = { x: 3.35, y: 6.81, width: 13.83, height: 8.33 };
const HEAD = { x: 13.78, y: 4.27, width: 7.67, height: 6.33 };
const EARS = { x: 13.67, y: 1, width: 4.58, height: 6.17 };
const TAIL_ROOT = { x: 4.4, y: 10.2 };
const NECK = { x: 15.8, y: 9.4 };
const EAR_BASE = { x: 16.2, y: 6 };
const EYE = { x: 18.33, y: 6.98 };
const NOSE = { x: 21.2, y: 8.1 };
// The body turns about its hips.
const HIND = { x: 7, y: 12 };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 20.5, height: 17.17 };
const FACE: Fur = { fill: '#a89273', outline: '#120d09' };

// The long hind foot, standing flat from the hock to the toes, and the small
// forepaw; each with where its leg comes down onto it.
const FOOT: Foot = { src: footArt, fur: footFurArt, width: 4.42, height: 2.17, heel: { x: 0.62, y: 0.69 } };
const PAW: Foot = { src: pawArt, fur: pawFurArt, width: 1.92, height: 1.17, heel: { x: 0.46, y: 0.35 } };
const HIND_ART: LegArt = {
  bone: legArt, boneFur: legFurArt, knee: true, overFoot: true,
  thigh: { src: haunchArt, fur: haunchFurArt },
  feet: { fore: FOOT, hind: FOOT },
};
const FORE_ART: LegArt = { bone: forelegArt, boneFur: forelegFurArt, knee: true, feet: { fore: PAW, hind: PAW } };
const HIND_WIDTH = 1.9;
const FORE_WIDTH = 1.45;
// Where each leg ends: the hind leg on its heel, as high as the foot under it
// stands; a foreleg's toes on the ledge.
const HEEL = GROUND - (FOOT.height - FOOT.heel.y);
const TOES = GROUND - (PAW.height - PAW.heel.y);

// The legs as a rabbit's: a hind leg's hip in the haunch, its thigh running
// down and forward to the stifle (the knee) at the belly, the shank back
// down to the hock, tapering to its point, and the long hind foot from the
// hock to the toes, flat on the ground when it sits and standing; pushing
// off, the heel peels up over the toes (it walks on its soles and hops on
// its toes). A foreleg's shoulder in the chest, the upper arm back to the
// elbow, the forearm down to the wrist (the carpus), and a short bone to the
// forepaw, which folds back as it swings. The far pair a little apart.
const HIND_LEG = {
  thigh: 3.3, shin: 3.4, bend: 1, fore: false, haunch: 3.2, taper: true, reach: -0.6,
  walksOn: { kind: 'sole', toes: { x: FOOT.width - FOOT.heel.x, y: FOOT.height - FOOT.heel.y }, peel: 62 },
} as const;
const FORE_LEG = { thigh: 2, shin: 2.4, bend: -1, fore: true, haunch: 1.7, reach: 0.3, walksOn: { kind: 'toes', length: 0.8, lean: 6, fold: 60 } } as const;
const LEGS: QuadLeg[] = [
  { ...HIND_LEG, hip: { x: 7.6, y: 11.4 }, far: true },
  { ...FORE_LEG, hip: { x: 15.5, y: 12.2 }, far: true },
  { ...HIND_LEG, hip: { x: 6.4, y: 11.6 }, far: false },
  { ...FORE_LEG, hip: { x: 14.4, y: 12.4 }, far: false },
];

// The slow half-bound (design-docs/easter/README.md): the hind feet land
// together at the start of each hop, the forefeet still down; the forefeet
// lift, the hind feet push off and the rabbit flies, then the forefeet land
// one after the other, the near first, and it gathers its hind feet under it
// for the next. Each hop is one cycle; the rabbit rests between hops where
// the cycle starts, all four feet down.
export const HOP: Gait = {
  stride: 6.4, lift: 1.6, stance: 0.45,
  beats: beatsFor(LEGS, { hind: { near: 0, far: 0 }, fore: { near: 0.6, far: 0.66 } }),
};
// Where in the cycle a hop begins and ends: all four feet down.
export const REST = 0.02;
// How far the body rises through the flight, at most.
const RISE = 0.9;
// One hop's length, on the page.
export const HOP_LENGTH = (HOP.stride / HOP.stance) * SCALE;

export type Pose = 'sit' | 'alert' | 'groom' | 'hop' | 'nudge' | 'thump';
// What the drawing reads of a rabbit: what it is doing, how far it has
// hopped (page pixels), how long it has been doing it, its seed, and
// whether it is fleeing (ears flat, scut up); and the pose it was in, which
// it eases out of over its first EASE ms.
export type RigRabbit = { pose: Pose; walked: number; since: number; seed: number; bolting?: boolean; was?: Pose };
export type RabbitLook = { now: number; gaze: number; still: boolean };

// How far its head turns toward a cursor, and from how far it notices one.
const LOOK = 10;
const LOOK_REACH = 160;

// How far the head would turn toward the cursor (degrees, nose down
// positive), standing at `at` on the page facing dir: in the drawing's own
// frame, so a cursor behind is looked at over the shoulder only a little.
export function gazeAt(dir: 1 | -1, at: Point, cursor: Point | null): number {
  if (!cursor) return 0;
  const eye = { x: at.x + (EYE.x - ANCHOR.x) * SCALE * dir, y: at.y - (ANCHOR.y - EYE.y) * SCALE };
  const dx = (cursor.x - eye.x) * dir, dy = cursor.y - eye.y;
  if (Math.hypot(dx, dy) > LOOK_REACH) return 0;
  return clamp((Math.atan2(dy, Math.max(dx, 12)) * 180) / Math.PI, -LOOK, LOOK);
}

// How the rabbit stands: its body's turn, its head's (positive nose down),
// its ears' (positive back), its tail's (positive up), where its feet go and
// where each is in its step.
type Stance = { body: Turn; head: number; ears: number; tail: number; feet: (hips: readonly Point[]) => Point[]; steps: Step[] };

const fore = (i: number) => LEGS[i].fore;
// The feet as they stand at rest between hops: every pose that is not a hop
// keeps them there, so nothing slides as it stops and sits.
const restSteps = (() => {
  const s = stepping(LEGS, REST * (HOP.stride / HOP.stance), HEEL, HOP);
  const hips = LEGS.map((l) => l.hip);
  return s.feet(hips).map((f, i) => (fore(i) ? { x: f.x, y: TOES } : f));
})();
const resting = () => restSteps;

// How far a forepaw is lifted in its swing, besides the gait's arc: a
// little more all the way, and enough as it tips its toes up to land that
// its heel never dips into the ledge.
function paws(step: Step): number {
  if (step.down) return 0;
  const tip = step.t > 0.75 ? Math.sin((Math.PI * (step.t - 0.75)) / 0.25) : 0;
  return 0.6 * Math.sqrt(Math.sin(Math.PI * step.t)) + 0.2 * tip;
}

// Hopping, this far into its hops (drawing units): the feet stepping by the
// shared gait, the forefeet stood on their toes; the body rising through the
// flight, pitching nose up as it pushes and nose down onto the forefeet;
// the ears back and the scut up in the air.
function hopping(walked: number): Stance {
  const phase = gaitPhase(walked, HOP);
  const p = phase - Math.floor(phase);
  const s = stepping(LEGS, walked, HEEL, HOP);
  const lift = flightLift(phase, HOP, RISE);
  const pitch = -7 * Math.sin(Math.PI * clamp((p - 0.15) / 0.45, 0, 1)) + 8 * Math.sin(Math.PI * clamp((p - 0.55) / 0.4, 0, 1));
  const air = Math.sin(Math.PI * clamp((p - 0.1) / 0.8, 0, 1));
  // Pushed off, the hind legs stay stretched out behind for the first of
  // their swing before they fold and come forward under the body.
  const trail = (step: Step) => (step.down ? 0 : Math.sin(Math.PI * clamp(step.t / 0.6, 0, 1)));
  const foot = (f: Point, i: number): Point => {
    if (fore(i)) return { x: f.x, y: f.y - HEEL + TOES - paws(s.steps[i]) };
    const k = trail(s.steps[i]);
    return { x: f.x - 2.6 * k, y: f.y - 0.8 * k };
  };
  return {
    body: turnAbout(pitch, HIND, 0, -lift - 0.4 * air),
    head: -pitch * 0.6, ears: 26 * air, tail: 24 * air,
    // Set from where the hips stand at rest, not where the pitching body
    // carries them, so a planted foot stays put as the body rocks over it.
    feet: () => s.feet(LEGS.map((l) => l.hip)).map(foot),
    steps: s.steps,
  };
}

const still = (body: Turn, head: number, ears: number, tail: number): Stance => ({ body, head, ears, tail, feet: resting, steps: [] });

// The forepaws off the ledge, each where `at` puts it from its shoulder, the
// hind feet where they rest; and those forepaws folded back at the wrist.
const forepawsAt = (at: (hip: Point) => Point) => (hips: readonly Point[]): Point[] =>
  resting().map((f, i) => (fore(i) ? { x: hips[i].x + at(hips[i]).x, y: hips[i].y + at(hips[i]).y } : f));
const LIFTED: Step[] = LEGS.map((l) => (l.fore ? { down: false, t: 0.4 } : { down: true, t: 0 }));
// Where its forepaws wash: just under the nose.
const MUZZLE = { x: 19.6, y: 9.6 };

// Sitting: the rump down on its heels, the back curved, the chest up.
const SIT = still(turnAbout(-20, HIND, 0.4, 1.7), 18, 6, -6);

function stance(rabbit: RigRabbit, look: RabbitLook): Stance {
  if (look.still) return SIT;
  const walked = rabbit.walked / SCALE;
  const nose = snuffle(rabbit.seed, look.now);
  switch (rabbit.pose) {
    case 'hop': {
      const hop = hopping(walked);
      return rabbit.bolting ? { ...hop, ears: 30, tail: 26 } : hop;
    }
    case 'alert': {
      // Sat up on its haunches, ears pricked, nose still, the forepaws
      // lifted off the ledge and held to its chest.
      const body = turnAbout(-30, HIND, 0.6, 1.4);
      return { ...still(body, 24, -4, -8), feet: forepawsAt(() => ({ x: 0.5, y: 2.7 })), steps: LIFTED };
    }
    case 'groom': {
      // Sat up, washing its face: both forepaws at the muzzle, stroking up
      // over it as the head bobs down to them.
      const stroke = Math.sin((Math.PI * rabbit.since) / 450) ** 2;
      const body = turnAbout(-24, HIND, 0.6, 1.4);
      const head = 22 + 10 * stroke;
      const muzzle = turned(body, turned(turnAbout(head, NECK), MUZZLE));
      return { ...still(body, head, 10, 0), feet: forepawsAt((hip) => ({ x: muzzle.x - hip.x - 0.4, y: muzzle.y - hip.y + 0.6 - 0.8 * stroke })), steps: LIFTED };
    }
    case 'nudge': {
      // Head down to the ledge, nose pushing the egg along, rump up.
      const push = Math.max(0, Math.sin((Math.PI * rabbit.since) / 300));
      return still(turnAbout(20, HIND, 0.5 * push, -1.2), 52, 2, -4);
    }
    case 'thump': {
      // Crouched and tense, ears up, the hind feet stamping.
      return still(turnAbout(4, HIND, 0, 0.6), 4, -6, 18);
    }
    default:
      return { ...SIT, head: SIT.head + nose * 0.8 + look.gaze, ears: SIT.ears + 3 * Math.sin(look.now / 900 + rabbit.seed) };
  }
}

// The thump lifts both hind heels and slams them down, twice.
function stamping(rabbit: RigRabbit): Step[] {
  if (rabbit.pose !== 'thump') return [];
  const t = (rabbit.since % 250) / 250;
  const up = t < 0.6 ? { down: true, t: 0.6 + 0.4 * (t / 0.6) } : { down: true, t: 0 };
  return LEGS.map((l) => (l.fore ? { down: true, t: 0 } : up));
}

// The legs of one side, outlined or as fur alone, hind and fore each with
// their own art.
function sideLegs(legs: readonly DrawnLeg[], far: boolean, fur: boolean): Layer[] {
  const of = (isFore: boolean) => legs.filter((d, i) => LEGS[i].far === far && d.fore === isFore);
  const name = far ? 'far legs' : 'near legs';
  return [
    { kind: 'legs', name: `${name}, hind`, legs: of(false), art: HIND_ART, width: HIND_WIDTH, far, fur },
    { kind: 'legs', name: `${name}, fore`, legs: of(true), art: FORE_ART, width: FORE_WIDTH, far, fur },
  ];
}

// From one pose into the next: the body, head, ears and tail turn, and the
// feet move, smoothly over EASE ms, so nothing snaps. The feet every pose
// plants are the same, so none slides.
const EASE = 260;
function eased(rabbit: RigRabbit, look: RabbitLook): Stance {
  const next = stance(rabbit, look);
  if (look.still || !rabbit.was || rabbit.was === rabbit.pose || rabbit.since >= EASE) return next;
  const before = stance({ ...rabbit, pose: rabbit.was }, look);
  const k = clamp(rabbit.since / EASE, 0, 1);
  const f = k * k * (3 - 2 * k);
  const mix = (a: number, b: number) => a + (b - a) * f;
  const turn = { angle: mix(before.body.angle, next.body.angle), pivot: next.body.pivot, dx: mix(before.body.dx, next.body.dx), dy: mix(before.body.dy, next.body.dy) };
  const feet = (hips: readonly Point[]) => {
    const from = before.feet(hips), to = next.feet(hips);
    return to.map((p, i) => ({ x: mix(from[i].x, p.x), y: mix(from[i].y, p.y) }));
  };
  const steps = LEGS.map((l, i) => (l.fore ? foldBetween(before.steps[i], next.steps[i], f) : next.steps[i] ?? before.steps[i]));
  return { body: turn, head: mix(before.head, next.head), ears: mix(before.ears, next.ears), tail: mix(before.tail, next.tail), feet, steps };
}

// A forepaw's fold part way from one step to another: the step whose fold
// (gait.ts's flexion) is that mix of the two, so a paw lifting off the
// ledge folds as it rises rather than all at once at the ledge: late as it
// lifts, early as it comes down, so its toes never dip into the ledge.
function foldBetween(a: Step | undefined, b: Step | undefined, f: number): Step {
  const folded = (s?: Step) => (!s || s.down ? 0 : s.t < 0.75 ? Math.sin((Math.PI * s.t) / 0.75) : 0);
  const g = folded(b) > folded(a) ? f * f : 1 - (1 - f) * (1 - f);
  const k = clamp(folded(a) + (folded(b) - folded(a)) * g, 0, 1);
  return k === 0 ? { down: true, t: 0 } : { down: false, t: (0.75 * Math.asin(k)) / Math.PI };
}

export function rabbitRig(rabbit: RigRabbit, look: RabbitLook): RigPose {
  const { body, head: angle, ears, tail, feet, steps } = eased(rabbit, look);
  const hips = LEGS.map((s) => turned(body, s.hip));
  const stamp = look.still ? [] : stamping(rabbit);
  const limbs = legsTo(LEGS, hips, feet(hips), stamp.length ? stamp : steps);
  const legs: DrawnLeg[] = limbs.map((limb, i) => ({ limb, haunch: LEGS[i].haunch ?? HIND_WIDTH, fore: LEGS[i].fore, taper: !!LEGS[i].taper }));
  const nod = turnAbout(angle, NECK);
  const shut = !look.still && blinking(rabbit.seed, look.now);
  const headLayers: Layer = {
    kind: 'group', turn: nod,
    layers: [
      { kind: 'group', turn: turnAbout(-ears, EAR_BASE), layers: [{ kind: 'image', name: 'ears', src: earsArt, ...EARS }] },
      { kind: 'image', name: 'head', src: headArt, ...HEAD },
      ...lidLayers(shut, EYE, 0.8, FACE),
    ],
  };
  const torso: Layer = {
    kind: 'group', turn: body,
    layers: [
      { kind: 'group', turn: turnAbout(tail, TAIL_ROOT), layers: [{ kind: 'image', name: 'tail', src: tailArt, ...TAIL }] },
      { kind: 'image', name: 'body', src: bodyArt, ...BODY },
      headLayers,
    ],
  };
  return {
    ...FRAME,
    // The far legs behind the body, outlined then as fur; the near legs
    // outlined behind it too, their fur then over its edge, so they grow out
    // of it with no line across.
    layers: [...sideLegs(legs, true, false), ...sideLegs(legs, true, true), ...sideLegs(legs, false, false), torso, ...sideLegs(legs, false, true)],
    guides: [
      { name: 'stands here', at: ANCHOR }, { name: 'tail root', at: turned(body, TAIL_ROOT) }, { name: 'neck', at: turned(body, NECK) },
      { name: 'ear base', at: turned(body, turned(nod, EAR_BASE)) },
      { name: 'eye', at: turned(body, turned(nod, EYE)) }, { name: 'nose', at: turned(body, turned(nod, NOSE)) },
      ...hips.map((at, i) => ({ name: LEGS[i].fore ? 'shoulder' : 'hip', at })),
      ...limbs.flatMap((l, i) => (LEGS[i].fore
        ? [{ name: 'elbow', at: l.knee }, { name: 'wrist (carpus)', at: l.ankle }, { name: 'forepaw', at: l.foot }]
        : [{ name: 'stifle (knee)', at: l.knee }, { name: 'hock (heel)', at: l.ankle }])),
    ],
  };
}
