import { describe, expect, it } from 'vitest';
import { firstOf, maxBy, pick } from './seed';

describe('pick', () => {
  it('spreads rand across the items, a stand-in 0 or 1 landing on the ends', () => {
    expect(pick(() => 0, ['a', 'b', 'c'])).toBe('a');
    expect(pick(() => 0.5, ['a', 'b', 'c'])).toBe('b');
    expect(pick(() => 1, ['a', 'b', 'c'])).toBe('c');
  });
});

describe('maxBy', () => {
  it('finds the highest scoring item, the first of a tie, and nothing in nothing', () => {
    expect(maxBy([3, 7, 7, 1], (n) => n)).toBe(7);
    expect(maxBy([{ k: 'a', n: 2 }, { k: 'b', n: 2 }], (o) => o.n)?.k).toBe('a');
    expect(maxBy([], (n: number) => n)).toBeUndefined();
  });
});

describe('firstOf', () => {
  it('gives what the first item makes anything of, and asks no further', () => {
    const asked: number[] = [];
    const half = (n: number, i: number) => {
      asked.push(i);
      return n % 2 ? null : n / 2;
    };
    expect(firstOf([3, 5, 8, 10], half)).toBe(4);
    expect(asked).toEqual([0, 1, 2]);
    expect(firstOf([0, 1], (n) => (n ? 'one' : null))).toBe('one');
    expect(firstOf([1, 3], half)).toBeNull();
  });
});
