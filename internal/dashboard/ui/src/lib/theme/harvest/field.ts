import { airspaceOf, cardReach, fitsAir, sweptPath, type Airspace } from '../air';
import { CARD_REACH, reachOf, type Box, type PageMap, type Reach } from '../floors';
import type { Point } from '../pointer';
import type { Chaff } from './chaff';
import { FOOTPRINTS, LOW_FOOTPRINTS, type Footprint } from './crow-rig';
import type { Field } from './crows';
import type { Leg, Piece, Route } from './flight';

// The crows' air (the note's airspace contract): the page's open air, open
// past its top and right edges (the surfaces kit's exits), minus every
// text, control and chart and each card's box shrunk by 6px on every side,
// since a crow may overlap a card's empty edge by as much as a standing
// animal may, never its inside (the kit's card reach). Each piece of a
// route is swept with its own reach: taking off or flaring to land at the
// ledge, skimming its band, or flapping in open air.

// The box every flying pose stays inside, for the bird kit's sweep.
const largest = (...boxes: Footprint[]): Footprint => ({
  width: Math.max(...boxes.map((b) => b.width)), height: Math.max(...boxes.map((b) => b.height)), down: Math.max(...boxes.map((b) => b.down ?? 0)),
});
// A skim's reach holds a low take-off or landing too: each runs on past
// the short hop into the skim (the take-off two beats, the flare its last
// 0.6s).
const SKIMMING = reachOf(largest(FOOTPRINTS.skim, LOW_FOOTPRINTS.takeoff, LOW_FOOTPRINTS.flare));
export const ENVELOPES: Record<Leg, Record<Piece, Reach>> = {
  depart: {
    hop: reachOf(largest(FOOTPRINTS.takeoff, FOOTPRINTS.flap)), lift: reachOf(largest(LOW_FOOTPRINTS.takeoff, FOOTPRINTS.skim)),
    skim: SKIMMING, climb: reachOf(FOOTPRINTS.flap),
  },
  arrive: {
    hop: reachOf(largest(FOOTPRINTS.flare, FOOTPRINTS.settle, FOOTPRINTS.flap)), lift: reachOf(largest(LOW_FOOTPRINTS.flare, LOW_FOOTPRINTS.settle, FOOTPRINTS.skim)),
    skim: SKIMMING, climb: reachOf(FOOTPRINTS.flap),
  },
};

export const crowAir = (page: PageMap): Airspace =>
  airspaceOf(page, { exits: ['top', 'right'], keepOff: cardReach({ top: CARD_REACH, bottom: CARD_REACH, sides: CARD_REACH }) });

// The route's pieces swept with their reaches, the boxes for the debug
// overlay.
export function sweep(route: Route, leg: Leg, clear: (box: Box) => boolean) {
  return sweptPath(route.curves.map((curve, i) => ({ curve, reach: ENVELOPES[leg][route.kinds[i]] })), clear);
}

// Everything the crows are placed against on this page.
export function fieldOf(page: PageMap, chaff: ReadonlyMap<number, Chaff>): Field {
  const inside = fitsAir(crowAir(page));
  const flap = FOOTPRINTS.flap;
  return {
    page, chaff,
    clear: (route, leg) => sweep(route, leg, inside).clear,
    envelope: (p: Point) => ({ left: p.x - flap.width / 2, right: p.x + flap.width / 2, top: p.y - flap.height, bottom: p.y + (flap.down ?? 0) }),
  };
}
