import { describe, expect, it } from 'vitest';
import { meets } from '../air';
import type { Box, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { fixed, seeded, steps } from '../test-scene';
import { airborne, gullView, standingAt, fresh, type Gull } from './gull';
import { cursorAt, OBSTACLES, OPEN, page, rule } from './gull-fixtures';
import { poseBox } from './gull-poses';
import { COOLDOWN, createGulls, reconcileGulls, restingGulls, stepGulls, STILL, type Gulls } from './gulls';

const p = page();
const trace = (g: Gulls, from: number, to: number, cursor: (t: number) => Cursor | null, rand: () => number = seeded(3), s: PageMap = p) =>
  steps(g, from, to, (x, t) => stepGulls(x, s, t, 50, rand, cursor(t)));
const group = (gulls: Gull[]): Gulls => ({ target: gulls.length, gulls, swooped: -Infinity, spent: null, answer: null, answering: null });
// Three gulls: two on the lower card, one on the heading's rule.
const three = () => group([
  standingAt(fresh(0), 4, 560, 0, 1e9),
  { ...standingAt(fresh(1), 4, 200, 0, 1e9) },
  { ...standingAt(fresh(2), 1, 420, 0, 1e9) },
]);

// The box a gull's drawing takes up now, on the page.
function boxOf(g: Gull, s: PageMap, now: number): Box | null {
  const v = gullView(g, s, now);
  return v && poseBox(v.pose, v);
}

describe('gulls together', () => {
  it('places three where there is room for three 100px apart, else two', () => {
    const g = createGulls(p, 0, fixed(0.5));
    expect(g.gulls).toHaveLength(3);
    expect(new Set(g.gulls.map((x) => x.id)).size).toBe(3);
    const narrow = page(OBSTACLES, [[1, { ...rule, right: rule.left + 160 }]]);
    expect(createGulls(narrow, 0, fixed(0.5)).target).toBe(2);
  });

  it('swoops one gull at a cursor left still for 5s, while the others watch it', () => {
    const states = trace(three(), 0, 20000, () => cursorAt(OPEN.x, OPEN.y, 0));
    const first = states.findIndex((s) => s.gulls.some((x) => x.mode === 'run' || x.mode === 'ready'));
    expect(first * 50).toBeGreaterThanOrEqual(STILL);
    expect(first * 50).toBeLessThan(STILL + 200);
    expect(states.every((s) => s.gulls.filter(airborne).length <= 1)).toBe(true);
    const flying = states.find((s) => s.gulls.some((x) => x.mode === 'dive'))!;
    const flier = flying.gulls.find((x) => x.mode === 'dive')!;
    expect(flying.gulls.filter((x) => x.id !== flier.id).every((x) => x.mode === 'eye' && x.watch === flier.id)).toBe(true);
    // It lands and calls; the resting place is spent, so no second swoop.
    expect(states.some((s) => s.gulls.some((x) => x.id === flier.id && x.mode === 'call'))).toBe(true);
    const runs = states.filter((s, i) => i > 0 && s.gulls.some((x) => x.mode === 'run') && !states[i - 1].gulls.some((x) => x.mode === 'run'));
    expect(runs).toHaveLength(1);
    expect(states.at(-1)!.gulls.every((x) => x.watch === null)).toBe(true);
  });

  it('waits for the cursor to move 24px and for 30s since the last swoop before another', () => {
    const moved = (t: number) => (t < 12000 ? cursorAt(OPEN.x, OPEN.y, 0) : cursorAt(OPEN.x + 40, OPEN.y + 30, 12000));
    const states = trace(three(), 0, 45000, moved);
    const starts = states.flatMap((s, i) => (i > 0 && s.swooped !== states[i - 1].swooped ? [i * 50] : []));
    expect(starts.length).toBe(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(COOLDOWN);
  });

  it('gives the cursor the long call instead when no swoop is clear, and only once', () => {
    // Over the middle of the table: no clear air within 160px.
    const states = trace(three(), 0, 15000, () => cursorAt(640, 330, 0));
    expect(states.every((s) => !s.gulls.some(airborne))).toBe(true);
    const callers = states.flatMap((s, i) => s.gulls.filter((x) => x.mode === 'call' && states[i - 1]?.gulls.find((b) => b.id === x.id)?.mode !== 'call'));
    // One call, perhaps answered once.
    expect(callers.length).toBeGreaterThanOrEqual(1);
    expect(callers.length).toBeLessThanOrEqual(2);
  });

  it('has a neighbour within 300px answer a call half the time, 0.4 to 0.9s later', () => {
    const near = group([standingAt(fresh(0), 4, 300, 0, 1e9), standingAt(fresh(1), 4, 450, 0, 1e9)]);
    const calls = (rand: () => number) => {
      const states = trace(near, 0, 9000, () => cursorAt(640, 330, 0), rand);
      return states.flatMap((s, i) => s.gulls.filter((x) => x.mode === 'call' && states[i - 1]?.gulls.find((b) => b.id === x.id)?.mode !== 'call').map((x) => [x.id, i * 50]));
    };
    const answered = calls(fixed(0.2));
    expect(answered).toHaveLength(2);
    expect(answered[1][1] - answered[0][1]).toBeGreaterThanOrEqual(400);
    expect(answered[1][1] - answered[0][1]).toBeLessThanOrEqual(950);
    expect(calls(fixed(0.8))).toHaveLength(1);
  });

  it('over a long run with a wandering cursor keeps one in the air at most, 100px apart, and never over content', () => {
    const rand = seeded(11);
    const path = seeded(5);
    // The cursor wanders, resting now and then, sometimes in the open air
    // below the short card.
    const moves = Array.from({ length: 40 }, (_, i) => {
      const open = i % 3 === 0;
      return { at: i * 8000, x: open ? 1100 + path() * 250 : 260 + path() * 1150, y: open ? 520 + path() * 330 : 20 + path() * 860, rest: open || path() < 0.4 };
    });
    const cursor = (t: number) => {
      const m = moves[Math.min(moves.length - 1, Math.floor(t / 8000))];
      return cursorAt(m.x, m.y, m.rest ? m.at : t);
    };
    const states = trace(createGulls(p, 0, rand), 0, 320000, cursor, rand);
    for (const [i, s] of states.entries()) {
      const now = i * 50;
      expect(s.gulls.filter(airborne).length).toBeLessThanOrEqual(1);
      const ground = s.gulls.filter((x) => !x.flight && x.mode !== 'away');
      for (const a of ground) {
        for (const b of ground) {
          if (a.id < b.id && a.floor === b.floor) expect(Math.abs(a.x - b.x), `${now}`).toBeGreaterThanOrEqual(99);
        }
      }
      for (const g of s.gulls) {
        const box = boxOf(g, p, now);
        if (box) expect(p.obstacles.filter((o) => !o.block && meets(box, o)), `${g.id} ${g.mode} at ${now}`).toEqual([]);
      }
    }
    expect(states.some((s) => s.gulls.some((x) => x.mode === 'dive'))).toBe(true);
    // A long run, slow on a busy machine.
  }, 60_000);
});

describe('layout changes and reduced motion', () => {
  it('keeps them where they stand through a remeasure, and never adds more', () => {
    const g = createGulls(p, 0, fixed(0.5));
    const again = reconcileGulls(g, p, 100, fixed(0.5));
    expect(again.gulls.map((x) => [x.floor, x.x])).toEqual(g.gulls.map((x) => [x.floor, x.x]));
    const two = { ...g, target: 2, gulls: g.gulls.slice(0, 2) };
    expect(reconcileGulls(two, p, 100, fixed(0.5)).gulls).toHaveLength(2);
  });

  it('stands them all still under reduced motion, kept where they stood', () => {
    const g = createGulls(p, 0, fixed(0.5));
    const still = restingGulls(p, g);
    expect(still.gulls.map((x) => [x.floor, x.x])).toEqual(g.gulls.map((x) => [x.floor, x.x]));
    expect(still.gulls.every((x) => x.mode === 'stand' && x.until === Infinity)).toBe(true);
    expect(restingGulls(p, null).gulls.length).toBeGreaterThanOrEqual(2);
  });

});
