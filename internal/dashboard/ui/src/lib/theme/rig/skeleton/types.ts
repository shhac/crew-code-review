// An animal's skeleton as data: joints in a hierarchy whose rest pose is its
// reference drawing, so a part attached to a joint, where export.py printed
// its box, is already in place at rest. Its rig poses the joints (FK for
// those it authors, a limb's constraint for those the limb owns), and its
// parts hang from them. See .ai-cache/plan-skeleton-rigs.md.
import type { Point } from '../../pointer';
import type { AirLegs, BirdLeg } from '../bird';
import type { Limb, QuadLeg, Step } from '../gait';
import type { Frame, Layer, Turn } from '../rig';

export type Side = 'near' | 'far';
export type Box = { x: number; y: number; width: number; height: number };

// What a joint is, which fixes its code (lab/skeleton.ts's), whatever a
// pose draws.
export type Role =
  | { part: 'spine'; index: number }
  | { part: 'limb'; pair: number; side: Side; index: 0 | 1 | 2 | 3 | 4 }
  | { part: 'head'; index: number }
  | { part: 'wing'; side: Side; index: number }
  | { part: 'other'; index: number };

// A joint at rest. Authored joints are placed by FK; derived ones (a limb's
// J1 to J4) only by their limb's constraint, at rest where its standing
// solve puts them. `trail`: its turn lags `lag` ms behind the body's, and
// with `spring` (0 to 1) it is blended over earlier moments too, each
// weighted that much less than the one after it.
export type JointSpec = {
  id: string;
  parent: string | null;
  role: Role;
  at: Point;
  name: string;
  derived?: boolean;
  limits?: { min: number; max: number };
  trail?: { lag: number; spring?: number };
};

// Only a bone that says so may change length: a neck, never a leg.
export type BoneSpec = { from: string; to: string; name: string; stretch?: { min: number; max: number } };

// A joint, or a point it carries in rest space: an eye, a bill's tip, a
// neck piece's top.
export type Handle = string | { on: string; at: Point };

// A limb: its root (authored) and the joints its constraint owns, the tip
// (the toes' end) carried on the foot. `leg` is today's QuadLeg (a bird's
// BirdLeg) less what the skeleton owns, so the solvers run as they are;
// `ground` is where its foot stands at rest, `leg.reach` ahead of its root.
type Owned = { root: string; middle: string; lower: string; end: string; tip?: string };
type LimbOf<S extends string, L extends QuadLeg> = { id: string; pair: number; side: Side; joints: Owned; ground: number; solve: S; leg: Omit<L, 'hip' | 'far' | 'fore'> };
export type LimbSpec = LimbOf<'quad', QuadLeg> | LimbOf<'bird', BirdLeg>;

export type Skeleton = { joints: readonly JointSpec[]; bones: readonly BoneSpec[]; limbs: readonly LimbSpec[] };

// A joint's turn about itself; `squash` in its own axes, turning with it (a
// breath; with `axis`, across that direction, as a wing's across its
// length); `foreshorten` in its parent's axes, the turn inside it (a wing
// seen edge-on); `shift` in its parent's frame (a head's thrust).
export type JointPose = { angle?: number; squash?: { by: number; axis?: number }; foreshorten?: number; shift?: Point };

// What a limb's constraint reaches for: a foot planted (or stepping, with
// its step; a bird's kept clear of `ground`), a handle reached, or a bird's
// legs in the air (bird.ts's airLegsTo `reach`). `walksOn`: what the foot
// stands on in this pose, where that is not the limb's own (a hare sat on
// its long hind soles, gait.ts's onSoles).
type Stands = { walksOn?: NonNullable<QuadLeg['walksOn']> };
export type Goal =
  | ({ kind: 'plant'; at: Point; step?: Step; ground?: number } & Stands)
  | ({ kind: 'reach'; to: Handle; by?: Point; step?: Step } & Stands)
  | { kind: 'air'; reach: number; legs?: AirLegs };

// One moment's pose: the root's turn (the one joint that may turn about a
// different point in each pose), each authored joint's pose, each limb's
// goal, which variant of a piece shows (false for none; its first
// otherwise), draws moved to another z, and what each shape draws now (an
// eyelid while the eye is shut), in its joint's rest space.
export type PoseSpec = {
  root: Turn;
  joints: Readonly<Partial<Record<string, JointPose>>>;
  limbs: Readonly<Partial<Record<string, Goal>>>;
  show: Readonly<Partial<Record<string, string | false>>>;
  z: Readonly<Partial<Record<string, number>>>;
  shapes?: Readonly<Partial<Record<string, readonly Layer[]>>>;
};

