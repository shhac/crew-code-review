import { describe, expect, it } from 'vitest';
import { cursorAt, lower, OPEN, page } from './gull-fixtures';
import { CALL, createGull, fresh, gullView, reconcileGull, restingGull, standingAt, stepGull, STRUT, takeOff, type Gull } from './gull';
import { airspace } from './gulls';
import { flightOf, flightTime, planSwoop } from './swoop';

const p = page();
// A gull standing on the lower card at x, its next wander far off.
const at = (x: number, extra: Partial<Gull> = {}): Gull => ({ ...standingAt(fresh(0), 4, x, 0, 1e9), ...extra });
const run = (g: Gull, from: number, to: number, cursor: (t: number) => ReturnType<typeof cursorAt> | null = () => null, others: Gull[] = []) => {
  const frames: Gull[] = [];
  const end = Array.from({ length: Math.round((to - from) / 16) }, (_, i) => from + (i + 1) * 16).reduce((x, t) => {
    const next = stepGull(x, p, t, 16, () => 0.5, cursor(t), others);
    frames.push(next);
    return next;
  }, g);
  return { end, frames };
};
const space = () => ({ air: () => airspace(p), berths: [] });

describe('a gull on a ledge', () => {
  it('stands, then wanders 30 to 120px along its run at 26px/s, and stands again looking about', () => {
    const g = at(400, { until: 1000 });
    const { end, frames } = run(g, 0, 8000);
    const strut = frames.filter((f) => f.mode === 'strut');
    expect(strut.length).toBeGreaterThan(0);
    const moved = Math.abs(strut.at(-1)!.target - 400);
    expect(moved).toBeGreaterThanOrEqual(30);
    expect(moved).toBeLessThanOrEqual(120);
    // 26px/s.
    const a = strut[2], b = strut[12];
    expect(Math.abs(b.x - a.x)).toBeCloseTo((STRUT * 10 * 16) / 1000, 0);
    expect(end.mode).toBe('stand');
    expect(end.glance).not.toBeNull();
  });

  it('follows a moving cursor along its ledge, stopping 36px short of it', () => {
    const g = at(300);
    // The cursor moves along above the ledge, then rests 150px to the right.
    const cursor = (t: number) => cursorAt(lower.left + 450, lower.y - 60, t);
    const { end } = run(g, 0, 9000, cursor);
    expect(end.x).toBeCloseTo(450 - 36, 0);
  });

  it('eyes a still cursor near it, facing it, and goes back to standing when it leaves', () => {
    const g = at(300, { dir: 1 });
    const still = cursorAt(lower.left + 200, lower.y - 80, -5000);
    const eyed = run(g, 0, 1500, () => still).end;
    expect(eyed.mode).toBe('eye');
    expect(eyed.dir).toBe(-1);
    expect(gullView(eyed, p, 1500)!.pose).toBe('eye');
    expect(run(eyed, 1500, 1600).end.mode).toBe('stand');
  });

  it('struts 48px away from a cursor too close to it', () => {
    const g = at(300);
    const close = cursorAt(lower.left + 290, lower.y - 14, 0);
    const { frames } = run(g, 0, 200, () => close);
    expect(frames.find((f) => f.mode === 'strut')!.target).toBeCloseTo(348);
  });

  it('turns round at most once every 1.2s', () => {
    const g = at(300, { dir: 1 });
    // A cursor flicking from side to side, still.
    const cursor = (t: number) => cursorAt(lower.left + (Math.floor(t / 300) % 2 ? 450 : 150), lower.y - 100, t - 2000);
    const { frames } = run(g, 0, 6000, cursor);
    const turns = frames.filter((f, i) => i > 0 && f.dir !== frames[i - 1].dir).length;
    expect(turns).toBeGreaterThan(1);
    expect(turns).toBeLessThanOrEqual(6000 / 1200 + 1);
  });

  it('keeps 100px from another gull on its ledge', () => {
    const other = { ...at(500), id: 1 };
    const g = at(300);
    const cursor = (t: number) => cursorAt(lower.left + 560, lower.y - 60, t);
    const { frames } = run(g, 0, 9000, cursor, [other]);
    expect(Math.max(...frames.map((f) => f.x))).toBeLessThanOrEqual(400);
  });
});

