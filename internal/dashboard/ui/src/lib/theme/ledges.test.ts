import { describe, expect, it } from 'vitest';
import type { Ledge } from './floors';
import { clearOf, freeOf, ledgeEnds, pointClaim, roomiest, runUnder, spare, staysPut, type Walker } from './ledges';
import { scene } from './test-scene';

const ledge = (left: number, right: number, y: number): Ledge => ({ left, right, y, base: y + 100, room: Infinity, headroom: Infinity });
const WALKER: Walker = { clear: 27, reach: 6, half: 20, spacing: 60 };

describe('the ledges a walker uses', () => {
  it('finds the ends of a run that are also ends of its ledge', () => {
    const f = ledge(100, 500, 300);
    expect(ledgeEnds(f, { lo: 8, hi: 392 })).toEqual([8, 392]);
    expect(ledgeEnds(f, { lo: 8, hi: 200 })).toEqual([8]);
    expect(ledgeEnds(f, { lo: 100, hi: 200 })).toEqual([]);
  });

  it('finds the run under a point off either end of the samples', () => {
    const page = scene([[1, ledge(100, 500, 300)]]);
    const f = page.floors.get(1)!;
    expect(runUnder(f, page, WALKER, -50)).toEqual({ lo: 8, hi: 392 });
    expect(runUnder(f, page, WALKER, 1000)).toEqual({ lo: 8, hi: 392 });
  });

  it('measures how much room is left over a pose, negative when it does not fit', () => {
    const page = scene([[1, ledge(100, 500, 300)]], [{ left: 280, right: 320, top: 250, bottom: 280 }]);
    const f = page.floors.get(1)!;
    expect(spare(f, page, WALKER, { width: 30, height: 15 }, 200)).toBe(20 - 15);
    expect(spare(f, page, WALKER, { width: 30, height: 25 }, 200)).toBe(-5);
    expect(spare(f, page, WALKER, { width: 30, height: 25 }, 0, 50)).toBeGreaterThan(0);
  });
});

describe('keeping walkers apart', () => {
  it('treats one standing still as a stretch with no length', () => {
    const taken = [pointClaim(1, 200)];
    expect(clearOf(taken, 1, 100, 140, 60)).toBe(true);
    expect(clearOf(taken, 1, 100, 141, 60)).toBe(false);
    expect(clearOf(taken, 1, 300, 260, 60)).toBe(true);
    expect(clearOf(taken, 2, 200, 200, 60)).toBe(true);
    expect(clearOf([{ floor: 1, lo: 200, hi: 300 }], 1, 350, 359, 60)).toBe(false);
  });

  it('cuts the stretches near each claim out of a run', () => {
    expect(freeOf({ lo: 0, hi: 400 }, [pointClaim(1, 300), pointClaim(1, 100)], 50)).toEqual([
      { lo: 0, hi: 50 }, { lo: 150, hi: 250 }, { lo: 350, hi: 400 },
    ]);
    expect(freeOf({ lo: 0, hi: 400 }, [{ floor: 1, lo: 100, hi: 300 }], 50)).toEqual([{ lo: 0, hi: 50 }, { lo: 350, hi: 400 }]);
  });

  it('settles a walker on an empty ledge before a shared one', () => {
    const page = scene([[1, ledge(0, 900, 300)], [2, ledge(0, 300, 500)]]);
    expect(roomiest(page, [], WALKER, 40)?.floor).toBe(1);
    expect(roomiest(page, [pointClaim(1, 450)], WALKER, 40)?.floor).toBe(2);
  });

  it('lets a walker stay with all of it on a run and nobody too close', () => {
    const page = scene([[1, ledge(0, 400, 300)]]);
    expect(staysPut({ floor: 1, x: 200 }, page, WALKER, [])).toBe(true);
    expect(staysPut({ floor: 1, x: 20 }, page, WALKER, [])).toBe(false);
    expect(staysPut({ floor: 1, x: 200 }, page, WALKER, [pointClaim(1, 250)])).toBe(false);
  });
});
