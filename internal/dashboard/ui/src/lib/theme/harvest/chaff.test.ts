import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { rad } from '../math';
import { BITE, CAP, chaffOn, FADE, grainAhead, grainNear, grainOpacity, MAX_GRAINS, MAX_STALKS, peck, QUIET, reconcileChaff, regrow, type Chaff } from './chaff';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
const floors = new Map([[1, card]]);
// Every y a path's points reach, as heights above the ledge.
const heights = (d: string) => [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => -Number(m[2]));
const xs = (d: string) => [...d.matchAll(/[ML]([-\d.]+) /g)].map((m) => Number(m[1]));
const firstGrain = (chaff: ReadonlyMap<number, Chaff>) => chaff.get(1)!.grains[0];

describe('straw and grain', () => {
  it('lays stalks no taller than 3px and within 12 degrees of flat', () => {
    const c = chaffOn(1, card, []);
    expect(c.stalks.length).toBeGreaterThan(25);
    for (const s of c.stalks) {
      expect(Math.abs(s.tilt)).toBeLessThanOrEqual(12);
      expect(s.length).toBeGreaterThanOrEqual(4);
      expect(s.length).toBeLessThanOrEqual(9);
      expect(s.width).toBeGreaterThanOrEqual(1.1);
      expect(s.width).toBeLessThanOrEqual(1.6);
      expect(s.width + s.length * Math.sin(rad(Math.abs(s.tilt)))).toBeLessThanOrEqual(CAP + 1e-9);
    }
    const all = [...c.straw, c.nodes].flatMap(heights);
    expect(Math.max(...all)).toBeLessThanOrEqual(CAP + 0.01);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(-0.01);
    expect(c.stalks.some((s) => s.tone === 0) && c.stalks.some((s) => s.tone === 1)).toBe(true);
    expect(c.stalks.some((s) => s.node !== null)).toBe(true);
  });

  it('scatters grain in clusters of two to five', () => {
    const c = chaffOn(1, card, []);
    const clusters = new Map<string, number>();
    for (const g of c.grains) clusters.set(g.key.split(':').slice(0, 3).join(':'), (clusters.get(g.key.split(':').slice(0, 3).join(':')) ?? 0) + 1);
    expect(clusters.size).toBeGreaterThan(5);
    for (const n of clusters.values()) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('leaves out the stretch under text that comes down to the ledge', () => {
    const text = { left: 300, right: 400, top: 280, bottom: 298 };
    const c = chaffOn(1, card, [text]);
    const under = (x: number) => x + card.left > 296 && x + card.left < 404;
    expect([...c.straw, c.nodes].flatMap(xs).some(under)).toBe(false);
    expect(c.grains.some((g) => under(g.x))).toBe(false);
  });

  it('is the same for the same ledge, and different for another', () => {
    expect(chaffOn(1, card, [])).toEqual(chaffOn(1, card, []));
    expect(chaffOn(2, card, []).straw).not.toEqual(chaffOn(1, card, []).straw);
  });

  it('caps the straw and grain on a page, sharing them across the ledges', () => {
    const many = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const chaff = reconcileChaff(many, []);
    const all = [...chaff.values()];
    expect(all.flatMap((c) => c.stalks).length).toBe(MAX_STALKS);
    expect(all.flatMap((c) => c.grains).length).toBe(MAX_GRAINS);
    expect(all.every((c) => c.stalks.length > 0 && c.grains.length > 0)).toBe(true);
    // The drawn paths are the kept stalks only.
    const one = all[0];
    expect(one.straw.join('').split('Z').length - 1).toBe(one.stalks.length);
  });

  it('eats the grain nearest the bill within reach, and only that one', () => {
    const chaff = reconcileChaff(floors, []);
    const g = firstGrain(chaff);
    expect(peck(chaff, 1, g.x + BITE + 3, 1000).get(1)!.grains.filter((h) => h.eaten !== null).length).toBeLessThanOrEqual(1);
    const eaten = peck(chaff, 1, g.x, 1000);
    expect(eaten.get(1)!.grains.filter((h) => h.eaten !== null).map((h) => h.key)).toEqual([g.key]);
    expect(grainOpacity(eaten.get(1)!.grains[0], 1000, false)).toBe(0);
    // Under reduced motion every grain is drawn.
    expect(grainOpacity(eaten.get(1)!.grains[0], 1000, true)).toBe(1);
    // Far from any grain, nothing is eaten.
    const bare = new Map([[1, { ...chaff.get(1)!, grains: [] }]]);
    expect(peck(bare, 1, 50, 1000).get(1)!.grains).toEqual([]);
  });

  it('finds grain in reach, and the next grain along the way it walks', () => {
    const chaff = reconcileChaff(floors, []);
    const g = firstGrain(chaff);
    expect(grainNear(chaff, 1, g.x - 0.1, 6)?.key).toBe(g.key);
    expect(grainNear(chaff, 9, g.x, 6)).toBeNull();
    const ahead = grainAhead(chaff, 1, g.x - 40, 1, 60);
    expect(ahead).not.toBeNull();
    expect(ahead!.x).toBeGreaterThan(g.x - 40);
    expect(grainAhead(chaff, 1, -10, -1, 60)).toBeNull();
  });

  it('brings eaten grain back once no crow has been near it for a while, fading in', () => {
    const chaff = reconcileChaff(floors, []);
    const g = firstGrain(chaff);
    const at = { x: card.left + g.x, y: card.y };
    const eaten = peck(chaff, 1, g.x, 1000);
    // A crow standing by keeps it from coming back.
    const watched = regrow(eaten, floors, [at], 1000 + QUIET + 1);
    expect(firstGrain(watched).eaten).toBe(1000);
    const left = 1000 + QUIET + 1;
    expect(firstGrain(regrow(watched, floors, [], left + QUIET - 10)).eaten).toBe(1000);
    const back = regrow(watched, floors, [{ x: at.x + 60, y: at.y }], left + QUIET);
    const grain = firstGrain(back);
    expect(grain.eaten).toBeNull();
    expect(grainOpacity(grain, left + QUIET, false)).toBe(0);
    expect(grainOpacity(grain, left + QUIET + FADE / 2, false)).toBeCloseTo(0.5);
    expect(grainOpacity(grain, left + QUIET + FADE, false)).toBe(1);
    // Kept, eaten or back, across a remeasure.
    expect(firstGrain(reconcileChaff(floors, [], eaten)).eaten).toBe(1000);
    expect(grainOpacity(firstGrain(reconcileChaff(floors, [])), 0, false)).toBe(1);
  });
});
