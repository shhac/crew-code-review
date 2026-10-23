import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { fox, foxAt } from '../../../lab/critters/fox';
import { planDiff, planOf } from '../rig/skeleton/plan';
import { LEAP, type Mode } from './fox';
import { foxRig as built } from './fox-rig';
import { foxRig as legacy } from './fox-rig-legacy';

// The fox moved onto its skeleton draws exactly what its old rig drew.
describe('the fox on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, and held still', () => {
    expect(unlike(fox, (at, look) => legacy(foxAt(at), { now: at.now, still: look.still }))).toEqual([]);
  });

  it('draws what it drew in every mode it has, waking, going and coming back too', () => {
    const modes: Mode[] = ['asleep', 'waking', 'stretch', 'trot', 'exit', 'away', 'enter', 'settle', 'crouch', 'leap', 'dig'];
    for (const mode of modes) for (const ear of [0, 1]) for (let i = 0; i < 60; i += 1) {
      const f = { mode, walked: i * 0.7, seed: 1, until: i * 50 - (i * 50) % 900 + LEAP, ear, look: i % 7 ? 0 : Infinity };
      const look = { now: i * 50, still: false };
      expect(planDiff(planOf(built(f, look)), planOf(legacy(f, look))), `${mode} ${i}`).toEqual([]);
    }
  }, 60000);
});
