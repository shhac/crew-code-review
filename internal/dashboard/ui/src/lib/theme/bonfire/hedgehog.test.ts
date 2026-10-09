import { describe, expect, it } from 'vitest';
import type { Ledge, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import type { Rand } from '../seed';
import { fixed, scene, seeded, steps } from '../test-scene';
import { chooseHome, createHogs, HOG, hogPoint, PILE, reconcileHogs, restingHogs, stepHogs, type Hog, type Hogs } from './hedgehog';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 60, headroom: Infinity, kind: 'card' };
const SPACING = HOG.width + 6;

// Runs the group forward in 50ms steps with the given cursor, keeping every
// state it passes through.
function trace(group: Hogs, s: PageMap, from: number, to: number, cursor: Cursor | null, rand: Rand = fixed(0.5)): Hogs[] {
  return steps(group, from, to, (g, t) => stepHogs(g, s, t, 50, rand, cursor));
}
const run = (...args: Parameters<typeof trace>) => trace(...args).at(-1)!;
const out = (g: Hogs) => g.hogs.filter((h) => h.mode !== 'hidden' && h.mode !== 'peek');
const withHog = (g: Hogs, id: number, hog: Partial<Hog>): Hogs => ({ ...g, hogs: g.hogs.map((h) => (h.id === id ? { ...h, ...hog } : h)) });

describe('hedgehog home', () => {
  it('piles its wood near the right end of a roomy card top and roams left of it', () => {
    const home = chooseHome(scene([[1, card]]))!;
    expect(home.floor).toBe(1);
    expect(home.pile).toBe(600 - 24 - PILE.width / 2);
    expect(home.lo).toBeLessThan(home.hi);
    expect(home.lo).toBeGreaterThanOrEqual(24 + HOG.width / 2);
  });

  it('refuses cramped, short and off-screen ledges', () => {
    expect(chooseHome(scene([[1, card]], [{ left: 0, right: 1000, top: 250, bottom: 290 }]))).toBeNull();
    for (const f of [{ ...card, headroom: 20 }, { ...card, y: 20 }, { ...card, right: 250 }]) {
      expect(chooseHome(scene([[1, f]]))).toBeNull();
    }
  });

  it('stops its range at text above the ledge', () => {
    const home = chooseHome(scene([[1, card]], [{ left: 300, right: 360, top: 280, bottom: 296 }]))!;
    expect(card.left + home.lo - HOG.width / 2).toBeGreaterThanOrEqual(360);
  });

  it('moves everyone in afresh, tucked away, when the home stops being usable', () => {
    const s = scene([[1, card], [2, { ...card, y: 600 }]]);
    const busy = withHog(createHogs(s, 0, fixed(0.5)), 0, { mode: 'walk', x: 200, target: 150 });
    const gone = reconcileHogs(busy, scene([[2, { ...card, y: 600 }]]), 10, fixed(0.5));
    expect(gone.home?.floor).toBe(2);
    expect(gone.hogs.every((h) => h.mode === 'hidden')).toBe(true);
    const narrowed = reconcileHogs(busy, scene([[1, { ...card, right: 600 }]]), 10, fixed(0.5));
    expect(narrowed.home!.pile).not.toBe(busy.home!.pile);
    const pile = card.left + busy.home!.pile;
    const covered = reconcileHogs(busy, scene([[1, card]], [{ left: pile - 10, right: pile + 10, top: 285, bottom: 295 }]), 10, fixed(0.5));
    expect(covered).toEqual({ home: null, hogs: [] });
  });

  it('keeps a walking hedgehog in range when something lands on its ledge', () => {
    const s = scene([[1, card]]);
    const busy = withHog(createHogs(s, 0, fixed(0.5)), 0, { mode: 'walk', x: 60, target: 45 });
    const later = reconcileHogs(busy, scene([[1, card]], [{ left: card.left + 100, right: card.left + 160, top: 285, bottom: 295 }]), 10, fixed(0.5));
    const hog = later.hogs[0];
    expect(later.home!.floor).toBe(1);
    expect(hog.mode).toBe('walk');
    expect(card.left + hog.x - HOG.width / 2).toBeGreaterThanOrEqual(card.left + 160);
    expect(hog.target).toBeGreaterThanOrEqual(later.home!.lo);
  });

  it('tucks away a hedgehog that a shrunken range would crowd onto another', () => {
    const s = scene([[1, card]]);
    const g = withHog(withHog(createHogs(s, 0, fixed(0.5)), 0, { mode: 'sniff', x: 60, until: 99999 }), 1, { mode: 'sniff', x: 120, until: 99999 });
    const later = reconcileHogs(g, scene([[1, card]], [{ left: card.left + 100, right: card.left + 160, top: 285, bottom: 295 }]), 10, fixed(0.5));
    expect(later.hogs.map((h) => h.mode)).toEqual(['sniff', 'hidden', 'hidden']);
  });

  it('keeps its pile on a card that scrolls away rather than moving it', () => {
    const s = scene([[1, card], [2, { ...card, y: 600 }]]);
    const g = createHogs(s, 0, fixed(0.5));
    const scrolled = scene([[1, { ...card, y: -200 }], [2, { ...card, y: 100 }]]);
    expect(reconcileHogs(g, scrolled, 10, fixed(0.5)).home?.floor).toBe(g.home?.floor);
  });
});

