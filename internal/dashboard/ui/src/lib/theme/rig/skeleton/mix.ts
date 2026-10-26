// One pose part way to another (an animal easing out of what it was doing
// into what it does next), channel by channel: the root's turn, each
// joint's turn, shift, squash and foreshortening, and each limb's goal,
// linearly; what shows, z and shapes are the next pose's. A step has no
// linear mix, so a limb's step is the next pose's (the last's where the
// next has none) unless the animal gives a mixer for that limb's steps (the
// rabbit's forepaws fold between two steps). A foot reaching for a handle
// is mixed from where it reaches in its own pose; how firmly a hinged
// leg's toes are pinned, and how far its paw is folded, from what each
// pose has them.
import { mix, mixPoint } from '../../math';
import type { Point } from '../../pointer';
import type { Step } from '../gait';
import { handleAt } from './forward';
import { held } from './hinge';
import type { Goal, JointPose, PoseSpec, Skeleton } from './types';

export type StepMixer = (a: Step | undefined, b: Step | undefined, f: number) => Step | undefined;
export type Mixers = { steps?: Readonly<Partial<Record<string, StepMixer>>> };

function mixJoint(a: JointPose = {}, b: JointPose = {}, f: number): JointPose {
  const shift = (p: JointPose) => p.shift ?? { x: 0, y: 0 };
  const squash = a.squash || b.squash ? { squash: { by: mix(a.squash?.by ?? 1, b.squash?.by ?? 1, f), ...((b.squash ?? a.squash)?.axis === undefined ? {} : { axis: (b.squash ?? a.squash)?.axis }) } } : {};
  return {
    ...(a.angle !== undefined || b.angle !== undefined ? { angle: mix(a.angle ?? 0, b.angle ?? 0, f) } : {}),
    ...(a.shift || b.shift ? { shift: mixPoint(shift(a), shift(b), f) } : {}),
    ...squash,
    ...(a.foreshorten !== undefined || b.foreshorten !== undefined ? { foreshorten: mix(a.foreshorten ?? 1, b.foreshorten ?? 1, f) } : {}),
  };
}

// Where a goal puts the foot, in its own pose; a foot in the air has none.
type Planted = Pick<Extract<Goal, { kind: 'plant' }>, 'at' | 'step' | 'ground' | 'walksOn' | 'side'>;
function planted(skeleton: Skeleton, pose: PoseSpec, goal: Goal): Planted | null {
  if (goal.kind === 'plant') return goal;
  if (goal.kind === 'air' || goal.kind === 'angles') return null;
  const to = handleAt(skeleton, pose, goal.to);
  return { at: { x: to.x + (goal.by?.x ?? 0), y: to.y + (goal.by?.y ?? 0) }, step: goal.step, walksOn: goal.walksOn, side: goal.side };
}

function mixGoal(skeleton: Skeleton, a: PoseSpec, b: PoseSpec, id: string, f: number, mixer?: StepMixer): Goal | undefined {
  const [ga, gb] = [a.limbs[id], b.limbs[id]];
  if (!ga || !gb) return gb ?? ga;
  if (ga.kind === 'air' && gb.kind === 'air') return { ...gb, reach: mix(ga.reach, gb.reach, f) };
  if (ga.kind === 'angles' && gb.kind === 'angles') return { kind: 'angles', swing: mix(ga.swing, gb.swing, f), bend: mix(ga.bend, gb.bend, f) };
  const [pa, pb] = [planted(skeleton, a, ga), planted(skeleton, b, gb)];
  if (!pa || !pb || (ga.kind !== 'plant' && ga.kind !== 'reach') || (gb.kind !== 'plant' && gb.kind !== 'reach')) return gb;
  const [ha, hb] = [held(ga), held(gb)];
  const step = mixer ? mixer(pa.step, pb.step, f) : pb.step ?? pa.step;
  const ground = pb.ground ?? pa.ground;
  const walksOn = pb.walksOn ?? pa.walksOn;
  const side = pb.side ?? pa.side;
  return {
    kind: 'plant', at: mixPoint(pa.at, pb.at, f), ...(step ? { step } : {}), ...(ground === undefined ? {} : { ground }), ...(walksOn ? { walksOn } : {}), ...(side ? { side } : {}),
    contact: mix(ha.contact, hb.contact, f), fold: mix(ha.fold, hb.fold, f),
  };
}

export function mixPose(skeleton: Skeleton, a: PoseSpec, b: PoseSpec, f: number, mixers: Mixers = {}): PoseSpec {
  const ids = (x: object, y: object) => [...new Set([...Object.keys(x), ...Object.keys(y)])];
  const limbs = ids(a.limbs, b.limbs).flatMap((id) => {
    const goal = mixGoal(skeleton, a, b, id, f, mixers.steps?.[id]);
    return goal ? [[id, goal] as const] : [];
  });
  return {
    root: { angle: mix(a.root.angle, b.root.angle, f), pivot: b.root.pivot, dx: mix(a.root.dx, b.root.dx, f), dy: mix(a.root.dy, b.root.dy, f) },
    joints: Object.fromEntries(ids(a.joints, b.joints).map((id) => [id, mixJoint(a.joints[id], b.joints[id], f)])),
    limbs: Object.fromEntries(limbs),
    show: b.show,
    z: b.z,
    ...(b.shapes ? { shapes: b.shapes } : {}),
  };
}
