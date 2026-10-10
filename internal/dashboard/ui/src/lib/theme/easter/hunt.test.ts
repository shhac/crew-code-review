import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { scene } from '../test-scene';
import { eggView } from './eggs';
import { canLeave, EGG, FIND_REACH, findEggs, hideEggs, leaveEgg, MOST, NO_HUNT, peepAt, PEEP, spotClear, START, tally, tallySpot, xOf, type Hunt } from './hunt';

const card = (y: number, left = 100, right = 500): Ledge => ({ left, right, y, base: y + 200, room: 40, headroom: Infinity, kind: 'card' });
// Many ledges, so the seeded chance hides a few eggs.
const many = scene(Array.from({ length: 30 }, (_, i) => [i + 1, card(100 + i * 40)] as [number, Ledge]));

describe('the egg hunt', () => {
  it('hides at most START eggs at first, one per ledge end, seeded by ledge id', () => {
    const hunt = hideEggs(NO_HUNT, many);
    expect(hunt.eggs.length).toBeGreaterThan(0);
    expect(hunt.eggs.length).toBeLessThanOrEqual(START);
    expect(new Set(hunt.eggs.map((e) => e.key)).size).toBe(hunt.eggs.length);
    expect(hideEggs(NO_HUNT, many)).toEqual(hunt);
    expect(hunt.eggs.every((e) => e.found === null)).toBe(true);
    expect(tally(hunt)).toEqual({ found: 0, total: hunt.eggs.length });
  });

  it('never gives a ledge it has seen another egg', () => {
    const hunt = hideEggs(NO_HUNT, many);
    const again = hideEggs({ ...hunt, eggs: [] }, many);
    expect(again.eggs).toEqual([]);
  });

  it('keeps eggs off ends that text or a control comes down to', () => {
    const lone = (o: { left: number; right: number; top: number; bottom: number }) =>
      [spotClear(card(300), scene([[1, card(300)]], [o]), 'left'), spotClear(card(300), scene([[1, card(300)]], [o]), 'right')];
    expect(lone({ left: 95, right: 130, top: 270, bottom: 296 })).toEqual([false, true]);
    // Text well above leaves room; a card's own empty edge may be reached into.
    expect(lone({ left: 95, right: 130, top: 200, bottom: 280 })).toEqual([true, true]);
    expect(spotClear(card(300, 100, 140), scene([]), 'left')).toBe(false);
  });

  it('finds an egg a stroke passes close to its top, and counts it once', () => {
    const hunt = hideEggs(NO_HUNT, many);
    const egg = hunt.eggs[0];
    const at = peepAt(egg, many.floors.get(egg.floor)!);
    const far = findEggs(hunt, many, { from: { x: at.x - 200, y: at.y - FIND_REACH - 2 }, to: { x: at.x + 200, y: at.y - FIND_REACH - 2 }, at: 1000 });
    expect(far).toBe(hunt);
    const found = findEggs(hunt, many, { from: { x: at.x - 200, y: at.y - 10 }, to: { x: at.x + 200, y: at.y - 10 }, at: 1000 });
    expect(found.eggs.find((e) => e.key === egg.key)!.found).toBe(1000);
    expect(tally(found)).toEqual({ found: 1, total: hunt.eggs.length });
    const twice = findEggs(found, many, { from: { x: at.x - 200, y: at.y - 10 }, to: { x: at.x + 200, y: at.y - 10 }, at: 2000 });
    expect(tally(twice)).toEqual(tally(found));
  });

  it('keeps found eggs counted after leaving a page, and drops the hidden ones from the total', () => {
    const hunt = hideEggs(NO_HUNT, many);
    const egg = hunt.eggs[0];
    const at = peepAt(egg, many.floors.get(egg.floor)!);
    const found = findEggs(hunt, many, { from: at, to: { x: at.x + 1, y: at.y }, at: 5 });
    const elsewhere = hideEggs(found, scene([[99, card(300)]]));
    expect(elsewhere.eggs.filter((e) => e.floor !== 99)).toEqual([]);
    expect(tally(elsewhere).found).toBe(1);
    expect(tally(elsewhere).total).toBe(1 + elsewhere.eggs.length);
  });

  it('lets a rabbit leave an egg at a free, clear end, up to MOST hidden', () => {
    const page = scene([[1, card(300)]]);
    const seen: Hunt = { ...NO_HUNT, seen: new Set([1]) };
    expect(canLeave(seen, page, 1, 'left')).toBe(true);
    const left = leaveEgg(seen, page, 1, 'left', 3000, 2);
    expect(left.eggs).toEqual([{ key: '1:left', floor: 1, end: 'left', design: 2, found: null, hidden: 3000 }]);
    expect(canLeave(left, page, 1, 'left')).toBe(false);
    expect(leaveEgg(left, page, 1, 'left', 4000, 1)).toBe(left);
    const full = hideEggs(NO_HUNT, many);
    const crowded = Array.from({ length: 20 }, (_, i) => i + 1).reduce((h, id) => leaveEgg(leaveEgg(h, many, id, 'left', 0, 0), many, id, 'right', 0, 0), full);
    expect(tally(crowded).total).toBe(MOST);
  });

  it('stands an egg in its ledge end', () => {
    const f = card(300);
    expect(xOf(f, 'left')).toBe(10);
    expect(xOf(f, 'right')).toBe(390);
  });
});

