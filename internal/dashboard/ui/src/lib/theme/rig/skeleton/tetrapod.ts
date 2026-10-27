// A four-limbed animal's body from a preset and what is measured on its
// drawing: its legs as rigs have always declared them (rig.ts's ArtLeg),
// the joints of its spine and head, its parts in the order they are drawn.
// The plan fills in the rest every such animal shares: each leg's joints
// and bones with their roles, codes and names, its limb for the solvers,
// its pieces laid as legImages lays them (bars along the bones, the foot
// before or after them, a curled foot as a variant), and the draw order's
// bands: the far legs outlined then as fur alone, the near legs outlined,
// the animal's own parts, the near legs' fur over its edge.
import type { Point } from '../../pointer';
import { BIRD_JOINTS, hingedLegOf, isHingedBird, type BirdLeg } from '../bird';
import type { ArtLeg, Foot, Frame } from '../rig';
import { rootsOf } from './forward';
import { restingPaw } from './hinge';
import type { Body, BoneSpec, Draw, Goal, Handle, Hinge, JointSpec, LimbSpec, Piece, Role, Shape, Side, Skeleton } from './types';

// What each joint of a leg is called, hip (or shoulder) to the toes' tip,
// and each bone from one to the next; a bone with no name is not one (a
// sole walker's ankle is its heel).
export type LegNames = { joints: readonly [string, string, string, string, string]; bones: readonly [string, string, string, string] };
// What a kind of animal shares: its legs' names, fore and hind; what the
// lab calls its limbs, where not a fore and hind leg; and which solver
// poses its legs.
export type Preset = { solve: 'quad' | 'bird'; legs: { fore: LegNames; hind: LegNames }; titles?: Readonly<Record<string, string>> };

const MAMMAL_FORE: LegNames = { joints: ['shoulder', 'elbow', 'wrist (carpus)', 'toes', 'toe tip'], bones: ['humerus', 'radius and ulna', 'metacarpus', 'toes (phalanges)'] };
const MAMMAL_HIND: LegNames = { joints: ['hip', 'stifle (knee)', 'hock (ankle)', 'toes', 'toe tip'], bones: ['femur', 'tibia and fibula', 'metatarsus', 'toes (phalanges)'] };
// A four-legged mammal's legs, as lab/critters/bones.ts's mammalLeg names
// them.
export const MAMMAL: Preset = { solve: 'quad', legs: { fore: MAMMAL_FORE, hind: MAMMAL_HIND } };
// A rabbit's or a hare's: a mammal's, standing at rest on its long hind
// soles, so the hock is the heel and no bone rises from the hind toes.
export const LEPORID: Preset = {
  ...MAMMAL,
  legs: { fore: { ...MAMMAL_FORE, joints: ['shoulder', 'elbow', 'wrist (carpus)', 'forepaw', 'toe tip'] }, hind: { joints: ['hip', 'stifle (knee)', 'hock (heel)', 'hind foot (its heel)', 'toe tip'], bones: ['femur', 'tibia and fibula', '', 'hind foot (metatarsus and toes)'] } },
};
// A bird's legs (rig/bird.ts), its wings its forelimbs.
const BIRD_LEG: LegNames = {
  joints: [BIRD_JOINTS.hip, BIRD_JOINTS.knee, BIRD_JOINTS.ankle, BIRD_JOINTS.foot, 'toe tip'],
  bones: ['femur (inside the body)', 'tibiotarsus (drumstick)', 'tarsometatarsus', 'toes'],
};
export const BIRD: Preset = { solve: 'bird', legs: { fore: BIRD_LEG, hind: BIRD_LEG }, titles: { L0: 'wing', L1: 'wing', L2: 'leg', L3: 'leg' } };

export const spine = (index: number): Role => ({ part: 'spine', index });
export const head = (index: number): Role => ({ part: 'head', index });

