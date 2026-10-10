// A dashboard-like page shared by the gulls' tests: a heading over its rule
// (a title, a subtitle and a search box above it), a first row of two cards
// 22px under the rule, a lower card under the wide one, the right-hand
// column empty below its short card, and lines of text in the cards.
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import type { Cursor } from '../pointer';

export const MAIN: Box = { left: 236, right: 1440, top: 0, bottom: 1100 };
export const rule: Ledge = { left: 290, right: 1386, y: 160, base: 160, room: 40, headroom: Infinity, kind: 'heading' };
export const board: Ledge = { left: 290, right: 994, y: 182, base: 500, room: 22, headroom: 22, kind: 'card' };
export const side: Ledge = { left: 1016, right: 1386, y: 182, base: 446, room: 22, headroom: 22, kind: 'card' };
export const lower: Ledge = { left: 290, right: 994, y: 560, base: 800, room: 60, headroom: 60, kind: 'card' };
export const TITLE: Obstacle = { left: 290, right: 487, top: 50, bottom: 110 };
export const SUBTITLE: Obstacle = { left: 290, right: 657, top: 115, bottom: 135 };
export const INPUT: Obstacle = { left: 826, right: 1386, top: 92, bottom: 133 };
export const CARDS: Obstacle[] = [
  { left: 290, right: 994, top: 182, bottom: 500, block: true },
  { left: 1016, right: 1386, top: 182, bottom: 446, block: true },
  { left: 290, right: 994, top: 560, bottom: 800, block: true },
];
// Rows of a table in the wide card, and a few lines in the others.
export const TEXT: Obstacle[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ left: 310, right: 970, top: 204 + i * 28, bottom: 222 + i * 28 })),
  ...Array.from({ length: 6 }, (_, i) => ({ left: 1036, right: 1300, top: 204 + i * 28, bottom: 222 + i * 28 })),
  ...Array.from({ length: 5 }, (_, i) => ({ left: 310, right: 800, top: 582 + i * 28, bottom: 600 + i * 28 })),
];
export const OBSTACLES: Obstacle[] = [TITLE, SUBTITLE, INPUT, ...CARDS, ...TEXT];
export const FLOORS: [number, Ledge][] = [[1, rule], [2, board], [3, side], [4, lower]];

export const page = (obstacles: readonly Obstacle[] = OBSTACLES, floors: [number, Ledge][] = FLOORS, main: Box = MAIN): PageMap =>
  ({ floors: new Map(floors), obstacles, width: 1440, height: 900, main });

// A cursor that last moved at `at`.
export const cursorAt = (x: number, y: number, at = 0): Cursor => ({ x, y, at });
// Open air: below the short card in the right-hand column.
export const OPEN = { x: 1200, y: 620 };
