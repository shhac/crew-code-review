import { describe, expect, it } from 'vitest';
import { apart } from '../math';
import { jointBeside } from './limb';

describe('jointBeside', () => {
  const root = { x: 0, y: 0 };

  it('bends to the side asked of the line from root to end, whichever way it points', () => {
    // Pointing right (x), the page's right of the line is below it (y down).
    expect(jointBeside(root, { x: 3, y: 0 }, 2, 2, 1).y).toBeGreaterThan(0);
    expect(jointBeside(root, { x: 3, y: 0 }, 2, 2, -1).y).toBeLessThan(0);
    // Pointing down, its right is to the left.
    expect(jointBeside(root, { x: 0, y: 3 }, 2, 2, 1).x).toBeLessThan(0);
  });

  it('keeps both bones their length, and straightens toward an end out of reach', () => {
    const end = { x: 1, y: 2.5 };
    const joint = jointBeside(root, end, 2, 1.5, 1);
    expect(apart(root, joint)).toBeCloseTo(2);
    expect(apart(joint, end)).toBeCloseTo(1.5);
    const far = jointBeside(root, { x: 10, y: 0 }, 2, 1.5, -1);
    expect(far.x).toBeCloseTo(2);
    expect(far.y).toBeCloseTo(0);
  });
});