// A variant of a piece's picture, its box in rest space (or in its joint's
// own frame), and the same picture as fur alone, outline taken out, if it
// has one.
export type Art = { src: string; box: Box; fur?: string };

export type Attachment =
  // A joint's frame. Box in rest space, or `local` in the joint's own frame
  // (a foot's box from its heel).
  | { kind: 'joint'; to: string; local?: boolean }
  // A bone's frame, rigid: origin at `from`, x along the bone, the art
  // carried from its rest pose without stretching.
  | { kind: 'bone'; from: string; to: string }
  // Stretched between two handles. `art` is where each handle sits in the
  // picture, fixing the source axis. The picture turns about `from` onto
  // the target and scales along that axis about the point `fixed` (a
  // distance from `art.from`) along it, which stays put; across the axis
  // it keeps its thickness.
  | { kind: 'span'; from: Handle; to: Handle; art: { from: Point; to: Point }; fixed?: number }
  // A leg bar exactly as rig.ts's bone() lays it: caps half its thickness
  // past each joint, or registered anchors; stretched to its box.
  | { kind: 'bar'; from: string; to: string; thick: number; anchors?: { start: number; end: number } };

// One drawing of a piece at a place in the draw order: `fur` for the pass
// of fur alone; `flush`, a bar's fur laid from the joint exactly, over a
// body's edge from a hip just inside it (bone()'s flush); `part`, what the
// lab lists it as, where several draws are one part (a side's legs).
export type Draw = { id: string; z: number; fur?: boolean; flush?: boolean; part?: string };

// Parts drawn in code, not from art (an eyelid, a bow's string), hung on a
// joint at a place in the draw order; each pose says what they draw.
export type Shape = { id: string; on: string; z: number };

// A part of the drawing hung from the skeleton. Every variant is drawn in
// each of its draws, those not shown unseen (`hide`: at opacity 0, as a
// curled foot is, rather than hidden), so showing one never reloads it.
// `extra`: a pose of its own about its anchor (its joint, its bone's or
// span's root, its bar's start), on top of its attachment. A bar's art has
// no box of its own: bone() lays it from the bar's ends.
type PieceOf<A extends Attachment, Arts> = {
  id: string;
  art: Readonly<Record<string, Arts>>;
  at: A;
  draws: readonly Draw[];
  side?: Side;
  hide?: 'opacity';
  extra?: (now: number, seed: number) => JointPose;
};
export type Piece = PieceOf<Exclude<Attachment, { kind: 'bar' }>, Art> | PieceOf<Extract<Attachment, { kind: 'bar' }>, Omit<Art, 'box'>>;

// An animal built on a skeleton: its frame, its bones, its parts, the
// points it marks for the lab and the tests (where it stands is always
// first; with none given, every joint by its name), and what the lab calls
// each limb, by its code, where that is not a fore or hind leg (a bird's
// wing and its leg).
export type Body = {
  frame: Frame;
  skeleton: Skeleton;
  pieces: readonly Piece[];
  shapes?: readonly Shape[];
  // `unsquashed`: marked where it would be with every squash above it
  // taken out, as a rig marked a point turned with the body but not
  // breathing with it.
  guides?: readonly { name: string; at: Handle; unsquashed?: boolean }[];
  titles?: Readonly<Record<string, string>>;
};

// The skeleton as a pose has it, for the lab and the tests: each joint where
// it is drawn, coded by its role; each bone, by its joints' ids, and how
// long it is now with every squash above it taken out; each limb as the solvers posed it, whether it is a
// foreleg, and how low its foot reaches.
export type PosedJoint = { id: string; code: string; name: string; at: Point; derived: boolean; far: boolean; parent: string | null; angle: number; limits?: { min: number; max: number } };
export type PosedBone = { code: string; name: string; from: string; to: string; far: boolean; length: number; stretch?: { min: number; max: number } };
export type PosedLimb = { id: string; code: string; limb: Limb; fore: boolean; sole: number };
export type PosedSkeleton = { joints: readonly PosedJoint[]; bones: readonly PosedBone[]; limbs: readonly PosedLimb[]; titles?: Readonly<Record<string, string>> };
