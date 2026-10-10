import { describe, expect, it } from 'vitest';
import { fixed, seeded } from '../test-scene';
import { escape, routeIn } from './flight';
import { board, overview, side, testSky } from './fixtures';
import {
  ENVELOPES, flightEnds, flyIn, fresh, HALF, kept, NEAR, PECK, PIGEON, POSES, SHY_SPEED, STAND, standing, stepPigeon, takeOff, viewOf, WALK_RUN, WALK_SPEED, type Pigeon,
} from './pigeon';

const PAGE = overview();
const SKY = testSky(PAGE);
const on = (x: number, floor = 2): Pigeon => standing(fresh(0), floor, x, 1, 0, fixed(0));

// Steps a pigeon every frame for ms, returning every state it passed.
function run(p: Pigeon, ms: number, rand: () => number, from = 0, cursor: { x: number; y: number } | null = null, taken = [] as { floor: number; lo: number; hi: number }[]) {
  const frames = Math.ceil(ms / 16);
  return Array.from({ length: frames }).reduce<Pigeon[]>((all, _, i) => {
    all.push(stepPigeon(all[all.length - 1], PAGE, from + (i + 1) * 16, 16, rand, taken, cursor));
    return all;
  }, [p]);
}

describe('a pigeon on the ground', () => {
  it('stands 1.5 to 5s, then walks (60%) or pecks (40%)', () => {
    const p = on(300);
    expect(p.until).toBe(STAND[0]);
    expect(stepPigeon(p, PAGE, STAND[0] - 1, 16, fixed(0.1), [])).toBe(p);
    expect(stepPigeon(p, PAGE, STAND[0], 16, fixed(0.1), []).mode).toBe('walk');
    expect(stepPigeon(p, PAGE, STAND[0], 16, fixed(0.7), []).mode).toBe('peck');
  });

  it('walks 30 to 120px along its stretch at 18px/s, driven by distance so its feet never slide', () => {
    const walking = stepPigeon(on(300), PAGE, STAND[0], 16, fixed(0.1), []);
    expect(Math.abs(walking.target - 300)).toBeGreaterThanOrEqual(WALK_RUN[0]);
    expect(Math.abs(walking.target - 300)).toBeLessThanOrEqual(WALK_RUN[1]);
    const after = stepPigeon(walking, PAGE, STAND[0] + 1000, 1000, fixed(0.1), []);
    expect(Math.abs(after.x - 300)).toBeCloseTo(WALK_SPEED);
    expect(after.walked - walking.walked).toBeCloseTo(WALK_SPEED);
  });

  it('pecks two to five times, 0.45s a peck, then stands', () => {
    const pecking = stepPigeon(on(300), PAGE, STAND[0], 16, fixed(0.99), []);
    expect(pecking.mode).toBe('peck');
    expect(pecking.pecks).toBe(5);
    expect(pecking.until - STAND[0]).toBe(5 * PECK);
    expect(stepPigeon(pecking, PAGE, pecking.until, 16, fixed(0.5), []).mode).toBe('stand');
  });

  it('keeps its whole body on a clear run, and stops short of another, over a long wander', () => {
    const other = { floor: 2, lo: 400, hi: 400 };
    const states = run(on(300), 120000, seeded(3), 0, null, [other]);
    for (const s of states) {
      expect(s.x).toBeGreaterThanOrEqual(12 + HALF - 1e-9);
      expect(s.x).toBeLessThanOrEqual(400 - PIGEON.spacing + 1e-9);
    }
    expect(new Set(states.map((s) => s.mode))).toEqual(new Set(['stand', 'walk', 'peck']));
  });

  it('shies away briskly from a cursor within 70px, or looks up with nowhere to go', () => {
    const p = on(300);
    const cursor = { x: board.left + 300 + 30, y: board.y - 10 };
    const shying = stepPigeon(p, PAGE, 100, 16, fixed(0.5), [], cursor);
    expect(shying.mode).toBe('shy');
    expect(shying.target).toBeLessThan(300);
    expect(shying.dir).toBe(-1);
    const after = stepPigeon(shying, PAGE, 1100, 1000, fixed(0.5), [], cursor);
    expect(300 - after.x).toBeCloseTo(SHY_SPEED);
    // Further off, it pays no heed.
    expect(stepPigeon(p, PAGE, 100, 16, fixed(0.5), [], { x: cursor.x + NEAR, y: cursor.y }).mode).toBe('stand');
    // Hemmed in by another just behind it, it looks up instead.
    const hemmed = stepPigeon(p, PAGE, 100, 16, fixed(0.5), [{ floor: 2, lo: 260, hi: 260 }], cursor);
    expect(hemmed.mode).toBe('alert');
  });

  it('is drawn standing, walking, pecking or alert at its feet on the ledge', () => {
    expect(viewOf(on(300), PAGE, 0)).toMatchObject({ x: 590, y: 182, pose: 'stand' });
    expect(viewOf({ ...on(300), mode: 'shy' }, PAGE, 0)!.pose).toBe('walk');
    expect(Object.keys(POSES)).toEqual(['stand', 'walk', 'peck', 'alert']);
  });

  it('is kept where its stretch is still clear, pulled back inside one that shrank, else placed again', () => {
    expect(kept(on(300), PAGE, [])).toMatchObject({ x: 300 });
    // Text coming down just to its right shrinks its stretch: its body is
    // pulled back inside what is left.
    const page = overview([{ left: 630, right: 700, top: 150, bottom: 175 }]);
    const moved = kept(on(330), page, []);
    expect(moved!.x).toBeLessThan(330);
    expect(moved!.x + HALF).toBeLessThanOrEqual(630 - 290);
    expect(kept(on(300), overview([], [[1, board]]), [])).toBeNull();
  });
});

