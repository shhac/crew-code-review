import { describe, expect, it } from 'vitest';
import { candleSpots } from './candles';

const ledge = (y: number, room: number, left = 0, right = 1000) => ({ left, right, y, base: y + 100, room, headroom: Infinity });

describe('candleSpots', () => {
  it('stands candles only where there is room for the flame', () => {
    const spots = candleSpots(new Map([[1, ledge(200, 40)], [2, ledge(500, 12)]]), 3);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.y === 200)).toBe(true);
  });

  it('keeps each candle on its floor, away from the ends', () => {
    for (const s of candleSpots(new Map([[4, ledge(200, 40, 300, 1100)]]), 3)) {
      expect(s.x).toBeGreaterThan(300 + 80 * 0.99);
      expect(s.x).toBeLessThan(1100 - 80 * 0.99);
    }
  });

  it('puts a candle in the same place every time, and moves it with its floor', () => {
    const before = candleSpots(new Map([[9, ledge(200, 40)]]), 3);
    const scrolled = candleSpots(new Map([[9, ledge(120, 40)]]), 3);
    expect(scrolled.map((s) => s.x)).toEqual(before.map((s) => s.x));
    expect(scrolled.every((s) => s.y === 120)).toBe(true);
  });

  it('gives a narrow card one candle at most, and the page only a few', () => {
    expect(candleSpots(new Map([[1, ledge(200, 40, 0, 400)]]), 3)).toHaveLength(1);
    const many = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, ledge(100 + i * 80, 40)] as const));
    expect(candleSpots(many, 3).length).toBeLessThanOrEqual(5);
  });

  it('does not spend the candle cap on ledges above or below the viewport', () => {
    const offscreen = Array.from({ length: 5 }, (_, i) => [i, ledge(-100 - i * 50, 40)] as const);
    const visible = new Map([...offscreen, [10, ledge(300, 40)], [11, ledge(1400, 40)]]);
    const spots = candleSpots(visible, 3, 800);
    expect(spots).toHaveLength(2);
    expect(spots.every((s) => s.y === 300)).toBe(true);
  });
});
