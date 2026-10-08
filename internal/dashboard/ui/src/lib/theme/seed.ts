// A seeded value in [0, 1): small, fast, and the same every time for the same
// n, so decorations keyed by a ledge id stay put across frames and scrolls.
export function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
