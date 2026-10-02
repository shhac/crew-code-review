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
  // Which half of the gait the leg steps in: alternate legs share a beat, so
  // the spider always stands on half its feet.
  beat: 0 | 0.5;
};
export type Leg = { hip: Point; knee: Point; foot: Point };

// The share of each cycle a foot spends planted.
const STANCE = 0.65;

// Ground covered per full cycle when each foot sweeps `stride` while planted.
export const cycleLength = (stride: number) => stride / STANCE;

const fract = (n: number) => n - Math.floor(n);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Where the foot is at this point in its cycle: planted and sliding back
// under the body, or lifted and swinging forward over a low arc.
export function footAt(spec: LegSpec, phase: number, ground: number, stride: number, lift: number): Point {
  const p = fract(phase + spec.beat);
  const rest = spec.hip.x + spec.reach;
  if (p < STANCE) return { x: rest + stride * (0.5 - p / STANCE), y: ground };
  const t = (p - STANCE) / (1 - STANCE);
  return { x: rest + stride * (t - 0.5), y: ground - Math.sin(Math.PI * t) * lift };
}

// The knee that joins a thigh at the hip to a shin at the foot. Of the two
// that fit, the higher: spider knees arch up over the body. A foot out of
// reach straightens the leg toward it rather than tearing it off.
export function kneeFor(hip: Point, foot: Point, thigh: number, shin: number): Point {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  // Clamped both ways: a foot out of reach straightens the leg, and a foot
  // pulled in onto its own hip (as a tuck can) still leaves a solvable fold.
  const d = clamp(Math.hypot(dx, dy), Math.abs(thigh - shin) + 1e-3, thigh + shin - 1e-6);
  const toFoot = Math.atan2(dy, dx);
  const bend = Math.acos(clamp((thigh * thigh + d * d - shin * shin) / (2 * thigh * d), -1, 1));
  const knees = [toFoot - bend, toFoot + bend].map((a) => ({ x: hip.x + thigh * Math.cos(a), y: hip.y + thigh * Math.sin(a) }));
  return knees[0].y <= knees[1].y ? knees[0] : knees[1];
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