describe('a swoop flown', () => {
  const plan = planSwoop({ air: airspace(p).view, gull: { floor: 4, x: 560 }, home: { floor: 4, x: 560 }, cursor: OPEN, taken: [], also: [] })!;
  const flight = flightOf(p, plan, 4, 0)!;
  const g = takeOff(at(560), flight, 0);

  it('goes through run, climb, dive, pull-up, cruise, flare, touchdown and the long call, then stands', () => {
    const { frames } = run(g, 0, flightTime(flight) + 3000);
    const modes = frames.map((f) => f.mode).filter((m, i, all) => m !== all[i - 1]);
    expect(modes).toEqual(['run', 'climb', 'dive', 'pullup', 'cruise', 'flare', 'touchdown', 'call', 'stand']);
    const down = frames.find((f) => f.mode === 'touchdown')!;
    expect(down.floor).toBe(plan.land.floor);
    // The two run-out steps carry it to where it lands.
    expect(frames.filter((f) => f.mode === 'touchdown').at(-1)!.x).toBeCloseTo(plan.land.x);
    const calls = frames.filter((f) => f.mode === 'call');
    expect(calls.length * 16).toBeGreaterThanOrEqual(CALL - 32);
    expect(calls.length * 16).toBeLessThanOrEqual(CALL + 32);
  });

  it('beats its wings in flight, but not in the dive', () => {
    const { frames } = run(g, 0, flightTime(flight));
    const dive = frames.filter((f) => f.mode === 'dive');
    expect(dive.at(-1)!.beat).toBe(dive[0].beat);
    expect(frames.at(-1)!.beat).toBeGreaterThan(2);
  });

  it('is drawn in the pose of each leg along the way', () => {
    const poses = new Set(run(g, 0, flightTime(flight)).frames.map((f, i) => gullView(f, p, (i + 1) * 16)!.pose));
    expect(poses).toEqual(new Set(['takeoff', 'flight', 'swoop', 'flare']));
  });

  it('flies on through a layout change that leaves its way clear', () => {
    const mid = run(g, 0, 900).end;
    expect(reconcileGull(mid, p, 900, () => 0.5, [], [], space())).toBe(mid);
  });

  it('re-plans, or fades out and turns up later, when its way is blocked', () => {
    const mid = run(g, 0, 900).end;
    const wall = { left: 236, right: 1440, top: 0, bottom: 1100 };
    const blocked = page([...p.obstacles, wall]);
    const next = reconcileGull(mid, blocked, 900, () => 0.5, [], [], { air: () => airspace(blocked), berths: [] })!;
    expect(next.mode).toBe('away');
    expect(gullView(next, blocked, 950)!.opacity).toBeLessThan(1);
    expect(gullView(next, blocked, 1100)).toBeNull();
    const back = run(next, 900, 4000).end;
    expect(back.mode).not.toBe('away');
  });
});

describe('placing', () => {
  it('stands somewhere clear, and under reduced motion stays where it stood', () => {
    const g = createGull(p, 0, () => 0.5)!;
    expect(g.mode).toBe('stand');
    const still = restingGull(p, g)!;
    expect([still.floor, still.x]).toEqual([g.floor, g.x]);
    expect(still.until).toBe(Infinity);
  });

  it('stands at its landing under reduced motion when stilled mid-flight', () => {
    const plan = planSwoop({ air: airspace(p).view, gull: { floor: 4, x: 560 }, home: null, cursor: OPEN, taken: [], also: [] })!;
    const flying = takeOff(at(560), flightOf(p, plan, 4, 0)!, 0);
    const still = restingGull(p, flying)!;
    expect([still.floor, still.x, still.mode]).toEqual([plan.land.floor, plan.land.x, 'stand']);
  });

  it('keeps its ledge through a layout change while its run holds it, else moves', () => {
    const g = at(300);
    expect(reconcileGull(g, p, 0, () => 0.5, [], [], space())).toEqual(g);
    const gone = page(p.obstacles, [...p.floors].filter(([id]) => id !== 4));
    expect(reconcileGull(g, gone, 0, () => 0.5, [], [], space())!.floor).not.toBe(4);
  });
});
