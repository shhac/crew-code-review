import { describe, expect, it } from 'vitest';
import { gazeExtremes, unlike } from './equivalence';
import { hedgehog } from './hedgehog';

describe('the old rig and the new compared', () => {
  it('finds how far the head turns each way', () => {
    const [low, high] = gazeExtremes(hedgehog);
    expect(low).toBeLessThan(-5);
    expect(high).toBeGreaterThan(5);
  });

  it('finds nothing between a rig and itself, and finds a head that no longer turns', () => {
    expect(unlike(hedgehog, hedgehog.pose)).toEqual([]);
    const unturned = unlike(hedgehog, (at, look) => hedgehog.pose(at, { ...look, gaze: 0 }), 3);
    expect(unturned).toHaveLength(3);
    expect(unturned[0]).toMatch(/gaze -/);
  }, 60000);
});
