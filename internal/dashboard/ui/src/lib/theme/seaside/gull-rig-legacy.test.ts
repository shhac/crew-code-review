import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { gull, gullAt } from '../../../lab/critters/gull';
import { BIRD_JOINTS } from '../rig/bird';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { gullRig as built, type GullPose } from './gull-rig';
import { gullRig as legacy } from './gull-rig-legacy';

// The gull moved onto its skeleton draws exactly what its old rig drew,
// but for its head, which now turns toward what it eyes on the neck's top
// at the nape rather than at the neck's base: the head, its lower
// mandible, the gape between, its eyelid and its marks on them; and its
// legs in the air, now held as its body holds them, tucked or trailing:
// their pieces and the marks on their joints.
const LEG_MARKS: readonly string[] = [BIRD_JOINTS.hip, BIRD_JOINTS.knee, BIRD_JOINTS.ankle, BIRD_JOINTS.foot];
const BODY_ONLY = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind === 'image' && !/gull-(head|mandible|drumstick|tarsus|toes)/.test(d.href)),
  guides: plan.guides.filter((g) => g.name !== 'eye' && g.name !== 'gape' && !LEG_MARKS.includes(g.name)),
});

describe('the gull on its skeleton', () => {
  it('draws what its old rig drew, but for its head, in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(gull, (at, look) => legacy(gullAt(at), { now: at.now, ...look }), 10, BODY_ONLY)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its head, in every pose through its whole motion, eyeing things as far up and down as it looks', () => {
    const poses: GullPose[] = ['stand', 'strut', 'forage', 'eye', 'call', 'takeoff', 'flap', 'glide', 'stoop', 'flare', 'settle'];
    for (const pose of poses) for (const gaze of [-10, 0, 25]) for (let i = 0; i < 100; i += 1) {
      const g = { pose, walked: i * 0.6, seed: 1, beat: pose === 'takeoff' ? -0.5 + i / 25 : i / 30, t: i / 99 };
      const look = { now: i * 37, still: false, gaze };
      expect(planDiff(BODY_ONLY(planOf(built(g, look))), BODY_ONLY(planOf(legacy(g, look)))), `${pose} ${i} gaze ${gaze}`).toEqual([]);
    }
  }, 60000);
});
