// A leg bent at relative hinges: each joint's turn is against the bone
// above it, the knee's within its limits, and what hangs below the shin
// (the bone up from the toes, or the paw itself) turned from the shin by
// the paw's hinge. The ground is a pin on the toes with a weight: planted
// (1), the toes stay where they are put and the bone up from them stands
// at its lean, as gait.ts's legsTo stood it; free (0), the paw hangs from
// its wrist at its hinge's rest, folded as far as its step or its pose
// folds it, and its toes at their own free turn from it. Between, as a paw lifts and lands, the two answers mix in
// relative angles, so a lifted paw never needs a step it is not taking to
// fold it, and a planted one never slides.
import { clamp, degrees, rad, smooth } from '../../math';
import type { Point } from '../../pointer';
import { rotate } from '../../spidergait';
import { flexion, liftedBy, roll, type Limb, type Step, type Toes } from '../gait';
import { jointBeside } from '../limb';
import type { Goal, HingedLeg, Limits } from './types';

const dir = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));
const along = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.cos(rad(deg)) * length, y: from.y + Math.sin(rad(deg)) * length });
// A turn brought into (-180, 180].
export const wrap = (deg: number) => deg - 360 * Math.ceil((deg - 180) / 360);

// A knee with no limits of its own may still not bend the wrong way.
export const STRAIGHT: Limits = { min: 0, max: 180 };

// How far the knee is bent, its interior angle (180 straight), bent to
// `side`: past straight it is more than 180, the wrong way.
export function kneeAngle(limb: Limb, side: 1 | -1): number {
  const bent = side * wrap(dir(limb.knee, limb.ankle) - dir(limb.knee, limb.hip));
  return bent < 0 ? bent + 360 : bent;
}
// How far what hangs below the shin is turned from it: the bone up from the
// toes, or the paw.
export const pawAngle = (limb: Limb, toes: boolean) => wrap((toes ? dir(limb.ankle, limb.foot) : limb.paw) - dir(limb.knee, limb.ankle));

// How far a foot is its own free self through its step: as it is off the
// ground (gait.ts's liftedBy); a sole, which roll lays flat again by 0.8
// of its swing to land, back on its planted answer by then.
const freed = (step: Step | undefined, sole: boolean) => {
  if (!sole) return liftedBy(step);
  return !step || step.down ? 0 : smooth(step.t / 0.2) * smooth((0.8 - step.t) / 0.15);
};

// How firmly a goal pins the toes, and how far through its fold the paw is.
export function held(goal: Extract<Goal, { kind: 'plant' | 'reach' }>, sole = false): { contact: number; fold: number } {
  return { contact: clamp(goal.contact ?? (goal.kind === 'reach' ? 0 : 1 - freed(goal.step, sole)), 0, 1), fold: goal.fold ?? flexion(goal.step) };
}

const within = (hinge: { rest: number; limits: Limits }, turn: number) => clamp(turn, hinge.rest + hinge.limits.min, hinge.rest + hinge.limits.max);

// Planted on its toes: where the toes are pinned (the reach clamped to what
// the leg can span) and the ankle, the bone up from the toes at its lean;
// for a knee with limits, as near its lean as they let it, in the one
// sector behind the toes (gait.ts's hingedToes, its foot down); and for a
// wrist or hock that bears only so much turn from the shin (its paw's
// `planted`), as near its lean as that lets it too, so a forearm lying
// along the ground brings the paw down flat with it rather than kinking
// the wrist.
function pinned(leg: HingedLeg, side: 1 | -1, hip: Point, target: Point, on: Toes): { ankle: Point; foot: Point } {
  const { thigh: a, shin: b, knee } = leg;
  const c = on.length;
  const bears = leg.paw.planted;
  if (!knee && !bears) return { ankle: { x: target.x - c * Math.sin(rad(on.lean)), y: target.y - c * Math.cos(rad(on.lean)) }, foot: target };
  const spanAt = (angle: number) => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad(angle)));
  const [upperMin, upperMax] = knee ? [spanAt(knee.min), spanAt(knee.max)] : [Math.abs(a - b), a + b];
  const minimum = knee ? Math.max(0, upperMin - c, c - upperMax) + 1e-4 : 0;
  const maximum = knee ? upperMax + c - 1e-4 : Infinity;
  const dx = target.x - hip.x, dy = target.y - hip.y;
  const reach = clamp(Math.hypot(dx, dy), minimum, maximum);
  const direction = Math.atan2(dx, dy);
  const foot = knee ? { x: hip.x + reach * Math.sin(direction), y: hip.y + reach * Math.cos(direction) } : target;
  const opening = (length: number) => Math.acos(clamp((reach * reach + c * c - length * length) / (2 * reach * c), -1, 1));
  const desired = rad(on.lean);
  const lean = Math.atan2(Math.sin(desired - direction), Math.cos(desired - direction));
  const [low, high] = knee ? [opening(upperMin), opening(upperMax)] : [lean - Math.PI / 2, lean + Math.PI / 2];
  const ankleAt = (off: number) => ({ x: foot.x - c * Math.sin(direction + off), y: foot.y - c * Math.cos(direction + off) });
  const off = knee ? clamp(lean, low, high) : lean;
  if (!bears) return { ankle: ankleAt(off), foot };
  const rest = leg.paw.rest ?? 0;
  const turn = (o: number) => {
    const ankle = ankleAt(o);
    return wrap(dir(ankle, foot) - dir(jointBeside(hip, ankle, a, b, side), ankle));
  };
  const over = (o: number) => {
    const t = turn(o);
    return Math.max(rest + bears.min - t, t - rest - bears.max, 0);
  };
  if (!over(off)) return { ankle: ankleAt(off), foot };
  // The nearest lean it bears, found on a fine sweep of those the knee
  // allows and closed in on toward its own; where none is borne, the one
  // that comes nearest.
  const sweep = Array.from({ length: BEARING_SWEEP + 1 }, (_, i) => low + ((high - low) * i) / BEARING_SWEEP);
  const borne = sweep.filter((o) => !over(o));
  if (!borne.length) return { ankle: ankleAt(sweep.reduce((best, o) => (over(o) < over(best) ? o : best))), foot };
  const nearest = borne.reduce((best, o) => (Math.abs(o - off) < Math.abs(best - off) ? o : best));
  const [edge] = Array.from({ length: 30 }).reduce<[number, number]>(([inside, outside]) => {
    const middle = (inside + outside) / 2;
    return over(middle) ? [inside, middle] : [middle, outside];
  }, [nearest, off]);
  return { ankle: ankleAt(edge), foot };
}
const BEARING_SWEEP = 96;

