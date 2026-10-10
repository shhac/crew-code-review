// Pages and air shared by summer tennis's tests: the overview at 1440, its
// heading's text ending at y 135 and the first row of cards at 182, with
// the band of air between them the pigeons fly out along.
import { meets } from '../air';
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import type { Exits, Sky } from './flight';

export const MAIN: Box = { left: 236, right: 1440, top: 0, bottom: 1600 };
export const rule: Ledge = { left: 290, right: 1386, y: 158, base: 158, room: 40, headroom: Infinity, kind: 'heading' };
export const board: Ledge = { left: 290, right: 994, y: 182, base: 500, room: 22, headroom: 24, kind: 'card' };
export const side: Ledge = { left: 1014, right: 1386, y: 182, base: 446, room: 22, headroom: 24, kind: 'card' };
// A card in the second row, below the board.
export const lower: Ledge = { left: 290, right: 994, y: 522, base: 800, room: 22, headroom: 22, kind: 'card' };
export const TITLE: Obstacle = { left: 290, right: 487, top: 50, bottom: 110 };
export const SUBTITLE: Obstacle = { left: 290, right: 657, top: 115, bottom: 134 };
export const INPUT: Obstacle = { left: 826, right: 1386, top: 92, bottom: 133 };
const block = (f: Ledge): Obstacle => ({ left: f.left, right: f.right, top: f.y, bottom: f.base, block: true });

export const overview = (extra: readonly Obstacle[] = [], floors: [number, Ledge][] = [[1, rule], [2, board], [3, side], [4, lower]]): PageMap => ({
  floors: new Map(floors),
  obstacles: [TITLE, SUBTITLE, INPUT, ...floors.filter(([, f]) => f.kind === 'card').map(([, f]) => block(f)), ...extra],
  width: 1440,
  height: 900,
  main: MAIN,
});

// The exits at 1440: the rail's edge (main's left) and the window's right.
export const EXITS: Exits = { left: MAIN.left, right: 1440 };

// A stand-in for the kits' air check: what of a box is inside main and the
// window must keep GAP from content and stay out of every card's box but
// its bottom 6px, and nothing goes below the window; anything wholly past
// the rail's edge, the window's right edge or its top is out, and fine.
const GAP = 4;
const REACH = 6;
export function testSky(page: PageMap, exits: Exits = EXITS): Sky {
  const clear = (box: Box) => {
    if (box.bottom > page.height) return false;
    const inside = { left: Math.max(box.left, exits.left ?? (page.main?.left ?? 0)), right: Math.min(box.right, exits.right), top: Math.max(box.top, 0), bottom: box.bottom };
    if (inside.left >= inside.right || inside.top >= inside.bottom) return true;
    return !page.obstacles.some((o) => meets(inside, o.block
      ? { left: o.left, right: o.right, top: o.top, bottom: o.bottom - REACH }
      : { left: o.left - GAP, right: o.right + GAP, top: o.top - GAP, bottom: o.bottom + GAP }));
  };
  return { clear, exits };
}

// The pigeon's envelopes, as the model has them.
export { ENVELOPES as PIGEON_ENVELOPES } from './pigeon';
