// An insect's body from what is measured on its drawing (a bee's, a
// wasp's): its body, head and abdomen joints, six legs (rig/hexapod.ts's)
// as limbs posed by the shared solver, and its parts in the order they are
// drawn. The plan fills in what every insect shares: each leg's joints and
// bones with their roles, codes and names, coded front to back a pair at a
// time, near before far (L0 the near front leg, L5 the far hind), and its
// limb for the solver. Its legs, antennae and wings are drawn in code, as
// shapes: the legs from where the limbs are, the rest on their joints.
//
// A leg swings at its socket: the thorax-coxa joint protracts and retracts
// the coxa, so the coxa turns to point along the leg toward its claws, and
// the femur, tibia and tarsus are solved from the coxa's end at the
// trochanter, sprawled out to the side as a real leg is and seen
// foreshortened (hexapod.ts's sprawledLimb), so no bone stretches to reach.
import { clamp, degrees, rad } from '../../math';
import type { Point } from '../../pointer';
import type { Limb } from '../gait';
import type { InsectLeg } from '../hexapod';
import type { Frame, Layer } from '../rig';
import { angleOf, applied } from './affine';
import { forward } from './forward';
import type { Body, BoneSpec, Goal, Handle, JointPose, JointSpec, LimbSpec, Piece, Shape, Side } from './types';

const PAIRS = { fore: 0, mid: 1, hind: 2 } as const;
// What the lab calls each pair's legs.
const TITLES = ['front leg', 'middle leg', 'hind leg'] as const;
const JOINTS = ['thorax-coxa joint', 'trochanter', 'knee (femur-tibia joint)', 'tibiotarsal joint', 'claws'] as const;
const BONES = ['coxa', 'femur (with the trochanter)', 'tibia', 'tarsus'] as const;
// How far the femur and tibia may open at the knee (interior, degrees;
// 180 straight): an insect's knee folds the tibia well back under the femur
// but never quite straightens it.
const KNEE = { min: 25, max: 172 } as const;
// How far the coxa protracts (positive, forward) or retracts from where it
// rests, degrees.
const SWING = { min: -60, max: 60 } as const;

// A leg by its bones, its socket where the drawing has it; where its claws
// stand is the leg's own, from how it sprawls (sprawled).
type Jointed = Omit<InsectLeg, 'reach' | 'bend' | 'track'>;
// Seen from above, which way each pair's femur points from the body's
// length midway through its stance, degrees from straight ahead: a stick
// insect's touches down at 36, 76 and 115 and lifts off at 80, 116 and 137,
// front to hind (Guschlbauer et al. 2022), so the front claws work ahead of
// their sockets, the middle ones from ahead to behind, the hind behind.
const HEADING = { fore: 58, mid: 96, hind: 126 } as const;
// How far a standing leg reaches out from its socket to its claws, of its
// whole length: most of it, the knee bent, riding high; the hind legs
// furthest, stretched back behind the body.
const OUT = { fore: 0.8, mid: 0.8, hind: 0.85 } as const;

// Where a leg is and which: its socket, and each pair's bones, alike on
// both sides.
export type Socket = Pick<InsectLeg, 'pair' | 'far' | 'hip'>;
export type Segments = Readonly<Record<InsectLeg['pair'], Omit<Jointed, keyof Socket>>>;

// Each leg with its claws set where it sprawls to, `ground` below the
// drawing's top.
export const sprawledLegs = (sockets: readonly Socket[], segments: Segments, ground: number): InsectLeg[] =>
  sockets.map((socket) => sprawled({ ...socket, ...segments[socket.pair] }, ground));
function sprawled(leg: Jointed, ground: number): InsectLeg {
  const length = leg.coxa + leg.femur + leg.tibia + leg.tarsus;
  const out = Math.sqrt(Math.max(0, (OUT[leg.pair] * length) ** 2 - (ground - leg.hip.y) ** 2));
  const heading = rad(HEADING[leg.pair]);
  return { ...leg, reach: out * Math.cos(heading), track: out * Math.sin(heading), bend: leg.pair === 'fore' ? 1 : -1 };
}

// The codes its legs' joints and bones had, by the codes they have now,
// before the coxa was a bone of its own: the knee was J1 and the femur B0.
export const CODES_BEFORE_COXA: Readonly<Record<string, string>> = Object.fromEntries([0, 1, 2, 3, 4, 5].flatMap((n) =>
  [1, 2, 3].flatMap((k) => [[`L${n}J${k}`, `L${n}J${k + 1}`], [`L${n}B${k - 1}`, `L${n}B${k}`]])));

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

