import { boundsOf, EXITS, fits, type Air, type Exit } from '../air';
import type { Box, Obstacle, PageMap } from '../floors';
import type { Sky } from './flight';

// July's air, on the surfaces kit (air.ts's exits, fits and lanes): the
// page's open air with its three exits, past which a bird is out of sight.
// The kit keeps a flier 4px from everything, cards included; July's
// contract (the note's "Airspace contract") lets a bird touch the top of
// the card it stands on, takes off from or lands on, and reach 6px into the
// empty bottom edge of a card above, as the ledge animals do, so the cards
// are handed to the kit's check trimmed by those amounts.

// How far into a card's empty bottom edge a bird may reach.
const REACH = 6;
// The kit's own gap round each obstacle, undone at a card's top.
const KIT_GAP = 4;

export const julyObstacles = (page: PageMap): Obstacle[] => page.obstacles.map((o) => (o.block
  ? { ...o, top: o.top + KIT_GAP, bottom: o.bottom - REACH - KIT_GAP }
  : o));

// The air a bird may be in, and the exits it may leave by: the right edge
// and the top always (where main reaches them), the rail's edge where the
// rail is a column (not on a phone, where it is stacked above main).
export function skyOf(page: PageMap, wanted: readonly Exit[] = EXITS): Sky {
  const julyPage = { ...page, obstacles: julyObstacles(page) };
  const air: Air = { page: julyPage, spots: [], ...boundsOf(page, wanted) };
  const exits = air.exits ?? {};
  return {
    clear: (box: Box) => fits(air, box),
    exits: { left: exits.rail ?? null, right: exits.right ?? page.width },
    air,
  };
}
