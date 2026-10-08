// A seeded value in [0, 1): small, fast, and the same every time for the same
// n, so decorations keyed by a ledge id stay put across frames and scrolls.
export function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type Rand = () => number;

// A value between lo and hi from rand, which is clamped so a test's stand-in
// returning 0 or 1 lands exactly on the ends.
export const between = (rand: Rand, lo: number, hi: number) => lo + Math.max(0, Math.min(1, rand())) * (hi - lo);