// The leg from its hip to its toes with the bone up from them turned `turn`
// from the shin: the shin and that bone one rigid bone from the knee to
// the toes, so jointBeside sets the knee, and the ankle is read back. A
// target out of reach, or one only reached by bending the knee past its
// limits, is moved toward or away from the hip until it is reached.
function bentTo(leg: HingedLeg, side: 1 | -1, hip: Point, target: Point, turn: number, c: number): Omit<Limb, 'paw'> {
  const { thigh: a, shin: b } = leg;
  const rigid = { x: b + c * Math.cos(rad(turn)), y: c * Math.sin(rad(turn)) };
  const span = Math.hypot(rigid.x, rigid.y);
  const shinOff = degrees(Math.atan2(rigid.y, rigid.x));
  // As spidergait.ts's knees clamps it, so the knee it finds is on the
  // foot's circle.
  const reachable = (d: number) => clamp(d, Math.abs(a - span) + 1e-3, a + span - 1e-6);
  const distance = Math.hypot(target.x - hip.x, target.y - hip.y);
  const posed = (d: number) => {
    const foot = d === distance ? target : along(hip, dir(hip, target), d);
    const knee = jointBeside(hip, foot, a, span, side);
    return { hip, knee, ankle: along(knee, dir(knee, foot) - shinOff, b), foot };
  };
  // The angle at the knee between the hip and the toes, less the rigid
  // bone's offset from the shin (which a fixed turn keeps), is the knee's
  // own angle.
  const opening = (d: number) => degrees(Math.acos(clamp((a * a + span * span - d * d) / (2 * a * span), -1, 1)));
  const d = reachable(distance);
  const limits = leg.knee ?? STRAIGHT;
  const bent = opening(d) - side * shinOff;
  if (bent >= limits.min && bent <= limits.max) return posed(d);
  const meets = rad(clamp(clamp(bent, limits.min, limits.max) + side * shinOff, 0, 180));
  return posed(reachable(Math.sqrt(a * a + span * span - 2 * a * span * Math.cos(meets))));
}

// Part way from one pose of the leg to another, `by` of the way, in the
// turns of its bones, each from the one above, and in their lengths (a
// planted foot out of reach stretches the bone above its ankle, as legsTo
// has always stretched it).
function between(from: Omit<Limb, 'paw'>, to: Omit<Limb, 'paw'>, by: number): Omit<Limb, 'paw'> {
  const shape = (l: Omit<Limb, 'paw'>) => {
    const [thigh, shin, toes] = [dir(l.hip, l.knee), dir(l.knee, l.ankle), dir(l.ankle, l.foot)];
    const long = (p: Point, q: Point) => Math.hypot(q.x - p.x, q.y - p.y);
    return { turns: [thigh, wrap(shin - thigh), wrap(toes - shin)], lengths: [long(l.hip, l.knee), long(l.knee, l.ankle), long(l.ankle, l.foot)] };
  };
  const [a, b] = [shape(from), shape(to)];
  const [thigh, knee, paw] = a.turns.map((t, i) => t + wrap(b.turns[i] - t) * by);
  const [upper, lower, toes] = a.lengths.map((l, i) => l + (b.lengths[i] - l) * by);
  const kneeAt = along(from.hip, thigh, upper);
  const ankle = along(kneeAt, thigh + knee, lower);
  return { hip: from.hip, knee: kneeAt, ankle, foot: along(ankle, thigh + knee + paw, toes) };
}

