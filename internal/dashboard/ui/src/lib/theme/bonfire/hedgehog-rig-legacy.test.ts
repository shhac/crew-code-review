import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { hedgehog, hogAt } from '../../../lab/critters/hedgehog';
import { planDiff, planOf } from '../rig/skeleton/plan';
import type { Hog } from './hedgehog';
import { hogRig as built } from './hedgehog-rig';
import { hogRig as legacy } from './hedgehog-rig-legacy';

// The hedgehog moved onto its skeleton draws exactly what its old rig drew.
describe('the hedgehog on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(hedgehog, (at, look) => legacy(hogAt(at), { now: at.now, ...look }))).toEqual([]);
  });

  it('draws what it drew going home, which the lab does not show', () => {
    const hog: Hog = { id: 0, seed: 1, x: 0, dir: 1, mode: 'home', target: 0, until: 0, out: 0, walked: 0 };
    for (const now of Array.from({ length: 120 }, (_, i) => i * 40)) {
      const at = { ...hog, walked: now / 30 };
      const look = { now, gaze: 0, still: false };
      expect(planDiff(planOf(built(at, look)), planOf(legacy(at, look))), `home at ${now}`).toEqual([]);
    }
  });
});
