import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { rabbit, rabbitAt } from '../../../lab/critters/rabbit';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { rabbitRig as built, type Pose } from './rabbit-rig';
import { rabbitRig as legacy } from './rabbit-rig-legacy';

// The rabbit moved onto its skeleton draws exactly what its old rig drew,
// but for its legs, now bent at relative hinges: a paw off the ledge hangs
// and folds from the bone above it (a planted one stands exactly as it
// did, which hinge.test.ts holds it to). So all but its legs' pieces, and
// the marks on the joints they move, must still match.
const LEG_MARKS = ['elbow', 'wrist (carpus)', 'forepaw', 'stifle (knee)', 'hock (heel)'];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/rabbit-(haunch|leg|foreleg|foot|paw)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});

describe('the rabbit on its skeleton', () => {
  it('draws what its old rig drew, but for its legs, in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(rabbit, (at, look) => legacy(rabbitAt(at), { now: at.now, ...look }), 10, ALL_BUT_LEGS)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its legs, as it eases from each pose into each other, which the lab does not show', () => {
    const poses: Pose[] = ['sit', 'alert', 'groom', 'hop', 'nudge', 'thump'];
    for (const was of poses) for (const pose of poses) for (const since of [0, 40, 90, 150, 220, 300]) {
      const r = { pose, was, walked: since / 9, since, seed: 1 };
      const look = { now: since + 500, gaze: 4, still: false };
      expect(planDiff(ALL_BUT_LEGS(planOf(built(r, look))), ALL_BUT_LEGS(planOf(legacy(r, look)))), `${was} to ${pose} at ${since}`).toEqual([]);
    }
  }, 60000);
});