// Its toes turned from the bone up to them by as much as it hangs free:
// flat on the ground, planted; free, `digits`. The toes are the last of
// the paw to leave the ground and the first to meet it, so they keep their
// planted turn `standing` until the paw is well clear.
function hung(limb: Omit<Limb, 'paw'>, free: number, digits: number, standing: number): Limb {
  const turn = standing + (digits - standing) * free * free;
  return { ...limb, paw: free * wrap(dir(limb.ankle, limb.foot) + turn) };
}

// Its paw's rest where none is given: its turn from the shin as the leg
// stands at rest, `reach` ahead of `hip` down on `ground`.
export function restingPaw(leg: Omit<HingedLeg, 'paw'>, hip: Point, ground: number): number {
  const foot = { x: hip.x + leg.reach, y: ground };
  const on = leg.walksOn;
  if (!on) throw new Error('hinge: a leg with nothing to stand on needs its paw\'s rest');
  if (on.kind === 'sole') return wrap(-dir(jointBeside(hip, foot, leg.thigh, leg.shin, leg.side), foot));
  const pin = pinned({ ...leg, paw: { rest: 0, limits: STRAIGHT } }, leg.side, hip, foot, on);
  return wrap(dir(pin.ankle, pin.foot) - dir(jointBeside(hip, pin.ankle, leg.thigh, leg.shin, leg.side), pin.ankle));
}

// The leg posed from `hip` toward its goal, `target` where its toes go.
export function solveHinged(leg: HingedLeg, hip: Point, goal: Goal, target: () => Point): Limb {
  const paw = { rest: leg.paw.rest ?? 0, limits: leg.paw.limits };
  if (goal.kind === 'angles') {
    if (leg.walksOn) throw new Error('hinge: only a leg with nothing to stand on is posed by angles');
    const knee = along(hip, 90 - goal.swing, leg.thigh);
    const shin = 90 - (goal.swing - goal.bend);
    const foot = along(knee, shin, leg.shin);
    return { hip, knee, ankle: foot, foot, paw: shin + within(paw, paw.rest) };
  }
  if (goal.kind === 'air') throw new Error('hinge: a leg in the air is a bird\'s');
  const side = goal.side ?? leg.side;
  const on = goal.walksOn ?? leg.walksOn;
  const { contact, fold } = held(goal, on?.kind === 'sole');
  const to = target();
  if (on?.kind === 'toes') {
    // Planted, the toes lie flat however the bone up to them leans: turned
    // from it as far as it stands from upright.
    const standing = on.lean - 90;
    const digits = goal.digits ?? leg.digits ?? standing;
    const free = bentTo(leg, side, hip, to, within(paw, paw.rest + on.fold * fold), on.length);
    if (!contact) return hung(free, 1, digits, standing);
    // Planted, as gait.ts's legsTo stood it; lifting or landing, each joint's
    // turn part way between the two.
    const pin = pinned(leg, side, hip, to, on);
    const planted = { hip, knee: jointBeside(hip, pin.ankle, leg.thigh, leg.shin, side), ankle: pin.ankle, foot: pin.foot };
    if (contact === 1) return { ...planted, paw: 0 };
    return hung(between(free, planted, contact), 1 - contact, digits, standing);
  }
  if (on?.kind !== 'sole') {
    const knee = jointBeside(hip, to, leg.thigh, leg.shin, side);
    return { hip, knee, ankle: to, foot: to, paw: dir(knee, to) + within(paw, paw.rest) };
  }
  // On its sole: the long foot from the heel to the toes is the bone up
  // from them, its toes where they go. Planted, the heel peels up about
  // them as it pushes off (legsTo's roll); free, the foot hangs from the
  // shin at its rest.
  const flat = dir({ x: 0, y: 0 }, on.toes);
  const tips = { x: to.x + on.toes.x, y: to.y + on.toes.y };
  const soled = (l: Omit<Limb, 'paw'>): Limb => ({ hip, knee: l.knee, ankle: l.ankle, foot: l.ankle, paw: wrap(dir(l.ankle, l.foot) - flat) });
  const free = bentTo(leg, side, hip, tips, within(paw, paw.rest) + flat, Math.hypot(on.toes.x, on.toes.y));
  if (!contact) return soled(free);
  const peel = on.peel * roll(goal.step);
  const heel = peel ? rotate(to, tips, peel) : to;
  const knee = jointBeside(hip, heel, leg.thigh, leg.shin, side);
  if (contact === 1) return { hip, knee, ankle: heel, foot: heel, paw: peel };
  return soled(between(free, { hip, knee, ankle: heel, foot: tips }, contact));
}