type Posing = Parameters<typeof forward>[1];
export type Insect = {
  body: Body;
  // Where each leg's thorax-coxa joint is, in the legs' order, the body
  // posed so: what its claws are set from.
  hips: (pose: Posing) => Point[];
  // Each coxa turned to point along its leg toward the claws' goal, the
  // body posed so: its thorax-coxa joints' poses, to add to the pose's.
  coxae: (pose: Posing, goals: readonly Goal[]) => Readonly<Record<string, JointPose>>;
  // Each leg's goal, in the legs' order, by its limb.
  limbs: (goals: readonly Goal[]) => Readonly<Record<string, Goal>>;
  // Each leg as posed, in the legs' order.
  legs: (limb: (id: string) => Limb) => Limb[];
};

// A piece drawn at its place in the order.
const atZ = (piece: Piece, z: number): Piece => ({ ...piece, draws: piece.draws.map((d) => ({ ...d, z })) });

// Which way a point is from another, as a joint's turn is measured:
// degrees clockwise on the page from pointing right.
const bearing = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));

export function insect(m: InsectMeasured): Insect {
  const at = (leg: InsectLeg, k: number) => `${codeOfLeg(leg)}J${k}`;
  const side = (leg: InsectLeg): Side => (leg.far ? 'far' : 'near');
  // Where each leg's claws stand at rest, and its trochanter: the coxa's
  // end, along the line from its socket to them.
  const claws = (leg: InsectLeg): Point => ({ x: leg.hip.x + leg.reach, y: m.ground });
  const rested = (leg: InsectLeg) => bearing(leg.hip, claws(leg));
  const trochanter = (leg: InsectLeg): Point => {
    const along = Math.atan2(m.ground - leg.hip.y, leg.reach);
    return { x: leg.hip.x + leg.coxa * Math.cos(along), y: leg.hip.y + leg.coxa * Math.sin(along) };
  };
  const legJoints = (leg: InsectLeg): JointSpec[] => ([0, 1, 2, 3, 4] as const).map((k) => ({
    id: at(leg, k), parent: k ? at(leg, k - 1) : m.root, role: { part: 'limb', pair: PAIRS[leg.pair], side: side(leg), index: k },
    at: k ? trochanter(leg) : leg.hip, name: JOINTS[k], ...(k > 1 ? { derived: true } : {}), ...(k === 0 ? { limits: SWING } : {}),
  }));
  // Seen from the side, a sprawled leg's femur, tibia and tarsus are
  // foreshortened as it turns out across the view, never longer than they
  // are: each keeps its own length in depth (the laws' bonesKeepLength).
  const lengths = (leg: InsectLeg) => [leg.coxa, leg.femur, leg.tibia, leg.tarsus];
  const legBones = (leg: InsectLeg): BoneSpec[] => BONES.map((name, k) => ({
    from: at(leg, k), to: at(leg, k + 1), name, ...(k ? { stretch: { min: 0, max: lengths(leg)[k] } } : {}),
  }));
  const limbOf = (leg: InsectLeg): LimbSpec => {
    const { femur, tibia, tarsus, lean, curl, track } = leg;
    return {
      id: codeOfLeg(leg), pair: PAIRS[leg.pair], side: side(leg), solve: 'sprawled', ground: m.ground,
      leg: { femur, tibia, tarsus, lean, curl, track: track ?? 0, reach: claws(leg).x - trochanter(leg).x, knee: KNEE },
      joints: { root: at(leg, 1), middle: at(leg, 2), lower: at(leg, 3), end: at(leg, 4) },
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
      const thorax = forward(skeleton, pose).get(m.root);
      return m.legs.map((leg) => (thorax ? applied(thorax, leg.hip) : leg.hip));
    },
    coxae: (pose, goals) => {
      const thorax = forward(skeleton, pose).get(m.root);
      if (!thorax) return {};
      return Object.fromEntries(m.legs.flatMap((leg, i) => {
        const goal = goals[i];
        if (goal?.kind !== 'plant') return [];
        const turn = bearing(applied(thorax, leg.hip), goal.at) - rested(leg) - angleOf(thorax);
        return [[at(leg, 0), { angle: clamp(((turn + 540) % 360) - 180, SWING.min, SWING.max) }]];
      }));
    },
    limbs: (goals) => Object.fromEntries(m.legs.map((leg, i) => [codeOfLeg(leg), goals[i]])),
    legs: (limb) => m.legs.map((leg) => limb(codeOfLeg(leg))),
  };
}

// Strokes drawn where the limbs are, brought into the rest space of the
// joint their shape hangs on.
export const localized = (layers: readonly Layer[], local: (p: Point) => Point): Layer[] =>
  layers.map((l) => (l.kind === 'stroke' ? { ...l, points: l.points.map(local) } : l));
