import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { CARDS, dashboardPage, HEADING, TITLE } from '../test-scene';
import { CLUMPS, CUSHIONS } from './art';
import { bellsOf, clumpBox, growMoss, MAX_CLUMPS, MAX_CLUMPS_A_LEDGE, MAX_CUSHIONS, MOSS_LINE, mossOn } from './moss';

const card: Ledge = { left: 100, right: 1300, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };

// Every y a path visits, its control points included: a curve stays inside
// them, so they bound what is drawn.
const ys = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
const xs = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 0);

describe('moss', () => {
  it('rims a clear ledge with low moss that never hangs below it', () => {
    const m = mossOn(1, card, []);
    expect(m.d).not.toBe('');
    expect(Math.min(...ys(m.d)) - MOSS_LINE / 2).toBeGreaterThanOrEqual(-5);
    expect(Math.max(...ys(m.d)) + MOSS_LINE / 2).toBeLessThanOrEqual(1e-9);
    expect(Math.min(...ys(m.tops))).toBeGreaterThanOrEqual(-5);
    expect(Math.max(...ys(m.tops))).toBeLessThanOrEqual(0);
  });

  it('grows clumps where they stand clear, at most three a ledge, with room either side', () => {
    const m = mossOn(1, card, []);
    expect(m.clumps.length).toBeGreaterThan(0);
    expect(m.clumps.length).toBeLessThanOrEqual(MAX_CLUMPS_A_LEDGE);
    for (const [a, b] of m.clumps.slice(1).map((c, i) => [m.clumps[i], c])) expect(b.x - a.x).toBeGreaterThan(40);
    for (const c of m.clumps) {
      const box = clumpBox(c);
      expect(box.left).toBeGreaterThanOrEqual(6 + 10);
      expect(box.right).toBeLessThanOrEqual(card.right - card.left - 6 - 10);
    }
  });

  it('keeps clumps out from under the heading text, and moss from under text that comes down near the rule', () => {
    const page = dashboardPage();
    const under = (x: number) => HEADING.left + x > TITLE.left && HEADING.left + x < TITLE.right;
    const m = mossOn(1, HEADING, page.obstacles);
    expect(m.clumps.length).toBeGreaterThan(0);
    expect(m.clumps.some((c) => under(clumpBox(c).left) || under(clumpBox(c).right))).toBe(false);
    const low = mossOn(1, HEADING, [{ ...TITLE, bottom: HEADING.y - 3 }]);
    expect(low.d).not.toBe('');
    expect(xs(low.d).some(under)).toBe(false);
  });

  it('grows clumps on a first-row card, reaching into the rule above no further than its empty edge', () => {
    const page = dashboardPage();
    const grown = [...growMoss(page.floors, page.obstacles)];
    const onCards = grown.filter(([id]) => id !== 1).flatMap(([, m]) => m.clumps);
    expect(onCards.length).toBeGreaterThan(0);
    for (const c of onCards) expect(-clumpBox(c).top).toBeLessThanOrEqual(CARDS[0].headroom + 6);
  });

  it('leaves no clump where a card above is too close', () => {
    expect(mossOn(1, { ...card, headroom: 19 }, []).clumps).toEqual([]);
    expect(mossOn(1, { ...card, headroom: 19 }, []).d).not.toBe('');
    expect(mossOn(1, { ...card, headroom: 4 }, []).d).toBe('');
  });

  it('keeps a clump in its slot when text appears elsewhere on its ledge', () => {
    const before = mossOn(1, card, []);
    const last = before.clumps.at(-1)!;
    const text = { left: card.left + clumpBox(last).left - 30, right: card.left + clumpBox(last).right + 30, top: 280, bottom: 296 };
    const after = mossOn(1, card, [text]);
    expect(after.clumps.map((c) => c.key)).not.toContain(last.key);
    const kept = after.clumps.filter((c) => before.clumps.some((b) => b.key === c.key));
    expect(kept.length).toBe(before.clumps.length - 1);
    for (const c of kept) expect(before.clumps.find((b) => b.key === c.key)).toEqual(c);
  });

  it('is the same for the same ledge, and different for another', () => {
    expect(mossOn(1, card, [])).toEqual(mossOn(1, card, []));
    expect(mossOn(2, card, [])).not.toEqual(mossOn(1, card, []));
  });

  it('caps the clumps and cushions on a page, sharing them across the ledges', () => {
    const floors = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const all = [...growMoss(floors, []).values()];
    expect(all.flatMap((m) => m.clumps).length).toBe(MAX_CLUMPS);
    expect(all.flatMap((m) => m.cushions).length).toBeLessThanOrEqual(MAX_CUSHIONS);
    expect(all.filter((m) => m.clumps.length > 0).length).toBeGreaterThanOrEqual(MAX_CLUMPS / MAX_CLUMPS_A_LEDGE);
    expect(all.every((m) => m.d !== '')).toBe(true);
  });

  it('never puts a cushion in a clump\'s slot', () => {
    for (const id of [1, 2, 3, 4, 5]) {
      const m = mossOn(id, card, []);
      const keys = new Set(m.clumps.map((c) => c.key));
      expect(m.cushions.some((c) => keys.has(c.key))).toBe(false);
      for (const c of m.cushions) expect(CUSHIONS[c.art]).toBeDefined();
    }
  });

  it('finds a clump\'s bells on it, lowest first, mirrored with it', () => {
    const c = mossOn(1, card, []).clumps[0];
    const bells = bellsOf(c);
    const box = clumpBox(c);
    expect(bells.length).toBe(CLUMPS[c.art].bells.length);
    for (const b of bells) {
      expect(b.x).toBeGreaterThanOrEqual(box.left);
      expect(b.x).toBeLessThanOrEqual(box.right);
      expect(b.y).toBeLessThan(-8);
      expect(b.y).toBeGreaterThanOrEqual(box.top);
    }
    for (const [a, b] of bells.slice(1).map((v, i) => [bells[i], v])) expect(b.y).toBeLessThanOrEqual(a.y);
    const mirrored = bellsOf({ ...c, flip: !c.flip });
    bells.forEach((b, i) => expect(mirrored[i].x - c.x).toBeCloseTo(c.x - b.x));
  });
});
