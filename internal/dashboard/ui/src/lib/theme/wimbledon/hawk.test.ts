import { describe, expect, it } from 'vitest';
import { around, meets } from '../air';
import type { Box, Obstacle, PageMap } from '../floors';
import { seeded } from '../test-scene';
import { flying, lengthOfTrack, reachAt } from './flight';
import {
  AGAIN, createHawk, FIRST, GAP, GLIDE, SIGHTED, SPEED, hawkAt, hawkRemeasured, hawkView, laneClear, OFF_APART, planSweep, RETRY, RETURN, RETURN_APART, rowsOf, simulate, stepHawk, type Plan,
} from './hawk';
import { board, EXITS, overview, side, testSky } from './fixtures';
import { ENVELOPES, fresh, POSES, standing, type Pigeon } from './pigeon';

const PAGE = overview();
const SKY = testSky(PAGE);
const at = (id: number, floor: number, x: number): Pigeon => standing(fresh(id), floor, x, 1, 0, () => 0.5);
// Two on the board and one on the card beside it, the first row.
const FLOCK = [at(0, 2, 200), at(1, 2, 480), at(2, 3, 150)];

// Every box drawn at now, worked out here from the plan's own parts.
function boxesAt(plan: Plan, pigeons: readonly Pigeon[], page: PageMap, now: number): { id: number; box: Box }[] {
  const row = page.floors.get(plan.row)!;
  const hawk = hawkAt(plan, now);
  const birds = pigeons.flatMap((p) => {
    const f = page.floors.get(p.floor)!;
    const off = plan.takeoffs.find((t) => t.id === p.id);
    if (!off || now < off.at) return [{ id: p.id, box: around({ x: f.left + p.x, y: f.y }, { half: POSES.alert.width / 2, up: POSES.alert.height, down: 0 }) }];
    const where = flying(off.track, now - off.at, false);
    if (where.done) return [];
    const g = page.floors.get(off.route.floor)!;
    return [{ id: p.id, box: around({ x: g.left + where.at.x, y: g.y + where.at.y }, reachAt(ENVELOPES, where.at, where.s, lengthOfTrack(off.track), false)) }];
  });
  return hawk ? [{ id: -1, box: around({ x: row.left + hawk.x, y: row.y + hawk.y }, GLIDE) }, ...birds] : birds;
}
const onScreen = (b: Box) => b.right > 0 && b.left < 1440 && b.bottom > 0 && b.top < 900;
const grow = (b: Box, by: number): Box => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });

