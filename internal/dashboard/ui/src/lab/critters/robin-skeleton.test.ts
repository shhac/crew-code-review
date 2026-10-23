import { describe, expect, it } from 'vitest';
import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import { partsLayers, partsPose } from '../../lib/theme/christmas/parts-pose';
import { robinSkeleton } from './robin-skeleton';

const joint = (mode: string, now: number, code: string) => robinSkeleton(mode, now, false, false).joints.find((j) => j.code === code)?.at;

describe("the robin's skeleton", () => {
  // A point a picture turns about stays put however far it turns, so each
  // joint is where its picture is drawn turning.
  it('puts each joint where its picture turns, the head lower when it pecks', () => {
    for (const [mode, now] of [['peck', 1120], ['tilt', 750], ['hop', 1250], ['flight', 100]] as const) {
      const pose = partsPose(now, mode);
      const head = partsLayers(pose).find((l) => l.id === 'head');
      const at = joint(mode, now, 'SJ0');
      expect(head && at, mode).toBeTruthy();
      if (!head || !at) continue;
      const turnedOnly = head.transform.replace(/rotate\([^)]*\)$/, '');
      const [x, y] = transformPoint(turnedOnly, 82, pose.headPivotY);
      expect(at.x, mode).toBeCloseTo(x, 6);
      expect(at.y, mode).toBeCloseTo(y, 6);
    }
    expect(joint('peck', 1120, 'SJ0')?.y).toBeGreaterThan((joint('peck', 0, 'SJ0')?.y ?? 0) + 5);
  });

  it("gives a standing leg its ankle, where it turns in a hop, over the foot it squashes from", () => {
    const s = robinSkeleton('hop', 1250, false, false);
    expect(s.joints.filter((j) => j.code.startsWith('L2') || j.code.startsWith('L3')).map((j) => j.code)).toEqual(['L3J2', 'L3J3', 'L2J2', 'L2J3']);
    expect(s.bones.filter((b) => b.code.startsWith('L')).map((b) => [b.code, b.from, b.to])).toEqual([['L2B2', 'L2J2', 'L2J3'], ['L3B2', 'L3J2', 'L3J3']]);
    const ankle = joint('alive', 0, 'L2J2'), foot = joint('alive', 0, 'L2J3');
    expect(ankle && foot && foot.y - ankle.y).toBeGreaterThan(10);
    expect(joint('flight', 100, 'L2J1')).toBeTruthy();
  });
});
