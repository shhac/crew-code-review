// What the animals' bones are, for the lab's skeleton view, where kinds of
// animal share them. A rig's piece standing for more than one real bone
// says so in its name, as does a line the rig draws between two pivots
// rather than along a bone.
import type { BoneNames, LegBones } from '../skeleton';

// A four-legged mammal's leg as rig/gait.ts poses a toe walker's: hip to
// stifle the femur, stifle to hock the tibia (the fibula alongside, fused
// in a rabbit or hare), hock to toes the metatarsus; shoulder to elbow the
// humerus, elbow to wrist (the carpus) the radius and ulna, wrist to toes
// the metacarpus. The foot's picture is its toes.
export const mammalLeg = ({ fore }: { fore: boolean }): LegBones => (fore
  ? { upper: 'humerus', middle: 'radius and ulna', lower: 'metacarpus', foot: 'toes (phalanges)' }
  : { upper: 'femur', middle: 'tibia and fibula', lower: 'metatarsus', foot: 'toes (phalanges)' });

// The trunk as a mammal rig marks it: no spine, only the pivots the body
// and head turn about.
export const mammalTrunk = (head: 'nose' | 'eye') => [
  ['tail root', 'hip', 'pelvis line (hip to tail root)'], ['hip', 'shoulder', 'back line (hip to shoulder)'],
  ['shoulder', 'neck', 'neck line (shoulder to head pivot)'], ['neck', head, 'skull'],
] as const;

// A bird's leg (rig/bird.ts): the femur runs inside the body to the knee,
// never drawn; the drumstick is the tibiotarsus, the bare leg below the
// ankle the tarsometatarsus, then the toes. Its wing is marked at the
// shoulder, the wrist and the wingtip, with no elbow between: the arm piece
// is the humerus and the forearm together, the hand piece the hand bones
// with the primaries on them.
export const BIRD: BoneNames = {
  legs: () => ({ upper: 'femur (inside the body)', middle: 'tibiotarsus (drumstick)', lower: 'tarsometatarsus', foot: 'toes' }),
  between: [
    ['hip', 'shoulder', 'back line (hip to shoulder)'],
    ['shoulder', 'wrist', 'arm (humerus, radius and ulna; no elbow)'], ['wrist', 'wingtip', 'hand and primaries'],
  ],
};

// An insect's leg as rig/hexapod.ts marks it: the coxa and trochanter are
// too small to show, so the first piece runs from the coxa's socket.
export const INSECT_LEGS: NonNullable<BoneNames['marked']> = {
  joints: ['coxa', 'knee', 'tibiotarsal joint', 'claws'],
  bones: ['femur (with coxa and trochanter)', 'tibia', 'tarsus'],
};
