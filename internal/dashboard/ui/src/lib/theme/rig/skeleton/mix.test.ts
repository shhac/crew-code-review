import { describe, expect, it } from 'vitest';
import type { Step } from '../gait';
import { compose } from './compose';
import { BODY, poseOf, type Moment } from './fixture';
import { handleAt } from './forward';
import { mixPose } from './mix';
import { planDiff, planOf } from './plan';

const at = (mode: Moment['mode'], now = 400): Moment => ({ mode, now, walked: now / 50, still: false });
const drawn = (pose: ReturnType<typeof poseOf>) => planOf(compose(BODY, () => pose, 0));

describe('mixPose', () => {
  const [walk, curl] = [poseOf(at('walk')), poseOf(at('curl'))];

  it('is the one pose at its start (drawn in the order, and showing what, the next one does) and the other at its end', () => {
    // Steps, mixed by default as the next pose has them, here go over halfway.
    const halfway = (a?: Step, b?: Step, f = 0) => (f < 0.5 ? a : b);
    const steps = { steps: { L0: halfway, L2: halfway } };
    expect(planDiff(drawn(mixPose(BODY.skeleton, walk, curl, 0, steps)), drawn({ ...walk, show: curl.show, z: curl.z }))).toEqual([]);
    expect(planDiff(drawn(mixPose(BODY.skeleton, walk, curl, 1, steps)), drawn(curl))).toEqual([]);
    expect(planDiff(drawn(mixPose(BODY.skeleton, walk, curl, 1)), drawn(curl))).toEqual([]);
  });

  it('turns the root and every joint part way, and shows what the next pose shows', () => {
    const half = mixPose(BODY.skeleton, walk, curl, 0.5);
    expect(half.root.angle).toBeCloseTo((walk.root.angle + curl.root.angle) / 2, 12);
    expect(half.joints.tail?.angle).toBeCloseTo(((walk.joints.tail?.angle ?? 0) + (curl.joints.tail?.angle ?? 0)) / 2, 12);
    expect(half.joints.pelvis?.squash?.by).toBeCloseTo(((walk.joints.pelvis?.squash?.by ?? 1) + (curl.joints.pelvis?.squash?.by ?? 1)) / 2, 12);
    expect([half.show, half.z]).toEqual([curl.show, curl.z]);
  });

  it('moves a reaching foot from where it was to where it reaches in its own pose', () => {
    const half = mixPose(BODY.skeleton, walk, curl, 0.25);
    const from = walk.limbs.L0, reach = curl.limbs.L0;
    if (from?.kind !== 'plant' || reach?.kind !== 'reach') throw new Error('the test animal reaches another way now');
    const to = handleAt(BODY.skeleton, curl, reach.to);
    const goal = half.limbs.L0;
    const target = { x: to.x + (reach.by?.x ?? 0), y: to.y + (reach.by?.y ?? 0) };
    expect(goal?.kind === 'plant' && [goal.at.x, goal.at.y]).toEqual([expect.closeTo(from.at.x + (target.x - from.at.x) / 4, 9), expect.closeTo(from.at.y + (target.y - from.at.y) / 4, 9)]);
  });

  it('takes the next pose\'s step, or the last\'s where it has none, unless the limb has its own mixer', () => {
    const stepping = poseOf(at('walk', 520));
    const standing = poseOf(at('stand'));
    const stepOf = (pose: ReturnType<typeof poseOf>, limb: string) => {
      const goal = pose.limbs[limb];
      return goal?.kind === 'plant' ? goal.step : undefined;
    };
    expect(stepOf(mixPose(BODY.skeleton, stepping, standing, 0.5), 'L2')).toEqual(stepOf(stepping, 'L2'));
    const folded = mixPose(BODY.skeleton, stepping, standing, 0.5, { steps: { L0: () => ({ down: false, t: 0.3 }) } });
    expect([stepOf(folded, 'L0'), stepOf(folded, 'L2')]).toEqual([{ down: false, t: 0.3 }, stepOf(stepping, 'L2')]);
  });
});
