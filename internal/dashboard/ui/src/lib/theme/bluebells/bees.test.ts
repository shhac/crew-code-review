import { describe, expect, it } from 'vitest';
import type { Box, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import type { Rand } from '../seed';
import { seeded, spacedAfterRelayout } from '../test-scene';
import { clear } from './beeair';
import { beeView, boxOf, stepBee, where, type Bee } from './bee';
import { boxesOf, createBees, reconcileBees, restingBees, SPACE, stepBees, type Bees, type Meadow } from './bees';
import type { WallSide } from './bonks';
import { cursorAt, dashboard, meadowOn } from './fixtures';
import { SHELF_KEY } from './flowers';
import { CONTACT } from './footprints';
import { along, originOf, placeRoute } from './route';

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
        // On its way to the wall, and knocked back off it.
        if (next.bonk || next.mode === 'bounce') expect(box.right, `${next.mode} at ${t}`).toBeLessThanOrEqual(card.left + 1 + 1e-9);
        expect(clear(m.air, box, { except: (o) => (o.block && o.left === card.left ? { ...o, left: o.left + 1 } : undefined) })).toBe(true);
      }
      if (next.mode === 'bounce' && b.mode === 'bonk') {
        const p = where(next, page, t)!;
        expect(p.x + CONTACT).toBeCloseTo(card.left, 0);
      }
      return next;
    }, first);
    expect(modes).toContain('bonk');
    expect(modes).toContain('bounce');
    expect(modes.slice(modes.indexOf('bounce'))).toContain('hover');
    expect(final).toBeDefined();
  });

  describe('with nowhere to go', () => {
    // Hovering in the left margin beside the first card, no flower in view,
    // and looking for a way since 0.
    const m = meadowOn();
    const page = m.air.page;
    const lost: Bee = { ...createBees(m, 0, seeded(30)).bees[0], mode: 'hover', since: 0, until: 0, flower: null, at: { frame: 2, x: -20, y: 60 }, to: null, stuck: 0 };
    const nowhere = (others: readonly Box[] = []) => ({ air: m.air, flowers: new Map(), claimed: new Set<string>(), others, cursor: null, bonks: [], mayBonk: false, mayDodge: true });

    it('hover on for 2s, then fly out of the window off the top or the bottom, clear all the way, and are away', () => {
      const ctx = nowhere();
      expect(stepBee(lost, ctx, 1990, 16, seeded(31)).mode).toBe('hover');
      const off = stepBee(lost, ctx, 2000, 16, seeded(31));
      expect(off.mode).toBe('leave');
      expect(off.flower).toBeNull();
      expect(off.flight?.purpose).toBe('leave');
      const out = along(placeRoute(off.flight!.route, originOf(page, off.flight!.frame)!), off.flight!.route.length).p;
      expect(out.y < 0 || out.y > page.height).toBe(true);
      const flown = Array.from({ length: 1000 }, (_, i) => 2000 + (i + 1) * 16).reduce((b: Bee, t) => {
        if (b.mode === 'away') return b;
        const next = stepBee(b, ctx, t, 16, seeded(t));
        const box = boxOf(next, page, t);
        if (box) expect(clear(m.air, box), `${next.mode} at ${t}`).toBe(true);
        return next;
      }, off);
      expect(flown.mode).toBe('away');
      expect(flown.until - flown.since).toBeGreaterThanOrEqual(3000);
      expect(flown.until - flown.since).toBeLessThanOrEqual(8000);
    });

    it('fade out where they hover when no way out is clear, and are away', () => {
      // The margin shut above and below it.
      const ctx = nowhere([{ left: 236, right: 290, top: 150, bottom: 190 }, { left: 236, right: 290, top: 300, bottom: 340 }]);
      const here = where(lost, page, 2000);
      const fading = stepBee(lost, ctx, 2000, 16, seeded(32));
      expect(fading.mode).toBe('leave');
      expect(fading.flight).toBeNull();
      expect(fading.flower).toBeNull();
      expect(where(fading, page, 2150)).toEqual(here);
      expect(beeView(fading, page, 2150)?.opacity).toBeCloseTo(0.5);
      expect(beeView(fading, page, 2300)?.opacity).toBe(0);
      expect(stepBee(fading, ctx, 2290, 16, seeded(33)).mode).toBe('leave');
      expect(stepBee(fading, ctx, 2300, 16, seeded(33)).mode).toBe('away');
    });
  });

  it('bonk at the first chance when a test cues it, once', { timeout: 30000 }, () => {
    const m = meadowOn();
    const card = m.air.page.floors.get(2)!;
    const wall: WallSide = { floor: 2, x: card.left, side: -1, top: card.y, runs: [{ lo: 40, hi: 200 }] };
    const cued = { ...m, bonks: [wall], cue: 'bonk' as const };
    const bonks: number[] = [];
    run(createBees(cued, 0, seeded(16)), cued, 20000, () => null, 0, seeded(17), (g, t) => {
      if (g.bees[0].mode === 'bounce' && !bonks.some((at) => t - at < 300)) bonks.push(t);
    });
    expect(bonks.length).toBe(1);
  });

  it('leave the shelf empty when a test cues a visit to it, and leave their flowers at once, the shelf first', { timeout: 30000 }, () => {
    const m = { ...meadowOn(), cue: 'shelf' as const };
    const g = createBees(m, 0, seeded(18));
    expect(g.bees.map((b) => b.flower)).not.toContain(SHELF_KEY);
    const loading = createBees({ ...m, flowers: new Map() }, 0, seeded(20));
    expect(reconcileBees(loading, m, 200, seeded(21)).bees.map((b) => b.flower)).not.toContain(SHELF_KEY);
    const shivered = new Map<number, number>();
    const seen: { visit?: number } = {};
    run(g, m, 20000, () => null, 0, seeded(19), (next, t) => {
      for (const b of next.bees) if (b.mode === 'shiver' && !shivered.has(b.id)) shivered.set(b.id, t);
      if (next.bees.some((b) => b.mode === 'perch' && b.flower === SHELF_KEY)) seen.visit = seen.visit ?? t;
    });
    expect([...shivered.keys()].sort()).toEqual(g.bees.map((b) => b.id));
    expect(Math.max(...shivered.values())).toBeLessThanOrEqual(600);
    expect(seen.visit).toBeDefined();
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

  describe('caught mid-flight by a layout change', () => {
    // The first bee well into a flight to a ledge's flower, a way still to
    // go: the group, the time and where along its way it is.
    function midFlight(m: Meadow) {
      const found: { g?: Bees; t?: number } = {};
      run(createBees(m, 0, seeded(20)), m, 30000, () => null, 0, seeded(21), (g, t) => {
        const f = g.bees[0].flight;
        if (found.g || g.bees[0].mode !== 'fly' || !f || f.purpose !== 'visit' || f.frame === 'rail') return;
        if (f.s > 20 && f.route.length - f.s > 80) Object.assign(found, { g, t });
      });
      if (!found.g || found.t === undefined) throw new Error('no flight to a ledge in 30s');
      return { g: found.g, t: found.t, b: found.g.bees[0] };
    }
    // The rest of its way on the page, s px further on.
    const aheadOf = (b: Bee, page: PageMap, ds: number) => {
      const f = b.flight!;
      return along(placeRoute(f.route, originOf(page, f.frame)!), f.s + ds).p;
    };

    it('fly on along their way while it is still clear, riding with its card', () => {
      const m = meadowOn();
      const { g, t, b } = midFlight(m);
      const scrolled = meadowOn(dashboard(40));
      const kept = reconcileBees(g, scrolled, t, seeded(22)).bees[0];
      expect(kept.mode).toBe('fly');
      expect(kept.flight).toBe(b.flight);
      expect(kept.flower).toBe(b.flower);
      const before = where(b, m.air.page, t)!, after = where(kept, scrolled.air.page, t)!;
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y + 40);
    });

    it('stop and hover where they are, free of the flower, when their way is no longer clear or the flower has gone', () => {
      const m = meadowOn();
      const { g, t, b } = midFlight(m);
      const p = aheadOf(b, m.air.page, 60);
      // Text across the way ahead, the flowers as they were.
      const page = dashboard(0, [{ left: p.x - 6, right: p.x + 6, top: p.y - 6, bottom: p.y + 6 }]);
      const blocked = { ...meadowOn(page), flowers: m.flowers };
      const gone = { ...m, flowers: new Map([...m.flowers].filter(([k]) => k !== b.flower)) };
      for (const [why, meadow] of [['blocked', blocked], ['gone', gone]] as const) {
        const next = reconcileBees(g, meadow, t, seeded(23)).bees[0];
        expect(next.mode, why).toBe('hover');
        expect(next.flight, why).toBeNull();
        expect(next.flower, why).toBeNull();
        expect(where(next, meadow.air.page, t), why).toEqual(where(b, m.air.page, t));
        expect(clear(meadow.air, boxOf(next, meadow.air.page, t)!), why).toBe(true);
      }
    });

    it('are put on the nearest flower at once when content comes over them', () => {
      const m = meadowOn();
      const { g, t, b } = midFlight(m);
      const p = where(b, m.air.page, t)!;
      const covered = meadowOn(dashboard(0, [{ left: p.x - 20, right: p.x + 20, top: p.y - 20, bottom: p.y + 20 }]));
      const next = reconcileBees(g, covered, t, seeded(24)).bees[0];
      expect(next.mode).toBe('perch');
      expect(next.flight).toBeNull();
      expect(clear(covered.air, boxOf(next, covered.air.page, t)!)).toBe(true);
    });
  });

  it('keep 8px apart when a layout change crowds the page', () => {
    // Text over the whole left column: the bees there must find flowers on
    // the right, beside those already on them.
    const crowded = meadowOn(dashboard(0, [{ left: 236, right: 840, top: 120, bottom: 900 }]));
    const bees = { create: (m: Meadow, now: number, rand: Rand) => createBees(m, now, rand), reconcile: reconcileBees, members: (g: Bees) => g.bees.filter((b) => b.mode !== 'away') };
    const apart = (a: Bee, b: Bee) => gap(boxOf(a, crowded.air.page, 1000)!, boxOf(b, crowded.air.page, 1000)!) >= SPACE - 0.01;
    for (const seed of [1, 2, 3]) expect(spacedAfterRelayout(bees, meadowOn(), crowded, apart, seeded(seed))).toEqual([]);
  });

  it('are put on flowers as soon as a page still loading has some', () => {
    const empty = { ...meadowOn(), flowers: new Map() };
    const g = createBees(empty, 0, seeded(14));
    expect(g.bees.every((b) => b.mode === 'away')).toBe(true);
    const loaded = reconcileBees(g, meadowOn(), 200, seeded(15));
    expect(loaded.bees.length).toBe(g.bees.length);
    expect(loaded.bees.every((b) => b.mode === 'perch')).toBe(true);
    expect(new Set(loaded.bees.map((b) => b.flower)).size).toBe(loaded.bees.length);
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
