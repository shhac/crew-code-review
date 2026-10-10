import { describe, expect, it } from 'vitest';
import type { Box } from '../floors';
import type { Cursor } from '../pointer';
import { seeded } from '../test-scene';
import { clear } from './beeair';
import { beeView, boxOf, stepBee, where, type Bee, type WallSide } from './bee';
import { boxesOf, createBees, reconcileBees, restingBees, SPACE, stepBees, type Bees, type Meadow } from './bees';
import { cursorAt, dashboard, meadowOn } from './fixtures';
import { SHELF_KEY } from './flowers';
import { HEAD } from './footprints';

const gap = (a: Box, b: Box) => Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);

// Runs the group in 16ms frames from `from` for `ms`, the cursor given by
// time, checking every frame.
function run(group: Bees, m: Meadow, ms: number, cursor: (t: number) => Cursor | null = () => null, from = 0, rand = seeded(7), each: (g: Bees, t: number) => void = () => {}) {
  return Array.from({ length: Math.ceil(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce((g, t) => {
    const next = stepBees(g, m, t, 16, rand, cursor(t));
    each(next, t);
    return next;
  }, group);
}

describe('the bees', () => {
  it('are two or three, perched on flowers apart, clear of everything', () => {
    const m = meadowOn();
    const g = createBees(m, 0, seeded(1));
    expect(g.bees.length).toBeGreaterThanOrEqual(2);
    const flowers = g.bees.map((b) => b.flower);
    expect(new Set(flowers).size).toBe(flowers.length);
    for (const b of g.bees) {
      expect(b.mode).toBe('perch');
      expect(clear(m.air, boxOf(b, m.air.page, 0)!)).toBe(true);
    }
  });

  it('bumble from flower to flower for a minute, never over content and never within 8px of each other', { timeout: 30000 }, () => {
    const m = meadowOn();
    const g = createBees(m, 0, seeded(2));
    const seen = new Set<string>();
    const visited = new Set<string>();
    run(g, m, 60000, () => null, 0, seeded(3), (next, t) => {
      for (const b of next.bees) {
        seen.add(b.mode);
        if (b.mode === 'perch' && b.flower) visited.add(b.flower);
        const box = boxOf(b, m.air.page, t);
        if (box) expect(clear(m.air, box), `${b.id} ${b.mode} at ${t}`).toBe(true);
      }
      const boxes = boxesOf(next, m.air.page, t);
      for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(gap(a, b)).toBeGreaterThanOrEqual(SPACE - 0.01);
    });
    for (const mode of ['perch', 'crawl', 'shiver', 'takeoff', 'hover', 'fly', 'approach', 'land']) expect(seen.has(mode), mode).toBe(true);
    expect(visited.size).toBeGreaterThan(g.bees.length);
  });

  it('keep clear of content and of each other with a cursor wandering among them', { timeout: 30000 }, () => {
    const m = meadowOn();
    const g = createBees(m, 0, seeded(12));
    const modes = new Set<string>();
    // A cursor sweeping to and fro over the first row's tops, now moving,
    // now resting.
    const cursor = (t: number): Cursor => {
      const k = Math.floor(t / 3000);
      const x = 300 + ((t / 4) % 1000), y = 140 + 30 * Math.sin(t / 700);
      return { x, y, at: k % 2 === 0 ? t : k * 3000 };
    };
    run(g, m, 40000, cursor, 0, seeded(13), (next, t) => {
      for (const b of next.bees) {
        modes.add(b.mode);
        const box = boxOf(b, m.air.page, t);
        if (box) expect(clear(m.air, box), `${b.id} ${b.mode} at ${t}`).toBe(true);
      }
      const boxes = boxesOf(next, m.air.page, t);
      for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(gap(a, b)).toBeGreaterThanOrEqual(SPACE - 0.01);
    });
    expect(modes.has('dodge')).toBe(true);
  });

  it('dart out of a moving cursor\'s way, and not again for a while', () => {
    const m = meadowOn();
    const g = createBees(m, 0, seeded(4));
    const b = g.bees[0];
    const here = where(b, m.air.page, 0)!;
    const cursor = cursorAt(here.x + 20, here.y + 10, 0);
    const after = run(g, m, 600, (t) => ({ ...cursor, at: t }), 0, seeded(5));
    const views: string[] = [];
    run(g, m, 600, (t) => ({ ...cursor, at: t }), 0, seeded(5), (next) => views.push(next.bees[0].mode));
    expect(views).toContain('dodge');
    const now = where(after.bees[0], m.air.page, 600);
    if (now) expect(Math.hypot(now.x - cursor.x, now.y - cursor.y)).toBeGreaterThan(30);
  });

  it('bonk head first into a card\'s side, at most a pixel in, bounce back and hover dazed', () => {
    const m = meadowOn();
    const page = m.air.page;
    // The first row's left card's left side, open to the margin.
    const card = page.floors.get(2)!;
    const wall: WallSide = { floor: 2, x: card.left, side: -1, top: card.y, runs: [{ lo: 40, hi: 200 }] };
    const meadow = { ...m, bonks: [wall] };
    const g = createBees(meadow, 0, seeded(6));
    const start = { ...g.bees[0], mode: 'hover' as const, since: 0, until: 0, flower: null, at: { frame: 2, x: -20, y: 60 }, to: null };
    const others = g.bees.slice(1).map((o) => boxOf(o, page, 0)!);
    const ctx = { air: m.air, flowers: m.flowers, claimed: new Set<string>(), others, cursor: null, bonks: [wall], mayBonk: true, mayDodge: true };
    const first = stepBee(start, ctx, 0, 16, () => 0.01);
    expect(first.mode).toBe('fly');
    expect(first.bonk).not.toBeNull();
    const modes: string[] = [];
    const final = Array.from({ length: 400 }, (_, i) => (i + 1) * 16).reduce((b: Bee, t) => {
      const next = stepBee(b, ctx, t, 16, seeded(t));
      modes.push(next.mode);
      const box = boxOf(next, page, t);
      if (box) {
        expect(box.right).toBeLessThanOrEqual(card.left + 1 + 1e-9);
        expect(clear(m.air, box, { except: (o) => (o.block && o.left === card.left ? { ...o, left: o.left + 1 } : undefined) })).toBe(true);
      }
      if (next.mode === 'bounce' && b.mode === 'bonk') {
        const p = where(next, page, t)!;
        expect(p.x + HEAD).toBeCloseTo(card.left, 0);
      }
      return next;
    }, first);
    expect(modes).toContain('bonk');
    expect(modes).toContain('bounce');
    expect(modes.slice(modes.indexOf('bounce'))).toContain('hover');
    expect(final).toBeDefined();
  });

  it('ride with their flowers on a scroll, and are put on a flower at once when content comes under them', () => {
    const m = meadowOn();
    const g = createBees(m, 0, seeded(8));
    const scrolled = meadowOn(dashboard(-40));
    const kept = reconcileBees(g, scrolled, 100, seeded(9));
    for (const [i, b] of kept.bees.entries()) {
      const before = where(g.bees[i], m.air.page, 100)!;
      const after = where(b, scrolled.air.page, 100);
      if (b.flower !== SHELF_KEY && after) expect(after.y).toBeCloseTo(before.y - 40);
      expect(b.flower).toBe(g.bees[i].flower);
    }
    // Text drawn over where the first bee perches.
    const p = where(g.bees[0], m.air.page, 0)!;
    const covered = meadowOn(dashboard(0, [{ left: p.x - 30, right: p.x + 30, top: p.y - 30, bottom: p.y + 20 }]));
    const moved = reconcileBees(g, covered, 100, seeded(10));
    for (const b of moved.bees) {
      const box = boxOf(b, covered.air.page, 100);
      if (box) expect(clear(covered.air, box)).toBe(true);
    }
    expect(moved.bees[0].flower).not.toBe(g.bees[0].flower);
  });

  it('perch still under reduced motion, keeping their flowers across a measurement', () => {
    const m = meadowOn();
    const g = restingBees(m, null);
    expect(g.bees.length).toBeGreaterThanOrEqual(2);
    for (const b of g.bees) {
      expect(b.mode).toBe('perch');
      expect(b.until).toBe(Infinity);
      expect(beeView(b, m.air.page, 5000)?.pose).toBe('perch');
    }
    const again = restingBees(meadowOn(dashboard(-40)), g);
    expect(again.bees.map((b) => b.flower)).toEqual(g.bees.map((b) => b.flower));
    // Nothing to perch on: no bees.
    const bare = meadowOn(dashboard(), null);
    expect(restingBees({ ...bare, flowers: new Map() }, null).bees).toEqual([]);
  });
});
