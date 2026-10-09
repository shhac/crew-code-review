import { describe, expect, it } from 'vitest';
import { inTurn, placeInTurn } from './group';

describe('inTurn', () => {
  it('steps each in order, each seeing the others as they now are', () => {
    const seen: number[][] = [];
    const after = inTurn([1, 2, 3], (n, others) => {
      seen.push(others);
      return n * 10;
    }, (_, __, other) => other);
    expect(after).toEqual([10, 20, 30]);
    expect(seen).toEqual([[2, 3], [10, 3], [10, 20]]);
  });

  it('lets the others react to each step, in time for their own', () => {
    // The first to step bumps the others by 100, and each then steps on from
    // its bumped value.
    const after = inTurn([0, 0, 0], (n) => n + 1, (before, _, other) => (before === 0 ? other + 100 : other));
    expect(after).toEqual([1, 101, 101]);
  });
});

describe('placeInTurn', () => {
  it('places each seeing those before it, leaving out any with no place', () => {
    const placed = placeInTurn([5, 6, 7, 8], (n, before) => (before.length === 2 && n === 7 ? null : { n, after: before.length }));
    expect(placed).toEqual([{ n: 5, after: 0 }, { n: 6, after: 1 }, { n: 8, after: 2 }]);
  });
});