describe('how many hedgehogs', () => {
  it('puts two in a pile with a modest range, three where all three can roam', () => {
    expect(createHogs(scene([[1, card]]), 0, fixed(0.5)).hogs).toHaveLength(3);
    const modest = scene([[1, card]], [{ left: card.left, right: card.left + 360, top: 280, bottom: 296 }]);
    expect(createHogs(modest, 0, fixed(0.5)).hogs).toHaveLength(2);
  });

  it('has none where no ledge suits them', () => {
    expect(createHogs(scene([]), 0, fixed(0.5))).toEqual({ home: null, hogs: [] });
  });

  it('gives each its own id and seed', () => {
    const { hogs } = createHogs(scene([[1, card]]), 0, fixed(0.5));
    expect(new Set(hogs.map((h) => h.id)).size).toBe(hogs.length);
    expect(new Set(hogs.map((h) => h.seed)).size).toBe(hogs.length);
  });
});

describe('hedgehog behaviour', () => {
  const s = scene([[1, card]]);

  it('stays hidden while the cursor keeps moving, and peeks out once it is still', () => {
    const g = createHogs(s, 0, fixed(0.5));
    const times = Array.from({ length: 120 }, (_, i) => i * 50);
    const busy = times.reduce((h, t) => stepHogs(h, s, t, 50, fixed(0.5), { x: 900, y: 100, at: t }), g);
    expect(busy.hogs.every((h) => h.mode === 'hidden')).toBe(true);
    const still = run(g, s, 0, 6000, { x: 900, y: 100, at: 0 });
    expect(still.hogs.some((h) => h.mode !== 'hidden')).toBe(true);
  });

  it('peeks out one at a time', () => {
    const states = trace(createHogs(s, 0, fixed(0.5)), s, 0, 30000, null, seeded(4));
    expect(states.every((g) => g.hogs.filter((h) => h.mode === 'peek').length <= 1)).toBe(true);
    const firstOut = (id: number) => states.findIndex((g) => g.hogs[id].mode !== 'hidden');
    expect(firstOut(0)).toBeLessThan(firstOut(1));
  });

  it('ducks back in if the cursor moves while it is peeking', () => {
    const states = trace(createHogs(s, 0, fixed(0.5)), s, 0, 4000, null);
    const peeking = states.find((g) => g.hogs[0].mode === 'peek')!;
    const ducked = stepHogs(peeking, s, 3000, 50, fixed(0.5), { x: 900, y: 100, at: 3000 });
    expect(ducked.hogs[0]).toMatchObject({ mode: 'hidden', x: peeking.home!.pile, until: 3000 + 2500 });
  });

  it('only ever peeks from a home with no room to walk', () => {
    const cramped = scene([[1, card]], [{ left: card.left, right: card.left + 470, top: 280, bottom: 296 }]);
    const home = chooseHome(cramped)!;
    expect(home.hi - home.lo).toBeLessThan(40);
    const modes = trace(createHogs(cramped, 0, fixed(0.5)), cramped, 0, 30000, null).flatMap((g) => g.hogs.map((h) => h.mode));
    expect(modes).toContain('peek');
    expect(modes).not.toContain('walk');
  });

  it('wanders out along its ledge, then goes home', () => {
    const later = run(createHogs(s, 0, fixed(0.2)), s, 0, 12000, null, fixed(0.2));
    const first = later.hogs[0];
    expect(['walk', 'sniff']).toContain(first.mode);
    expect(first.x).toBeLessThan(later.home!.hi);
    const modes = trace(later, s, 12000, 90000, null, fixed(0.2)).map((g) => g.hogs[0].mode);
    expect(modes).toContain('home');
    expect(modes.slice(modes.indexOf('home'))).toContain('hidden');
  });

  it('counts the distance each walks, and only its own', () => {
    const states = trace(createHogs(s, 0, fixed(0.2)), s, 0, 12000, null, fixed(0.2));
    const last = states.at(-1)!;
    expect(last.hogs[0].walked).toBeGreaterThan(0);
    // Going in and out of the pile moves it without walking.
    const inPile = (h: Hog) => h.mode === 'hidden' || h.mode === 'peek';
    const strides = states.slice(1).map((g, i) => [states[i].hogs[0], g.hogs[0]]).filter(([a, b]) => !inPile(a) && !inPile(b));
    expect(last.hogs[0].walked).toBeCloseTo(strides.reduce((sum, [a, b]) => sum + Math.abs(b.x - a.x), 0));
  });

  it('never lets two out on the ledge come within a body and a gap of each other', () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const states = trace(createHogs(s, 0, fixed(0.5)), s, 0, 120000, null, seeded(seed));
      expect(states.flatMap((g) => g.hogs).some((h) => h.mode === 'walk')).toBe(true);
      for (const g of states) {
        const xs = out(g).map((h) => h.x).sort((a, b) => a - b);
        xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(SPACING - 1e-6));
      }
    }
  });

  it('curls up when the cursor moves close, then flees home once it is quiet', () => {
    const later = run(createHogs(s, 0, fixed(0.2)), s, 0, 12000, null, fixed(0.2));
    const at = hogPoint(later.hogs[0], later.home, s)!;
    const cursor = { x: at.x + 10, y: at.y - 10, at: 12040 };
    const curled = stepHogs(later, s, 12050, 50, fixed(0.5), cursor);
    expect(curled.hogs[0].mode).toBe('curled');
    const held = run(curled, s, 12100, 14000, cursor);
    expect(held.hogs[0]).toMatchObject({ mode: 'curled', x: curled.hogs[0].x });
    const fled = run(held, s, 14000, 18000, cursor);
    expect(['flee', 'hidden', 'peek']).toContain(fled.hogs[0].mode);
  });

  it('sends the hedgehogs between a fleeing one and the pile home ahead of it', () => {
    const g = createHogs(s, 0, fixed(0.5));
    const home = g.home!;
    const scattered: Hogs = {
      home,
      hogs: [
        { ...g.hogs[0], mode: 'curled', x: home.lo + 10, until: 100 },
        { ...g.hogs[1], mode: 'sniff', x: home.lo + 100, until: 99999 },
        { ...g.hogs[2], mode: 'hidden', x: home.pile, until: 99999 },
      ],
    };
    const next = stepHogs(scattered, s, 200, 50, fixed(0.5), null);
    expect(next.hogs.map((h) => h.mode)).toEqual(['flee', 'flee', 'hidden']);
  });

  it('waits behind another on its way home rather than walking through it', () => {
    const g = createHogs(s, 0, fixed(0.5));
    const home = g.home!;
    const queued: Hogs = {
      home,
      hogs: [
        { ...g.hogs[0], mode: 'home', x: home.hi - 80, target: home.hi, dir: 1 },
        { ...g.hogs[1], mode: 'curled', x: home.hi - 80 + SPACING + 2, until: 99999 },
      ],
    };
    const later = run(queued, s, 0, 2000, null);
    expect(later.hogs[1].x - later.hogs[0].x).toBeGreaterThanOrEqual(SPACING - 1e-6);
    expect(later.hogs[0].mode).toBe('home');
  });
});

describe('reduced motion', () => {
  const s = scene([[1, card]]);

  it('sits them still in a row by the pile, spaced apart', () => {
    const g = restingHogs(s, null);
    expect(g.hogs.length).toBe(3);
    expect(g.hogs.every((h) => h.mode === 'sniff')).toBe(true);
    const xs = g.hogs.map((h) => h.x);
    xs.slice(1).forEach((x, i) => expect(xs[i] - x).toBeGreaterThanOrEqual(SPACING));
  });

  it('keeps them where they sat across a scroll', () => {
    const g = restingHogs(s, null);
    const scrolled = scene([[1, { ...card, y: 250 }]]);
    expect(restingHogs(scrolled, g)).toEqual(g);
  });
});
