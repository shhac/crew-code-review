import { describe, expect, it } from 'vitest';
import { waspAir, windowEdge } from './air';
import { STAGE, TALL } from './fixtures';

describe('the wasps\' air', () => {
  it('is the rail\'s air in the stage\'s coordinates, with a lane out past the window\'s left edge over its top half', () => {
    expect(TALL.air).toEqual({ left: -16, right: 184, top: -262, bottom: 72 });
    expect(TALL.lane).toEqual({ left: -58, right: -16, top: -262, bottom: -95 });
    expect(windowEdge(TALL)).toBe(-34);
    expect(waspAir(null, STAGE)).toBeNull();
    expect(waspAir({ left: 18, top: 0, width: 0, height: 0 }, STAGE)).toBeNull();
  });
});
