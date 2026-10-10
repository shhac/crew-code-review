// Pages, air and cursors shared by the cupids' tests: a dashboard-like
// page with a heading, its rule and a row of cards under it.
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { airOf, type Air } from '../air';
import { SPOT } from './footprints';

export const MAIN: Box = { left: 236, right: 1440, top: 0, bottom: 1100 };
// The heading's rule, and two cards below it with 22px up to the rule.
export const rule: Ledge = { left: 290, right: 1386, y: 160, base: 160, room: 40, headroom: Infinity, kind: 'heading' };
export const board: Ledge = { left: 290, right: 994, y: 182, base: 500, room: 22, headroom: 22, kind: 'card' };
export const side: Ledge = { left: 1016, right: 1386, y: 182, base: 446, room: 22, headroom: 22, kind: 'card' };
export const TITLE: Obstacle = { left: 290, right: 487, top: 50, bottom: 110 };
export const SUBTITLE: Obstacle = { left: 290, right: 657, top: 115, bottom: 135 };
export const INPUT: Obstacle = { left: 826, right: 1386, top: 92, bottom: 133 };
export const cards: Obstacle[] = [
  { left: 290, right: 994, top: 182, bottom: 500, block: true },
  { left: 1016, right: 1386, top: 182, bottom: 446, block: true },
];

export const page = (obstacles: readonly Obstacle[] = [TITLE, SUBTITLE, INPUT, ...cards], floors: [number, Ledge][] = [[1, rule], [2, board], [3, side]]): PageMap =>
  ({ floors: new Map(floors), obstacles, width: 1440, height: 900 });
export const airFor = (p: PageMap = page(), main: Box = MAIN): Air => airOf({ ...p, main }, SPOT);
export const still = (x: number, y: number, at = 0): Cursor => ({ x, y, at });