describe('a pigeon in the air', () => {
  it('takes off, flies out along its route and is away; flies back in, lands and stands', () => {
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const off = takeOff(on(300), route, 1000);
    expect(off).toMatchObject({ mode: 'takeoff', way: 'right', home: { floor: 2, x: 300 }, dir: 1 });
    expect(stepPigeon(off, PAGE, 1200, 16, fixed(0.5), []).mode).toBe('takeoff');
    expect(stepPigeon(off, PAGE, 1400, 16, fixed(0.5), []).mode).toBe('fly');
    const ends = flightEnds(off.flight!);
    const gone = stepPigeon(off, PAGE, ends + 1, 16, fixed(0.5), []);
    expect(gone).toMatchObject({ mode: 'away', flight: null });
    expect(viewOf(gone, PAGE, ends + 1)).toBeNull();
    const back = flyIn(gone, routeIn(3, side, 100, 'right', ENVELOPES, SKY)!, 20000);
    expect(back).toMatchObject({ mode: 'fly', floor: 3, x: 100, dir: -1 });
    const landing = flightEnds(back.flight!);
    expect(stepPigeon(back, PAGE, landing - 100, 16, fixed(0.5), []).mode).toBe('land');
    const down = stepPigeon(back, PAGE, landing + 1, 16, fixed(0.5), []);
    expect(down).toMatchObject({ mode: 'stand', flight: null, landed: landing + 1, floor: 3, x: 100 });
    expect(viewOf(down, PAGE, landing + 1)).toMatchObject({ x: side.left + 100, y: side.y });
  });

  it('is drawn along its route, on the page, with its flight pose', () => {
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const off = takeOff(on(300), route, 0);
    expect(viewOf(off, PAGE, 0)).toMatchObject({ x: 590, y: 182, pose: 'takeoff' });
    const v = viewOf({ ...off, mode: 'fly' }, PAGE, 1000)!;
    expect(v.pose).toBe('fly');
    expect(v.x).toBeGreaterThan(900);
    expect(v.y).toBeLessThan(182);
  });
});
