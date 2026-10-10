import { describe, expect, it } from 'vitest';
import { keepByKey, shareOut } from './decor';

describe('keepByKey', () => {
  const at = (key: string, x: number, lit = 0) => ({ key, x, lit });

  it('keeps the one remembered where the same key is at the same x', () => {
    const before = [at('a', 10, 5), at('b', 20, 7)];
    const after = keepByKey(before, [at('a', 10), at('b', 24), at('c', 30)]);
    expect(after).toEqual([at('a', 10, 5), at('b', 24), at('c', 30)]);
    expect(after[0]).toBe(before[0]);
  });

  it('carries over only what it is told to', () => {
    const after = keepByKey([at('a', 10, 5)], [at('a', 10)], (old, now) => ({ ...now, lit: old.lit + 1 }));
    expect(after).toEqual([at('a', 10, 6)]);
  });

  it('starts every one afresh with nothing remembered', () => {
    expect(keepByKey(undefined, [at('a', 1)])).toEqual([at('a', 1)]);
  });
});

describe('shareOut', () => {
  it('takes one from each ledge in turn, up to the cap', () => {
    expect([...shareOut([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']], 5)]).toEqual(['a1', 'b1', 'c1', 'a2', 'c2']);
  });

  it('takes them all when under the cap, and none from no ledges', () => {
    expect(shareOut([['a1'], ['b1']], 10).size).toBe(2);
    expect(shareOut([], 10).size).toBe(0);
  });
});
