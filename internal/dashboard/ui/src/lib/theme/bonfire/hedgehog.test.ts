import { describe, expect, it } from 'vitest';
import type { Ledge, PageMap } from '../floors';
import { fixed, scene, steps } from '../test-scene';
import { chooseHome, createHog, HOG, hogPoint, PILE, reconcileHog, restingHog, stepHog, type Hog } from './hedgehog';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 60, headroom: Infinity, kind: 'card' };

// Runs the hedgehog forward in 50ms steps with the given cursor, keeping every
// state it passes through.
function trace(hog: Hog, s: PageMap, from: number, to: number, cursor: Parameters<typeof stepHog>[5], rand = fixed(0.5)): Hog[] {
  return steps(hog, from, to, (h, t) => stepHog(h, s, t, 50, rand, cursor));
}
const run = (...args: Parameters<typeof trace>) => trace(...args).at(-1)!;

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

  it('moves in afresh, tucked away, when its home stops being usable', () => {
    const s = scene([[1, card], [2, { ...card, y: 600 }]]);
    const out: Hog = { ...createHog(s, 0), mode: 'walk', x: 200, target: 150 };
    const gone = reconcileHog(out, scene([[2, { ...card, y: 600 }]]), 10);
    expect(gone).toMatchObject({ mode: 'hidden', home: { floor: 2 } });
    const narrowed = reconcileHog(out, scene([[1, { ...card, right: 600 }]]), 10);
    expect(narrowed.mode).toBe('hidden');
    expect(narrowed.home!.pile).not.toBe(out.home!.pile);
    const covered = reconcileHog(out, scene([[1, card]], [{ left: card.left + out.home!.pile - 10, right: card.left + out.home!.pile + 10, top: 285, bottom: 295 }]), 10);
    expect(covered).toMatchObject({ mode: 'hidden', home: null });
    expect(hogPoint(covered, scene([]))).toBeNull();
  });

  it('keeps a walking hedgehog in range when something lands on its ledge', () => {
    const s = scene([[1, card]]);
    const out: Hog = { ...createHog(s, 0), mode: 'walk', x: 60, target: 45 };
    const later = reconcileHog(out, scene([[1, card]], [{ left: card.left + 100, right: card.left + 160, top: 285, bottom: 295 }]), 10);
    expect(later.home!.floor).toBe(1);
    expect(later.mode).toBe('walk');
    expect(card.left + later.x - HOG.width / 2).toBeGreaterThanOrEqual(card.left + 160);
    expect(later.target).toBeGreaterThanOrEqual(later.home!.lo);
    const peeking = reconcileHog({ ...out, mode: 'peek', x: 400 }, s, 10);
    expect(peeking.x).toBe(400);
  });

  it('keeps its pile on a card that scrolls away rather than moving it', () => {
    const s = scene([[1, card], [2, { ...card, y: 600 }]]);
    const hog = createHog(s, 0);
    const scrolled = scene([[1, { ...card, y: -200 }], [2, { ...card, y: 100 }]]);
    expect(reconcileHog(hog, scrolled, 10).home?.floor).toBe(hog.home?.floor);
  });
});

describe('hedgehog behaviour', () => {
  const s = scene([[1, card]]);

  it('stays hidden while the cursor keeps moving, and peeks out once it is still', () => {
    const hog = createHog(s, 0);
    const times = Array.from({ length: 120 }, (_, i) => i * 50);
    const busy = times.reduce((h, t) => stepHog(h, s, t, 50, fixed(0.5), { x: 900, y: 100, at: t }), hog);
    expect(busy.mode).toBe('hidden');
    const still = run(hog, s, 0, 6000, { x: 900, y: 100, at: 0 });
    expect(still.mode).not.toBe('hidden');
  });

  it('ducks back in if the cursor moves while it is peeking', () => {
    const states = trace(createHog(s, 0), s, 0, 4000, null);
    const peeking = states.find((h) => h.mode === 'peek')!;
    const ducked = stepHog(peeking, s, 3000, 50, fixed(0.5), { x: 900, y: 100, at: 3000 });
    expect(ducked).toMatchObject({ mode: 'hidden', x: peeking.home!.pile, until: 3000 + 2500 });
  });

  it('only ever peeks from a home with no room to walk', () => {
    const cramped = scene([[1, card]], [{ left: card.left, right: card.left + 470, top: 280, bottom: 296 }]);
    const home = chooseHome(cramped)!;
    expect(home.hi - home.lo).toBeLessThan(40);
    const modes = trace(createHog(cramped, 0), cramped, 0, 30000, null).map((h) => h.mode);
    expect(modes).toContain('peek');
    expect(modes).not.toContain('walk');
  });

  it('wanders out along its ledge, then goes home', () => {
    const out = run(createHog(s, 0), s, 0, 12000, null, fixed(0.2));
    expect(['walk', 'sniff']).toContain(out.mode);
    expect(out.x).toBeLessThan(out.home!.hi);
    const modes = trace(out, s, 12000, 90000, null, fixed(0.2)).map((h) => h.mode);
    expect(modes).toContain('home');
    expect(modes.slice(modes.indexOf('home'))).toContain('hidden');
  });

  it('curls up when the cursor moves close, then flees home once it is quiet', () => {
    const out = run(createHog(s, 0), s, 0, 12000, null, fixed(0.2));
    const at = hogPoint(out, s)!;
    const curled = stepHog(out, s, 12050, 50, fixed(0.5), { x: at.x + 10, y: at.y - 10, at: 12040 });
    expect(curled.mode).toBe('curled');
    const x = curled.x;
    const held = run(curled, s, 12100, 14000, { x: at.x + 10, y: at.y - 10, at: 12040 });
    expect(held.mode).toBe('curled');
    expect(held.x).toBe(x);
    const fled = run(held, s, 14000, 18000, { x: at.x + 10, y: at.y - 10, at: 12040 });
    expect(['flee', 'hidden', 'peek']).toContain(fled.mode);
  });

  it('sits still by its pile under reduced motion', () => {
    const hog = restingHog(s);
    expect(hog.mode).toBe('sniff');
    expect(stepHog(hog, s, 1000, 50, fixed(0.5), null)).toBe(hog);
  });

  it('has no home, and draws nothing, where no ledge suits it', () => {
    const hog = createHog(scene([]), 0);
    expect(hog.home).toBeNull();
    expect(hogPoint(hog, scene([]))).toBeNull();
  });
});
