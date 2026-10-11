// Pages shared by summer tennis's tests: the overview at 1440, its
// heading's text ending at y 135 and the first row of cards at 182, with
// the band of air between them the pigeons fly out along.
import type { Box, Ledge, Obstacle, PageMap } from '../floors';
import type { Exits } from './flight';

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

// The pigeon's envelopes, as the model has them.
export { ENVELOPES as PIGEON_ENVELOPES } from './pigeon';
