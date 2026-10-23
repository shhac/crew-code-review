// A bird's wing on the skeleton (July's pigeons and hawk, August's gulls,
// September's crows), as rig/wings.ts's birdWing draws it: the shoulder a
// joint at the wing's own root, foreshortened across by the sine of its lift
// and swept in the wing's plane; the wrist a joint the hand folds about; the
// wingtip a point the hand carries. A wing is a bird's forelimb (L0 the
// near, L1 the far), its joints authored, posed from its WingPose. Each
// piece, the arm and the hand, is drawn with its upper side and its
// underside, the one facing the eye shown; folded away into the body's own
// folded wing, neither.
import type { Point } from '../../pointer';
import { foreshortening, wingFace, type WingArt, type WingPose } from '../wings';
import type { BoneSpec, JointPose, JointSpec, Piece, PoseSpec, Side } from './types';

// The wing's art, which side it is on, the joint it hangs from and where on
// the bird its shoulder is (in that joint's rest space), the wingtip in the
// wing's own flat drawing, and the draw order its pieces take.
export type WingSpec = { art: WingArt; side: Side; parent: string; root: Point; tip: Point; z: number };

export type Wing = {
  joints: readonly JointSpec[];
  bones: readonly BoneSpec[];
  pieces: readonly Piece[];
  ids: { shoulder: string; wrist: string; tip: string };
  // Its joints held as `pose` and the face shown, seen from `view` degrees
  // above level; not `shown`, every piece drawn unseen.
  pose: (pose: WingPose, view?: number, shown?: boolean) => Pick<PoseSpec, 'joints' | 'show'>;
};

export function wingOf({ art, side, parent, root, tip, z }: WingSpec): Wing {
  const code = `L${side === 'far' ? 1 : 0}`;
  const ids = { shoulder: `${code}J0`, wrist: `${code}J1`, tip: `${code}J2` };
  const role = (index: 0 | 1 | 2) => ({ part: 'limb', pair: 0, side, index }) as const;
  const joints: JointSpec[] = [
    { id: ids.shoulder, parent, role: role(0), at: art.shoulder, name: 'shoulder' },
    { id: ids.wrist, parent: ids.shoulder, role: role(1), at: art.wrist, name: 'wrist' },
    { id: ids.tip, parent: ids.wrist, role: role(2), at: tip, name: 'wingtip' },
  ];
  const bones = [{ from: ids.shoulder, to: ids.wrist, name: 'arm (humerus, radius and ulna; no elbow)' }, { from: ids.wrist, to: ids.tip, name: 'hand and primaries' }];
  // The hand under the arm, its cut end hidden beneath the arm's rounded
  // wrist.
  const piece = (part: 'hand' | 'arm', to: string): Piece => {
    const { upper, under, ...box } = art[part];
    return { id: `${code} ${part}`, side, art: { upper: { src: upper, box }, under: { src: under, box } }, at: { kind: 'joint', to }, draws: [{ id: `${code} ${part}`, z, part: `${art.name} ${part}` }] };
  };
  const pieces = [piece('hand', ids.wrist), piece('arm', ids.shoulder)];
  const pose = (wing: WingPose, view = 0, shown = true) => {
    const face: string | false = shown ? wingFace(wing.lift, side === 'far', view) : false;
    const posed: Record<string, JointPose> = {
      [ids.shoulder]: { angle: -wing.sweep, foreshorten: foreshortening(wing.lift), shift: { x: root.x - art.shoulder.x, y: root.y - art.shoulder.y } },
      [ids.wrist]: { angle: -wing.fold },
    };
    return { joints: posed, show: Object.fromEntries(pieces.map((p) => [p.id, face])) };
  };
  return { joints, bones, pieces, ids, pose };
}