// One picture on a joint, where it sits in the drawing; `part`, what the lab
// lists it as where that is not its id.
export const picture = (id: string, on: string, src: string, box: { x: number; y: number; width: number; height: number }): Piece =>
  ({ id, art: { drawn: { src, box } }, at: { kind: 'joint', to: on }, draws: [{ id, z: 0 }] });

// Where something is drawn between the near legs' outlines and their fur,
// in order: a piece (all its draws there), a few pieces together (a wing),
// or a draw or shape by its id (a neck drawn twice, its fur further on).
export type Slot = Piece | readonly Piece[] | string;

// A rig's leg bent at relative hinges (hinge.ts): its knee within its
// jointLimits, its paw on this hinge, its toes free at `digits`.
export type HingedArtLeg = ArtLeg & { paw: Hinge; digits?: number };

export type Measured<L extends ArtLeg> = {
  frame: Frame;
  // Its spine and head, the root first; legs hang from `root`.
  joints: readonly JointSpec[];
  bones?: readonly BoneSpec[];
  root: string;
  // Its legs, in the order its gait, feet and steps list them; each
  // standing at rest on `ground`; a leg with a `paw` hinge bent at
  // relative hinges (hinge.ts), its knee within its jointLimits.
  legs: readonly L[];
  ground: (leg: L) => number;
  order: readonly Slot[];
  // Pieces drawn where `order` names their draws, and shapes on joints.
  pieces?: readonly Piece[];
  shapes?: readonly Omit<Shape, 'z'>[];
  guides: (code: (leg: L, joint: number) => string) => readonly { name: string; at: Handle; unsquashed?: boolean }[];
  // What its anchor's mark is called, where it does not stand there.
  stands?: string;
};

export type Tetrapod<L extends ArtLeg> = {
  body: Body;
  // Each leg's code, in the legs' order.
  codes: readonly string[];
  // Where each leg's hip (or shoulder) is, in the legs' order, the body
  // posed so: what a pose sets its feet from.
  hips: (pose: Parameters<typeof rootsOf>[1]) => Point[];
  // Each leg's goal, in the legs' order, by its limb.
  limbs: (goals: readonly Goal[]) => Readonly<Record<string, Goal>>;
  // Which of its foot's pictures each leg shows, in the legs' order.
  feet: (shown: (leg: L, i: number) => string) => Readonly<Record<string, string>>;
  // A side's leg fur drawn under the animal's own parts instead of over
  // them (a bird's legs tucked up into its belly in flight).
  furUnder: (side: Side) => Readonly<Record<string, number>>;
};

const Z = { farLegs: 0, farFur: 1, nearLegs: 2, under: 2.5, parts: 3 } as const;

type Bar = { from: number; to: number; art: { src: string; fur: string; anchors?: { start: number; end: number } }; thick: number };
// A leg's pieces as rig.ts's piecesOf lays them along its bones: one from
// the hip to the foot on a leg too short to show a knee; from the knee on a
// bird's, its femur in the body; otherwise the upper bone as thick as the
// haunch, the middle one (a hind shank tapering to the hock), and a bone up
// from the toes where it stands on them.
function barsOf(leg: ArtLeg): Bar[] {
  const { art, width } = leg;
  const haunch = leg.haunch ?? width;
  const plain = { src: art.bone, fur: art.boneFur };
  if (!art.knee) return [{ from: 0, to: 3, art: plain, thick: width }];
  if (art.inBody) return [{ from: 1, to: 2, art: art.thigh ?? plain, thick: haunch }, { from: 2, to: 3, art: plain, thick: width }];
  const shank = leg.taper ? { art: art.shank ?? art.thigh ?? plain, thick: width * 1.15 } : { art: art.shank ?? plain, thick: width };
  const toes = leg.walksOn?.kind === 'toes' ? [{ from: 2, to: 3, art: plain, thick: width }] : [];
  return [{ from: 0, to: 1, art: art.thigh ?? plain, thick: haunch }, { from: 1, to: 2, ...shank }, ...toes];
}

const boxOf = (foot: Foot) => ({ src: foot.src, fur: foot.fur, box: { x: -foot.heel.x, y: -foot.heel.y, width: foot.width, height: foot.height } });