describe('the counter', () => {
  it('sits right-aligned in the brand, after its words, or not at all', () => {
    const brand = { left: 18, right: 218, top: 24, bottom: 88 };
    expect(tallySpot(brand, { left: 94, right: 167, top: 36, bottom: 76 })).toEqual({ x: 184, y: 48 });
    expect(tallySpot(brand, { left: 94, right: 180, top: 36, bottom: 76 })).toBeNull();
  });
});

describe('an egg as drawn', () => {
  const f = card(300);
  const egg = { key: '1:left', floor: 1, end: 'left' as const, design: 0, found: null, hidden: -Infinity };

  it('peeps a third of its height over the ledge while hidden, at most wobbling', () => {
    const views = Array.from({ length: 300 }, (_, i) => eggView(egg, f, i * 100, false));
    expect(views.every((v) => Math.abs(v.sunk - (1 - PEEP) * EGG.height) < 1e-9)).toBe(true);
    expect(views.some((v) => v.tilt !== 0)).toBe(true);
    expect(Math.max(...views.map((v) => Math.abs(v.tilt)))).toBeLessThanOrEqual(9);
    expect(views.every((v) => v.x === 110 && v.y === 300)).toBe(true);
  });

  it('pops up to stand on the ledge when found, never past it, with a brief glint', () => {
    const found = { ...egg, found: 1000 };
    const sunk = Array.from({ length: 20 }, (_, i) => eggView(found, f, 1000 + i * 50, false).sunk);
    expect(sunk[0]).toBeCloseTo((1 - PEEP) * EGG.height);
    expect(sunk.every((s, i) => i === 0 || s <= sunk[i - 1])).toBe(true);
    expect(sunk.at(-1)).toBe(0);
    expect(eggView(found, f, 1300, false).glint).toBeGreaterThan(0);
    expect(eggView(found, f, 2000, false).glint).toBe(0);
  });

  it('rises out of sight to its peep when a rabbit leaves it', () => {
    const left = { ...egg, hidden: 5000 };
    expect(eggView(left, f, 5000, false).sunk).toBe(EGG.height);
    expect(eggView(left, f, 5600, false).sunk).toBeCloseTo((1 - PEEP) * EGG.height);
  });

  it('holds still under reduced motion', () => {
    expect(eggView(egg, f, 12345, true)).toEqual({ x: 110, y: 300, ledge: 300, sunk: (1 - PEEP) * EGG.height, tilt: 0, glint: 0 });
    expect(eggView({ ...egg, found: 12000 }, f, 12100, true).sunk).toBe(0);
  });
});
