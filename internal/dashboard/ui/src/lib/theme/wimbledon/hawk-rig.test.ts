import { describe, expect, it } from 'vitest';
import { firstShut, guideAt, lidsOf, pageReach, rigBounds } from '../rig/test-rig';
import type { RigPose } from '../rig/rig';
import { GLIDE } from './hawk';
import { FOOTPRINTS, hawkRig, type HawkPose, type RigHawk } from './hawk-rig';

const hawk = (pose: HawkPose, over: Partial<RigHawk> = {}): RigHawk => ({ pose, seed: 2, beat: 0, gaze: 0, ...over });
const moments = (pose: HawkPose): RigPose[] => Array.from({ length: 240 }, (_, i) => hawkRig(hawk(pose, { beat: i / 60 }), { now: i * 37, still: false }));
const most = (rigs: readonly RigPose[], of: (r: RigPose) => number) => Math.max(...rigs.map(of));
const below = (r: RigPose) => (rigBounds(r).bottom - r.anchor.y) * r.scale;
const at = (pose: RigPose, name: string) => guideAt(pose, name) ?? { x: NaN, y: NaN };

describe('hawk rig', () => {
  for (const pose of ['glide', 'flap'] as const) {
    it(`stays inside its footprint while it does ${pose}`, () => {
      const rigs = moments(pose);
      const { width, height, down = 0 } = FOOTPRINTS[pose];
      expect(most(rigs, (r) => pageReach(r).left)).toBeLessThanOrEqual(width / 2);
      expect(most(rigs, (r) => pageReach(r).right)).toBeLessThanOrEqual(width / 2);
      expect(most(rigs, (r) => pageReach(r).top)).toBeLessThanOrEqual(height);
      expect(most(rigs, below)).toBeLessThanOrEqual(down + 1e-9);
    });
  }

  it('glides inside the box its sweep is planned with, about 1.6 times the pigeon long', () => {
    expect(GLIDE).toEqual({ half: FOOTPRINTS.glide.width / 2, up: FOOTPRINTS.glide.height, down: FOOTPRINTS.glide.down });
    // A pigeon standing is 20.17 drawing units long; the hawk's glide 32.25.
    expect(32.25 / 20.17).toBeCloseTo(1.6, 1);
  });

  it('flaps its wings through a deep stroke, and holds them out to glide', () => {
    const top = hawkRig(hawk('flap', { beat: 0 }), { now: 0, still: false });
    const bottom = hawkRig(hawk('flap', { beat: 0.55 }), { now: 0, still: false });
    expect(at(top, 'wingtip').y).toBeLessThan(at(top, 'shoulder').y - 8);
    expect(at(bottom, 'wingtip').y).toBeGreaterThan(at(bottom, 'shoulder').y + 8);
    const glides = moments('glide').map((r) => at(r, 'wingtip').y - at(r, 'shoulder').y);
    expect(Math.max(...glides) - Math.min(...glides)).toBeLessThan(1);
  });

  it('blinks, but not under reduced motion, and turns its head a little', () => {
    expect(firstShut((now) => hawkRig(hawk('glide'), { now, still: false }))).toBeDefined();
    expect(lidsOf(hawkRig(hawk('flap'), { now: 1234, still: true }))).toEqual([]);
    const turned = hawkRig(hawk('glide', { gaze: 8 }), { now: 0, still: true });
    expect(at(turned, 'eye').y).toBeGreaterThan(at(hawkRig(hawk('glide'), { now: 0, still: true }), 'eye').y);
  });
});
