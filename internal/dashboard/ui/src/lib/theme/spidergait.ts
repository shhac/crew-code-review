// How a walking spider's legs move. Pure geometry, in the sprite's own
// coordinates (x right, y down, facing right), so it can be tested without a
// page and drawn at any scale.
//
// Each foot spends most of its cycle planted while the body moves over it,
// then lifts and swings forward to its next hold. The cycle is driven by
// distance walked, not by time: a planted foot stays exactly where it was put
// on the floor, however fast or slow the spider is going, and a spider that
// stops stops mid-step instead of treading air.

export type Point = { x: number; y: number };
export type LegSpec = {
  hip: Point;
  // Where the foot rests, relative to the hip, mid-stride.
  reach: number;
  thigh: number;
  shin: number;
  // When in the cycle the leg steps, 0 to 1: a spider's alternate legs share
  // a beat, so it always stands on half its feet.
  beat: number;
};
export type Leg = { hip: Point; knee: Point; foot: Point };

// The share of each cycle a foot spends planted.
const STANCE = 0.65;

// Ground covered per full cycle when each foot sweeps `stride` while planted.
export const cycleLength = (stride: number, stance = STANCE) => stride / stance;

const fract = (n: number) => n - Math.floor(n);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// `p` turned `angle` degrees about `pivot` (clockwise on the page, y down).
export function rotate(p: Point, pivot: Point, angle: number): Point {
  const a = (angle * Math.PI) / 180;
  const x = p.x - pivot.x, y = p.y - pivot.y;
  return { x: pivot.x + x * Math.cos(a) - y * Math.sin(a), y: pivot.y + x * Math.sin(a) + y * Math.cos(a) };
}

// Where a foot is in its step: down, 0 setting down to 1 lifting off, or
// swinging, 0 lifting off to 1 landing. Everything a step moves (where the
// foot is, how a paw folds or a sole rolls) reads this one reckoning, so
// they can never fall out of step with each other.
export type Step = { down: boolean; t: number };
export function stepAt(phase: number, beat: number, stance = STANCE): Step {
  const p = fract(phase + beat);
  return p < stance ? { down: true, t: p / stance } : { down: false, t: (p - stance) / (1 - stance) };
}

// Where a foot resting at `rest` is in its step: planted and sliding back
// under the body, or lifted and swinging forward over a low arc.
export function footOf(rest: number, step: Step, ground: number, stride: number, lift: number): Point {
  if (step.down) return { x: rest + stride * (0.5 - step.t), y: ground };
  return { x: rest + stride * (step.t - 0.5), y: ground - Math.sin(Math.PI * step.t) * lift };
}

// Where the foot is at this point in its cycle.
export const footAt = (spec: LegSpec, phase: number, ground: number, stride: number, lift: number, stance = STANCE): Point =>
  footOf(spec.hip.x + spec.reach, stepAt(phase, spec.beat, stance), ground, stride, lift);

// The two knees that join a thigh at the hip to a shin at the foot. A foot
// out of reach straightens the leg toward it rather than tearing it off.
function knees(hip: Point, foot: Point, thigh: number, shin: number): [Point, Point] {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  // Clamped both ways: a foot out of reach straightens the leg, and a foot
  // pulled in onto its own hip (as a tuck can) still leaves a solvable fold.
  const d = clamp(Math.hypot(dx, dy), Math.abs(thigh - shin) + 1e-3, thigh + shin - 1e-6);
  const toFoot = Math.atan2(dy, dx);
  const bend = Math.acos(clamp((thigh * thigh + d * d - shin * shin) / (2 * thigh * d), -1, 1));
  const at = (a: number) => ({ x: hip.x + thigh * Math.cos(a), y: hip.y + thigh * Math.sin(a) });
  return [at(toFoot - bend), at(toFoot + bend)];
}

// Of the two knees, the higher: spider knees arch up over the body.
export function kneeFor(hip: Point, foot: Point, thigh: number, shin: number): Point {
  const [a, b] = knees(hip, foot, thigh, shin);
  return a.y <= b.y ? a : b;
}

// Of the two knees, the one further toward side (1 forward, -1 back): a
// four-legged animal's fore knees bend forward and its hocks back.
export function kneeToward(hip: Point, foot: Point, thigh: number, shin: number, side: 1 | -1): Point {
  const [a, b] = knees(hip, foot, thigh, shin);
  return (a.x - b.x) * side >= 0 ? a : b;
}

// The leg standing at rest, mid-stride with the foot down: the pose to make
// per-leg decisions from that must not change as the leg moves.
export function restingLeg(spec: LegSpec, ground: number): Leg {
  const foot = { x: spec.hip.x + spec.reach, y: ground };
  return { hip: spec.hip, knee: kneeFor(spec.hip, foot, spec.thigh, spec.shin), foot };
}

// A spider gathering itself to jump: hips sink toward the floor while the
// feet stay planted, so the knees fold higher.
export function crouched(specs: LegSpec[], depth: number): LegSpec[] {
  return specs.map((s) => ({ ...s, hip: { x: s.hip.x, y: s.hip.y + depth } }));
}

// Legs drawn in under the body, as in the air mid-jump: each foot moves
// toward a point just below and inside its hip, by `amount` (0 to 1).
export function tucked(legs: Leg[], specs: LegSpec[], amount: number): Leg[] {
  if (amount <= 0) return legs;
  return legs.map((leg, i) => {
    const spec = specs[i];
    const under = { x: leg.hip.x + spec.reach * 0.4, y: leg.hip.y + spec.shin * 0.45 };
    const foot = { x: leg.foot.x + (under.x - leg.foot.x) * amount, y: leg.foot.y + (under.y - leg.foot.y) * amount };
    return { hip: leg.hip, knee: kneeFor(leg.hip, foot, spec.thigh, spec.shin), foot };
  });
}

export function legsAt(specs: LegSpec[], phase: number, ground: number, stride: number, lift: number): Leg[] {
  return specs.map((spec) => {
    const foot = footAt(spec, phase, ground, stride, lift);
    return { hip: spec.hip, knee: kneeFor(spec.hip, foot, spec.thigh, spec.shin), foot };
  });
}
