import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { rabbit, rabbitAt } from '../../../lab/critters/rabbit';
import { planDiff, planOf } from '../rig/skeleton/plan';
import { rabbitRig as built, type Pose } from './rabbit-rig';
import { rabbitRig as legacy } from './rabbit-rig-legacy';

// The rabbit moved onto its skeleton draws exactly what its old rig drew.
describe('the rabbit on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(rabbit, (at, look) => legacy(rabbitAt(at), { now: at.now, ...look }))).toEqual([]);
  });

  it('draws what it drew as it eases from each pose into each other, which the lab does not show', () => {
    const poses: Pose[] = ['sit', 'alert', 'groom', 'hop', 'nudge', 'thump'];
    for (const was of poses) for (const pose of poses) for (const since of [0, 40, 90, 150, 220, 300]) {
      const r = { pose, was, walked: since / 9, since, seed: 1 };
      const look = { now: since + 500, gaze: 4, still: false };
      expect(planDiff(planOf(built(r, look)), planOf(legacy(r, look))), `${was} to ${pose} at ${since}`).toEqual([]);
    }
  });
});
