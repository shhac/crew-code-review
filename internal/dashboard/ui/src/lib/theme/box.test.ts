import { describe, expect, it } from 'vitest';
import { clip, finite, grow, holds, meets, union } from './box';

const a = { left: 0, right: 100, top: 0, bottom: 50 };

describe('box', () => {
  it('meets only where boxes overlap, not where they touch', () => {
    expect(meets(a, { left: 99, right: 120, top: 49, bottom: 60 })).toBe(true);
    expect(meets(a, { left: 100, right: 120, top: 0, bottom: 50 })).toBe(false);
    expect(meets(a, { left: 0, right: 100, top: 50, bottom: 60 })).toBe(false);
  });

  it('covers both in a union and widens every side by grow', () => {
    expect(union(a, { left: -10, right: 20, top: 30, bottom: 80 })).toEqual({ left: -10, right: 100, top: 0, bottom: 80 });
    expect(grow(a, 4)).toEqual({ left: -4, right: 104, top: -4, bottom: 54 });
    expect(grow(a, -5)).toEqual({ left: 5, right: 95, top: 5, bottom: 45 });
  });

  it('holds a box wholly inside, edges included', () => {
    expect(holds(a, a)).toBe(true);
    expect(holds(a, { left: 10, right: 90, top: 10, bottom: 40 })).toBe(true);
    expect(holds(a, { left: 10, right: 101, top: 10, bottom: 40 })).toBe(false);
  });

  it('clips to the overlap, or nothing where boxes only touch', () => {
    expect(clip(a, { left: 50, right: 200, top: -20, bottom: 20 })).toEqual({ left: 50, right: 100, top: 0, bottom: 20 });
    expect(clip(a, { left: 100, right: 200, top: 0, bottom: 50 })).toBeNull();
  });

  it('is finite only with every side a number', () => {
    expect(finite(a)).toBe(true);
    expect(finite({ ...a, right: Infinity })).toBe(false);
    expect(finite({ ...a, top: NaN })).toBe(false);
  });
});
