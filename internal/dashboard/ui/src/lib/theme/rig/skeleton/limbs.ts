// A limb's constraint: given where FK put its root and what it reaches
// for, a solver for its kind poses it (gait.ts's legsTo, bird.ts's
// birdLegsTo and airLegsTo, unchanged; hinge.ts's for a leg bent at
// relative hinges; an arm's), and its answer places the joints the limb
// owns. FK never places those. Each owned joint's frame turns with its
// bone from where the limb stands at rest (its standing solve), the foot's
// with the paw, so a part hung on one follows it.
import { degrees } from '../../math';
import type { Point } from '../../pointer';
import { rotate as turnPoint } from '../../spidergait';
import { airLegsTo, birdLegsTo, type BirdLeg } from '../bird';
import { jointBeside } from '../limb';
import { legsTo, type Limb, type QuadLeg } from '../gait';
import { product, rotate, translate, type Affine } from './affine';
import { solveHinged } from './hinge';
import type { Goal, Handle, LimbKind, LimbSpec, Skeleton } from './types';

// The whole leg each solver takes, its hip the root where it is now (the
// solvers pose from their `hip` argument; the spec's is read only to set
// feet from, which the goal has done).
const quadOf = (limb: Extract<LimbSpec, { solve: 'quad' }>, root: Point): QuadLeg => ({ ...limb.leg, hip: root, far: limb.side === 'far', fore: limb.pair === 0 });
const birdOf = (limb: Extract<LimbSpec, { solve: 'bird' }>, root: Point): BirdLeg => ({ ...limb.leg, hip: root, far: limb.side === 'far', fore: limb.pair === 0 });

const plus = (p: Point, by: Point = { x: 0, y: 0 }): Point => ({ x: p.x + by.x, y: p.y + by.y });

const direction = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));

// The limb posed from `root` (its J0 now) toward its goal; `handle` finds
// a reach's target, which may only be an authored joint or a point on one.
type Solver<K extends LimbKind> = (limb: Extract<LimbSpec, { solve: K }>, root: Point, goal: Goal, handle: (h: Handle) => Point) => Limb;
const target = (goal: Goal, handle: (h: Handle) => Point): Point => {
  if (goal.kind === 'plant') return goal.at;
  if (goal.kind === 'reach') return plus(handle(goal.to), goal.by);
  throw new Error(`skeleton: a ${goal.kind} goal has no target`);
};
const SOLVERS: { [K in LimbKind]: Solver<K> } = {
  quad: (limb, root, goal, handle) => {
    if (goal.kind === 'plant' || goal.kind === 'reach') {
      const quad = quadOf(limb, root);
      return legsTo([goal.walksOn ? { ...quad, walksOn: goal.walksOn } : quad], [root], [target(goal, handle)], goal.step ? [goal.step] : [])[0];
    }
    throw new Error(`skeleton: ${limb.id} is not posed by a ${goal.kind} goal`);
  },
  bird: (limb, root, goal, handle) => {
    if (goal.kind === 'air') return airLegsTo([birdOf(limb, root)], [root], goal.reach, goal.legs)[0];
    if (goal.kind === 'plant' || goal.kind === 'reach') return birdLegsTo([birdOf(limb, root)], [root], [target(goal, handle)], goal.step ? [goal.step] : [], goal.kind === 'plant' ? goal.ground : undefined)[0];
    throw new Error(`skeleton: ${limb.id} is not posed by a ${goal.kind} goal`);
  },
  hinged: (limb, root, goal, handle) => solveHinged(limb.leg, root, goal, () => target(goal, handle)),
  arm: (limb, root, goal, handle) => {
    if (goal.kind !== 'plant' && goal.kind !== 'reach') throw new Error(`skeleton: ${limb.id} is not posed by a ${goal.kind} goal`);
    const at = target(goal, handle);
    const knee = jointBeside(root, at, limb.leg.thigh, limb.leg.shin, goal.side ?? limb.leg.side ?? 1);
    return { hip: root, knee, ankle: at, foot: at, paw: direction(knee, at) };
  },
};
const solverOf = <K extends LimbKind>(limb: Extract<LimbSpec, { solve: K }>): Solver<K> => SOLVERS[limb.solve];

export function solveLimb(limb: LimbSpec, root: Point, goal: Goal, handle: (h: Handle) => Point): Limb {
  return solverOf(limb)(limb, root, goal, handle);
}

// Standing at rest: its foot down `reach` ahead of its root, on its ground;
// a hinged leg with nothing to stand on hanging straight down.
export const standing = (limb: LimbSpec, root: Point): Limb =>
  solveLimb(limb, root, limb.solve === 'hinged' && !limb.leg.walksOn ? { kind: 'angles', swing: 0, bend: 0 } : { kind: 'plant', at: { x: root.x + limb.leg.reach, y: limb.ground } }, () => root);

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
