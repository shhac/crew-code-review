import type { Box, Ledge, PageMap } from '../floors';
import type { Point } from '../pointer';
import type { Rand } from '../seed';
import { reconcileChaff } from './chaff';
import type { Field } from './crows';
import type { Clear } from './flight';

// A page for the crows' tests: a wide card top and two cards below it,
// with straw and grain on every ledge, all air clear unless a test says.
export const card = (left: number, right: number, y: number): Ledge => ({ left, right, y, base: y + 200, room: Infinity, headroom: Infinity, kind: 'card' });
export const PAGE: PageMap = {
  floors: new Map([[1, card(300, 1300, 200)], [2, card(300, 780, 500)], [3, card(820, 1300, 500)]]),
  obstacles: [], width: 1440, height: 900, main: { left: 280, right: 1440, top: 0, bottom: 900 },
};
export const OPEN: Clear = () => true;
export const SHUT: Clear = () => false;
export const envelope = (p: Point): Box => ({ left: p.x - 23, right: p.x + 23, top: p.y - 40, bottom: p.y + 18 });
export const field = (page: PageMap = PAGE, clear: Clear = OPEN): Field => ({ page, chaff: reconcileChaff(page.floors, page.obstacles), clear, envelope });

// A repeatable rand.
export function seeded(seed: number): Rand {
  const state = { n: seed };
  return () => {
    state.n = (state.n * 1664525 + 1013904223) % 4294967296;
    return state.n / 4294967296;
  };
}
