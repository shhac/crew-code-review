import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { hare, hareAt } from '../../../lab/critters/hare';
import { hareRig as legacy } from './hare-rig-legacy';

// The hare moved onto its skeleton draws exactly what its old rig drew.
describe('the hare on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, held still, and looking either way as far as it goes', () => {
    expect(unlike(hare, (at, look) => legacy(hareAt(at), { now: at.now, ...look }))).toEqual([]);
  }, 60000);
});
