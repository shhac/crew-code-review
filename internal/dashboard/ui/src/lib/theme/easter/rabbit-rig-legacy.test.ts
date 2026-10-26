import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import type { Moment } from '../../../lab/critters/critter';
import { rabbit, rabbitAt } from '../../../lab/critters/rabbit';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { rabbitRig as built, type Pose } from './rabbit-rig';
import { rabbitRig as legacy } from './rabbit-rig-legacy';

// The rabbit moved onto its skeleton draws exactly what its old rig drew,
// but for its legs, now bent at relative hinges: a paw off the ledge hangs
// and folds from the bone above it (a planted one stands exactly as it
// did, which hinge.test.ts holds it to). So all but its legs' pieces, and
// the marks on the joints they move, must still match; nor did it mark
// the head joint at the back of the skull.
const LEG_MARKS = ['elbow', 'wrist (carpus)', 'forepaw', 'stifle (knee)', 'hock (heel)', 'head joint'];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/rabbit-(haunch|leg|foreleg|foot|paw)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});
// Nudging, its head nods at the back of its skull, where the old rig
// turned it about the throat and swung the back of it off the body: so
// there, all but its head and what is on it too (its eyelid, a lid and a
// line, the only shapes it draws).
const HEAD_MARKS = ['ear base', 'eye', 'nose'];
const ALL_BUT_LEGS_AND_HEAD = (plan: Plan): Plan => {
  const legless = ALL_BUT_LEGS(plan);
  return {
    ...legless,
    draws: legless.draws.filter((d) => d.kind === 'image' && !/rabbit-(head|ears)/.test(d.href)),
    guides: legless.guides.filter((g) => !HEAD_MARKS.includes(g.name)),
  };
};
const butFor = (...poses: Pose[]) => (poses.includes('nudge') ? ALL_BUT_LEGS_AND_HEAD : ALL_BUT_LEGS);
const nudging = (rig: typeof rabbit, nudge: boolean) => ({ ...rig, modes: rig.modes.filter((m) => (m === 'nudge') === nudge) });

describe('the rabbit on its skeleton', () => {
  it('draws what its old rig drew, but for its legs (and nudging, its head), in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    const old = (at: Moment, look: { gaze: number; still: boolean }) => legacy(rabbitAt(at), { now: at.now, ...look });
    expect(unlike(nudging(rabbit, false), old, 10, ALL_BUT_LEGS)).toEqual([]);
    expect(unlike(nudging(rabbit, true), old, 10, ALL_BUT_LEGS_AND_HEAD)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its legs (and into or out of a nudge, its head), as it eases from each pose into each other, which the lab does not show', () => {
    const poses: Pose[] = ['sit', 'alert', 'groom', 'hop', 'nudge', 'thump'];
    for (const was of poses) for (const pose of poses) for (const since of [0, 40, 90, 150, 220, 300]) {
      const r = { pose, was, walked: since / 9, since, seed: 1 };
      const look = { now: since + 500, gaze: 4, still: false };
      const except = butFor(was, pose);
      expect(planDiff(except(planOf(built(r, look))), except(planOf(legacy(r, look)))), `${was} to ${pose} at ${since}`).toEqual([]);
    }
  }, 60000);
});
