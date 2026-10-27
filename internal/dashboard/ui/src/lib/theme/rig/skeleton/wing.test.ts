import { describe, expect, it } from 'vitest';
import type { Point } from '../../pointer';
import { turnAbout, turned, type Frame, type Layer, type RigPose } from '../rig';
import { FOLDED, foreshortening, wingFace, type WingArt, type WingPose } from '../wings';
import { compose } from './compose';
import { planDiff, planOf } from './plan';
import type { Body } from './types';
import { wingOf } from './wing';
import { skeletonFromPosed } from '../../../../lab/skeleton';

// A wing as the birds' rigs drew it before their skeletons, kept as what
// the skeleton's wing is held to: moved to its root and foreshortened about
// its shoulder, swept about the shoulder, the hand folded about the wrist
// and drawn under the arm, each piece's upper side and underside both drawn
// and only the facing one seen; folded away, neither.
const placing = (art: WingArt, pose: WingPose, root: Point) => ({
  placed: turnAbout(0, art.shoulder, root.x - art.shoulder.x, root.y - art.shoulder.y),
  swept: turnAbout(-pose.sweep, art.shoulder),
  folded: turnAbout(-pose.fold, art.wrist),
});
function birdWing(art: WingArt, pose: WingPose, root: Point, far: boolean, shown: boolean): Layer {
  const face = wingFace(pose.lift, far, 0);
  const sides = (piece: WingArt['arm'], part: string): Layer[] => (['upper', 'under'] as const).map((side) => ({
    kind: 'image', name: `${art.name} ${part}${side === 'under' ? ', underside' : ''}`, src: piece[side],
    x: piece.x, y: piece.y, width: piece.width, height: piece.height, far, hidden: !shown || side !== face,
  }));
  const { placed, swept, folded } = placing(art, pose, root);
  const hand: Layer = { kind: 'group', turn: folded, layers: sides(art.hand, 'hand') };
  return { kind: 'group', turn: placed, foreshorten: foreshortening(pose.lift), layers: [{ kind: 'group', turn: swept, layers: [hand, ...sides(art.arm, 'arm')] }] };
}
// Where a point of the wing's flat drawing was drawn, on the hand or the arm.
function wingPoint(art: WingArt, pose: WingPose, root: Point, p: Point, onHand: boolean): Point {
  const { placed, swept, folded } = placing(art, pose, root);
  const inPlane = turned(swept, onHand ? turned(folded, p) : p);
  return turned(placed, { x: inPlane.x, y: art.shoulder.y + (inPlane.y - art.shoulder.y) * foreshortening(pose.lift) });
}

const FRAME: Frame = { width: 30, height: 20, anchor: { x: 15, y: 18 }, scale: 1.5 };
const ART: WingArt = {
  name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: -0.9, y: -8 },
  arm: { upper: 'arm.webp', under: 'arm-under.webp', x: -3.9, y: -9.2, width: 5.58, height: 9.42 },
  hand: { upper: 'hand.webp', under: 'hand-under.webp', x: -4, y: -16.6, width: 5.67, height: 10 },
};
const TIP = { x: -1.6, y: -16.2 };
const NEAR = { x: 14.2, y: 7.6 }, FAR = { x: 15.3, y: 7 };
const far = wingOf({ art: ART, side: 'far', parent: 'body', root: FAR, tip: TIP, z: 0 });
const near = wingOf({ art: ART, side: 'near', parent: 'body', root: NEAR, tip: TIP, z: 1 });
const BODY: Body = {
  frame: FRAME,
  skeleton: { joints: [{ id: 'body', parent: null, role: { part: 'spine', index: 2 }, at: { x: 12, y: 10 }, name: 'body' }, ...far.joints, ...near.joints], bones: [...far.bones, ...near.bones], limbs: [] },
  pieces: [...far.pieces, ...near.pieces],
  titles: { L0: 'wing', L1: 'wing' },
};
const ROOT = turnAbout(-12, { x: 13, y: 12 });
const posed = (wing: WingPose, shown: boolean): RigPose => {
  const [a, b] = [far.pose(wing, 0, shown), near.pose(wing, 0, shown)];
  return compose(BODY, () => ({ root: ROOT, joints: { ...a.joints, ...b.joints }, limbs: {}, show: { ...a.show, ...b.show }, z: {} }), 0);
};
const drawn = (wing: WingPose, shown: boolean): RigPose =>
  ({ ...FRAME, layers: [{ kind: 'group', turn: ROOT, layers: [birdWing(ART, wing, FAR, true, shown), birdWing(ART, wing, NEAR, false, shown)] }] });
const POSES: WingPose[] = [
  { lift: 40, sweep: 20, fold: 30 }, { lift: -55, sweep: -10, fold: 120 }, { lift: 3, sweep: 50, fold: 150 }, { lift: -2, sweep: 0, fold: 0 },
  { lift: 60, sweep: 0, fold: 0 }, { lift: -30, sweep: 0, fold: 0 }, { lift: 90, sweep: 0, fold: 90 }, { lift: 90, sweep: 30, fold: 0 }, FOLDED,
];

describe('a wing on the skeleton', () => {
  it('draws as the birds drew their wings, either side, its facing side seen, and folded away unseen', () => {
    for (const wing of POSES) for (const shown of [true, false]) {
      expect(planDiff({ ...planOf(posed(wing, shown)), guides: [] }, { ...planOf(drawn(wing, shown)), guides: [] }), JSON.stringify(wing)).toEqual([]);
    }
  });

  it('carries its wrist and wingtip where the birds\' wings had them, coded as the bird\'s forelimb', () => {
    for (const wing of POSES) {
      const joints = posed(wing, true).skeleton?.joints ?? [];
      const at = (code: string) => joints.find((j) => j.code === code)?.at;
      const want = turned(ROOT, wingPoint(ART, wing, NEAR, TIP, true));
      expect([at('L0J2')?.x, at('L0J2')?.y]).toEqual([expect.closeTo(want.x, 9), expect.closeTo(want.y, 9)]);
      const wrist = turned(ROOT, wingPoint(ART, wing, FAR, ART.wrist, false));
      expect([at('L1J1')?.x, at('L1J1')?.y]).toEqual([expect.closeTo(wrist.x, 9), expect.closeTo(wrist.y, 9)]);
    }
    const skeleton = posed(POSES[0], true).skeleton;
    expect(skeleton?.joints.filter((j) => j.far).map((j) => `${j.code} ${j.name}`)).toEqual(['L1J0 shoulder', 'L1J1 wrist', 'L1J2 wingtip']);
    if (!skeleton) return;
    expect(skeletonFromPosed(skeleton).groups.map((g) => `${g.code} ${g.title}`)).toEqual(['L0 near wing', 'L1 far wing', 'S spine']);
  });
});
