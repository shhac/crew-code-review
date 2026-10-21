import { walls, wallRuns, type PageMap, type Run } from '../floors';
import { FOOTPRINTS } from './footprints';

// The card sides a bee may fly into, and the knock back off them.

// A card side a bee may fly into: its card, x, the side its air is on, and
// the stretches (px down from the card's top) where a bonk and its bounce
// fit in front of it.
export type WallSide = { floor: number; x: number; side: -1 | 1; top: number; runs: readonly Run[] };

// How far a bonk knocks the bee back off the wall.
export const KNOCK_BACK = 8;
const BONK_DEPTH = FOOTPRINTS.bonk.ahead + FOOTPRINTS.bonk.behind + KNOCK_BACK;
// Kept this far from a card's top and bottom, past its rounded corners.
const CORNER = 16;

// Every wall the page has, with the stretches where its bonk and the bounce
// after it stand clear in front of it (the bonk's box from front to back,
// and the knock back), away from the card's rounded corners.
export function bonksOf(page: PageMap): WallSide[] {
  return walls(page).flatMap((w) => {
    const runs = wallRuns(w, page, BONK_DEPTH, { inset: CORNER });
    return runs.length ? [{ floor: w.floor, x: w.x, side: w.side, top: w.top, runs }] : [];
  });
}
