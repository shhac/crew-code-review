import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { hedgehog, hogAt } from '../../../lab/critters/hedgehog';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import type { Hog } from './hedgehog';
import { hogRig as built } from './hedgehog-rig';
import { hogRig as legacy } from './hedgehog-rig-legacy';

// The hedgehog moved onto its skeleton draws exactly what its old rig drew,
// but for its legs, now real bones bent at relative hinges, the hip and
// knee hidden in the body and each piece held rigid on its shin, drawn
// behind the body: all but its legs' pieces and the marks on their joints
// must still match.
const LEG_MARKS = ['shoulder', 'hip', 'wrist', 'ankle'];
const ALL_BUT_LEGS = (plan: Plan): Plan => ({
  ...plan,
  draws: plan.draws.filter((d) => d.kind !== 'image' || !/hedgehog-(leg|hand|hind)/.test(d.href)),
  guides: plan.guides.filter((g) => !LEG_MARKS.includes(g.name)),
});

describe('the hedgehog on its skeleton', () => {
  it('draws what its old rig drew, but for its legs, in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(hedgehog, (at, look) => legacy(hogAt(at), { now: at.now, ...look }), 10, ALL_BUT_LEGS)).toEqual([]);
  }, 60000);

  it('draws what it drew going home, but for its legs, which the lab does not show', () => {
    const hog: Hog = { id: 0, seed: 1, x: 0, dir: 1, mode: 'home', target: 0, until: 0, out: 0, walked: 0 };
    for (const now of Array.from({ length: 120 }, (_, i) => i * 40)) {
      const at = { ...hog, walked: now / 30 };
      const look = { now, gaze: 0, still: false };
      expect(planDiff(ALL_BUT_LEGS(planOf(built(at, look))), ALL_BUT_LEGS(planOf(legacy(at, look)))), `home at ${now}`).toEqual([]);
    }
  });
});
