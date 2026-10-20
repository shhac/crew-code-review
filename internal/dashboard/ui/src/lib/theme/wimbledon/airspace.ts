import { airspaceOf, cardReach, EXITS, type Airspace, type Exit } from '../air';
import { CARD_REACH, type PageMap } from '../floors';

// July's air, on the surfaces kit (air.ts's exits, fits and lanes): the
// page's open air with its three exits, past which a bird is out of sight.
// The kit keeps a flier 4px from everything; July's contract (the note's
// "Airspace contract") lets a bird touch the top of the card it stands on,
// takes off from or lands on, and reach 6px into the empty bottom edge of a
// card above, as the ledge animals do: the kit's card reach.
const julyKeepOff = cardReach({ top: 0, bottom: CARD_REACH });

// The air a bird may be in, and the exits it may leave by: the right edge
// and the top always (where main reaches them), the rail's edge where the
// rail is a column (not on a phone, where it is stacked above main).
export const skyOf = (page: PageMap, wanted: readonly Exit[] = EXITS): Airspace => airspaceOf(page, { exits: wanted, keepOff: julyKeepOff });

// Where the fliers are cut off as drawn: at the rail's edge where it is an
// exit, so a bird crossing it passes behind the rail rather than over its
// nav (the rail is never air); nowhere where there is no such exit.
export const clipOf = (sky: Airspace): number | null => sky.exits?.rail ?? null;
