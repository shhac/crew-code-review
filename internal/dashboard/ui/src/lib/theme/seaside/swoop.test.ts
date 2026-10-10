import { describe, expect, it } from 'vitest';
import { around, meets } from '../air';
import { cubic, samples } from '../curves';
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import { apart } from '../math';
import type { Point } from '../pointer';
import { lower, OPEN, page, rule } from './gull-fixtures';
import { AIR, LIFT } from './gull-poses';
import { airspace } from './gulls';
import { aimOff, flightOf, flightTime, inFlight, passPoints, planSwoop, replan, stillClear, type Leg, type Plan } from './swoop';

const view = (p: PageMap = page()) => airspace(p).view;
const ask = (p: PageMap, cursor: Point, gull = { floor: 4, x: 560 }) => ({ air: view(p), gull, home: gull, cursor, taken: [], also: [] });

// A route checked on its own terms, independent of air.ts: every pose box,
// a pixel apart along every leg, inside main's air in view and touching
// nothing, except the card a run or a flare is on.
function covers(p: PageMap, legs: readonly Leg[], takeoff: Ledge, landing: Ledge): string[] {
  const room = view(p).room;
  const own = (f: Ledge) => (o: Obstacle) => !!o.block && o.top === f.y && o.left === f.left;
  return legs.flatMap((l, i) => samples((t) => cubic(l.curve, t), 1).flatMap(({ p: at }) => {
    const box = around(at, AIR[l.pose]);
    const outside = box.left < room.left || box.right > room.right || box.top < room.top || box.bottom > room.bottom;
    const ledge = l.mode === 'run' || l.mode === 'climb' ? takeoff : l.mode === 'flare' ? landing : null;
    const hit = p.obstacles.filter((o) => !(ledge && own(ledge)(o)) && meets(box, o));
    return [...(outside ? [`leg ${i} ${l.mode} leaves the air`] : []), ...hit.map((o) => `leg ${i} ${l.mode} over ${JSON.stringify(o)}`)];
  }));
}

const ledgeOf = (p: PageMap, floor: number) => p.floors.get(floor)!;

describe('the pass point', () => {
  it('is in clear air, never over the cursor, 12 to 160px from it, nearest first', () => {
    const p = page();
    for (const cursor of [OPEN, { x: 600, y: 300 }, { x: 1100, y: 470 }, { x: 260, y: 900 }]) {
      const passes = passPoints(view(p), cursor);
      for (const q of passes) {
        const box = around(q, AIR.swoop);
        expect(apart(q, cursor)).toBeGreaterThanOrEqual(12);
        expect(apart(q, cursor)).toBeLessThanOrEqual(160);
        expect(cursor.x >= box.left && cursor.x <= box.right && cursor.y >= box.top && cursor.y <= box.bottom).toBe(false);
        expect(p.obstacles.some((o) => meets(box, o))).toBe(false);
      }
      passes.slice(1).forEach((q, i) => expect(apart(q, cursor)).toBeGreaterThanOrEqual(apart(passes[i], cursor)));
    }
  });

  it('comes close to a cursor over open air, and there is none in the middle of a table of text', () => {
    expect(apart(passPoints(view(), OPEN)[0], OPEN)).toBeLessThanOrEqual(16);
    expect(passPoints(view(), { x: 640, y: 330 })).toEqual([]);
  });
});

