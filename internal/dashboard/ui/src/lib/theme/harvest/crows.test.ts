import { describe, expect, it } from 'vitest';
import type { PageMap } from '../floors';
import type { Cursor } from '../pointer';
import type { Alarm } from './alarm';
import { peck, type Chaff } from './chaff';
import { grounded, standing, type Crow } from './crow';
import { AWAY, createCrows, feedingSpots, LOOK_AGAIN, pointOf, reconcileCrows, RESTLESS_AWAY, restingCrows, RETURN_GAP, SPOT_APART, SPOT_GRAIN, STAGGER, stepCrows, type Crows, type Field } from './crows';
import { card, field, OPEN, PAGE, seeded, SHUT } from './fixtures';
import { leave } from './flight';

const SCARECROW = { x: 80, y: 780 };
const alarmAt = (at: number, until = at + 1500): Alarm => ({ at, until, ...SCARECROW });

// Runs the family frame by frame, eating the grain its pecks bite, and
// returns every frame's group.
function run(g: Crows, f: Field, from: number, ms: number, rand = seeded(5), alarm: (now: number) => Alarm | null = () => null, cursor: (now: number) => Cursor | null = () => null) {
  const frames: { now: number; group: Crows }[] = [];
  const end = Array.from({ length: Math.ceil(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce((acc, now) => {
    const { group, bites } = stepCrows(acc.group, acc.field, now, 16, rand, cursor(now), alarm(now));
    const chaff = bites.reduce<ReadonlyMap<number, Chaff>>((c, b) => peck(c, b.floor, b.x, now), acc.field.chaff);
    frames.push({ now, group });
    return { group, field: { ...acc.field, chaff } };
  }, { group: g, field: f });
  return { frames, group: end.group, field: end.field };
}
const modes = (g: Crows) => g.crows.map((c) => c.mode);
const standingOn = (g: Crows) => g.crows.filter(grounded);

// No two crows on one ledge closer than 60px, none off its run.
function spaced(g: Crows) {
  const on = standingOn(g);
  return on.every((a) => on.every((b) => a === b || a.floor !== b.floor || Math.abs(a.x - b.x) >= 60 - 1e-6));
}

describe('the crows', () => {
  it('feed only where they stand clear, near grain, apart and with a way off the page', () => {
    const f = field();
    const spots = feedingSpots(f, []);
    expect(spots.length).toBeGreaterThan(10);
    expect(spots.every((s) => [...f.chaff.get(s.floor)!.grains].some((g) => Math.abs(g.x - s.x) <= SPOT_GRAIN))).toBe(true);
    const taken = [{ floor: 1, x: 500 }];
    expect(feedingSpots(f, taken).every((s) => s.floor !== 1 || Math.abs(s.x - 500) >= SPOT_APART)).toBe(true);
    // Text coming down onto a ledge leaves no room to stand under it.
    const text = { left: 300, right: 1300, top: 180, bottom: 195 };
    expect(feedingSpots(field({ ...PAGE, obstacles: [text] }), []).some((s) => s.floor === 1)).toBe(false);
    // With no way off the page, nobody is placed at all.
    const shut = createCrows(field(PAGE, SHUT), 0, seeded(1));
    expect(modes(shut)).toEqual(['away', 'away']);
  });

  it('are three where three spots are 90px apart, two where only two are, never more later', () => {
    const three = createCrows(field(), 0, seeded(1));
    expect(three.size).toBe(3);
    expect(modes(three)).toEqual(['scan', 'scan', 'scan']);
    expect(spaced(three)).toBe(true);
    // Spread over the ledges nobody else is on first.
    expect(new Set(three.crows.map((c) => c.floor)).size).toBe(3);
    const narrow: PageMap = { ...PAGE, floors: new Map([[1, card(300, 470, 200)], [2, card(300, 470, 500)]]) };
    const two = createCrows(field(narrow), 0, seeded(1));
    expect(two.size).toBe(2);
    const roomy = reconcileCrows(two, field(), 100, seeded(2));
    expect(roomy.crows.length).toBe(2);
  });

  it('keep apart and on their runs over a long run, and eat the grain', () => {
    const f = field();
    const { frames, field: after } = run(createCrows(f, 0, seeded(3)), f, 0, 30000, seeded(4));
    expect(frames.every(({ group }) => spaced(group))).toBe(true);
    const eaten = [...after.chaff.values()].flatMap((c) => c.grains).filter((g) => g.eaten !== null);
    expect(eaten.length).toBeGreaterThan(0);
  });

  it('scatter at a flap, nearest the scarecrow first and 0.2 to 0.35s apart, every one off the page', () => {
    // One row of cards and small envelopes, so no crow has to wait for
    // another's way to clear.
    const row: PageMap = { ...PAGE, floors: new Map([[1, card(300, 700, 500)], [2, card(740, 1100, 500)], [3, card(1140, 1420, 500)]]) };
    const f = { ...field(row), envelope: (p: { x: number; y: number }) => ({ left: p.x, right: p.x, top: p.y, bottom: p.y }) };
    const g = createCrows(f, 0, seeded(3));
    const { frames } = run(g, f, 0, 8000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000) : null));
    const far = (c: Crow) => Math.hypot(pointOf(c, row, 0)!.x - SCARECROW.x, pointOf(c, row, 0)!.y - SCARECROW.y);
    const takeoffs = g.crows.map((c) => frames.find(({ group }) => group.crows[c.id].mode === 'takeoff')!.now);
    const ordered = [...g.crows].sort((a, b) => far(a) - far(b)).map((c) => takeoffs[c.id]);
    expect(ordered[0]).toBe(1008);
    ordered.slice(1).forEach((t, i) => {
      expect(t - ordered[i]).toBeGreaterThanOrEqual(STAGGER.lo - 16);
      expect(t - ordered[i]).toBeLessThanOrEqual(STAGGER.hi + 16);
    });
    expect(modes(frames.at(-1)!.group)).toEqual(['away', 'away', 'away']);
    // Every crow left by the top or the right, never over the rail.
    for (const { now, group } of frames) for (const c of group.crows) {
      const p = pointOf(c, row, now);
      if (p) expect(p.x).toBeGreaterThan(280);
    }
  });

  it('stay away 15 to 25s after the last flap, longer if the scarecrow flaps on', () => {
    const f = field();
    const g = createCrows(f, 0, seeded(3));
    const once = run(g, f, 0, 4000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000) : null)).group;
    for (const c of once.crows) {
      expect(c.back - 2500).toBeGreaterThanOrEqual(AWAY.lo);
      expect(c.back - 2500).toBeLessThanOrEqual(AWAY.hi);
    }
    // The same flapping going on to 6s pushes every wait out.
    const longer = run(g, f, 0, 7000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000, Math.min(now, 6000)) : null)).group;
    for (const c of longer.crows) expect(c.back - 6000).toBeGreaterThanOrEqual(AWAY.lo);
    // A flap while they are away starts their wait again.
    const again = run(once, f, 4000, 1000, seeded(5), () => alarmAt(4500)).group;
    for (const c of again.crows) expect(c.back).toBeGreaterThanOrEqual(6000 + AWAY.lo);
  });

  it('turn back if they were coming in when the scarecrow flapped', () => {
    const f = field();
    const gone = run(createCrows(f, 0, seeded(3)), f, 0, 5000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000, 1000) : null));
    const coming = run(gone.group, gone.field, 5000, 30000, seeded(6), () => alarmAt(1000, 1000));
    const frame = coming.frames.find(({ group }) => group.crows.some((c) => c.mode === 'arrive'))!;
    const arriving = frame.group.crows.find((c) => c.mode === 'arrive')!;
    const turned = stepCrows(frame.group, coming.field, frame.now + 16, 16, seeded(7), null, alarmAt(frame.now + 16)).group;
    expect(turned.crows[arriving.id].mode).toBe('depart');
    expect(turned.crows[arriving.id].back).toBeGreaterThanOrEqual(frame.now + 16 + 1500 + AWAY.lo);
  });

  it('come back one at a time, a scout first, the next 2 to 6s after it lands, farthest from the scarecrow first', () => {
    const f = field();
    const gone = run(createCrows(f, 0, seeded(3)), f, 0, 5000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000, 1000) : null));
    const { frames } = run(gone.group, gone.field, 5000, 40000, seeded(6), () => alarmAt(1000, 1000));
    expect(frames.every(({ group }) => group.crows.filter((c) => c.mode === 'arrive').length <= 1)).toBe(true);
    const lands = frames.flatMap(({ now, group }, i) => group.crows.filter((c, k) => c.mode === 'settle' && (i ? frames[i - 1].group.crows[k].mode : '') === 'arrive').map(() => now));
    const starts = frames.flatMap(({ now, group }, i) => group.crows.filter((c, k) => c.mode === 'arrive' && (i ? frames[i - 1].group.crows[k].mode : 'arrive') === 'away').map(() => now));
    expect(lands.length).toBe(3);
    starts.slice(1).forEach((s, i) => {
      expect(s - lands[i]).toBeGreaterThanOrEqual(RETURN_GAP.lo - 16);
    });
    // The scout went to the spot farthest from the scarecrow it could.
    const first = frames.find(({ group }) => group.crows.some((c) => c.mode === 'arrive'))!.group.crows.find((c) => c.mode === 'arrive')!;
    const f1 = PAGE.floors.get(first.floor)!;
    expect(Math.hypot(f1.left + first.x - SCARECROW.x, f1.y - SCARECROW.y)).toBeGreaterThan(900);
  });

  it('stay away and look again every 5s while there is nowhere to come back to, still counted', () => {
    const f = field();
    const gone = run(createCrows(f, 0, seeded(3)), f, 0, 5000, seeded(4), (now) => (now >= 1000 ? alarmAt(1000, 1000) : null)).group;
    const nowhere = { ...f, clear: SHUT };
    const back = gone.crows.reduce((m, c) => Math.max(m, c.back), 0);
    const later = run(gone, nowhere, 5000, back - 5000 + 100, seeded(6), () => alarmAt(1000, 1000)).group;
    expect(later.crows.length).toBe(3);
    expect(modes(later)).toEqual(['away', 'away', 'away']);
    expect(later.crows.some((c) => c.back > back && c.back <= back + LOOK_AGAIN + 100)).toBe(true);
  });

  it('now and then one leaves on its own, never while another is flying, and comes back elsewhere', () => {
    const f = field();
    const g = { ...createCrows(f, 0, seeded(3)), restless: 1000 };
    const { frames } = run(g, f, 0, 30000, seeded(8));
    const left = frames.find(({ group }) => group.crows.some((c) => c.mode === 'takeoff'))!;
    expect(left.now).toBeLessThan(1100);
    const crow = left.group.crows.find((c) => c.mode === 'takeoff')!;
    const awayAt = frames.find(({ group }) => group.crows[crow.id].mode === 'away')!.now;
    const backAt = frames.find(({ now, group }) => now > awayAt && group.crows[crow.id].mode === 'arrive')!;
    expect(backAt.now - 1000).toBeGreaterThanOrEqual(RESTLESS_AWAY.lo - 16);
    const landed = backAt.group.crows[crow.id];
    expect(landed.floor !== crow.floor || Math.abs(landed.x - crow.x) >= SPOT_APART).toBe(true);
    expect(frames.every(({ group }) => group.crows.filter((c) => ['takeoff', 'depart', 'arrive'].includes(c.mode)).length <= 1)).toBe(true);
  });

  it('keep their places through a layout change while their runs stay, and move when they go', () => {
    const f = field();
    const g = createCrows(f, 0, seeded(3));
    expect(reconcileCrows(g, f, 100, seeded(1)).crows.map((c) => [c.floor, c.x])).toEqual(g.crows.map((c) => [c.floor, c.x]));
    const gone = g.crows[0].floor;
    const without = { ...PAGE, floors: new Map([...PAGE.floors].filter(([id]) => id !== gone)) };
    const moved = reconcileCrows(g, field(without), 100, seeded(1));
    expect(moved.crows[0].floor === gone && moved.crows[0].mode !== 'away').toBe(false);
    expect(moved.crows.slice(1).map((c) => [c.floor, c.x])).toEqual(g.crows.slice(1).map((c) => [c.floor, c.x]));
  });

  it('keep flying a clear route through a layout change, and find another when it is not', () => {
    const f = field();
    const leaving = { ...standing(0, 1, 300, 1, 0, () => 0), mode: 'depart' as const, flight: leave({ x: 600, y: 200 }, 1440, OPEN, 0, 200) };
    const g: Crows = { crows: [leaving], size: 2, alarm: null, restless: Infinity, landed: -Infinity };
    expect(reconcileCrows(g, f, 300, seeded(1)).crows[0].flight).toBe(leaving.flight);
    const onlyRight: Field = { ...f, clear: (r) => r[r.length - 1].to.y > 0 };
    const rerouted = reconcileCrows(g, onlyRight, 300, seeded(1)).crows[0];
    expect(rerouted.mode).toBe('depart');
    expect(rerouted.flight).not.toBe(leaving.flight);
    expect(reconcileCrows(g, { ...f, clear: SHUT }, 300, seeded(1)).crows[0].mode).toBe('away');
  });

  it('stand still under reduced motion, keeping their places, never stepped', () => {
    const f = field();
    const fresh = restingCrows(f, null);
    expect(fresh.size).toBe(3);
    expect(spaced(fresh)).toBe(true);
    expect(fresh.crows.every((c) => c.mode === 'scan' && c.until === Infinity)).toBe(true);
    const moving = createCrows(f, 0, seeded(3));
    const stilled = restingCrows(f, moving);
    expect(stilled.crows.map((c) => [c.floor, c.x])).toEqual(moving.crows.map((c) => [c.floor, c.x]));
    expect(stilled.restless).toBe(Infinity);
  });
});
