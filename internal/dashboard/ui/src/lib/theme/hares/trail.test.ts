import { describe, expect, it } from 'vitest';
import { reachOf } from '../floors';
import { CLEAR, POSES, SPACING } from './hare';
import { CARDS, HEADING, page, seeded } from './fixtures';
import { arcPoint, AWAY, clearAt, FADE, placeOn, plan, REACH, sweptClear, trailOf, type Claim, type PlanOptions, type Segment } from './trail';

const LEAP = reachOf(POSES.leap);
const options = (over: Partial<PlanOptions> = {}): PlanOptions => ({
  clear: CLEAR, body: reachOf(POSES.bound), air: LEAP, claims: [], spacing: SPACING, budget: 2000, ledges: 3, rand: seeded(7), ...over,
});
const kinds = (segments: readonly Segment[]) => segments.map((s) => s.kind);

describe('a trail', () => {
  it('places a hare along it, fading out before it goes away and in after', () => {
    const trail = trailOf([
      { kind: 'run', floor: 2, from: 10, to: 110 },
      { kind: 'away', from: { floor: 2, x: 110 }, to: { floor: 3, x: 8 }, length: AWAY },
      { kind: 'run', floor: 3, from: 8, to: 108 },
    ]);
    expect(trail.length).toBe(100 + AWAY + 100);
    expect(placeOn(trail, 50)).toEqual({ kind: 'run', floor: 2, x: 60, dir: 1, fade: 1 });
    expect(placeOn(trail, 100 - FADE / 2)).toMatchObject({ kind: 'run', fade: 0.5 });
    expect(placeOn(trail, 150).kind).toBe('away');
    expect(placeOn(trail, 100 + AWAY + FADE / 2)).toMatchObject({ kind: 'run', floor: 3, fade: 0.5 });
    expect(placeOn(trail, 10_000)).toMatchObject({ kind: 'run', floor: 3, x: 108 });
  });
});

describe('the airspace', () => {
  it('lets a box stand on a card, its top reaching up into the empty edge of the rule above', () => {
    const scene = page();
    expect(clearAt({ x: 400, y: 182 }, reachOf({ width: 40, height: 27 }), scene)).toBe(true);
    expect(clearAt({ x: 400, y: 182 }, reachOf({ width: 40, height: 22 + REACH + 1 }), scene)).toBe(false);
  });

  it('keeps a box off content, out of a card and inside the window', () => {
    const scene = page([{ left: 380, right: 420, top: 170, bottom: 178 }]);
    expect(clearAt({ x: 400, y: 182 }, reachOf({ width: 40, height: 20 }), scene)).toBe(false);
    expect(clearAt({ x: 800, y: 200 }, reachOf({ width: 40, height: 20 }), scene)).toBe(false);
    expect(clearAt({ x: 10, y: 182 }, reachOf({ width: 40, height: 20 }), scene)).toBe(false);
  });

  it('checks a whole arc, not just its ends', () => {
    const scene = page();
    const [from, to] = [{ x: 615, y: 182 }, { x: 692, y: 182 }];
    expect(sweptClear(from, to, 2, LEAP, scene)).toBe(true);
    // Too high an arc crosses the heading rule above.
    expect(sweptClear(from, to, 8, LEAP, scene)).toBe(false);
    // Text in the gap between the cards blocks it.
    expect(sweptClear(from, to, 2, LEAP, page([{ left: 650, right: 656, top: 165, bottom: 175 }]))).toBe(false);
  });
});

describe('planning a trail', () => {
  it('runs along its ledge and leaps the gap to the next card, clear all the way', () => {
    const scene = page();
    const trail = plan({ floor: 2, x: 100 }, 1, scene, options({ ledges: 2 }));
    expect(kinds(trail.segments)).toEqual(['run', 'leap', 'run']);
    const leap = trail.segments[1];
    if (leap.kind !== 'leap') throw new Error('expected a leap');
    expect(leap.to.floor).toBe(3);
    for (const t of Array.from({ length: 51 }, (_, i) => i / 50)) expect(clearAt(arcPoint(leap, scene, t)!, LEAP, scene)).toBe(true);
    // Its body stays on the clear run, take-off and landing included.
    expect(leap.from.x).toBeLessThanOrEqual(CARDS[0].right - CARDS[0].left - 8 - POSES.bound.width / 2);
    expect(leap.to.x).toBeGreaterThanOrEqual(8 + POSES.bound.width / 2);
  });

  it('goes on ledge to ledge up to its ledges, never back onto one it crossed', () => {
    const trail = plan({ floor: 2, x: 100 }, 1, page(), options());
    const floors = trail.segments.flatMap((s) => (s.kind === 'run' ? [s.floor] : []));
    expect(floors).toEqual([2, 3, 4]);
  });

  it('stops spacing short of another hare in its way', () => {
    const claims: Claim[] = [{ floor: 2, lo: 250, hi: 250 }];
    const trail = plan({ floor: 2, x: 50 }, 1, page(), options({ claims }));
    expect(kinds(trail.segments)).toEqual(['run']);
    expect(trail.length).toBeCloseTo(250 - SPACING - 50);
  });

  it('keeps to its budget', () => {
    expect(plan({ floor: 2, x: 50 }, 1, page(), options({ budget: 120 })).length).toBeCloseTo(120);
  });

  it('with no leap, goes off a ledge end and in at another, out of sight', () => {
    // Text in every gap between the cards: no leap is clear.
    const walls = [{ left: 646, right: 660, top: 170, bottom: 178 }, { left: 1006, right: 1020, top: 170, bottom: 178 }];
    const trail = plan({ floor: 3, x: 100 }, 1, page(walls), options({ ledges: 2 }));
    expect(kinds(trail.segments)).toContain('away');
    const away = trail.segments.find((s) => s.kind === 'away');
    if (away?.kind !== 'away') throw new Error('expected an away');
    expect(away.from.floor).toBe(3);
    expect(away.to.floor).not.toBe(3);
  });

  it('stops at a dead end: a run that ends at text with no ledge end', () => {
    const wall = { left: 560, right: 600, top: 170, bottom: 178 };
    const trail = plan({ floor: 2, x: 50 }, 1, page([wall]), options());
    expect(kinds(trail.segments)).toEqual(['run']);
  });

  it('on a trip, stops once on the ledge it is heading for', () => {
    const trail = plan({ floor: 2, x: 100 }, 1, page(), options({ toward: 3 }));
    const last = trail.segments.at(-1);
    expect(last?.kind === 'run' && last.floor).toBe(3);
  });

  it('never leaps onto the heading rule through its own line', () => {
    // The rule is 22px above the cards, inside the cards' columns: a leap up
    // to it would cross it.
    const trail = plan({ floor: 2, x: 100 }, 1, page(), options());
    expect(trail.segments.some((s) => s.kind === 'leap' && s.to.floor === 1)).toBe(false);
    expect(HEADING.y).toBeLessThan(CARDS[0].y);
  });
});