// One limb's pieces, as legImages lays them, its limb coded `code` (its
// joints `${code}J0` to J4), outlined at one z and as fur alone at another,
// listed in the lab as `part`: for an animal that sets its limbs among its other parts itself (a cupid's
// arms and legs, each its own pair of draws, as rig.ts's limbLayers).
export function limbPieces(leg: ArtLeg, code: string, z: { outlined: number; fur: number }, part = `${leg.far ? 'far' : 'near'} legs`): Piece[] {
  const side: Side = leg.far ? 'far' : 'near';
  const at = (k: number) => `${code}J${k}`;
  const draws = (id: string, flush: boolean): Draw[] => [{ id, z: z.outlined, part }, { id: `${id}, fur`, z: z.fur, fur: true, flush, part: `${part}, fur` }];
  const bars = barsOf(leg).map((b, i): Piece => ({
    id: `${code}B${b.from}`, side, art: { drawn: { src: b.art.src, fur: b.art.fur } },
    at: { kind: 'bar', from: at(b.from), to: at(b.to), thick: b.thick, anchors: b.art.anchors }, draws: draws(`${code}B${b.from}`, i === 0),
  }));
  const { curled } = leg.art;
  const foot: Piece = {
    id: `${code} foot`, side, at: { kind: 'joint', to: at(3), local: true }, draws: draws(`${code} foot`, false),
    ...(curled ? { art: { toes: boxOf(leg.art.foot), curled: boxOf(curled) }, hide: 'opacity' } : { art: { drawn: boxOf(leg.art.foot) } }),
  };
  return leg.art.overFoot ? [foot, ...bars] : [...bars, foot];
}

