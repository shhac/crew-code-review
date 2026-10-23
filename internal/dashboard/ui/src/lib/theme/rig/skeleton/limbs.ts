// A limb's constraint: given where FK put its root and what it reaches
// for, today's solvers (gait.ts's legsTo, bird.ts's birdLegsTo and
// airLegsTo) pose it, unchanged, and their answer places the joints the
// limb owns. FK never places those. Each owned joint's frame turns with its
// bone from where the limb stands at rest (its standing solve), the foot's
// with the paw, so a part hung on one follows it.
import { degrees, rad } from '../../math';
import type { Point } from '../../pointer';
import { rotate as turnPoint } from '../../spidergait';
import { airLegsTo, birdLegsTo, type BirdLeg } from '../bird';
import { jointBeside } from '../limb';
import { legsTo, type Limb, type QuadLeg } from '../gait';
import { product, rotate, translate, type Affine } from './affine';
import type { Goal, Handle, LimbSpec, Skeleton } from './types';

// The whole leg each solver takes, its hip the root where it is now (the
// solvers pose from their `hip` argument; the spec's is read only to set
// feet from, which the goal has done).
const quadOf = (limb: Extract<LimbSpec, { solve: 'quad' }>, root: Point): QuadLeg => ({ ...limb.leg, hip: root, far: limb.side === 'far', fore: limb.pair === 0 });
const birdOf = (limb: Extract<LimbSpec, { solve: 'bird' }>, root: Point): BirdLeg => ({ ...limb.leg, hip: root, far: limb.side === 'far', fore: limb.pair === 0 });

const plus = (p: Point, by: Point = { x: 0, y: 0 }): Point => ({ x: p.x + by.x, y: p.y + by.y });

// The limb posed from `root` (its J0 now) toward its goal; `handle` finds
// a reach's target, which may only be an authored joint or a point on one.
const direction = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));
const along = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.cos(rad(deg)) * length, y: from.y + Math.sin(rad(deg)) * length });

export function solveLimb(limb: LimbSpec, root: Point, goal: Goal, handle: (h: Handle) => Point): Limb {
  if (limb.solve === 'angles') {
    if (goal.kind !== 'angles') throw new Error(`skeleton: ${limb.id} is posed by angles`);
    const knee = along(root, 90 - goal.swing, limb.leg.thigh);
    const foot = along(knee, 90 - (goal.swing - goal.bend), limb.leg.shin);
    return { hip: root, knee, ankle: foot, foot, paw: goal.paw };
  }
  if (goal.kind === 'angles') throw new Error(`skeleton: ${limb.id} is not posed by angles`);
  if (goal.kind === 'air') {
    if (limb.solve !== 'bird') throw new Error(`skeleton: ${limb.id} has no legs in the air`);
    return airLegsTo([birdOf(limb, root)], [root], goal.reach, goal.legs)[0];
  }
  const at = goal.kind === 'plant' ? goal.at : plus(handle(goal.to), goal.by);
  if (limb.solve === 'arm') {
    const knee = jointBeside(root, at, limb.leg.thigh, limb.leg.shin, goal.side ?? 1);
    return { hip: root, knee, ankle: at, foot: at, paw: direction(knee, at) };
  }
  const steps = goal.step ? [goal.step] : [];
  if (limb.solve === 'bird') return birdLegsTo([birdOf(limb, root)], [root], [at], steps, goal.kind === 'plant' ? goal.ground : undefined)[0];
  const quad = quadOf(limb, root);
  return legsTo([goal.walksOn ? { ...quad, walksOn: goal.walksOn } : quad], [root], [at], steps)[0];
}

// Standing at rest: its foot down `reach` ahead of its root, on its ground.
export const standing = (limb: LimbSpec, root: Point): Limb =>
  solveLimb(limb, root, limb.solve === 'angles' ? { kind: 'angles', swing: 0, bend: 0, paw: 0 } : { kind: 'plant', at: { x: root.x + limb.leg.reach, y: limb.ground } }, () => root);

const restOf = (skeleton: Skeleton, id: string): Point => {
  const joint = skeleton.joints.find((j) => j.id === id);
  if (!joint) throw new Error(`skeleton: no joint ${id}`);
  return joint.at;
};

// Where the joints the limb owns are, as it is posed: the toes' tip carried
// on the foot, turned with the paw from where it is at rest.
export function ownedPoints(skeleton: Skeleton, limb: LimbSpec, rest: Limb, now: Limb): Map<string, Point> {
  const { middle, lower, end, tip } = limb.joints;
  const points = new Map<string, Point>([[middle, now.knee], [lower, now.ankle], [end, now.foot]]);
  if (!tip) return points;
  const toes = restOf(skeleton, tip);
  return points.set(tip, turnPoint(plus(now.foot, { x: toes.x - rest.foot.x, y: toes.y - rest.foot.y }), now.foot, now.paw - rest.paw));
}

const SAME = 1e-9;

// Each owned joint's frame, mapping rest space (as the limb stands) to the
// drawing: moved to where it is and turned as its bone has turned since,
// the bone down from it toward the toes; the foot, and the toes' tip on
// it, by the paw. A joint with no length of bone below it (an ankle that
// is the foot) turns with the foot.
export function ownedFrames(skeleton: Skeleton, limb: LimbSpec, rest: Limb, now: Limb): Map<string, Affine> {
  const frame = (at: Point, was: Point, turn: number): Affine => product(translate(at.x, at.y), rotate(turn), translate(-was.x, -was.y));
  const along = (a: Point, b: Point, ra: Point, rb: Point) =>
    (Math.hypot(b.x - a.x, b.y - a.y) < SAME || Math.hypot(rb.x - ra.x, rb.y - ra.y) < SAME ? now.paw - rest.paw : direction(a, b) - direction(ra, rb));
  const { middle, lower, end, tip } = limb.joints;
  const foot = frame(now.foot, rest.foot, now.paw - rest.paw);
  const frames = new Map<string, Affine>([
    [middle, frame(now.knee, rest.knee, along(now.knee, now.ankle, rest.knee, rest.ankle))],
    [lower, frame(now.ankle, rest.ankle, along(now.ankle, now.foot, rest.ankle, rest.foot))],
    [end, foot],
  ]);
  return tip ? frames.set(tip, foot) : frames;
}

// Every joint the limbs own, which FK must not place.
export const ownedBy = (skeleton: Skeleton): Set<string> =>
  new Set(skeleton.limbs.flatMap(({ joints: { middle, lower, end, tip } }) => [middle, lower, end, ...(tip ? [tip] : [])]));
