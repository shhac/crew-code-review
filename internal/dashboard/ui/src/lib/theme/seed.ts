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

// One of items, each equally likely; the clamp in between and the small
// margin keep a stand-in returning exactly 1 on the last item.
export const pick = <T>(rand: Rand, items: readonly T[]): T => items[Math.floor(between(rand, 0, items.length - 0.001))];

// What fn makes of the first of items it makes anything of, trying them in
// order; null for none. fn is not called again once one is found, so what
// it draws from a rand is drawn just as a loop stopping there would draw it.
export const firstOf = <T, U>(items: readonly T[], fn: (item: T, i: number) => U | null): U | null =>
  items.reduce<U | null>((found, item, i) => found ?? fn(item, i), null);

// The item scoring highest, the first of any tie; undefined for none.
export const maxBy = <T>(items: readonly T[], score: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || score(item) > score(best) ? item : best), undefined);
