import { describe, expect, it } from 'vitest';
import type { Moment } from '../../../lab/critters/critter';
import { unlike } from '../../../lab/critters/equivalence';
import { crow, crowAt } from '../../../lab/critters/crow';
import { BIRD_JOINTS } from '../rig/bird';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { crowRig as built, grounded, type CrowPose } from './crow-rig';
import { crowRig as legacy } from './crow-rig-legacy';

// The crow moved onto its skeleton draws exactly what its old rig drew,
// but for its head, which now turns its small turns on the neck's top,
// behind the eye, rather than at the neck's base: the head, its eyelid and
// its marks on them; and its legs in the air, now held as its body holds
// them when tucked: their pieces and the marks on their joints. Its sidle
// is a skip now, not the hurried walk the old rig drew, so it is left out.
const LEG_MARKS: readonly string[] = [BIRD_JOINTS.hip, BIRD_JOINTS.knee, BIRD_JOINTS.ankle, BIRD_JOINTS.foot];
const BODY_ONLY = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind === 'image' && !/crow-(head|drumstick|tarsus|foot)/.test(d.href)),
  guides: plan.guides.filter((g) => g.name !== 'eye' && g.name !== 'bill' && !LEG_MARKS.includes(g.name)),
});

describe('the crow on its skeleton', () => {
  it('draws what its old rig drew, but for its head, in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    const old = (at: Moment, look: { gaze: number; still: boolean }) => {
      const c = crowAt(at);
      const seen = { now: at.now, still: look.still, gaze: grounded(c.pose) ? look.gaze : 0 };
      return c.pose === 'sidle' ? built(c, seen) : legacy(c, seen);
    };
    expect(unlike(crow, old, 10, BODY_ONLY)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its head, in every pose through its whole motion, high and low in the air, climbing and diving', () => {
    const poses: CrowPose[] = ['stand', 'walk', 'peck', 'alert', 'takeoff', 'flap', 'skim', 'glide', 'flare', 'settle'];
    for (const pose of poses) for (const [depth, climb] of [[1, 0], [0, 8], [0.5, -6]]) for (let i = 0; i < 80; i += 1) {
      const c = { pose, walked: i * 0.7, seed: 1, beat: pose === 'takeoff' ? -0.5 + i / 20 : i / 25, t: i / 79, depth, climb };
      const look = { now: i * 41, still: false, gaze: (i % 5) * 4 - 6 };
      expect(planDiff(BODY_ONLY(planOf(built(c, look))), BODY_ONLY(planOf(legacy(c, look)))), `${pose} ${i} depth ${depth}`).toEqual([]);
    }
  }, 60000);
});
