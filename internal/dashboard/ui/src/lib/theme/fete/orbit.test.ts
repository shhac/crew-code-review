import { describe, expect, it } from 'vitest';
import { meets } from '../air';
import { grown } from './air';
import { MEDIUM, SHORT, TALL, places } from './fixtures';
import { SPACE } from './flight';
import { APART, bandOf, orbitFits, orbitOf } from './orbit';
import { CAKE } from './table';
import { zoneOf } from './wasp';

describe('the wasps\' orbits', () => {
  it('keeps the two bands a footprint and 6px apart, and wasp 1\'s spot clear of wasp 0\'s band', () => {
    const low = bandOf(orbitOf(0, places)), high = bandOf(orbitOf(1, places));
    expect(low.top - high.bottom).toBeCloseTo(APART);
    expect(meets(grown(zoneOf(1, places), SPACE), low)).toBe(false);
    const zone0 = zoneOf(0, places);
    expect(zone0.left).toBeGreaterThanOrEqual(low.left);
    expect(zone0.right).toBeLessThanOrEqual(low.right);
    expect(zone0.top).toBeGreaterThanOrEqual(low.top);
    expect(zone0.bottom).toBeLessThanOrEqual(low.bottom);
  });

  it('needs about 32px above the cake for the low orbit and 80 for the high one', () => {
    expect(CAKE.y - bandOf(orbitOf(0, places)).top).toBeCloseTo(31.5, 0);
    expect(CAKE.y - bandOf(orbitOf(1, places)).top).toBeCloseTo(80, 0);
    expect([0, 1].map((id) => orbitFits(id, { air: TALL, places }))).toEqual([true, true]);
    expect([0, 1].map((id) => orbitFits(id, { air: MEDIUM, places }))).toEqual([true, false]);
    expect([0, 1].map((id) => orbitFits(id, { air: SHORT, places }))).toEqual([false, false]);
  });
});
