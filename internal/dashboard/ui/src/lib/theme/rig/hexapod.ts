import { mix, mixPoint, rad } from '../math';
import type { Point } from '../pointer';
import { legsTo, restingFeet, stepping, type Gait, type Limb, type QuadLeg, type Step } from './gait';
import type { Layer } from './rig';

// An insect's six legs, drawn in code. All six come from the thorax, a pair
// on each of its segments: fore, mid and hind. Each runs coxa (its socket,
// hidden in the fur, the leg's root here), trochanter (too small to show),
// femur, the knee, tibia, the tibiotarsal joint, then the tarsus out to the
// claws. At page size a leg is a pixel thick or less, so it is drawn as
// strokes rather than leg art, which would blur away: crisp, any colour.
//
// The stepping is the spider's and the quadrupeds' (spidergait.ts through
// gait.ts): driven by distance walked, so a planted foot never slides. A
// leg is posed as a toe walker's is, the tarsus standing in for the bone up
// from the toes, so its lean and its curl through a swing come for free.

export type Pair = 'fore' | 'mid' | 'hind';
export type InsectLeg = {
  pair: Pair;
  // The far side's leg, seen past the body, drawn behind it and darker.
  far: boolean;
  // The coxa's socket on the thorax's underside, in the drawing's own
  // coordinates (facing right, y down).
  hip: Point;
  femur: number;
  tibia: number;
  tarsus: number;
  // How far ahead of the hip (behind, negative) the claws stand.
  reach: number;
  // Which way the knee points: forward (1), as on a leg reaching forward, or
  // back (-1), as on a hind leg reaching back. Insect knees ride high, on
  // the side away from the body.
  bend: 1 | -1;
  // How far the tarsus lies from straight down at rest, degrees, its claws
  // ahead of the joint above (positive) or behind it (negative); and how far
  // it curls back as the leg swings.
  lean: number;
  curl: number;
};

// The leg as the shared stepping knows a leg.
export const asQuad = (leg: InsectLeg): QuadLeg => ({
  hip: leg.hip, reach: leg.reach, thigh: leg.femur, shin: leg.tibia, fore: leg.pair === 'fore', bend: leg.bend, far: leg.far,
  walksOn: { kind: 'toes', length: leg.tarsus, lean: leg.lean, fold: leg.curl },
});

// Insects walk with their legs in two alternating tripods (the fore and hind
// legs of one side with the middle leg of the other, three feet always down)
// at speed; slower, a tetrapod, diagonal pairs stepping in turn with four
// feet down; slowest, a wave running from the hind leg forward up each side,
// one leg off at a time (Wilson 1966; Drosophila across speeds, J. Exp.
// Biol. 2018).
export type InsectGait = 'tripod' | 'tetrapod' | 'wave';

// Each gait's share of the cycle a foot is down, and when in the cycle (0
// to 1) each leg lifts off, by its side and pair.
const GAITS: Record<InsectGait, { stance: number; lifts: Record<'near' | 'far', Record<Pair, number>> }> = {
  tripod: { stance: 0.55, lifts: { near: { fore: 0, mid: 0.5, hind: 0 }, far: { fore: 0.5, mid: 0, hind: 0.5 } } },
  tetrapod: { stance: 2 / 3, lifts: { near: { hind: 0, mid: 1 / 3, fore: 2 / 3 }, far: { hind: 1 / 3, mid: 2 / 3, fore: 0 } } },
  wave: { stance: 5 / 6, lifts: { near: { hind: 0, mid: 1 / 6, fore: 2 / 6 }, far: { hind: 3 / 6, mid: 4 / 6, fore: 5 / 6 } } },
};

const fract = (n: number) => n - Math.floor(n);

// The gait for these legs, in their order: how far each foot moves while
// down (stride) and how high it lifts. A leg lifting off at `t` in the cycle
// has the beat stepAt reads as stance - t.
export function insectGait(legs: readonly InsectLeg[], kind: InsectGait, stride: number, lift: number): Gait {
  const { stance, lifts } = GAITS[kind];
  const beats = legs.map((leg) => fract(stance - lifts[leg.far ? 'far' : 'near'][leg.pair]));
  return { stride, lift, stance, beats };
}

// Walking this far: the legs posed from hips the body has moved, their
// feet stepping on the ground line.
export function walkingLegs(legs: readonly InsectLeg[], hips: readonly Point[], walked: number, ground: number, gait: Gait): Limb[] {
  const quads = legs.map(asQuad);
  const { feet, steps } = stepping(quads, walked, ground, gait);
  return legsTo(quads, hips, feet(hips), steps);
}

// Stood still, every foot down at its reach.
export function standingLegs(legs: readonly InsectLeg[], hips: readonly Point[], ground: number): Limb[] {
  const quads = legs.map(asQuad);
  return legsTo(quads, hips, restingFeet(quads, hips, ground));
}

// How the legs are held off the ground: `hang` from drawn up under the body
// (0, flying fast; the hind pair trailing straight back) to hanging below it
// (1, hovering; the fore legs forward, the hind pair trailing down), and
// `reach` toward stretched down and forward to meet a surface (1), as a
// bee's are in the last 60 to 70ms before it lands (from photographs and
// the landing studies; no measured posture turned up). `pitch` is the
// body's turn (degrees): legs drawn up turn with it, hanging and reaching
// ones only partly, as they hang.
export type AirHold = { hang: number; reach: number; pitch: number };

