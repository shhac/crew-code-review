// What the animals' bones are, for the lab's skeleton view, where kinds of
// animal share them. A rig's piece standing for more than one real bone
// says so in its name, as does a line the rig draws between two pivots
// rather than along a bone.
import type { BoneNames, Chain, LegBones, Marked, Spine } from '../skeleton';

// A four-legged mammal's leg as rig/gait.ts poses a toe walker's: hip to
// stifle the femur, stifle to hock the tibia (the fibula alongside, fused
// in a rabbit or hare), hock to toes the metatarsus; shoulder to elbow the
// humerus, elbow to wrist (the carpus) the radius and ulna, wrist to toes
// the metacarpus. The foot's picture is its toes.
export const mammalLeg = ({ fore }: { fore: boolean }): LegBones => (fore
  ? { pair: 0, limb: 'foreleg', upper: 'humerus', middle: 'radius and ulna', lower: 'metacarpus', foot: 'toes (phalanges)' }
  : { pair: 1, limb: 'hind leg', upper: 'femur', middle: 'tibia and fibula', lower: 'metatarsus', foot: 'toes (phalanges)' });

// A mammal rig marks no spine, only the pivots the body and head turn
// about (its mark called the neck is where the head turns on it), so the
// spine is lines between them and the limbs' roots.
export const mammalSpine = (tail: boolean): Spine => [
  { mark: 'neck', name: 'head joint (neck)', line: 'neck line' }, { mark: 'shoulder', line: 'back line' },
  { mark: 'hip', line: 'pelvis line' }, ...(tail ? [{ mark: 'tail root' }] : []),
];
// The head's own marks from the head joint outward, the skull from there
// to its last.
export const mammalHead = (...marks: string[]): Chain =>
  ({ joints: marks.map((mark) => ({ mark })), bones: [['head joint (neck)', marks[marks.length - 1], 'skull']] });

// A bird's leg (rig/bird.ts): the femur runs inside the body to the knee,
// never drawn; the drumstick is the tibiotarsus, the bare leg below the
// ankle the tarsometatarsus, then the toes. Its wing is marked at the
// shoulder, the wrist and the wingtip, with no elbow between: the arm piece
// is the humerus and the forearm together, the hand piece the hand bones
// with the primaries on them. Only the near wing is marked; the far one is
// posed the same, so its joints are carried over from the near's. The rigs mark
// no spine, but their pictures turn about its points: the head on its
// joint, a pigeon's neck at its base, the body about its middle, the tail
// at its root; none has the tail's tip.
export const BIRD: BoneNames = {
  legs: () => ({ pair: 1, limb: 'leg', upper: 'femur (inside the body)', middle: 'tibiotarsus (drumstick)', lower: 'tarsometatarsus', foot: 'toes' }),
  marked: [{ joints: ['shoulder', 'wrist', 'wingtip'], bones: ['arm (humerus, radius and ulna; no elbow)', 'hand and primaries'], limb: () => 'wing', pair: 0, twin: true }],
  spine: [
    { pivot: 'head', name: 'head joint', line: 'neck line' }, { pivot: 'neck', name: 'neck base', line: 'back line' },
    { mark: 'shoulder', line: 'back line' }, { pivot: 'body', name: 'body pivot', line: 'back line' },
    { mark: 'hip', line: 'pelvis line' }, { pivot: 'tail', name: 'tail root' },
  ],
  head: { joints: [{ mark: 'eye' }, { mark: 'bill' }, { mark: 'gape' }, { pivot: 'lower mandible', name: 'jaw hinge (lower mandible)' }] },
};

// An insect's leg as rig/hexapod.ts marks it: the coxa and trochanter are
// too small to show, so the first piece runs from the coxa's socket.
const PAIRS = ['front leg', 'middle leg', 'hind leg'];
export const INSECT_LEGS: Marked = {
  joints: ['coxa', 'knee', 'tibiotarsal joint', 'claws'],
  bones: ['femur (with coxa and trochanter)', 'tibia', 'tarsus'],
  limb: (pair) => PAIRS[pair] ?? 'leg',
};
