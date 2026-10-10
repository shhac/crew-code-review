// Pages, air and flowers shared by the bees' tests: a dashboard-like page
// in a 1440x900 window, a heading and its rule over two rows of cards with
// text in them, 54px margins either side, and the rail's shelf.
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { beeAirOf, type BeeAir } from './beeair';
import { meadowOf, type Meadow } from './bees';
import { flowersOf } from './flowers';
import { growMoss } from './moss';

export const MAIN: Box = { left: 236, right: 1440, top: 0, bottom: 1400 };
export const RAIL: Box = { left: 0, right: 236, top: 520, bottom: 760 };
export const SHELF: Box = { left: 60, right: 175.5, top: 688, bottom: 760 };
const rule: Ledge = { left: 290, right: 1386, y: 160, base: 160, room: 40, headroom: Infinity, kind: 'heading' };
const card = (left: number, right: number, y: number, base: number, headroom: number): Ledge => ({ left, right, y, base, room: headroom, headroom, kind: 'card' });
export const CARDS = [
  card(290, 830, 182, 420, 22), card(848, 1386, 182, 380, 22),
  card(290, 830, 438, 700, 18), card(848, 1386, 398, 700, 18),
];
export const TITLE: Obstacle = { left: 290, right: 520, top: 60, bottom: 112 };
// Each card's text: a line at its top and a block below, inset 20px.
const text = (c: Ledge): Obstacle[] => [
  { left: c.left + 20, right: c.left + 180, top: c.y + 20, bottom: c.y + 36 },
  { left: c.left + 20, right: c.right - 20, top: c.y + 50, bottom: c.base - 20 },
];
const block = (c: Ledge): Obstacle => ({ left: c.left, right: c.right, top: c.y, bottom: c.base, block: true });

export function dashboard(shift = 0, extra: readonly Obstacle[] = []): PageMap {
  const move = <T extends { top: number; bottom: number }>(b: T): T => ({ ...b, top: b.top + shift, bottom: b.bottom + shift });
  const floors = new Map<number, Ledge>([[1, { ...rule, y: rule.y + shift, base: rule.base + shift }], ...CARDS.map((c, i) => [i + 2, { ...c, y: c.y + shift, base: c.base + shift }] as const)]);
  const obstacles = [TITLE, ...CARDS.flatMap((c) => [block(c), ...text(c)])].map(move);
  return { floors, obstacles: [...obstacles, ...extra], width: 1440, height: 900, main: move(MAIN) };
}

export const airOn = (page: PageMap = dashboard(), rail: Box | null = RAIL): BeeAir => beeAirOf(page, rail);
export function meadowOn(page: PageMap = dashboard(), rail: Box | null = RAIL): Meadow {
  const air = airOn(page, rail);
  return meadowOf(air, flowersOf(growMoss(page.floors, page.obstacles), rail ? SHELF : null));
}
export const cursorAt = (x: number, y: number, at: number): Cursor => ({ x, y, at });
