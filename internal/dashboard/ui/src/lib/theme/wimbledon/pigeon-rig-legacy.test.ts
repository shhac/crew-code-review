import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { pigeon, pigeonAt } from '../../../lab/critters/pigeon';
import { BIRD_JOINTS } from '../rig/bird';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { LOOK, pigeonRig as built, type PigeonPose } from './pigeon-rig';
import { pigeonRig as legacy } from './pigeon-rig-legacy';

// The pigeon moved onto its skeleton draws exactly what its old rig drew,
// but for its legs in the air, now held as its body holds them, tucked or
// trailing (reaching to land they meet the ledge as they did). So all but
// its legs' pieces, and the marks on their joints, must still match.
const LEG_MARKS: readonly string[] = [BIRD_JOINTS.hip, BIRD_JOINTS.knee, BIRD_JOINTS.ankle, BIRD_JOINTS.foot];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/pigeon-(thigh|shank|foot)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});

describe('the pigeon on its skeleton', () => {
  it('draws what its old rig drew, but for its legs, in every moment the lab shows, and held still', () => {
    expect(unlike(pigeon, (at, look) => legacy(pigeonAt(at), { now: at.now, still: look.still }), 10, ALL_BUT_LEGS)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its legs, in every pose through its whole motion, its head turned as far as it goes either way', () => {
    const poses: PigeonPose[] = ['stand', 'walk', 'peck', 'alert', 'takeoff', 'fly', 'land', 'settle'];
    for (const pose of poses) for (const gaze of [-LOOK, 0, LOOK]) for (let i = 0; i < 120; i += 1) {
      const p = { pose, walked: i * 0.6, seed: 1, beat: pose === 'takeoff' ? -0.5 + i / 25 : i / 30, t: i / 119, gaze };
      const look = { now: i * 37, still: false };
      expect(planDiff(ALL_BUT_LEGS(planOf(built(p, look))), ALL_BUT_LEGS(planOf(legacy(p, look)))), `${pose} ${i} gaze ${gaze}`).toEqual([]);
    }
  }, 60000);
});
