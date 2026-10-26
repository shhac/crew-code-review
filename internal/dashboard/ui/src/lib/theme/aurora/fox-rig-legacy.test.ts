import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { fox, foxAt } from '../../../lab/critters/fox';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { LEAP, type Mode } from './fox';
import { foxRig as built } from './fox-rig';
import { foxRig as legacy } from './fox-rig-legacy';

// The fox moved onto its skeleton draws exactly what its old rig drew,
// but for its legs, now bent at relative hinges: a paw off the ground
// hangs and folds from the bone above it (a planted one stands exactly as
// it did, which hinge.test.ts holds it to). So all but its legs' pieces,
// and the marks on the joints they move, must still match.
const LEG_MARKS = ['elbow', 'wrist (carpus)', 'stifle (knee)', 'hock (ankle)', 'toes'];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/fox-(haunch|leg|toes)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});

describe('the fox on its skeleton', () => {
  it('draws what its old rig drew, but for its legs, in every moment the lab shows, and held still', () => {
    expect(unlike(fox, (at, look) => legacy(foxAt(at), { now: at.now, still: look.still }), 10, ALL_BUT_LEGS)).toEqual([]);
  }, 60000);

  it('draws what it drew, but for its legs, in every mode it has, waking, going and coming back too', () => {
    const modes: Mode[] = ['asleep', 'waking', 'stretch', 'trot', 'exit', 'away', 'enter', 'settle', 'crouch', 'leap', 'dig'];
    for (const mode of modes) for (const ear of [0, 1]) for (let i = 0; i < 60; i += 1) {
      const f = { mode, walked: i * 0.7, seed: 1, until: i * 50 - (i * 50) % 900 + LEAP, ear, look: i % 7 ? 0 : Infinity };
      const look = { now: i * 50, still: false };
      expect(planDiff(ALL_BUT_LEGS(planOf(built(f, look))), ALL_BUT_LEGS(planOf(legacy(f, look)))), `${mode} ${i}`).toEqual([]);
    }
  }, 60000);
});
