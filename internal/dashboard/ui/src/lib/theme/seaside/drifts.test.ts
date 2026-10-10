import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { beachOn, driftPath, MAX_SHELLS, reconcileBeaches, shellPaths, windOf } from './drifts';

const card: Ledge = { left: 100, right: 1100, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
// Many ledges' worth, so the seeded odds show.
const many = Array.from({ length: 40 }, (_, i) => beachOn(i + 1, card, []));
const numbers = (d: string) => [...d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
const ys = (d: string) => numbers(d).filter((_, i) => i % 2 === 1);

describe('sand drifts', () => {
  it('lies low along the ledge, 16 to 44px long and 1.5 to 5px high', () => {
    const drifts = many.flatMap((b) => b.drifts);
    expect(drifts.length).toBeGreaterThan(100);
    for (const d of drifts) {
      expect(d.hi - d.lo).toBeGreaterThanOrEqual(16);
      expect(d.hi - d.lo).toBeLessThanOrEqual(44);
      expect(d.height).toBeGreaterThanOrEqual(1.5);
      expect(d.height).toBeLessThanOrEqual(5);
      expect(Math.min(...ys(driftPath(d)))).toBeGreaterThanOrEqual(-5);
      expect(Math.max(...ys(driftPath(d)))).toBeLessThanOrEqual(0);
    }
    // About 55% of the 56px slots.
    const slots = Math.floor((card.right - card.left - 16) / 56);
    expect(drifts.length / (many.length * slots)).toBeGreaterThan(0.4);
    expect(drifts.length / (many.length * slots)).toBeLessThan(0.7);
  });

  it('faces one wind per ledge: a long gentle windward slope and a short steep lee', () => {
    for (const [i, b] of many.entries()) {
      const wind = windOf(i + 1);
      for (const d of b.drifts) {
        const windward = wind === 1 ? d.crest - d.lo : d.hi - d.crest;
        expect(windward).toBeCloseTo(2 * (d.hi - d.lo - windward), 5);
      }
    }
    expect(new Set(many.map((_, i) => windOf(i + 1))).size).toBe(2);
  });

  it('keeps every drift and shell apart and inside the ledge, away from its ends', () => {
    for (const b of many) {
      const spans = [...b.drifts.map((d) => [d.lo, d.hi]), ...b.shells.map((s) => [s.x - s.size / 2, s.x + s.size / 2])].sort((a, z) => a[0] - z[0]);
      expect(spans[0][0]).toBeGreaterThanOrEqual(8);
      expect(spans.at(-1)![1]).toBeLessThanOrEqual(card.right - card.left - 8);
      spans.slice(1).forEach((s, i) => expect(s[0]).toBeGreaterThanOrEqual(spans[i][1] - 0.01));
    }
  });

  it('leaves out the stretch under text that comes down to the ledge', () => {
    const text = { left: 400, right: 520, top: 280, bottom: 296 };
    for (const id of [1, 2, 3, 4, 5]) {
      const b = beachOn(id, card, [text]);
      const spans = [...b.drifts.map((d) => [d.lo, d.hi]), ...b.shells.map((s) => [s.x - s.size / 2, s.x + s.size / 2])];
      expect(spans.some(([lo, hi]) => card.left + hi > text.left && card.left + lo < text.right)).toBe(false);
    }
    // Text well clear of the sand's 6px leaves it be.
    expect(beachOn(1, card, [{ ...text, bottom: 290 }])).toEqual(beachOn(1, card, []));
  });

  it('is the same for the same ledge, and different for another', () => {
    expect(beachOn(1, card, [])).toEqual(beachOn(1, card, []));
    expect(beachOn(2, card, []).sand).not.toEqual(beachOn(1, card, []).sand);
  });

  it('draws a lighter crest and a few darker grains inside the sand', () => {
    const b = many.find((x) => x.grains)!;
    expect(b.crest).toMatch(/^M/);
    for (const d of many.flatMap((x) => x.drifts)) {
      expect(d.grains.length).toBeLessThanOrEqual(3);
      for (const g of d.grains) {
        expect(g.x).toBeGreaterThan(d.lo);
        expect(g.x + 1).toBeLessThan(d.hi);
        expect(g.y).toBeLessThan(0);
        expect(g.y).toBeGreaterThan(-d.height);
      }
    }
  });

  it('washes up a cockle or a winkle, 4 to 5px, at the foot of about one drift in four', () => {
    const shells = many.flatMap((b) => b.shells);
    const drifts = many.flatMap((b) => b.drifts);
    expect(shells.length / drifts.length).toBeGreaterThan(0.15);
    expect(shells.length / drifts.length).toBeLessThan(0.35);
    expect(new Set(shells.map((s) => s.kind))).toEqual(new Set(['cockle', 'winkle']));
    for (const s of shells) {
      expect(s.size).toBeGreaterThanOrEqual(4);
      expect(s.size).toBeLessThanOrEqual(5);
      const { body, lines } = shellPaths(s.kind, s.size);
      expect(Math.min(...ys(body), ...ys(lines))).toBeGreaterThanOrEqual(-s.size);
      expect(Math.max(...ys(body))).toBeLessThanOrEqual(0);
      const xs = numbers(body).filter((_, i) => i % 2 === 0);
      // Within a rounding of its size either way.
      expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(s.size / 2 + 0.05);
    }
  });

  it('caps the shells on a page, sharing them across the ledges', () => {
    const floors = new Map(Array.from({ length: 30 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const beaches = reconcileBeaches(floors, []);
    expect([...beaches.values()].flatMap((b) => b.shells).length).toBe(MAX_SHELLS);
    // Shared out a ledge at a time, so the later ledges are not left bare.
    const withShells = [...floors].filter(([id, f]) => beachOn(id, f, []).shells.length > 0).map(([id]) => id);
    expect(withShells.length).toBeGreaterThan(MAX_SHELLS);
    expect(withShells.slice(0, MAX_SHELLS).every((id) => beaches.get(id)!.shells.length === 1)).toBe(true);
    // The drifts themselves are not capped.
    expect(beaches.get(30)!.drifts).toEqual(beachOn(30, floors.get(30)!, []).drifts);
  });
});
