import { describe, expect, it } from 'vitest';
import { CARDS, dashboardPage, fixed, HEADING, seeded } from '../test-scene';
import { fresh, holds, LOPE_SPEED, placeHare, sittingAt, SPACING, spots, stepHare, type Hare } from './hare';

const page = dashboardPage();
// A hare on the heading rule at x (ledge-local: the title covers 0 to
// 300), doing as told.
const hare = (x: number, over: Partial<Hare> = {}): Hare => ({ ...sittingAt(fresh(0), HEADING, 1, x, page, 0, fixed(0.5)), ...over });
// Steps a hare in 16ms frames from `from` for `ms`, the others standing still.
function run(h: Hare, ms: number, others: readonly Hare[] = [], from = 0, rand = fixed(0.5)): Hare[] {
  return Array.from({ length: Math.floor(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce<Hare[]>((seen, t) => [...seen, stepHare(seen.at(-1) ?? h, page, t, 16, rand, others)], []);
}

describe('placing a hare', () => {
  it('sits it grazing on the roomiest free stretch, tall only where there is room above', () => {
    const h = placeHare(page, 0, fixed(0.5), [], fresh(0))!;
    expect(h).toMatchObject({ floor: 1, mode: 'graze', target: h.x });
    // The title stands over the rule's left end, so the room is right of it.
    expect(h.x).toBeGreaterThan(300);
    expect(h.tall).toBe(true);
    const onCard = sittingAt(fresh(1), CARDS[0], 2, 100, page, 0, fixed(0.5));
    // A first-row card has 22px up to the rule: short of TALL, even
    // reaching into the rule's edge.
    expect(onCard.tall).toBe(false);
  });

  it('puts the next on a ledge with nobody on it, and SPACING from anyone sharing one', () => {
    const first = placeHare(page, 0, fixed(0.5), [], fresh(0))!;
    const second = placeHare(page, 0, fixed(0.5), [first], fresh(1))!;
    expect(second.floor).not.toBe(first.floor);
    const crowded = { ...page, floors: new Map([[1, HEADING]]) };
    const a = placeHare(crowded, 0, seeded(1), [], fresh(0))!;
    const b = placeHare(crowded, 0, seeded(2), [a], fresh(1))!;
    expect(b.floor).toBe(1);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(SPACING);
  });

  it('finds no spot where every ledge is covered, and so places none', () => {
    const covered = dashboardPage([{ left: 0, right: 1440, top: 120, bottom: 181 }]);
    expect(spots(covered, [])).toEqual([]);
    expect(placeHare(covered, 0, fixed(0.5), [], fresh(0))).toBeNull();
  });
});

describe('holding its place', () => {
  it('holds on a clear run with nobody near, the one it is boxing aside', () => {
    const h = hare(900);
    expect(holds(h, page, [])).toBe(true);
    const near = { ...hare(940), id: 1 };
    expect(holds(h, page, [near])).toBe(false);
    expect(holds(h, page, [near], 1)).toBe(true);
  });

  it('does not hold under the title, off its run, or with its ledge gone', () => {
    expect(holds(hare(100), page, [])).toBe(false);
    expect(holds(hare(995), page, [])).toBe(false);
    expect(holds(hare(900, { floor: 9 }), page, [])).toBe(false);
  });
});

describe('a hare on its own', () => {
  it('grazes until its time is up, then sits up, lopes or grazes on', () => {
    const h = hare(900, { until: 1000 });
    expect(stepHare(h, page, 500, 16, fixed(0.5), [])).toEqual(h);
    expect(stepHare(h, page, 1000, 16, fixed(0.1), []).mode).toBe('sit');
    const loping = stepHare(h, page, 1000, 16, fixed(0.5), []);
    expect(loping.mode).toBe('lope');
    expect(Math.abs(loping.target - h.x)).toBeGreaterThanOrEqual(20);
    expect(stepHare(h, page, 1000, 16, fixed(0.9), []).mode).toBe('graze');
  });

  it('lopes to its target at its own pace, then grazes there', () => {
    const states = run(hare(900, { mode: 'lope', target: 960, dir: 1 }), 4000);
    // A second in.
    expect(states[62].x - 900).toBeCloseTo((LOPE_SPEED * 63 * 16) / 1000, 5);
    const done = states.at(-1)!;
    expect(done).toMatchObject({ mode: 'graze', x: 960, target: 960 });
    expect(done.walked).toBeCloseTo(60, 5);
  });

  it('comes up to another and stops there, arrived', () => {
    const done = run(hare(900, { mode: 'approach', target: 940, dir: 1 }), 3000).at(-1)!;
    expect(done).toMatchObject({ mode: 'arrived', x: 940 });
  });

  it('boxes until its time is up, then has boxed', () => {
    const h = hare(900, { mode: 'box', until: 500 });
    expect(stepHare(h, page, 400, 16, fixed(0.5), []).mode).toBe('box');
    expect(stepHare(h, page, 500, 16, fixed(0.5), []).mode).toBe('boxed');
  });

  it('leaves a run to the group, standing still', () => {
    const h = hare(900, { mode: 'run' });
    expect(stepHare(h, page, 5000, 16, fixed(0.5), [])).toEqual(h);
  });

  it('lopes off to make room when left too close to another, rather than grazing there', () => {
    const other = { ...hare(930), id: 1 };
    const next = stepHare(hare(900, { mode: 'sit', until: 0 }), page, 100, 16, fixed(0.5), [other]);
    expect(next).toMatchObject({ mode: 'lope', dir: -1 });
    expect(other.x - next.target).toBeGreaterThanOrEqual(SPACING);
  });

  it('sits on facing the other when there is no room to move away', () => {
    // Hemmed in by the title on its left.
    const other = { ...hare(360), id: 1 };
    const next = stepHare(hare(330, { mode: 'standoff', until: 0 }), page, 100, 16, fixed(0.5), [other]);
    expect(next).toMatchObject({ mode: 'sit', dir: 1 });
    expect(next.until).toBeGreaterThan(100);
  });

  it('never lopes within SPACING of a neighbour on its ledge', () => {
    const others = [{ ...hare(760), id: 1 }, { ...hare(960), id: 2 }];
    const rand = seeded(3);
    const states = run(hare(860, { until: 0 }), 60_000, others, 0, rand);
    expect(states.some((h) => h.mode === 'lope')).toBe(true);
    for (const h of states) for (const o of others) expect(Math.abs(h.x - o.x)).toBeGreaterThanOrEqual(SPACING - 1e-9);
  });
});