// Each hold, per pair: where the tibia's end (the ankle) is from the hip,
// as an angle from straight down (degrees, positive forward) and a share
// of femur and tibia together; how far the tarsus leans from straight down;
// and how much of the body's pitch the leg turns with.
type Held = { angle: number; out: number; lean: number; turns: number };
const HOLDS: Record<'tucked' | 'hanging' | 'reaching', Record<Pair, Held>> = {
  tucked: {
    fore: { angle: 48, out: 0.8, lean: 55, turns: 1 },
    mid: { angle: -28, out: 0.72, lean: -40, turns: 1 },
    hind: { angle: -68, out: 0.88, lean: -78, turns: 1 },
  },
  hanging: {
    fore: { angle: 28, out: 0.9, lean: 22, turns: 0.4 },
    mid: { angle: -6, out: 0.92, lean: -4, turns: 0.4 },
    hind: { angle: -32, out: 0.92, lean: -34, turns: 0.4 },
  },
  reaching: {
    fore: { angle: 38, out: 0.97, lean: 45, turns: 0.3 },
    mid: { angle: 12, out: 0.97, lean: 30, turns: 0.3 },
    hind: { angle: -22, out: 0.97, lean: -30, turns: 0.3 },
  },
};

const blend = (a: Held, b: Held, t: number): Held =>
  ({ angle: mix(a.angle, b.angle, t), out: mix(a.out, b.out, t), lean: mix(a.lean, b.lean, t), turns: mix(a.turns, b.turns, t) });

// The legs posed in the air.
export function airLegs(legs: readonly InsectLeg[], hips: readonly Point[], hold: AirHold): Limb[] {
  const helds = legs.map((leg) => blend(blend(HOLDS.tucked[leg.pair], HOLDS.hanging[leg.pair], hold.hang), HOLDS.reaching[leg.pair], hold.reach));
  // Angles from straight down turn the other way to the page's: a nose-up
  // pitch (negative) swings a leg's end forward.
  const specs = legs.map((leg, i): QuadLeg => ({ ...asQuad(leg), walksOn: { kind: 'toes', length: leg.tarsus, lean: helds[i].lean - hold.pitch * helds[i].turns, fold: 0 } }));
  const feet = legs.map((leg, i) => {
    const h = helds[i];
    const down = rad(h.angle - hold.pitch * h.turns);
    const lean = rad(h.lean - hold.pitch * h.turns);
    const length = h.out * (leg.femur + leg.tibia);
    const ankle = { x: hips[i].x + length * Math.sin(down), y: hips[i].y + length * Math.cos(down) };
    return { x: ankle.x + leg.tarsus * Math.sin(lean), y: ankle.y + leg.tarsus * Math.cos(lean) };
  });
  return legsTo(specs, hips, feet);
}

// How a leg is drawn: each bone's thickness (femur, tibia, tarsus), the dark
// outline round them, the near and far sides' colours for each bone, and
// how long the claws' hook is.
export type LegLook = {
  widths: readonly [number, number, number];
  outline: number;
  ink: string;
  near: readonly [string, string, string];
  far: readonly [string, string, string];
  claw: number;
};

// A leg's bones, root to claws, and the claws' hook: on from the tarsus,
// then bent down to grip.
export function bonesOf(limb: Limb, claw: number): [Point[], Point[], Point[], Point[]] {
  const { hip, knee, ankle, foot } = limb;
  const along = Math.atan2(foot.y - ankle.y, foot.x - ankle.x);
  const tip = { x: foot.x + claw * 0.6 * Math.cos(along), y: foot.y + claw * 0.6 * Math.sin(along) };
  const hook = along + rad(Math.cos(along) >= 0 ? 70 : -70);
  return [[hip, knee], [knee, ankle], [ankle, foot], [foot, tip, { x: tip.x + claw * 0.5 * Math.cos(hook), y: tip.y + claw * 0.5 * Math.sin(hook) }]];
}

// One side's legs as strokes: every outline first, then every bone's colour
// over them, so outlines show only round the legs' silhouettes and never
// across a joint. Named for the lab, which shows and hides each side.
function side(limbs: readonly Limb[], look: LegLook, far: boolean): Layer[] {
  const name = far ? 'far legs' : 'near legs';
  const colours = far ? look.far : look.near;
  const widths = [...look.widths, look.widths[2] * 0.8];
  const bones = limbs.map((limb) => bonesOf(limb, look.claw));
  const outlines = bones.flatMap((leg) => leg.map((points, b): Layer => ({ kind: 'stroke', name, points, width: widths[b] + 2 * look.outline, colour: look.ink })));
  const fills = bones.flatMap((leg) => leg.map((points, b): Layer => ({ kind: 'stroke', name, points, width: widths[b], colour: colours[Math.min(b, 2)] })));
  return [...outlines, ...fills];
}

// The legs as layers: the far side's, to go behind the body, and the near
// side's, to go over its edge so they grow out of it.
export function legLayers(legs: readonly InsectLeg[], limbs: readonly Limb[], look: LegLook): { far: Layer[]; near: Layer[] } {
  const of = (far: boolean) => limbs.filter((_, i) => legs[i].far === far);
  return { far: side(of(true), look, true), near: side(of(false), look, false) };
}

// A rounded shape laid along a bone, `at` (0 to 1) along it, `length` long
// and `width` across: a bumblebee's pollen basket on its hind tibia, packed
// with a load.
export function podAlong(from: Point, to: Point, at: number, length: number, width: number): Point[] {
  const centre = mixPoint(from, to, at);
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  return Array.from({ length: 16 }, (_, i) => {
    const t = (2 * Math.PI * i) / 16;
    const u = (length / 2) * Math.cos(t), v = (width / 2) * Math.sin(t);
    return { x: centre.x + u * Math.cos(a) - v * Math.sin(a), y: centre.y + u * Math.sin(a) + v * Math.cos(a) };
  });
}

export type { Limb, Step };
