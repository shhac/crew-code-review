import { describe, expect, it } from 'vitest';
import { wingStroke } from './wings';

describe('wingStroke', () => {
  it('beats its wings: down broad, up turned edge-on, the tip riding a figure-eight', () => {
    const down = wingStroke(0.25, 12, 75), up = wingStroke(0.75, 12, 75);
    expect(down.squash).toBe(1);
    expect(up.squash).toBeLessThan(0.6);
    expect(wingStroke(0, 12, 75).angle).toBeCloseTo(12);
    expect(wingStroke(0.5, 12, 75).angle).toBeCloseTo(12 - 75);
    // The root rises and falls twice a beat, so the tip's path crosses
    // itself.
    expect(wingStroke(0.125, 12, 75).lift).toBeGreaterThan(0);
    expect(wingStroke(0.375, 12, 75).lift).toBeLessThan(0);
  });
});
