import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { hawk, hawkAt } from '../../../lab/critters/hawk';
import { planDiff, planOf } from '../rig/skeleton/plan';
import { hawkRig as built } from './hawk-rig';
import { hawkRig as legacy } from './hawk-rig-legacy';

// The hawk moved onto its skeleton draws exactly what its old rig drew.
describe('the hawk on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, and held still', () => {
    expect(unlike(hawk, (at, look) => legacy(hawkAt(at), { now: at.now, still: look.still }))).toEqual([]);
  });

  it('draws what it drew turning its head toward what it passes, either way', () => {
    for (const pose of ['glide', 'flap'] as const) for (const gaze of [-8, 8]) for (let i = 0; i < 60; i += 1) {
      const h = { pose, seed: 2, beat: i / 13, gaze };
      const look = { now: i * 53, still: false };
      expect(planDiff(planOf(built(h, look)), planOf(legacy(h, look))), `${pose} ${i} gaze ${gaze}`).toEqual([]);
    }
  });
});
