import { walls, wallRuns, type PageMap } from '../floors';
import type { WallSide } from './bee';
import { FOOTPRINTS } from './footprints';

// The card sides a bee may fly into: every wall the page has, with the
// stretches where its bonk and the bounce after it stand clear in front of
// it (the bonk's box from front to back, and the 8px it is knocked back),
// away from the card's rounded corners.
const BOUNCE = 8;
export const BONK_DEPTH = FOOTPRINTS.bonk.ahead + FOOTPRINTS.bonk.behind + BOUNCE;
// Kept this far from a card's top and bottom, past its rounded corners.
const CORNER = 16;

export function bonksOf(page: PageMap): WallSide[] {
  return walls(page).flatMap((w) => {
    const runs = wallRuns(w, page, BONK_DEPTH, { inset: CORNER });
    return runs.length ? [{ floor: w.floor, x: w.x, side: w.side, top: w.top, runs }] : [];
  });
}
