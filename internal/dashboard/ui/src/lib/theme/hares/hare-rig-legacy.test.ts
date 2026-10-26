import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { hare, hareAt } from '../../../lab/critters/hare';
import type { Plan } from '../rig/skeleton/plan';
import { hareRig as legacy } from './hare-rig-legacy';

// The hare moved onto its skeleton draws exactly what its old rig drew,
// but for its legs, now bent at relative hinges: a paw off the ground
// hangs and folds from the bone above it (a planted one stands exactly as
// it did, which hinge.test.ts holds it to). So all but its legs' pieces,
// and the marks on the joints they move, must still match.
const LEG_MARKS = ['elbow', 'wrist (carpus)', 'stifle (knee)', 'hock (ankle)', 'toes'];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/hare-(thigh|shank|hind|fore|upper-arm)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});

describe('the hare on its skeleton', () => {
  it('draws what its old rig drew, but for its legs, in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(hare, (at, look) => legacy(hareAt(at), { now: at.now, ...look }), 10, ALL_BUT_LEGS)).toEqual([]);
  }, 60000);
});
