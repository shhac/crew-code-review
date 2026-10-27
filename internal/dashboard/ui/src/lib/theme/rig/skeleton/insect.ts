// An insect's body from what is measured on its drawing (a bee's, a
// wasp's): its body, head and abdomen joints, six legs (rig/hexapod.ts's)
// as limbs posed by the shared solver, and its parts in the order they are
// drawn. The plan fills in what every insect shares: each leg's joints and
// bones with their roles, codes and names, coded front to back a pair at a
// time, near before far (L0 the near front leg, L5 the far hind), and its
// limb for the solver. Its legs, antennae and wings are drawn in code, as
// shapes: the legs from where the limbs are, the rest on their joints.
import type { Point } from '../../pointer';
import type { Limb } from '../gait';
import { asQuad, type InsectLeg } from '../hexapod';
import type { Frame, Layer } from '../rig';
import { rootsOf } from './forward';
import type { Body, BoneSpec, Goal, Handle, JointSpec, LimbSpec, Piece, Shape, Side } from './types';

const PAIRS = { fore: 0, mid: 1, hind: 2 } as const;
// What the lab calls each pair's legs.
const TITLES = ['front leg', 'middle leg', 'hind leg'] as const;
const JOINTS = ['coxa', 'knee', 'tibiotarsal joint', 'claws'] as const;
const BONES = ['femur (with coxa and trochanter)', 'tibia', 'tarsus'] as const;

// A leg's code: its pair from the front, near before far.
export const codeOfLeg = (leg: InsectLeg) => `L${2 * PAIRS[leg.pair] + (leg.far ? 1 : 0)}`;

// What is drawn, back to front: a piece, or a shape on a joint by its id.
export type InsectSlot = Piece | { shape: string; on: string };

export type InsectMeasured = {
  frame: Frame;
  // Its body, head and the rest, the root first; the legs hang from `root`.
  joints: readonly JointSpec[];
  bones?: readonly BoneSpec[];
  root: string;
  legs: readonly InsectLeg[];
  ground: number;
  order: readonly InsectSlot[];
  guides: (code: (leg: InsectLeg, joint: number) => string) => readonly { name: string; at: Handle }[];
  stands?: string;
};

export type Insect = {
  body: Body;
  // Where each leg's coxa is, in the legs' order, the body posed so.
  hips: (pose: Parameters<typeof rootsOf>[1]) => Point[];
  // Each leg's goal, in the legs' order, by its limb.
  limbs: (goals: readonly Goal[]) => Readonly<Record<string, Goal>>;
  // Each leg as posed, in the legs' order.
  legs: (limb: (id: string) => Limb) => Limb[];
};

// A piece drawn at its place in the order.
const atZ = (piece: Piece, z: number): Piece => ({ ...piece, draws: piece.draws.map((d) => ({ ...d, z })) });

export function insect(m: InsectMeasured): Insect {
  const at = (leg: InsectLeg, k: number) => `${codeOfLeg(leg)}J${k}`;
  const side = (leg: InsectLeg): Side => (leg.far ? 'far' : 'near');
  const legJoints = (leg: InsectLeg): JointSpec[] => ([0, 1, 2, 3] as const).map((k) => ({
    id: at(leg, k), parent: k ? at(leg, k - 1) : m.root, role: { part: 'limb', pair: PAIRS[leg.pair], side: side(leg), index: k },
    at: leg.hip, name: JOINTS[k], ...(k ? { derived: true } : {}),
  }));
  const legBones = (leg: InsectLeg): BoneSpec[] => BONES.map((name, k) => ({ from: at(leg, k), to: at(leg, k + 1), name }));
  const limbOf = (leg: InsectLeg): LimbSpec => {
    const { hip, far, fore, ...quad } = asQuad(leg);
    return {
      id: codeOfLeg(leg), pair: PAIRS[leg.pair], side: side(leg), solve: 'quad', ground: m.ground, leg: quad,
      joints: { root: at(leg, 0), middle: at(leg, 1), lower: at(leg, 2), end: at(leg, 3) },
    };
  };
  const skeleton = { joints: [...m.joints, ...m.legs.flatMap(legJoints)], bones: [...(m.bones ?? []), ...m.legs.flatMap(legBones)], limbs: m.legs.map(limbOf) };
  const pieces = m.order.flatMap((slot, z): Piece[] => ('shape' in slot ? [] : [atZ(slot, z)]));
  const shapes = m.order.flatMap((slot, z): Shape[] => ('shape' in slot ? [{ id: slot.shape, on: slot.on, z }] : []));
  const body: Body = {
    frame: m.frame,
    skeleton,
    pieces,
    shapes,
    guides: m.guides(at),
    ...(m.stands ? { stands: m.stands } : {}),
    titles: Object.fromEntries(m.legs.map((leg) => [codeOfLeg(leg), TITLES[PAIRS[leg.pair]]])),
  };
  return {
    body,
    hips: (pose) => {
      const roots = rootsOf(skeleton, pose);
      return m.legs.map((leg) => roots.get(codeOfLeg(leg)) ?? leg.hip);
    },
    limbs: (goals) => Object.fromEntries(m.legs.map((leg, i) => [codeOfLeg(leg), goals[i]])),
    legs: (limb) => m.legs.map((leg) => limb(codeOfLeg(leg))),
  };
}

// Strokes drawn where the limbs are, brought into the rest space of the
// joint their shape hangs on.
export const localized = (layers: readonly Layer[], local: (p: Point) => Point): Layer[] =>
  layers.map((l) => (l.kind === 'stroke' ? { ...l, points: l.points.map(local) } : l));