export function tetrapod<L extends ArtLeg>(preset: Preset, m: Measured<L>): Tetrapod<L> {
  const codeOf = (leg: L) => `L${(leg.fore ? 0 : 2) + (leg.far ? 1 : 0)}`;
  const at = (leg: L, k: number) => `${codeOf(leg)}J${k}`;
  // Drawn, and listed by the tests, far side first, each side's legs in
  // their order.
  const drawn = [...m.legs.filter((l) => l.far), ...m.legs.filter((l) => !l.far)];
  const names = (leg: L) => preset.legs[leg.fore ? 'fore' : 'hind'];
  const side = (leg: L): Side => (leg.far ? 'far' : 'near');

  const legJoints = (leg: L): JointSpec[] => {
    const { foot } = leg.art;
    const toes = { x: leg.hip.x + leg.reach + foot.width - foot.heel.x, y: m.ground(leg) + foot.height - foot.heel.y };
    return ([0, 1, 2, 3, 4] as const).map((k) => ({
      id: at(leg, k), parent: k ? at(leg, k - 1) : m.root, role: { part: 'limb', pair: leg.fore ? 0 : 1, side: side(leg), index: k },
      at: k === 4 ? toes : leg.hip, name: names(leg).joints[k], ...(k ? { derived: true } : {}),
    }));
  };
  const legBones = (leg: L): BoneSpec[] => names(leg).bones.flatMap((name, k) => (name ? [{ from: at(leg, k), to: at(leg, k + 1), name }] : []));
  const limbOf = (leg: L): LimbSpec => {
    const joints = { root: at(leg, 0), middle: at(leg, 1), lower: at(leg, 2), end: at(leg, 3), tip: at(leg, 4) };
    const limb = { id: codeOf(leg), pair: leg.fore ? 0 : 1, side: side(leg), joints, ground: m.ground(leg) };
    if (preset.solve === 'bird') {
      if (!isBird(leg)) throw new Error(`tetrapod: ${codeOf(leg)} is not a bird's leg`);
      const { hip, far, fore, ...bird } = leg;
      if (!isHingedBird(bird)) return { ...limb, solve: 'bird', leg: bird };
      // Bent at hinges, its tarsus rests where it stands at rest.
      const rest = bird.paw.rest ?? restingPaw(hingedLegOf({ ...bird, paw: { ...bird.paw, rest: 0 } }), hip, m.ground(leg));
      return { ...limb, solve: 'bird', leg: { ...bird, paw: { ...bird.paw, rest } } };
    }
    if (isHinged(leg)) {
      const { hip, far, fore, bend, bendFrame, jointLimits, paw, ...bones } = leg;
      const bent = { ...bones, side: bend === 1 ? -1 : 1, ...(jointLimits ? { knee: jointLimits } : {}) } as const;
      const print = { width: leg.art.foot.width, height: leg.art.foot.height, heel: leg.art.foot.heel };
      return { ...limb, solve: 'hinged', leg: { ...bent, print, paw: { ...paw, rest: paw.rest ?? restingPaw(bent, hip, m.ground(leg)) } } };
    }
    const { hip, far, fore, ...quad } = leg;
    return { ...limb, solve: 'quad', leg: quad };
  };
  const skeleton: Skeleton = {
    joints: [...m.joints, ...drawn.flatMap(legJoints)],
    bones: [...(m.bones ?? []), ...drawn.flatMap(legBones)],
    limbs: drawn.map(limbOf),
  };

  const nearFur = Z.parts + m.order.length;
  const legPieces = (leg: L) => limbPieces(leg, codeOf(leg), leg.far ? { outlined: Z.farLegs, fur: Z.farFur } : { outlined: Z.nearLegs, fur: nearFur });
  const legs = drawn.flatMap(legPieces);

  // The animal's own parts, each at its place in the order; the near legs'
  // fur after them all.
  const named = new Map((m.pieces ?? []).flatMap((p) => p.draws.map((d) => [d.id, p] as const)));
  const shapes = new Map((m.shapes ?? []).map((s) => [s.id, s]));
  const placed = new Map<Piece, Draw[]>();
  const placedShapes: Shape[] = [];
  m.order.forEach((slot, i) => {
    const z = Z.parts + i;
    const all = (p: Piece) => placed.set(p, p.draws.map((d) => ({ ...d, z })));
    if (isPieces(slot)) return slot.forEach(all);
    if (typeof slot !== 'string') return all(slot);
    const shape = shapes.get(slot);
    if (shape) return placedShapes.push({ ...shape, z });
    const piece = named.get(slot);
    if (!piece) throw new Error(`tetrapod: nothing called ${slot} to draw`);
    placed.set(piece, (placed.get(piece) ?? piece.draws).map((d) => (d.id === slot ? { ...d, z } : d)));
  });
  const own = [...placed].map(([p, draws]) => ({ ...p, draws }));
  const body: Body = {
    frame: m.frame,
    skeleton,
    pieces: [...legs, ...own],
    shapes: placedShapes,
    guides: m.guides(at),
    ...(m.stands ? { stands: m.stands } : {}),
    ...(preset.titles ? { titles: preset.titles } : {}),
  };
  return {
    body,
    codes: m.legs.map(codeOf),
    hips: (pose) => {
      const roots = rootsOf(skeleton, pose);
      return m.legs.map((leg) => roots.get(codeOf(leg)) ?? leg.hip);
    },
    limbs: (goals) => Object.fromEntries(m.legs.map((leg, i) => [codeOf(leg), goals[i]])),
    feet: (shown) => Object.fromEntries(m.legs.map((leg, i) => [`${codeOf(leg)} foot`, shown(leg, i)])),
    furUnder: (s) => Object.fromEntries(legs.filter((p) => (p.side ?? 'near') === s).flatMap((p) => p.draws.filter((d) => d.fur).map((d) => [d.id, Z.under]))),
  };
}

const isHinged = <L extends ArtLeg>(leg: L): leg is L & { paw: Hinge } => 'paw' in leg;
const isBird = (leg: ArtLeg): leg is BirdLeg => 'toes' in leg && 'peel' in leg && leg.walksOn?.kind === 'toes';
const isPieces = (slot: Slot): slot is readonly Piece[] => Array.isArray(slot);