describe("the hawk's sweep", { timeout: 30_000 }, () => {
  it('finds the rows: ledges side by side with tops within 2px', () => {
    expect(rowsOf(PAGE).map((r) => r.floors)).toEqual([[1], [2, 3], [4]]);
  });

  it('has a lane 4px over the first row, closed by anything in the band', () => {
    expect(laneClear(board, SKY)).toBe(true);
    const chart: Obstacle = { left: 1100, right: 1200, top: 150, bottom: 172 };
    expect(laneClear(board, testSky(overview([chart])))).toBe(false);
  });

  it('plans a sweep whose every frame keeps every bird in air and 6px from every other', () => {
    for (const seed of Array.from({ length: 5 }, (_, i) => i + 1)) {
      const plan = planSweep(FLOCK, PAGE, SKY, 1000, seeded(seed))!;
      expect(plan).not.toBeNull();
      expect(plan.row).toBe(2);
      expect(plan.takeoffs.map((t) => t.id).sort()).toEqual([0, 1, 2]);
      for (const now of Array.from({ length: Math.ceil((plan.end + 4000 - plan.start) * 0.06) }, (_, i) => plan.start + i * (1000 / 60))) {
        const boxes = boxesAt(plan, FLOCK, PAGE, now).filter((d) => onScreen(d.box));
        for (const d of boxes) expect(SKY.clear(d.box), `${d.id} at ${now}`).toBe(true);
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(meets(grow(a.box, GAP), b.box), `${a.id} and ${b.id} at ${now}`).toBe(false)));
      }
    }
  });

  it('comes in from the side farther from the nearest pigeon, and they fly away ahead of it, the farthest first', () => {
    // Pigeons near the right: it comes in from the rail's edge going right.
    const right = [at(0, 3, 200), at(1, 3, 300)];
    const plan = planSweep(right, PAGE, SKY, 0, seeded(2))!;
    expect(plan.dir).toBe(1);
    expect(plan.takeoffs.every((t) => t.route.way !== 'left')).toBe(true);
    expect(plan.takeoffs.map((t) => t.id)).toEqual([1, 0]);
    expect(plan.takeoffs[1].at - plan.takeoffs[0].at).toBe(OFF_APART);
    // Pigeons near the rail: it comes in from the right going left.
    const left = [at(0, 2, 60), at(1, 2, 160)];
    expect(planSweep(left, PAGE, SKY, 0, seeded(2))!.dir).toBe(-1);
  });

  it('plans none when a pigeon on its row has no way out ahead of it either way', () => {
    // Text low in the band's top over the right half closes the pigeons'
    // way out to the right, though the hawk's lane under it is open.
    const label: Obstacle = { left: 1200, right: 1386, top: 120, bottom: 150 };
    const page = overview([label]);
    const plan = planSweep(FLOCK, page, testSky(page), 0, seeded(3))!;
    expect(plan.dir).toBe(-1);
    // With no rail column there is no way out to the left either.
    expect(planSweep(FLOCK, page, testSky(page, { left: null, right: 1440 }), 0, seeded(3))).toBeNull();
  });

  it('leaves pigeons on rows with no way out looking up until it has passed', () => {
    const flock = [...FLOCK, at(3, 4, 300)];
    const plan = planSweep(flock, PAGE, SKY, 0, seeded(4))!;
    expect(plan.alerts).toEqual([3]);
    expect(plan.takeoffs.some((t) => t.id === 3)).toBe(false);
  });

  it('brings them back one at a time, 5 to 10s after it has gone', () => {
    const plan = planSweep(FLOCK, PAGE, SKY, 0, seeded(5))!;
    expect(plan.returns.map((r) => r.id)).toEqual(plan.takeoffs.map((t) => t.id));
    expect(plan.returns[0].at - plan.end).toBeGreaterThanOrEqual(RETURN[0]);
    expect(plan.returns[0].at - plan.end).toBeLessThanOrEqual(RETURN[1]);
    plan.returns.slice(1).forEach((r, i) => {
      expect(r.at - plan.returns[i].at).toBeGreaterThanOrEqual(RETURN_APART[0]);
      expect(r.at - plan.returns[i].at).toBeLessThanOrEqual(RETURN_APART[1]);
    });
  });

  it('plans none with a pigeon already in the air', () => {
    const up = { ...FLOCK[0], mode: 'away' as const };
    expect(planSweep([up, ...FLOCK.slice(1)], PAGE, SKY, 0, seeded(1))).toBeNull();
  });

  it('waits 30 to 60s, sweeps only when the page is calm, then waits 70 to 140s', () => {
    const h = createHawk(0, seeded(6));
    expect(h.next).toBeGreaterThanOrEqual(FIRST[0]);
    expect(h.next).toBeLessThanOrEqual(FIRST[1]);
    expect(stepHawk(h, FLOCK, PAGE, SKY, h.next - 1, seeded(6), true)).toBe(h);
    expect(stepHawk(h, FLOCK, PAGE, SKY, h.next, seeded(6), false)).toEqual({ next: h.next + RETRY, plan: null });
    const sweeping = stepHawk(h, FLOCK, PAGE, SKY, h.next, seeded(6), true);
    expect(sweeping.plan).not.toBeNull();
    const plan = sweeping.plan!;
    expect(hawkView(sweeping, PAGE, plan.start + 1000)).toMatchObject({ dir: plan.dir });
    expect(hawkView(sweeping, PAGE, plan.end + 1)).toBeNull();
    const after = stepHawk(sweeping, FLOCK, PAGE, SKY, plan.end, seeded(6), true);
    expect(after.plan).toBeNull();
    expect(after.next - plan.end).toBeGreaterThanOrEqual(AGAIN[0]);
    expect(after.next - plan.end).toBeLessThanOrEqual(AGAIN[1]);
  });

  it('crosses from exit to exit, gliding a pixel up and down, its belly 4px over the row', () => {
    const plan = planSweep(FLOCK, PAGE, SKY, 0, seeded(7))!;
    const first = hawkAt(plan, plan.start)!;
    // It starts out of sight, half a second before it comes in past the
    // exit, while the pigeons already see it coming.
    const lead = (SPEED * SIGHTED) / 1000;
    expect(board.left + first.x + (plan.dir > 0 ? GLIDE.half : -GLIDE.half)).toBeCloseTo(plan.dir > 0 ? EXITS.left! - 1 - lead : EXITS.right + 1 + lead);
    const ys = Array.from({ length: 50 }, (_, i) => hawkAt(plan, plan.start + i * 40)!.y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(-3);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-5);
    expect(side.y + Math.max(...ys)).toBeLessThan(side.y);
  });

  it('finds a pigeon left standing in its path, or flying too close, frame by frame', () => {
    const plan = planSweep(FLOCK, PAGE, SKY, 0, seeded(9))!;
    expect(simulate(plan, FLOCK, PAGE, SKY)).toBe(true);
    const stays = { ...plan, takeoffs: plan.takeoffs.slice(0, -1) };
    expect(simulate(stays, FLOCK, PAGE, SKY)).toBe(false);
    // One leaving 2s late is still standing when the hawk reaches it.
    const late = { ...plan, takeoffs: plan.takeoffs.map((t, i) => (i === 1 ? { ...t, at: plan.takeoffs[0].at + 2000 } : t)) };
    expect(simulate(late, FLOCK, PAGE, SKY)).toBe(false);
  });

  it('drops a sweep the page has closed under it', () => {
    const rand = seeded(8);
    const h = { next: Infinity, plan: planSweep(FLOCK, PAGE, SKY, 0, rand)! };
    expect(simulate(h.plan, FLOCK, PAGE, SKY, 500)).toBe(true);
    expect(hawkRemeasured(h, FLOCK, PAGE, SKY, 500, rand)).toBe(h);
    const closed = overview([{ left: 600, right: 700, top: 140, bottom: 178 }]);
    expect(hawkRemeasured(h, FLOCK, closed, testSky(closed), 500, rand).plan).toBeNull();
  });
});
