import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { catchLight, frostColour, MAX_GLINTS, reconcileRime, rimeOn, shine } from './frost';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
const xsOf = (d: string) => [...d.matchAll(/M([\d.]+) /g)].map((m) => Number(m[1]));

describe('frost', () => {
  it('rims the ledge with clusters of crystals no taller than 3.5px', () => {
    const { d } = rimeOn(1, card, []);
    expect(d.startsWith('M6 -0.5H')).toBe(true);
    const tops = [...d.matchAll(/L[\d.]+ (-[\d.]+)/g)].map((m) => -Number(m[1]));
    expect(tops.length).toBeGreaterThan(15);
    expect(Math.max(...tops)).toBeLessThanOrEqual(3.5);
  });

  it('leaves out the stretch under text that comes down to the ledge', () => {
    const text = { left: 300, right: 400, top: 280, bottom: 298 };
    const xs = xsOf(rimeOn(1, card, [text]).d);
    expect(xs.some((x) => x + card.left > 299 && x + card.left < 401)).toBe(false);
    expect(rimeOn(1, card, []).d).not.toEqual(rimeOn(1, card, [text]).d);
  });

  it('is the same for the same ledge, and different for another', () => {
    expect(rimeOn(1, card, [])).toEqual(rimeOn(1, card, []));
    expect(rimeOn(2, card, []).d).not.toEqual(rimeOn(1, card, []).d);
  });

  it('caps the glints on a page', () => {
    const floors = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const glints = [...reconcileRime(floors, []).values()].flatMap((r) => r.glints);
    expect(glints.length).toBe(MAX_GLINTS);
  });

  it('glints softly once a period, and when a moving cursor passes', () => {
    const floors = new Map([[1, card]]);
    const rime = reconcileRime(floors, []);
    const g = rime.get(1)!.glints[0];
    const samples = Array.from({ length: 400 }, (_, i) => shine(g, i * 50));
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.8);
    expect(samples.filter((s) => s > 0).length * 50).toBeLessThan(1400);
    const x = card.left + g.x;
    const caught = catchLight(rime, floors, { from: { x: x - 30, y: 297 }, to: { x: x + 30, y: 297 }, at: 100000 });
    const lit = caught.get(1)!.glints[0];
    expect(lit.at).toBe(100000);
    expect(shine(lit, 100300)).toBeCloseTo(0.8);
    // A second pass while it is still glinting changes nothing; one after
    // starts the glint again.
    const pass = (at: number) => catchLight(caught, floors, { from: { x: x - 30, y: 297 }, to: { x: x + 30, y: 297 }, at }).get(1)!.glints[0].at;
    expect(pass(100300)).toBe(100000);
    expect(pass(100600)).toBe(100600);
    // Kept across a remeasure.
    expect(reconcileRime(floors, [], caught).get(1)!.glints[0].at).toBe(100000);
  });

  it('is ice tinted by the aurora', () => {
    expect(frostColour(0)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(frostColour(0)).not.toEqual(frostColour(16000));
  });
});