describe('a swoop', () => {
  it('runs, climbs, dives at the cursor, pulls up and flies on to land, all of it in clear air', () => {
    const p = page();
    const plan = planSwoop(ask(p, OPEN))!;
    expect(plan).not.toBeNull();
    expect(plan.legs.map((l) => l.mode)).toEqual(['run', 'climb', 'dive', 'pullup', 'cruise', 'flare']);
    expect(plan.legs.map((l) => l.pose)).toEqual(['takeoff', 'flight', 'swoop', 'flight', 'flight', 'flare']);
    expect(covers(p, plan.legs, lower, ledgeOf(p, plan.land.floor))).toEqual([]);
    expect(plan.length).toBeLessThanOrEqual(900);
    // Aimed at the cursor, passing beside it.
    const dive = plan.legs[2];
    expect(aimOff(dive.curve.from, dive.curve.to, OPEN)).toBeLessThanOrEqual(35);
    expect(apart(dive.curve.to, OPEN)).toBeLessThanOrEqual(160);
    // It lands where it can stand, 80px from the cursor.
    const g = ledgeOf(p, plan.land.floor);
    expect(apart({ x: g.left + plan.land.x, y: g.y - LIFT }, OPEN)).toBeGreaterThanOrEqual(80);
    expect(plan.legs.at(-1)!.curve.to.y).toBeCloseTo(g.y - LIFT);
  });

  it('takes the run two steps and 0.45s, the pull-up 0.35s, and speeds up into the dive and slows in the flare', () => {
    const plan = planSwoop(ask(page(), OPEN))!;
    const [run, climb, dive, pull, cruise, flare] = plan.legs;
    expect(run.duration).toBe(450);
    expect(apart(run.curve.from, run.curve.to)).toBeCloseTo(Math.hypot(18, 3));
    expect(pull.duration).toBe(350);
    expect([climb.v0, cruise.v0]).toEqual([200, 240]);
    expect([dive.v0, dive.v1]).toEqual([200, 360]);
    expect([flare.v0, flare.v1]).toEqual([240, 60]);
  });

  it('walks at most 60px to somewhere with room to take off', () => {
    // Under the search box the rule has 27px, room to stand but not to take
    // off; the open stretch beside the subtitle is a little way along.
    const p = page();
    const plan = planSwoop(ask(p, { x: 760, y: 40 }, { floor: 1, x: 410 }));
    if (plan) {
      expect(Math.abs(plan.from - 410)).toBeLessThanOrEqual(60);
      expect(covers(p, plan.legs, rule, ledgeOf(p, plan.land.floor))).toEqual([]);
    }
    const stuck = planSwoop(ask(p, OPEN, { floor: 1, x: 900 }));
    expect(stuck === null || Math.abs(stuck.from - 900) <= 60).toBe(true);
  });

  it('never leaves the air for any cursor over the page, and has no route where no air is near', () => {
    const p = page();
    const found: Plan[] = [];
    // One on the lower card, one on the heading's rule beside its subtitle.
    for (const gull of [{ floor: 4, x: 560 }, { floor: 1, x: 420 }]) {
      for (let y = 20; y < 900; y += 50) {
        for (let x = 250; x < 1430; x += 70) {
          const plan = planSwoop(ask(p, { x, y }, gull));
          if (!plan) continue;
          found.push(plan);
          expect(covers(p, plan.legs, ledgeOf(p, gull.floor), ledgeOf(p, plan.land.floor)), `${x},${y}`).toEqual([]);
          const dive = plan.legs[2];
          expect(aimOff(dive.curve.from, dive.curve.to, { x, y })).toBeLessThanOrEqual(35);
          expect(plan.length).toBeLessThanOrEqual(900);
        }
      }
    }
    expect(found.length).toBeGreaterThan(5);
    expect(planSwoop(ask(p, { x: 640, y: 330 }))).toBeNull();
    // Hundreds of plans, slow on a busy machine.
  }, 60_000);

  it('keeps clear of the other gulls and lands away from them', () => {
    const p = page();
    const first = planSwoop(ask(p, OPEN))!;
    // Another gull where the first plan's cruise went, and one standing
    // where it landed.
    const mid = cubic(first.legs[4].curve, 0.5);
    const also: Box[] = [{ left: mid.x - 20, right: mid.x + 20, top: mid.y - 20, bottom: mid.y + 20 }];
    const taken = [{ floor: first.land.floor, lo: first.land.x, hi: first.land.x }];
    const plan = planSwoop({ ...ask(p, OPEN), also, taken });
    expect(plan).not.toEqual(first);
    if (!plan) return;
    for (const l of plan.legs) {
      for (const s of samples((t) => cubic(l.curve, t), 1)) expect(meets(around(s.p, AIR[l.pose]), also[0])).toBe(false);
    }
    if (plan.land.floor === first.land.floor) expect(Math.abs(plan.land.x - first.land.x)).toBeGreaterThanOrEqual(100);
  });
});

describe('a flight under way', () => {
  const p = page();
  const plan = planSwoop(ask(p, OPEN))!;
  const flight = flightOf(p, plan, 4, 1000)!;

  it('is where its legs say at each moment, and over when they are flown', () => {
    expect(inFlight(p, flight, 1000)!.leg.mode).toBe('run');
    expect(inFlight(p, flight, 1000)!.at.x).toBeCloseTo(plan.legs[0].curve.from.x);
    expect(inFlight(p, flight, 1000 + 460)!.leg.mode).toBe('climb');
    expect(inFlight(p, flight, 1000 + flightTime(flight) - 1)!.leg.mode).toBe('flare');
    expect(inFlight(p, flight, 1000 + flightTime(flight))).toBeNull();
  });

  it('rides with its landing ledge when the page scrolls', () => {
    const scrolled = page(OBSTACLES_SHIFTED(-120), FLOORS_SHIFTED(-120));
    const now = 1000 + flightTime(flight) / 2;
    expect(inFlight(scrolled, flight, now)!.at.y).toBeCloseTo(inFlight(p, flight, now)!.at.y - 120);
  });

  it('carries on while the rest of it is clear, and re-plans or stops when blocked', () => {
    const now = 1000 + 600;
    const air = airspace(p);
    expect(stillClear(air.room, flight, now, [], [])).toBe(true);
    // Something appears across the rest of its way.
    const at = inFlight(p, flight, now + 400)!.at;
    const blocked = page([...p.obstacles, { left: at.x - 10, right: at.x + 10, top: at.y - 10, bottom: at.y + 10 }]);
    expect(stillClear(airspace(blocked).room, flight, now, [], [])).toBe(false);
    const here = inFlight(blocked, flight, now)!;
    const again = replan(airspace(blocked).view, here.at, here.heading, [], [], OPEN);
    if (again) expect(covers(blocked, again.legs, lower, ledgeOf(blocked, again.land.floor))).toEqual([]);
    // Its landing ledge gone.
    expect(stillClear(air.room, { ...flight, floor: 99, land: { ...flight.land, floor: 99 } }, now, [], [])).toBe(false);
  });
});

function OBSTACLES_SHIFTED(dy: number): Obstacle[] {
  return page().obstacles.map((o) => ({ ...o, top: o.top + dy, bottom: o.bottom + dy }));
}
function FLOORS_SHIFTED(dy: number): [number, Ledge][] {
  return [...page().floors].map(([id, f]) => [id, { ...f, y: f.y + dy, base: f.base + dy }]);
}
