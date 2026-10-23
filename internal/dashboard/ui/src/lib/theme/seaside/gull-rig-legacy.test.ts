import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { gull, gullAt } from '../../../lab/critters/gull';
import { planDiff, planOf } from '../rig/skeleton/plan';
import { gullRig as built, type GullPose } from './gull-rig';
import { gullRig as legacy } from './gull-rig-legacy';

// The gull moved onto its skeleton draws exactly what its old rig drew.
describe('the gull on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, and held still', () => {
    expect(unlike(gull, (at, look) => legacy(gullAt(at), { now: at.now, still: look.still }))).toEqual([]);
  });

  it('draws what it drew in every pose through its whole motion, eyeing things as far up and down as it looks', () => {
    const poses: GullPose[] = ['stand', 'strut', 'forage', 'eye', 'call', 'takeoff', 'flap', 'glide', 'stoop', 'flare', 'settle'];
    for (const pose of poses) for (const gaze of [-10, 0, 25]) for (let i = 0; i < 100; i += 1) {
      const g = { pose, walked: i * 0.6, seed: 1, beat: pose === 'takeoff' ? -0.5 + i / 25 : i / 30, t: i / 99 };
      const look = { now: i * 37, still: false, gaze };
      expect(planDiff(planOf(built(g, look)), planOf(legacy(g, look))), `${pose} ${i} gaze ${gaze}`).toEqual([]);
    }
  }, 60000);
});
