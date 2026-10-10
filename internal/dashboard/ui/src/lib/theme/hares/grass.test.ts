import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { BUD_TOP, brush, heightOf, leanOf, MAX_SHOOTS, MAX_TUFTS, meadowOn, PART, reconcileMeadows, SWAY, type Plant } from './grass';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
const tufts = (m: readonly Plant[]) => m.filter((p) => p.kind === 'tuft');
const shoots = (m: readonly Plant[]) => m.filter((p) => p.kind === 'shoot');

describe('grass', () => {
  it('grows tufts and a few daffodil shoots along a clear ledge, none taller than a shoot', () => {
    const m = meadowOn(1, card, []);
    expect(tufts(m).length).toBeGreaterThan(20);
    expect(shoots(m).length).toBeGreaterThan(0);
    expect(shoots(m).length).toBeLessThan(tufts(m).length / 3);
    expect(Math.max(...m.map(heightOf))).toBeLessThanOrEqual(BUD_TOP);
    expect(Math.max(...tufts(m).map(heightOf))).toBeLessThanOrEqual(6);
    for (const p of m) expect(p.x).toBeGreaterThanOrEqual(12);
  });

  it('leaves out the stretch under text that comes down near the ledge, with a margin', () => {
    const text = { left: 300, right: 400, top: 280, bottom: 295 };
    const m = meadowOn(1, card, [text]);
    expect(m.some((p) => p.x + card.left > 300 - 8 && p.x + card.left < 400 + 8)).toBe(false);
    // Text high enough above leaves the grass alone.
    expect(meadowOn(1, card, [{ ...text, bottom: 285 }])).toEqual(meadowOn(1, card, []));
  });

  it('never puts a tuft on top of a shoot', () => {
    const m = meadowOn(3, card, []);
    for (const s of shoots(m)) expect(tufts(m).every((t) => Math.abs(t.x - s.x) >= 7)).toBe(true);
  });

  it('is the same for the same ledge, and different for another', () => {
    expect(meadowOn(1, card, [])).toEqual(meadowOn(1, card, []));
    expect(meadowOn(2, card, [])).not.toEqual(meadowOn(1, card, []));
  });

  it('caps the plants on a page, sharing them across the ledges', () => {
    const floors = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const all = [...reconcileMeadows(floors, []).values()].flat();
    expect(tufts(all).length).toBe(MAX_TUFTS);
    expect(shoots(all).length).toBeLessThanOrEqual(MAX_SHOOTS);
    const kept = reconcileMeadows(floors, []);
    expect([...kept.values()].every((m) => tufts(m).length > 0)).toBe(true);
  });

  it('sways gently, a shoot less than the grass', () => {
    const m = meadowOn(1, card, []);
    const leans = m.flatMap((p) => Array.from({ length: 200 }, (_, i) => Math.abs(leanOf(p, card.left + p.x, i * 97))));
    expect(Math.max(...leans)).toBeLessThanOrEqual(SWAY + 1e-9);
    expect(Math.max(...leans)).toBeGreaterThan(2);
    const s = shoots(m)[0];
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(leanOf(s, card.left + s.x, i * 97))))).toBeLessThanOrEqual(SWAY / 3 + 1e-9);
  });

  it('parts where a moving cursor brushes it, away from the cursor, and springs back', () => {
    const floors = new Map([[1, card]]);
    const meadows = reconcileMeadows(floors, []);
    const near = tufts(meadows.get(1)!)[5];
    const x = card.left + near.x;
    const brushed = brush(meadows, floors, { from: { x: x + 4, y: 290 }, to: { x: x + 6, y: 299 }, at: 1000 }).get(1)!;
    const after = brushed.find((p) => p.key === near.key)!;
    expect(after.at).toBe(1000);
    expect(after.away).toBe(-1);
    expect(leanOf(after, x, 1000)).toBeLessThan(-PART + SWAY + 1e-9);
    expect(Math.abs(leanOf(after, x, 1900))).toBeLessThanOrEqual(SWAY);
    // Far tufts are left alone.
    expect(brushed.filter((p) => p.at === 1000).length).toBeLessThan(5);
    // Kept across a remeasure while it is still there.
    expect(reconcileMeadows(floors, [], new Map([[1, brushed]])).get(1)!.find((p) => p.key === near.key)!.at).toBe(1000);
  });
});
