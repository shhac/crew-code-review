// Forward kinematics: each authored joint's world matrix, from the root's
// turn down the hierarchy. The order is today's SVG composition, pinned by
// forward.test.ts: a group's transformOf (rig.ts) is T(d) R(a) S(1, s)
// about its pivot, the squash first and in the group's own axes, then the
// turn; a bird's wing foreshortens in an outer group and sweeps inside it
// (wings.ts's birdWing). A joint carries both:
//
//   local(j) = T(at + shift) F(foreshorten) R(angle) Q(squash) T(-at)
import type { Point } from '../../pointer';
import { applied, IDENTITY, product, rotate, scale, translate, turnMatrix, type Affine } from './affine';
import type { JointPose, JointSpec, PoseSpec, Skeleton } from './types';

const foreshortening = (f?: number): Affine => (f === undefined ? IDENTITY : scale(1, f));

// Across `axis` where it has one: turned to lie along x, squashed, turned
// back.
const squashing = (q?: JointPose['squash']): Affine => {
  if (!q) return IDENTITY;
  if (!q.axis) return scale(1, q.by);
  return product(rotate(q.axis), scale(1, q.by), rotate(-q.axis));
};

export const local = (j: Pick<JointSpec, 'at'>, p: JointPose = {}): Affine => {
  const shift = p.shift ?? { x: 0, y: 0 };
  return product(translate(j.at.x + shift.x, j.at.y + shift.y), foreshortening(p.foreshorten), rotate(p.angle ?? 0), squashing(p.squash), translate(-j.at.x, -j.at.y));
};

// A limb's root takes its parent's turn and shift but never its squash, as
// a hip does today, turned by the body's Turn outside its breathing group
// (hare-rig.ts's hips). `carried` is each joint's frame with every squash
// above it and its own left out, for its limb roots.
type Frames = { world: ReadonlyMap<string, Affine>; carried: ReadonlyMap<string, Affine> };

// `trailing`, where a joint lags: what it turns by (a matrix without a
// move), taken from an earlier moment; it stays hung where it is now.
// Without one, the last answer is kept, as a pose finds its limbs' roots
// (rootsOf) and is then drawn from the same root and joints.
type Posing = Pick<PoseSpec, 'root' | 'joints'>;
const last: { skeleton?: Skeleton; root?: Posing['root']; joints?: Posing['joints']; frames?: Frames } = {};
export function frames(skeleton: Skeleton, pose: Posing, trailing?: (j: JointSpec) => Affine | null): Frames {
  if (!trailing && last.frames && last.skeleton === skeleton && last.root === pose.root && last.joints === pose.joints) return last.frames;
  const found = framesOf(skeleton, pose, trailing ?? (() => null));
  if (!trailing) Object.assign(last, { skeleton, root: pose.root, joints: pose.joints, frames: found });
  return found;
}

function framesOf(skeleton: Skeleton, pose: Posing, trailing: (j: JointSpec) => Affine | null): Frames {
  const roots = new Set(skeleton.limbs.map((l) => l.joints.root));
  const world = new Map<string, Affine>();
  const carried = new Map<string, Affine>();
  const top = turnMatrix(pose.root);
  skeleton.joints.forEach((j) => {
    if (j.derived) return;
    const above = j.parent === null ? top : (roots.has(j.id) ? carried : world).get(j.parent);
    const aboveCarried = j.parent === null ? top : carried.get(j.parent);
    if (!above || !aboveCarried) throw new Error(`skeleton: ${j.id} comes before its parent ${j.parent}`);
    const p = pose.joints[j.id] ?? {};
    const turned = local(j, p);
    const own = product(above, turned);
    const lag = j.trail ? trailing(j) : null;
    const at = applied(own, j.at);
    const placed = lag ? product(translate(at.x, at.y), lag, translate(-j.at.x, -j.at.y)) : own;
    world.set(j.id, placed);
    carried.set(j.id, lag ? placed : product(aboveCarried, p.squash ? local(j, { ...p, squash: undefined }) : turned));
  });
  return { world, carried };
}

// Each authored joint's world matrix, mapping rest space into the drawing.
// A derived joint has none: its limb's constraint places it.
export const forward = (skeleton: Skeleton, pose: Posing): ReadonlyMap<string, Affine> => frames(skeleton, pose).world;

// Where each limb's root is, by the limb: what a pose sets its feet from
// (a foot planted under its hip as the body turns) before it has goals.
export function rootsOf(skeleton: Skeleton, pose: Posing): ReadonlyMap<string, Point> {
  const world = forward(skeleton, pose);
  return new Map(skeleton.limbs.map((limb) => {
    const root = skeleton.joints.find((j) => j.id === limb.joints.root);
    const m = world.get(limb.joints.root);
    if (!root || !m) throw new Error(`skeleton: ${limb.id} has no root ${limb.joints.root}`);
    return [limb.id, applied(m, root.at)];
  }));
}
