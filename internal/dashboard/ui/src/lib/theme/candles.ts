import type { Ledge } from './floors';

// Stubby candles left burning on the page's floors. Where they stand comes
// from the floor's id rather than from chance each frame, so a candle stays
// put on its card as the page scrolls and re-renders, and the same card gets
// the same candles every visit.

export type CandleSpot = { key: string; x: number; y: number; stub: number; beat: number };

// The tallest stub and its flame stand this tall; a floor with less clear
// space above it would put the flame through whatever sits there.
const HEIGHT = 26;
const PER_FLOOR = 2;
const MAX = 5;
// Room each candle wants along a floor, so a short card gets one, not two.
const SPACING = 360;
// Kept off the ends, where the spiders turn and drop.
const MARGIN = 0.1;

// Small, fast, and stable across reloads: a floor id always hashes the same.
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function candleSpots(floors: ReadonlyMap<number, Ledge>, stubs: number): CandleSpot[] {
  const spots = [...floors].flatMap(([id, f]) => {
    if (f.room < HEIGHT) return [];
    const width = f.right - f.left;
    const count = Math.min(PER_FLOOR, Math.floor(width / SPACING));
    // Each candle gets its own slice of the floor, so two never stack.
    const slice = (1 - 2 * MARGIN) / count;
    return Array.from({ length: count }, (_, i) => ({
      key: `${id}:${i}`,
      x: f.left + width * (MARGIN + slice * (i + 0.2 + 0.6 * hash(id * 31 + i))),
      y: f.y,
      stub: Math.floor(hash(id * 17 + i) * stubs),
      beat: 0.9 + hash(id * 7 + i),
    }));
  });
  return spots.slice(0, MAX);
}
