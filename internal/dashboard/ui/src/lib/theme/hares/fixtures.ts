// A page laid out as the dashboard's are, for the hares' tests: a heading
// rule with its title at the left, and a row of cards 22px below it with
// gaps between them, the first-row clearance a hare has day to day.
import type { Ledge, Obstacle, PageMap } from '../floors';

export const HEADING: Ledge = { left: 300, right: 1300, y: 160, base: 160, room: 60, headroom: Infinity, kind: 'heading' };
export const TITLE: Obstacle = { left: 300, right: 600, top: 100, bottom: 150 };
const card = (left: number, right: number): Ledge => ({ left, right, y: 182, base: 400, room: 22, headroom: 22, kind: 'card' });
export const CARDS = [card(300, 646), card(660, 1006), card(1020, 1300)];
const block = (f: Ledge): Obstacle => ({ left: f.left, right: f.right, top: f.y, bottom: f.base, block: true });

// The page: the heading rule is floor 1, the cards 2, 3 and 4.
export function page(extra: readonly Obstacle[] = [], cards: readonly Ledge[] = CARDS): PageMap {
  const floors = new Map<number, Ledge>([[1, HEADING], ...cards.map((c, i) => [i + 2, c] as const)]);
  return { floors, obstacles: [TITLE, ...cards.map(block), ...extra], width: 1440, height: 900 };
}

// A seeded stand-in for Math.random, so a long run is the same every time.
export function seeded(seed: number): () => number {
  const state = { s: seed };
  return () => {
    state.s = (state.s * 16807) % 2147483647;
    return (state.s - 1) / 2147483646;
  };
}
