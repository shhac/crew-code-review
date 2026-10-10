import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { MAX_PETALS, petalPath, scatterPetals } from './petals';

const ledge = (left: number, right: number, y: number): Ledge => ({ left, right, y, base: y + 200, room: 40, headroom: Infinity, kind: 'card' });

describe('petals', () => {
  it('lie only where the ledge is clear, never under text', () => {
    const f = ledge(0, 2000, 300);
    const text = { left: 400, right: 900, top: 280, bottom: 298 };
    const petals = scatterPetals(new Map([[1, f]]), [text]).get(1)!;
    expect(petals.length).toBeGreaterThan(0);
    for (const p of petals) expect(p.x + 3 < text.left || p.x - 3 > text.right).toBe(true);
  });

  it('are a few, seeded by ledge id, the same every time', () => {
    const floors = new Map([[3, ledge(0, 1400, 300)], [4, ledge(0, 1400, 500)]]);
    const a = scatterPetals(floors, []);
    expect(scatterPetals(floors, [])).toEqual(a);
    expect(a.get(3)!.map((p) => p.x)).not.toEqual(a.get(4)!.map((p) => p.x));
    // Fewer than one a slot on average: a few, not a carpet.
    expect(a.get(3)!.length).toBeLessThan(1400 / 70 * 1.5);
  });

  it('keep the same places as the ledge scrolls', () => {
    const before = scatterPetals(new Map([[1, ledge(0, 900, 300)]]), []).get(1)!;
    const after = scatterPetals(new Map([[1, ledge(0, 900, 120)]]), []).get(1)!;
    expect(after).toEqual(before);
  });

  it('are capped, shared out a ledge at a time', () => {
    const floors = new Map(Array.from({ length: 12 }, (_, i) => [i + 1, ledge(0, 1400, 100 + i * 60)] as const));
    const all = scatterPetals(floors, []);
    const counts = [...all.values()].map((p) => p.length);
    expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_PETALS);
    expect(counts.at(-1)).toBeGreaterThan(0);
  });

  it('draw small, lying on the ledge', () => {
    const [p] = scatterPetals(new Map([[1, ledge(0, 2000, 300)]]), []).get(1)!;
    const ys = petalPath(p).match(/-?\d+\.\d+/g)!.map(Number).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0);
  });

  it('never hang below the ledge, outline and all, however they are turned', () => {
    const floors = new Map(Array.from({ length: 12 }, (_, i) => [i + 1, ledge(0, 1400, 100 + i * 60)] as const));
    const petals = [...scatterPetals(floors, []).values()].flat();
    expect(new Set(petals.map((p) => Math.round(p.angle))).size).toBeGreaterThan(5);
    for (const p of petals) {
      const ys = petalPath(p).match(/-?\d+\.\d+/g)!.map(Number).filter((_, i) => i % 2 === 1);
      // The outline is 0.5 wide, so its middle stays a quarter above.
      expect(Math.max(...ys)).toBeLessThanOrEqual(-0.25);
    }
  });
});
