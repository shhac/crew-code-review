import { describe, expect, it } from 'vitest';
import { fillTo, inTurn, keepInTurn, placeIds, placeInTurn, regroup, troupeSize } from './group';

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

  it('leaves the others as they were when there is no reaction', () => {
    expect(inTurn([1, 2, 3], (n, others) => n + others.length)).toEqual([3, 4, 5]);
  });
});

describe('placeInTurn', () => {
  it('places each seeing those before it, leaving out any with no place', () => {
    const placed = placeInTurn([5, 6, 7, 8], (n, before) => (before.length === 2 && n === 7 ? null : { n, after: before.length }));
    expect(placed).toEqual([{ n: 5, after: 0 }, { n: 6, after: 1 }, { n: 8, after: 2 }]);
  });
});

describe('placeIds', () => {
  it('places each id in turn, seeing those placed before it', () => {
    const placed = placeIds<{ id: number; before: number }>([0, 1, 2], (others, id) => (id === 1 ? null : { id, before: others.length }));
    expect(placed).toEqual([{ id: 0, before: 0 }, { id: 2, before: 1 }]);
  });
});

describe('troupeSize', () => {
  it('keeps three only where three were placed', () => {
    expect(troupeSize([1, 2, 3])).toBe(3);
    expect(troupeSize([1, 2])).toBe(2);
    expect(troupeSize([1])).toBe(2);
    expect(troupeSize([])).toBe(2);
  });
});

// Animals on a line: each wants its spot x, and two may not share one.
type Pup = { id: number; x: number };
const keepClear = (p: Pup, settled: Pup[]) => (settled.some((o) => o.x === p.x) ? null : p);
const firstFree = (others: Pup[], id: number): Pup | null => {
  const x = [0, 1, 2, 3, 4].find((s) => !others.some((o) => o.x === s));
  return x === undefined ? null : { id, x };
};

describe('regroup', () => {
  it('lets the lower id win a contested spot, and places the other afresh', () => {
    const after = regroup([{ id: 0, x: 3 }, { id: 1, x: 3 }], 2, keepClear, firstFree);
    expect(after).toEqual([{ id: 0, x: 3 }, { id: 1, x: 0 }]);
  });

  it('never places more than the target', () => {
    expect(regroup<Pup>([], 2, keepClear, firstFree).map((p) => p.id)).toEqual([0, 1]);
    expect(regroup([{ id: 0, x: 1 }, { id: 1, x: 2 }], 2, keepClear, firstFree)).toHaveLength(2);
    expect(regroup([{ id: 0, x: 1 }], 3, () => null, firstFree).map((p) => p.id)).toEqual([0, 1, 2]);
  });

  it('returns them sorted by id, the kept and the added together', () => {
    const after = regroup([{ id: 2, x: 4 }, { id: 0, x: 4 }], 3, keepClear, firstFree);
    expect(after.map((p) => p.id)).toEqual([0, 1, 2]);
    expect(after).toEqual([{ id: 0, x: 0 }, { id: 1, x: 1 }, { id: 2, x: 4 }]);
  });

  it('leaves out any with no room anywhere', () => {
    const full = (others: Pup[], id: number) => (others.length < 1 ? { id, x: 0 } : null);
    expect(regroup<Pup>([], 3, keepClear, full)).toEqual([{ id: 0, x: 0 }]);
  });

  it('shows keep every other, those still to come as they were', () => {
    const seen: number[][] = [];
    keepInTurn([{ id: 0, x: 0 }, { id: 1, x: 1 }, { id: 2, x: 2 }], (p, _, all) => {
      seen.push(all.map((o) => o.id));
      return p.id === 1 ? null : { ...p, x: p.x + 10 };
    });
    expect(seen).toEqual([[1, 2], [0, 2], [0]]);
  });

  it('places the missing clear of those kept', () => {
    expect(fillTo(3, [{ id: 1, x: 0 }], firstFree)).toEqual([{ id: 0, x: 1 }, { id: 2, x: 2 }]);
  });
});
